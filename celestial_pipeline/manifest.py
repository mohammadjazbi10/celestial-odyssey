from __future__ import annotations

import platform
from pathlib import Path

import pandas as pd
from astropy.io import fits

from . import __version__
from .common import utc_now, write_csv, write_json


def _observation_summary(path: Path) -> dict:
    with fits.open(path, memmap=False) as hdus:
        header = hdus[0].header
        lch = hdus[1].header if len(hdus) > 1 else {}
        n = len(hdus[1].data) if len(hdus) > 1 and hdus[1].data is not None else 0
        timedelta = lch.get("TIMEDEL", header.get("TIMEDEL"))
        return {"ra_deg": lch.get("RA_OBJ", header.get("RA_OBJ")),
                "dec_deg": lch.get("DEC_OBJ", header.get("DEC_OBJ")),
                "sector": lch.get("SECTOR", header.get("SECTOR")),
                "provenance": lch.get("AUTHOR", header.get("ORIGIN")),
                "cadence_seconds": float(timedelta) * 86400 if timedelta is not None else None,
                "observation_count": n, "tstart_btjd": lch.get("TSTART"), "tstop_btjd": lch.get("TSTOP"),
                "object_name": lch.get("OBJECT", header.get("OBJECT")),
                "telescope": lch.get("TELESCOP", header.get("TELESCOP"))}


def build_manifest(targets: pd.DataFrame, root: Path, config: dict,
                   failures: list[dict] | None = None) -> tuple[pd.DataFrame, dict]:
    enriched = targets.copy()
    for file_name, key in (("gaia_dr3.csv", "gaia"), ("simbad.csv", "simbad"),
                            ("sector_availability.csv", "sectors")):
        path = root / "catalogs" / file_name
        if path.exists():
            cat = pd.read_csv(path)
            if "tic_id" in cat:
                cols = [c for c in cat.columns if c == "tic_id" or c not in enriched.columns]
                enriched = enriched.merge(cat[cols], on="tic_id", how="left", suffixes=("", f"_{key}"))
    known_path = root / "catalogs" / "known_objects.csv"
    known = pd.read_csv(known_path) if known_path.exists() else pd.DataFrame()
    eb_path = root / "catalogs" / "tess_ebs.csv"
    ebs = pd.read_csv(eb_path) if eb_path.exists() else pd.DataFrame()
    for col, filename in (("known_object_catalog_status", "planets_failure.json"),
                          ("tess_eb_catalog_status", "tess_ebs_failure.json")):
        failed_path = root / "catalogs" / filename
        status = "query_failed" if failed_path.exists() else "queried"
        enriched[col] = status
    enriched["known_object_catalog_provenance"] = "NASA Exoplanet Archive TAP (PS confirmed planets; TOI dispositions)"
    enriched["tess_eb_catalog_provenance"] = "MAST HLSP TESS-EBs v1.0 (Sectors 1-26)"
    if not known.empty:
        confirmed_ids = known.loc[known.object_class.eq("confirmed_planet"), "tic_id"].dropna().unique()
        candidate_ids = known.loc[known.object_class.eq("planet_candidate"), "tic_id"].dropna().unique()
        confirmed_toi_ids = known.loc[known.object_class.eq("confirmed_toi_disposition"), "tic_id"].dropna().unique()
        false_positive_ids = known.loc[known.object_class.eq("false_positive_or_false_alarm"), "tic_id"].dropna().unique()
        enriched["known_planet"] = enriched.tic_id.isin(set(confirmed_ids) | set(confirmed_toi_ids))
        enriched["known_candidate"] = enriched.tic_id.isin(candidate_ids)
        enriched["known_false_positive_toi"] = enriched.tic_id.isin(false_positive_ids)
        if "pl_orbper" in known:
            periods = known.groupby("tic_id").pl_orbper.apply(lambda s: ";".join(str(x) for x in s.dropna()))
            enriched["catalog_periods_days"] = enriched.tic_id.map(periods)
    else:
        enriched["known_planet"] = False
        enriched["known_candidate"] = False
        enriched["known_false_positive_toi"] = False
    enriched["known_eclipsing_binary"] = enriched.tic_id.isin(ebs.tic_id) if "tic_id" in ebs else False
    enriched["known_object_classifications"] = enriched.apply(
        lambda r: ";".join(x for x, ok in (("confirmed_planet", r.get("known_planet", False)),
                                           ("TOI", r.get("known_candidate", False)),
                                           ("false_positive_or_false_alarm", r.get("known_false_positive_toi", False)),
                                           ("eclipsing_binary", r.get("known_eclipsing_binary", False))) if bool(ok)), axis=1)
    explicit_eval = enriched.get("is_evaluation_example", pd.Series(False, index=enriched.index)).fillna(False).astype(bool)
    catalog_eval = enriched.known_planet | enriched.known_candidate | enriched.known_eclipsing_binary
    enriched["is_evaluation_example"] = explicit_eval | catalog_eval
    enriched["split"] = enriched.is_evaluation_example.map({True: "evaluation", False: "train"})
    successes = 0
    observations = 0
    failed = list(failures or [])
    metadata_records = []
    for idx, row in enriched.iterrows():
        tic, sector = int(row.tic_id), int(row.sector)
        fits_path = root / "raw" / f"tic-{tic}" / f"sector-{sector}.fits"
        processed_path = root / "processed" / f"tic-{tic}" / f"sector-{sector}.npz"
        enriched.loc[idx, "fits_path"] = str(fits_path) if fits_path.exists() else ""
        enriched.loc[idx, "processed_path"] = str(processed_path) if processed_path.exists() else ""
        if fits_path.exists():
            try:
                summary = _observation_summary(fits_path)
                successes += 1
                observations += int(summary["observation_count"])
                for k, v in summary.items():
                    enriched.loc[idx, k] = v
                enriched.loc[idx, "download_status"] = "success"
                metadata_records.append({"tic_id": tic, "sector": sector, **summary,
                                         "fits_path": str(fits_path), "processed_path": str(processed_path) if processed_path.exists() else None})
            except Exception as exc:
                failed.append({"tic_id": tic, "sector": sector, "stage": "fits_validation", "error": repr(exc)})
        elif not str(row.get("download_status", "")):
            enriched.loc[idx, "download_status"] = "missing"
    for col, val in (("gaia_match_status", "unattempted"), ("simbad_match_status", "unattempted")):
        if col not in enriched:
            enriched[col] = val
    enriched["available_sectors"] = enriched.get("available_sectors", "")
    if "available_sector_count" not in enriched:
        enriched["available_sector_count"] = 0
    enriched["available_sector_count"] = pd.to_numeric(enriched.available_sector_count, errors="coerce").fillna(0).astype(int)
    write_csv(root / "metadata" / "targets.csv", enriched)
    write_json(root / "metadata" / "target_metadata.json", metadata_records)
    disk_bytes = sum(f.stat().st_size for f in root.rglob("*") if f.is_file())

    def match_counts(file_name: str) -> dict:
        path = root / "catalogs" / file_name
        if not path.exists():
            return {status: 0 for status in ("matched", "no_match", "ambiguous", "query_failed")}
        frame = pd.read_csv(path)
        status_col = "gaia_match_status" if file_name.startswith("gaia") else "simbad_match_status"
        return {status: int(frame[status_col].eq(status).sum()) if status_col in frame else 0
                for status in ("matched", "no_match", "ambiguous", "query_failed")}

    followup_path = root / "metadata" / "followup_downloads.csv"
    followup_count = 0
    if followup_path.exists():
        followup_frame = pd.read_csv(followup_path)
        if "followup_status" in followup_frame:
            followup_count = int(followup_frame.followup_status.eq("downloaded").sum())
    inventory = {
        "generated_at_utc": utc_now(), "pipeline_version": __version__, "python_version": platform.python_version(),
        "data_root": str(root), "requested_targets": int(config.get("count", len(targets))),
        "selected_unique_tics": int(enriched.tic_id.nunique()), "target_rows": int(len(enriched)),
        "successful_fits_downloads": successes, "missing_or_failed_downloads": int(len(enriched) - successes),
        "observation_count_total": observations, "gaia_dr3_match_status_counts": match_counts("gaia_dr3.csv"),
        "simbad_match_status_counts": match_counts("simbad.csv"),
        "confirmed_planet_crossmatch_rows": int(known.object_class.eq("confirmed_planet").sum()) if not known.empty else 0,
        "candidate_crossmatch_rows": int(known.object_class.eq("planet_candidate").sum()) if not known.empty else 0,
        "false_positive_or_false_alarm_rows": int(known.object_class.eq("false_positive_or_false_alarm").sum()) if not known.empty else 0,
        "tess_eb_crossmatch_rows": int(len(ebs)), "targets_with_available_followup": int((enriched.available_sector_count > 1).sum()),
        "followup_light_curves_downloaded": followup_count,
        "disk_usage_bytes": disk_bytes, "disk_usage_gib": round(disk_bytes / (1024 ** 3), 6),
        "failures": failed, "config": config,
    }
    write_json(root / "metadata" / "manifest.json", inventory)
    return enriched, inventory
