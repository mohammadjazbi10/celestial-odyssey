from __future__ import annotations

import logging
import time
from pathlib import Path

import pandas as pd
from astropy import units as u
from astropy.coordinates import SkyCoord
from astroquery.gaia import Gaia
from astroquery.simbad import Simbad

from .common import log_event, retry, utc_now, write_csv


GAIA_COLUMNS = ["source_id", "ra", "dec", "parallax", "parallax_error", "pmra", "pmdec",
                "phot_g_mean_mag", "phot_bp_mean_mag", "phot_rp_mean_mag", "teff_gspphot",
                "logg_gspphot", "mh_gspphot", "ruwe", "non_single_star"]


def _coordinate(row) -> SkyCoord:
    return SkyCoord(float(row.ra_deg) * u.deg, float(row.dec_deg) * u.deg, frame="icrs")


def _nearest_ambiguity(matches: list[dict], radius_arcsec: float, tie_arcsec: float) -> dict:
    matches = sorted(matches, key=lambda x: x["match_distance_arcsec"])
    if not matches:
        return {"match_status": "no_match", "match_ambiguous": False, "match_distance_arcsec": None,
                "match_candidate_count": 0, "match_tie_delta_arcsec": None}
    nearest = matches[0]
    delta = matches[1]["match_distance_arcsec"] - nearest["match_distance_arcsec"] if len(matches) > 1 else None
    ambiguous = delta is not None and delta <= tie_arcsec
    nearest.update({"match_status": "ambiguous" if ambiguous else "matched",
                    "match_ambiguous": ambiguous, "match_candidate_count": len(matches),
                    "match_tie_delta_arcsec": delta, "search_radius_arcsec": radius_arcsec})
    return nearest


def crossmatch_gaia(targets: pd.DataFrame, root: Path, radius_arcsec: float = 2.0,
                    tie_arcsec: float = 0.25, logger: logging.Logger | None = None) -> pd.DataFrame:
    """Gaia DR3 cone search per TIC; cache individual query results and never suppress near ties."""
    Gaia.MAIN_GAIA_TABLE = "gaiadr3.gaia_source"
    cache_dir = root / "cache" / "gaia"
    cache_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for target in targets.itertuples(index=False):
        path = cache_dir / f"tic-{int(target.tic_id)}.csv"
        try:
            if path.exists():
                found = pd.read_csv(path).to_dict("records") if path.stat().st_size > 5 else []
            else:
                coord = _coordinate(target)
                job = retry(lambda: Gaia.cone_search_async(coord, radius=radius_arcsec * u.arcsec),
                            logger=logger, label=f"Gaia DR3 TIC {target.tic_id}")
                table = retry(job.get_results, logger=logger, label=f"Gaia DR3 result TIC {target.tic_id}")
                found = table.to_pandas().to_dict("records")
                pd.DataFrame(found).to_csv(path, index=False)
                time.sleep(0.15)
            coord = _coordinate(target)
            candidates = []
            for item in found:
                if "ra" not in item or "dec" not in item or pd.isna(item.get("ra")) or pd.isna(item.get("dec")):
                    continue
                sep = float(coord.separation(SkyCoord(float(item["ra"]) * u.deg, float(item["dec"]) * u.deg)).arcsec)
                rec = {"tic_id": int(target.tic_id), "gaia_dr3_source_id": item.get("source_id"),
                       "gaia_ra_deg": item.get("ra"), "gaia_dec_deg": item.get("dec"),
                       "match_distance_arcsec": sep, "catalog": "Gaia DR3", "catalog_retrieved_at_utc": utc_now(),
                       "catalog_provenance": "ESA Gaia DR3 TAP through astroquery.gaia.Gaia.cone_search_async"}
                for col in GAIA_COLUMNS:
                    rec[f"gaia_{col}"] = item.get(col)
                candidates.append(rec)
            annotated = _nearest_ambiguity(candidates, radius_arcsec, tie_arcsec)
            row = {"tic_id": int(target.tic_id), **annotated}
            row["gaia_match_distance_arcsec"] = row.get("match_distance_arcsec")
            row["gaia_candidate_source_ids"] = ";".join(str(x.get("gaia_dr3_source_id")) for x in candidates)
            row["gaia_candidate_distances_arcsec"] = ";".join(str(x.get("match_distance_arcsec")) for x in candidates)
            if annotated["match_status"] == "ambiguous":
                row["gaia_dr3_source_id"] = None
            row["gaia_match_status"] = row.pop("match_status")
            row["gaia_match_ambiguous"] = row.pop("match_ambiguous")
            rows.append(row)
        except Exception as exc:
            rows.append({"tic_id": int(target.tic_id), "gaia_match_status": "query_failed", "gaia_match_ambiguous": False,
                         "match_error": repr(exc), "catalog": "Gaia DR3", "catalog_retrieved_at_utc": utc_now()})
            if logger:
                log_event(logger, "catalog_failure", catalog="Gaia DR3", tic_id=int(target.tic_id), error=repr(exc))
    frame = pd.DataFrame(rows)
    write_csv(root / "catalogs" / "gaia_dr3.csv", frame)
    return frame


def crossmatch_simbad(targets: pd.DataFrame, root: Path, radius_arcsec: float = 3.0,
                      tie_arcsec: float = 0.25, logger: logging.Logger | None = None) -> pd.DataFrame:
    cache_dir = root / "cache" / "simbad"
    cache_dir.mkdir(parents=True, exist_ok=True)
    simbad = Simbad()
    simbad.server = "simbad.harvard.edu"
    simbad.add_votable_fields("otype", "sp", "flux(V)", "parallax", "propermotions")
    rows = []
    for target in targets.itertuples(index=False):
        path = cache_dir / f"tic-{int(target.tic_id)}.csv"
        try:
            if path.exists():
                found = pd.read_csv(path).to_dict("records") if path.stat().st_size > 5 else []
            else:
                result = retry(lambda: simbad.query_region(_coordinate(target), radius=radius_arcsec * u.arcsec),
                               logger=logger, label=f"SIMBAD TIC {target.tic_id}")
                found = [] if result is None else result.to_pandas().to_dict("records")
                pd.DataFrame(found).to_csv(path, index=False)
                time.sleep(0.4)
            coord = _coordinate(target)
            candidates = []
            for item in found:
                ra = item.get("ra", item.get("RA"))
                dec = item.get("dec", item.get("DEC"))
                if ra is None or dec is None or pd.isna(ra) or pd.isna(dec):
                    continue
                try:
                    obj = SkyCoord(str(ra), str(dec), unit=(u.hourangle, u.deg), frame="icrs")
                except Exception:
                    obj = SkyCoord(float(ra) * u.deg, float(dec) * u.deg, frame="icrs")
                sep = float(coord.separation(obj).arcsec)
                candidates.append({"tic_id": int(target.tic_id), "simbad_main_id": str(item.get("main_id")),
                                  "simbad_otype": str(item.get("otype")),
                                  "simbad_sp_type": str(item.get("sp", item.get("sp_type"))),
                                  "match_distance_arcsec": sep, "simbad_ra": str(ra), "simbad_dec": str(dec),
                                  "catalog": "SIMBAD", "catalog_retrieved_at_utc": utc_now(),
                                  "catalog_provenance": "CDS SIMBAD TAP through astroquery.simbad.query_region"})
            annotated = _nearest_ambiguity(candidates, radius_arcsec, tie_arcsec)
            if annotated["match_status"] == "ambiguous":
                annotated["simbad_main_id"] = None
                annotated["simbad_otype"] = None
            row = {"tic_id": int(target.tic_id), **annotated}
            row["simbad_match_distance_arcsec"] = row.get("match_distance_arcsec")
            row["simbad_candidate_ids"] = ";".join(str(x.get("simbad_main_id")) for x in candidates)
            row["simbad_candidate_distances_arcsec"] = ";".join(str(x.get("match_distance_arcsec")) for x in candidates)
            row["simbad_match_status"] = row.pop("match_status")
            row["simbad_match_ambiguous"] = row.pop("match_ambiguous")
            rows.append(row)
        except Exception as exc:
            rows.append({"tic_id": int(target.tic_id), "simbad_match_status": "query_failed", "simbad_match_ambiguous": False,
                         "match_error": repr(exc), "catalog": "SIMBAD", "catalog_retrieved_at_utc": utc_now()})
            if logger:
                log_event(logger, "catalog_failure", catalog="SIMBAD", tic_id=int(target.tic_id), error=repr(exc))
    frame = pd.DataFrame(rows)
    write_csv(root / "catalogs" / "simbad.csv", frame)
    return frame
