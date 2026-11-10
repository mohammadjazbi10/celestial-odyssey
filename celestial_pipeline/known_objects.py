from __future__ import annotations

import logging
import time
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from astropy import units as u
from astropy.coordinates import SkyCoord

from .common import log_event, retry, utc_now, write_csv


NEA_TAP = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
TESS_EB_URL = "https://archive.stsci.edu/hlsps/tess-ebs/hlsp_tess-ebs_tess_lcf-ffi_s0001-s0026_tess_v1.0_cat.csv"


def _tap_table(root: Path, table: str, query: str, logger=None) -> pd.DataFrame:
    path = root / "cache" / f"nea_{table}.csv"
    if path.exists():
        return pd.read_csv(path)
    def fetch():
        response = requests.get(NEA_TAP, params={"query": query, "format": "csv"}, timeout=120)
        response.raise_for_status()
        if "<html" in response.text[:500].lower() or "error" == response.text[:20].strip().lower():
            raise RuntimeError(f"NASA Exoplanet Archive returned an error for {table}: {response.text[:500]}")
        from io import StringIO
        frame = pd.read_csv(StringIO(response.text))
        if frame.empty and "pl_name" not in frame.columns and "toi" not in frame.columns:
            raise RuntimeError(f"Unexpected empty/malformed NASA Exoplanet Archive response for table {table}")
        frame.to_csv(path, index=False)
        return frame
    return retry(fetch, logger=logger, label=f"NASA Exoplanet Archive TAP {table}")


def _coords_match(targets: pd.DataFrame, catalog: pd.DataFrame, ra_col: str, dec_col: str,
                  radius_arcsec: float, label: str) -> pd.DataFrame:
    cat = catalog.copy()
    cat[ra_col] = pd.to_numeric(cat[ra_col], errors="coerce")
    cat[dec_col] = pd.to_numeric(cat[dec_col], errors="coerce")
    cat = cat.dropna(subset=[ra_col, dec_col])
    if cat.empty:
        return pd.DataFrame(columns=["tic_id", "catalog", "match_distance_arcsec"])
    coords = SkyCoord(cat[ra_col].to_numpy() * u.deg, cat[dec_col].to_numpy() * u.deg)
    out = []
    for target in targets.itertuples(index=False):
        tcoord = SkyCoord(float(target.ra_deg) * u.deg, float(target.dec_deg) * u.deg)
        sep = tcoord.separation(coords).arcsec
        indices = np.where(sep <= radius_arcsec)[0]
        for i in indices:
            record = cat.iloc[int(i)].to_dict()
            record.update({"tic_id": int(target.tic_id), "catalog": label,
                           "match_distance_arcsec": float(sep[int(i)]), "catalog_retrieved_at_utc": utc_now()})
            out.append(record)
    return pd.DataFrame(out)


def crossmatch_planets(targets: pd.DataFrame, root: Path, radius_arcsec: float = 5.0,
                       logger: logging.Logger | None = None) -> pd.DataFrame:
    # Planetary Systems (confirmed) and TOI (candidate/false-positive dispositions) remain distinct.
    confirmed_query = "select pl_name, hostname, ra, dec, pl_orbper, default_flag, soltype from ps where upper(soltype) like '%CONF%'"
    candidate_query = "select toi, tid, tfopwg_disp, ra, dec, pl_orbper from toi"
    confirmed = _tap_table(root, "ps", confirmed_query, logger)
    candidates = _tap_table(root, "toi", candidate_query, logger)
    confirmed_rows = _coords_match(targets, confirmed, "ra", "dec", radius_arcsec, "NASA Exoplanet Archive PS")
    candidate_rows = _coords_match(targets, candidates, "ra", "dec", radius_arcsec, "NASA Exoplanet Archive TOI")
    if not confirmed_rows.empty:
        confirmed_rows["object_class"] = "confirmed_planet"
        confirmed_rows["catalog_table"] = "PS"
        confirmed_rows["catalog_provenance"] = f"NASA Exoplanet Archive TAP: {NEA_TAP}; table ps"
    if not candidate_rows.empty:
        def toi_class(disposition):
            value = str(disposition).strip().upper()
            if value in {"PC", "APC"}:
                return "planet_candidate"
            if value in {"CP", "KP"}:
                return "confirmed_toi_disposition"
            if value in {"FP", "FA"}:
                return "false_positive_or_false_alarm"
            return "other_toi_disposition"
        candidate_rows["object_class"] = candidate_rows.tfopwg_disp.map(toi_class)
        candidate_rows["catalog_table"] = "TOI"
        candidate_rows["catalog_provenance"] = f"NASA Exoplanet Archive TAP: {NEA_TAP}; table toi; tfopwg_disp retained and classified"
    frame = pd.concat([confirmed_rows, candidate_rows], ignore_index=True, sort=False)
    if frame.empty:
        frame = pd.DataFrame(columns=["tic_id", "catalog", "match_distance_arcsec", "catalog_retrieved_at_utc",
                                      "object_class", "catalog_table", "catalog_provenance", "pl_name", "toi",
                                      "tfopwg_disp", "pl_orbper"])
    write_csv(root / "catalogs" / "known_objects.csv", frame)
    return frame


def crossmatch_tess_ebs(targets: pd.DataFrame, root: Path, radius_arcsec: float = 5.0,
                        logger: logging.Logger | None = None) -> pd.DataFrame:
    cache = root / "cache" / "tess_ebs.csv"
    if cache.exists():
        catalog = pd.read_csv(cache)
    else:
        def fetch():
            response = requests.get(TESS_EB_URL, timeout=120)
            response.raise_for_status()
            from io import StringIO
            frame = pd.read_csv(StringIO(response.text))
            if frame.empty or "tess_id" not in frame.columns:
                raise RuntimeError("TESS-EB catalog response did not contain expected tess_id column")
            frame.to_csv(cache, index=False)
            return frame
        catalog = retry(fetch, logger=logger, label="MAST TESS-EBs public catalog")
    if "tess_id" in catalog:
        catalog["tic_id"] = pd.to_numeric(catalog.tess_id, errors="coerce")
    tic_exact = targets[["tic_id"]].merge(catalog, on="tic_id", how="inner") if "tic_id" in catalog else pd.DataFrame()
    frames = []
    if not tic_exact.empty:
        tic_exact["match_distance_arcsec"] = 0.0
        tic_exact["match_method"] = "TIC identifier exact cross-reference"
        frames.append(tic_exact)
    # Positional fallback only when the catalog carries coordinate columns; all candidates retain match separation.
    ra_col = next((c for c in ("ra", "RA", "ra_deg") if c in catalog), None)
    dec_col = next((c for c in ("dec", "DEC", "dec_deg") if c in catalog), None)
    if ra_col and dec_col:
        positional = _coords_match(targets, catalog, ra_col, dec_col, radius_arcsec, "MAST TESS-EBs")
        if not positional.empty:
            positional["match_method"] = "sky coordinate"
            already = set(tic_exact.tic_id.astype(int)) if not tic_exact.empty else set()
            frames.append(positional[~positional.tic_id.isin(already)])
    frame = pd.concat(frames, ignore_index=True, sort=False) if frames else pd.DataFrame(columns=["tic_id", "match_distance_arcsec"])
    if not frame.empty:
        frame["object_class"] = "eclipsing_binary_catalog_entry"
        frame["catalog_table"] = "TESS-EBs v1.0 (Sectors 1-26)"
        frame["catalog_provenance"] = f"MAST HLSP TESS-EBs: {TESS_EB_URL}"
        frame["catalog_retrieved_at_utc"] = utc_now()
    write_csv(root / "catalogs" / "tess_ebs.csv", frame)
    return frame
