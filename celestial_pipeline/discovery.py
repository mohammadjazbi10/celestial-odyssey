from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd
from astroquery.mast import Observations
from lightkurve import search_lightcurve

from .common import log_event, retry, utc_now, write_csv


def discover_spoc_targets(sector: int, count: int, seed: int, root: Path,
                          eval_tics: set[int] | None = None,
                          logger: logging.Logger | None = None) -> pd.DataFrame:
    """Query MAST for unique TESS SPOC 120-second targets in one sector."""
    eval_tics = eval_tics or set()
    cache = root / "cache" / f"spoc_sector_{sector}_observations.csv"
    if cache.exists():
        observations = pd.read_csv(cache)
    else:
        table = retry(lambda: Observations.query_criteria(
            obs_collection="TESS", dataproduct_type="timeseries",
            sequence_number=sector, provenance_name="SPOC", t_exptime=[119.0, 121.0]
        ), logger=logger, label=f"MAST sector {sector} SPOC 120s discovery")
        observations = table.to_pandas()
        write_csv(cache, observations)
    if observations.empty:
        raise RuntimeError(f"MAST returned no SPOC 120-second observations for sector {sector}.")
    # Defense in depth: archive criteria have changed names/units in the past.
    if "provenance_name" in observations:
        observations = observations[observations.provenance_name.astype(str).str.upper().eq("SPOC")]
    if "sequence_number" in observations:
        observations = observations[pd.to_numeric(observations.sequence_number, errors="coerce").eq(sector)]
    if "t_exptime" in observations:
        exp = pd.to_numeric(observations.t_exptime, errors="coerce")
        observations = observations[exp.between(119.0, 121.0)]
    target_text = observations.get("target_name", pd.Series(index=observations.index, dtype=object)).astype(str)
    observations["tic_id"] = pd.to_numeric(target_text.str.extract(r"(?i)TIC\s*(\d+)", expand=False), errors="coerce")
    numeric_target = pd.to_numeric(target_text, errors="coerce")
    observations["tic_id"] = observations.tic_id.fillna(numeric_target)
    observations = observations.dropna(subset=["tic_id"]).copy()
    observations["tic_id"] = observations.tic_id.astype("int64")
    observations["ra_deg"] = pd.to_numeric(observations.get("s_ra"), errors="coerce")
    observations["dec_deg"] = pd.to_numeric(observations.get("s_dec"), errors="coerce")
    observations = observations.dropna(subset=["ra_deg", "dec_deg"])
    observations = observations.drop_duplicates("tic_id")
    if len(observations) < count:
        raise RuntimeError(f"Only {len(observations)} unique SPOC 120-second TIC targets are available in sector {sector}; {count} requested.")
    rng = np.random.default_rng(seed)
    permutation = rng.permutation(len(observations))
    observations = observations.iloc[permutation].reset_index(drop=True)
    eligible = observations[~observations.tic_id.isin(eval_tics)]
    eval_rows = observations[observations.tic_id.isin(eval_tics)].copy()
    random_count = count - len(eval_rows)
    if random_count < 0:
        raise RuntimeError(f"Evaluation list has {len(eval_rows)} targets, more than requested total {count}.")
    if len(eligible) < random_count:
        raise RuntimeError(f"Only {len(eligible)} random-sample targets remain after holding out evaluation TICs; {random_count} requested.")
    chosen = eligible.head(random_count).copy()
    chosen["sector"] = sector
    chosen["sample_seed"] = seed
    chosen["is_evaluation_example"] = False
    chosen["split"] = "train"
    if len(eval_rows):
        eval_rows["sector"] = sector
        eval_rows["sample_seed"] = seed
        eval_rows["is_evaluation_example"] = True
        eval_rows["split"] = "evaluation"
        chosen = pd.concat([chosen, eval_rows], ignore_index=True)
    chosen["discovery_provenance"] = "MAST Observations API; TESS/SPOC; 120 s"
    chosen["discovered_at_utc"] = utc_now()
    if logger:
        log_event(logger, "discovery_complete", sector=sector, unique_available=len(observations), sampled=count,
                  evaluation_targets=int(chosen.is_evaluation_example.sum()))
    return chosen.reset_index(drop=True)


def download_sector_lightcurve(tic_id: int, sector: int, root: Path,
                               logger: logging.Logger | None = None) -> tuple[Path, object]:
    """Find exact 2-minute SPOC product; Lightkurve manages archive cache/download."""
    target_dir = root / "raw" / f"tic-{tic_id}"
    target_dir.mkdir(parents=True, exist_ok=True)
    expected = target_dir / f"sector-{sector}.fits"
    if expected.exists() and expected.stat().st_size > 0:
        from astropy.io import fits
        with fits.open(expected, memmap=False) as hdus:
            if "TIME" in hdus[1].columns.names and "PDCSAP_FLUX" in hdus[1].columns.names:
                from lightkurve import TessLightCurve
                # Read through the public Lightkurve FITS reader for downstream consistency.
                lc = TessLightCurve.read(expected)
                return expected, lc
    result = retry(lambda: search_lightcurve(f"TIC {tic_id}", mission="TESS", author="SPOC",
                                             sector=sector, exptime=120),
                   logger=logger, label=f"Lightkurve search TIC {tic_id} sector {sector}")
    if len(result) == 0:
        raise RuntimeError(f"No SPOC 120-second Lightkurve product found for TIC {tic_id}, sector {sector}.")
    # Select precisely the matching cadence and sector if the archive returned variants.
    candidates = [row for row in result if abs(float(np.asarray(row.exptime.value).reshape(-1)[0]) - 120.0) < 1.0]
    if not candidates:
        raise RuntimeError(f"MAST product search returned no 120-second product for TIC {tic_id}, sector {sector}.")
    lc = retry(lambda: candidates[0].download(download_dir=str(target_dir), cache=True),
               logger=logger, label=f"Lightkurve download TIC {tic_id} sector {sector}")
    source = Path(str(getattr(lc, "filename", ""))) if getattr(lc, "filename", None) else None
    if source is None or not source.exists():
        # Lightkurve product downloads use the MAST cache; locate only the product just downloaded.
        fits_files = sorted(target_dir.rglob("*.fits"), key=lambda p: p.stat().st_mtime, reverse=True)
        if not fits_files:
            raise RuntimeError("Lightkurve downloaded a curve but exposed no corresponding FITS file path.")
        source = fits_files[0]
    if source.resolve() != expected.resolve():
        source.replace(expected)
    if logger:
        log_event(logger, "download_complete", tic_id=tic_id, sector=sector, path=str(expected), bytes=expected.stat().st_size)
    return expected, lc
