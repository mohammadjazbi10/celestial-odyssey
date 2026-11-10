from __future__ import annotations

import logging
import time
from pathlib import Path

import pandas as pd
from astroquery.mast import Observations

from .common import log_event, retry, write_csv
from .discovery import download_sector_lightcurve


def discover_followup_sectors(targets: pd.DataFrame, root: Path,
                              logger: logging.Logger | None = None) -> pd.DataFrame:
    cache = root / "cache" / "followup_sector_observations.csv"
    if cache.exists():
        observations = pd.read_csv(cache)
        failures_path = root / "cache" / "followup_sector_failures.csv"
        failures = pd.read_csv(failures_path) if failures_path.exists() and failures_path.stat().st_size > 5 else pd.DataFrame()
        existing_availability = root / "catalogs" / "sector_availability.csv"
        if existing_availability.exists():
            old = pd.read_csv(existing_availability)
            completed = set(pd.to_numeric(old.loc[old.followup_query_status.eq("queried"), "tic_id"], errors="coerce").dropna().astype(int)) if "followup_query_status" in old else set()
        else:
            completed = set()
        failed_ids = set(pd.to_numeric(failures.get("tic_id", pd.Series(dtype=int)), errors="coerce").dropna().astype(int)) if not failures.empty else set()
        missing_targets = targets[~targets.tic_id.astype(int).isin(completed - failed_ids)]
    else:
        observations = pd.DataFrame(columns=["tic_id", "sequence_number", "obs_collection", "provenance_name", "t_exptime"])
        failures = pd.DataFrame()
        missing_targets = targets
    if not missing_targets.empty:
        tables = [observations] if not observations.empty else []
        prior_failures = failures.to_dict("records") if not failures.empty else []
        failed_rows = []
        for target in missing_targets.itertuples(index=False):
            try:
                table = retry(lambda: Observations.query_criteria(
                    obs_collection="TESS", dataproduct_type="timeseries", target_name=str(int(target.tic_id)),
                    provenance_name="SPOC", t_exptime=[119.0, 121.0]), logger=logger,
                    label=f"follow-up sectors TIC {target.tic_id}")
                if len(table):
                    part = table.to_pandas()
                    part["tic_id"] = int(target.tic_id)
                    tables.append(part)
                time.sleep(0.15)
            except Exception as exc:
                failed_rows.append({"tic_id": int(target.tic_id), "error": repr(exc)})
                if logger:
                    log_event(logger, "followup_discovery_failure", tic_id=int(target.tic_id), error=repr(exc))
        observations = pd.concat(tables, ignore_index=True) if tables else pd.DataFrame(
            columns=["tic_id", "sequence_number", "obs_collection", "provenance_name", "t_exptime"])
        write_csv(cache, observations)
        combined_failures = [row for row in prior_failures if int(row["tic_id"]) not in set(missing_targets.tic_id.astype(int))]
        failures = pd.DataFrame(combined_failures + failed_rows)
        write_csv(root / "cache" / "followup_sector_failures.csv", failures)
    rows = []
    for target in targets.itertuples(index=False):
        subset = observations[pd.to_numeric(observations.get("tic_id"), errors="coerce") == int(target.tic_id)] if not observations.empty else pd.DataFrame()
        sectors = sorted(set(pd.to_numeric(subset.get("sequence_number"), errors="coerce").dropna().astype(int))) if not subset.empty else []
        query_failed = not failures.empty and int(target.tic_id) in set(pd.to_numeric(failures.tic_id, errors="coerce").dropna().astype(int))
        rows.append({"tic_id": int(target.tic_id), "available_sectors": ";".join(map(str, sectors)),
                     "available_sector_count": len(sectors), "followup_catalog_provenance": "MAST Observations API TESS/SPOC 120 s"})
        rows[-1]["followup_query_status"] = "query_failed" if query_failed else "queried"
    result = pd.DataFrame(rows)
    write_csv(root / "catalogs" / "sector_availability.csv", result)
    return result


def download_followup(targets: pd.DataFrame, availability: pd.DataFrame, root: Path, limit: int = 20,
                      logger: logging.Logger | None = None) -> pd.DataFrame:
    frame = targets.merge(availability, on="tic_id", how="left")
    frame["priority_score"] = frame.get("known_planet", pd.Series(False, index=frame.index)).fillna(False).astype(int) * 100 + \
        frame.get("known_candidate", pd.Series(False, index=frame.index)).fillna(False).astype(int) * 50 + \
        frame.get("known_eclipsing_binary", pd.Series(False, index=frame.index)).fillna(False).astype(int) * 75 + \
        pd.to_numeric(frame.available_sector_count, errors="coerce").fillna(0)
    frame = frame.sort_values(["priority_score", "tic_id"], ascending=[False, True]).head(limit)
    downloaded = []
    for target in frame.itertuples(index=False):
        sectors = [int(s) for s in str(target.available_sectors).split(";") if s and int(s) != int(target.sector)]
        if not sectors:
            downloaded.append({"tic_id": int(target.tic_id), "followup_status": "no_additional_sector"})
            continue
        sector = sectors[0]
        try:
            path, _ = download_sector_lightcurve(int(target.tic_id), sector, root, logger)
            downloaded.append({"tic_id": int(target.tic_id), "followup_sector": sector,
                               "followup_fits_path": str(path), "followup_status": "downloaded"})
        except Exception as exc:
            downloaded.append({"tic_id": int(target.tic_id), "followup_sector": sector,
                               "followup_status": "failed", "error": repr(exc)})
    result = pd.DataFrame(downloaded)
    write_csv(root / "metadata" / "followup_downloads.csv", result)
    return result
