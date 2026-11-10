from __future__ import annotations

import csv
import json
import math
import os
import re
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import numpy as np
from dotenv import load_dotenv
from fastapi import Body, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import gemma
from .casefiles import render_pdf
from .data_access import load_npz
from .persistence import read_records, write_records
from .predictions import next_events
from .science_tools import compare_sap_pdcsap, fold_curve, quality_summary


PROJECT_ROOT = Path(os.environ.get("POLARIX_PROJECT_ROOT", Path(__file__).resolve().parents[1])).resolve()
load_dotenv(PROJECT_ROOT / ".env", override=False)
DATA_ROOT = Path(os.environ.get("POLARIX_DATA_ROOT", PROJECT_ROOT / "data")).resolve()
ML_LIGHTCURVE_ROOT = Path(os.environ.get("POLARIX_LIGHTCURVE_ROOT", PROJECT_ROOT / "lightcurves")).resolve()
STATE_ROOT = DATA_ROOT / "metadata"
INVESTIGATIONS_PATH = STATE_ROOT / "polarix_investigations.json"
PREDICTIONS_PATH = STATE_ROOT / "polarix_predictions.json"


class InvestigationCreate(BaseModel):
    candidate_id: str
    hypothesis: str = ""
    notes: str = ""


class InvestigationPatch(BaseModel):
    title: str | None = Field(default=None, max_length=160)
    hypothesis: str | None = Field(default=None, max_length=1000)
    notes: str | None = Field(default=None, max_length=12000)
    status: str | None = Field(default=None, max_length=40)
    mission_progress: dict[str, Any] | None = None


class ChatMessage(BaseModel):
    message: str = Field(min_length=1, max_length=5000)


class ScienceToolRequest(BaseModel):
    arguments: dict[str, Any] = Field(default_factory=dict)


class PredictionReview(BaseModel):
    status: Literal["awaiting", "supported", "contradicted"]
    review_note: str = Field(default="", max_length=2000)

app = FastAPI(title="POLARIX real data API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get(
        "POLARIX_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["*"],
)


def _parse_cell(value: str | None) -> Any:
    if value is None or value == "":
        return None
    text = value.strip()
    if text.lower() in {"nan", "none", "null", "nat"}:
        return None
    if text.lower() == "true":
        return True
    if text.lower() == "false":
        return False
    try:
        number = float(text)
        if not math.isfinite(number):
            return None
        return int(number) if number.is_integer() else number
    except ValueError:
        return text


def _read_csv(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [{key: _parse_cell(value) for key, value in row.items()} for row in csv.DictReader(handle)]


def _read_json(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, dict):
        payload = payload.get("candidates", [])
    return payload if isinstance(payload, list) else []


def _tic(row: dict[str, Any]) -> str:
    value = row.get("tic_id")
    return str(value).removeprefix("TIC ").strip() if value is not None else ""


def _normalize_tic_id(value: Any) -> str:
    tic_id = str(value or "").strip()
    if tic_id.upper().startswith("TIC "):
        tic_id = tic_id[4:].strip()
    return tic_id


def _sector(row: dict[str, Any]) -> int | None:
    try:
        return int(row["sector"]) if row.get("sector") is not None else None
    except (ValueError, TypeError):
        return None


def _indexed(rows: list[dict[str, Any]], key: str = "tic_id") -> dict[str, dict[str, Any]]:
    indexed: dict[str, dict[str, Any]] = {}
    for row in rows:
        if row.get(key) is None:
            continue
        identifier = str(row[key])
        indexed.setdefault(identifier, row)
        sector = _sector(row)
        if sector is not None:
            indexed[f"{identifier}:{sector}"] = row
    return indexed


def _linked(index: dict[str, dict[str, Any]], tic_id: str, sector: int | None) -> dict[str, Any] | None:
    if sector is not None and f"{tic_id}:{sector}" in index:
        return index[f"{tic_id}:{sector}"]
    return index.get(tic_id)


@lru_cache(maxsize=1)
def _dataset() -> dict[str, Any]:
    candidates = _read_json(PROJECT_ROOT / "candidates.json")
    if not candidates:
        candidates = _read_csv(PROJECT_ROOT / "reports" / "ranked_candidates.csv")
    # The project-level target manifest represents acquisition coverage (300 stars).
    # ML output files represent the smaller analyzed subset and remain independent.
    targets = _read_csv(DATA_ROOT / "metadata" / "targets.csv") or _read_csv(PROJECT_ROOT / "targets.csv")
    features = _read_csv(PROJECT_ROOT / "features.csv")
    rankings = _read_csv(PROJECT_ROOT / "ensemble_star_rankings.csv")
    anomaly_scores = _read_csv(PROJECT_ROOT / "unsupervised_anomaly_scores.csv")
    events = _read_csv(PROJECT_ROOT / "reports" / "peak_detection_events.csv")
    bls_candidates = _read_csv(PROJECT_ROOT / "reports" / "bls_candidates.csv")
    verification_files = {
        "bls": "bls_scientific_verification.csv",
        "events": "peak_scientific_verification.csv",
        "catalogs": "catalogue_crossmatch_verification.csv",
        "prediction_eligibility": "future_prediction_eligibility.csv",
    }
    verification = {key: _read_csv(PROJECT_ROOT / "reports" / filename) for key, filename in verification_files.items()}
    run_summary_path = PROJECT_ROOT / "run_summary.json"
    run_summary = json.loads(run_summary_path.read_text(encoding="utf-8")) if run_summary_path.is_file() else {}
    output_sector = _parse_cell(str(run_summary.get("sector"))) if run_summary.get("sector") is not None else None
    # These run-specific output tables omit sector; the ML run manifest supplies its sector.
    for row in [*events, *bls_candidates]:
        if row.get("sector") is None and output_sector is not None:
            row["sector"] = output_sector
    return {
        "candidates": candidates,
        "targets": targets,
        "feature_target_count": len(features),
        "features": _indexed(features),
        "rankings": _indexed(rankings),
        "anomaly_scores": _indexed(anomaly_scores),
        "events": events,
        "bls_candidates": bls_candidates,
        "sector": output_sector,
        "verification": verification,
        "verification_available": {key: (PROJECT_ROOT / "reports" / filename).is_file() for key, filename in verification_files.items()},
        "prediction_eligibility": _read_csv(PROJECT_ROOT / "reports" / "future_prediction_eligibility.csv"),
        "events_available": (PROJECT_ROOT / "reports" / "peak_detection_events.csv").is_file(),
        "bls_candidates_available": (PROJECT_ROOT / "reports" / "bls_candidates.csv").is_file(),
    }


def _curve_path(tic_id: str, sector: int) -> Path | None:
    # TIC is digit-only and sector is parsed as an integer before path construction.
    if not re.fullmatch(r"\d+", tic_id) or sector < 0:
        return None
    candidates = [
        ML_LIGHTCURVE_ROOT / f"TIC_{tic_id}" / f"sector-{sector}-preprocessed.npz",
        DATA_ROOT / "processed" / f"tic-{tic_id}" / f"sector-{sector}.npz",
    ]
    return next((path for path in candidates if path.is_file()), None)


def _all_candidates() -> list[dict[str, Any]]:
    dataset = _dataset()
    target_index = {_tic(row): row for row in dataset["targets"]}
    result = []
    for source in dataset["candidates"]:
        record = {key: value for key, value in source.items()}
        tic_id = _tic(record)
        record["tic_id"] = tic_id
        record["candidate_id"] = str(record.get("candidate_id") or "")
        record["sector"] = _sector(record)
        record["target"] = target_index.get(tic_id)
        record["features"] = _linked(dataset["features"], tic_id, record["sector"])
        record["star_ranking"] = _linked(dataset["rankings"], tic_id, record["sector"])
        record["anomaly_scores"] = _linked(dataset["anomaly_scores"], tic_id, record["sector"])
        record["lightcurve_available"] = bool(
            record["sector"] is not None and _curve_path(tic_id, record["sector"])
        )
        result.append(record)
    return result


def _target_records() -> list[dict[str, Any]]:
    dataset = _dataset()
    candidates = _all_candidates()
    candidate_counts: dict[str, int] = {}
    for candidate in candidates:
        candidate_counts[candidate["tic_id"]] = candidate_counts.get(candidate["tic_id"], 0) + 1
    records = []
    for source in dataset["targets"]:
        tic_id = _tic(source)
        record = dict(source)
        record["tic_id"] = tic_id
        sector = _sector(record)
        record["features"] = _linked(dataset["features"], tic_id, sector)
        record["star_ranking"] = _linked(dataset["rankings"], tic_id, sector)
        record["anomaly_scores"] = _linked(dataset["anomaly_scores"], tic_id, sector)
        record["candidate_count"] = candidate_counts.get(tic_id, 0)
        record["ml_analyzed"] = tic_id in dataset["features"] or tic_id in dataset["rankings"] or tic_id in dataset["anomaly_scores"]
        record["lightcurve_available"] = bool(sector is not None and _curve_path(tic_id, sector))
        records.append(record)
    return records


def _matching_events(tic_id: str, sector: int | None) -> list[dict[str, Any]]:
    return [
        event for event in _dataset()["events"]
        if _tic(event) == tic_id and (sector is None or _sector(event) == sector)
    ]


def _matching_bls_candidates(tic_id: str, sector: int | None) -> list[dict[str, Any]]:
    return [
        result for result in _dataset()["bls_candidates"]
        if _tic(result) == tic_id and (sector is None or _sector(result) == sector)
    ]


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "project_root": str(PROJECT_ROOT),
        "data_root_exists": DATA_ROOT.is_dir(),
        "candidate_count": len(_dataset()["candidates"]),
        "target_count": len(_dataset()["targets"]),
        "ml_feature_target_count": _dataset()["feature_target_count"],
    }


@app.get("/api/targets")
def list_targets(
    q: str | None = None,
    ml_analyzed: bool | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    rows = _target_records()
    if q:
        needle = q.casefold()
        rows = [row for row in rows if needle in row.get("tic_id", "").casefold() or needle in str(row.get("object_name") or "").casefold()]
    if ml_analyzed is not None:
        rows = [row for row in rows if row["ml_analyzed"] is ml_analyzed]
    return {"total": len(rows), "limit": limit, "offset": offset, "results": rows[offset:offset + limit]}


@app.get("/api/targets/{tic_id}")
def get_target(tic_id: str) -> dict[str, Any]:
    if not re.fullmatch(r"\d+", tic_id):
        raise HTTPException(status_code=422, detail="tic_id must contain digits only.")
    target = next((row for row in _target_records() if row["tic_id"] == tic_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="TIC ID is not present in the acquisition manifest.")
    target["catalog_data_available"] = any(target.get(key) is not None for key in (
        "gaia_dr3_source_id", "simbad_main_id", "known_planet", "known_candidate", "known_eclipsing_binary"
    ))
    return target


@app.get("/api/candidates")
def list_candidates(
    q: str | None = None,
    event_type: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    rows = _all_candidates()
    if q:
        needle = q.casefold()
        rows = [row for row in rows if needle in row["candidate_id"].casefold() or needle in row["tic_id"].casefold()]
    if event_type:
        rows = [row for row in rows if row.get("event_type") == event_type]
    rows.sort(key=lambda row: (row.get("candidate_priority_score") is None, -(row.get("candidate_priority_score") or 0)))
    return {"total": len(rows), "limit": limit, "offset": offset, "results": rows[offset:offset + limit]}


@app.get("/api/candidates/{candidate_id}")
def get_candidate(candidate_id: str) -> dict[str, Any]:
    candidate = next((row for row in _all_candidates() if row["candidate_id"] == candidate_id), None)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate was not present in the available ML output.")
    candidate["detected_events"] = _matching_events(candidate["tic_id"], candidate["sector"])
    candidate["bls_candidates"] = _matching_bls_candidates(candidate["tic_id"], candidate["sector"])
    bls_row = candidate["bls_candidates"][0] if candidate["bls_candidates"] else {}
    for field in ("period_days", "duration_hours"):
        if candidate.get(field) is not None:
            candidate[f"{field}_source"] = "ranked candidate record"
        elif bls_row.get(field) is not None:
            candidate[field] = bls_row[field]
            candidate[f"{field}_source"] = "BLS result joined by TIC and sector"
        else:
            candidate[f"{field}_source"] = None
    candidate["detected_events_available"] = _dataset()["events_available"]
    candidate["bls_candidates_available"] = _dataset()["bls_candidates_available"]
    candidate_time = candidate.get("event_time_btjd")
    compatible_events = [
        event for event in candidate["detected_events"]
        if event.get("event_type") == candidate.get("event_type") and event.get("event_time_btjd") is not None
    ]
    if candidate_time is not None and compatible_events:
        nearest = min(compatible_events, key=lambda event: abs(float(event["event_time_btjd"]) - float(candidate_time)))
        # The candidate time and event time should agree within a few 120-second cadences.
        if abs(float(nearest["event_time_btjd"]) - float(candidate_time)) <= 0.003:
            candidate["matched_detection_event"] = nearest
    return candidate


def _rows_for_tic(rows: list[dict[str, Any]], tic_id: str, sector: int | None = None) -> list[dict[str, Any]]:
    return [row for row in rows if _tic(row) == tic_id and (sector is None or _sector(row) in (None, sector))]


def _candidate_by_id(candidate_id: str) -> dict[str, Any]:
    candidate = next((row for row in _all_candidates() if row["candidate_id"] == candidate_id), None)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate was not present in the available ML output.")
    return get_candidate(candidate_id)


@app.get("/api/lightcurves/{tic_id}")
def get_lightcurve(
    tic_id: str,
    sector: int | None = Query(default=None, ge=0),
    max_points: int = Query(default=2000, ge=10, le=5000),
    flux_type: str = Query(default="pdcsap", pattern="^(sap|pdcsap|detrended)$"),
    period_days: float | None = Query(default=None, gt=0),
    epoch_btjd: float | None = None,
) -> dict[str, Any]:
    if not re.fullmatch(r"\d+", tic_id):
        raise HTTPException(status_code=422, detail="tic_id must contain digits only.")
    if sector is None:
        target = next((row for row in _target_records() if row["tic_id"] == tic_id), None)
        sector = _sector(target or {})
    if sector is None:
        raise HTTPException(status_code=404, detail="No sector is recorded for this TIC ID.")
    path = _curve_path(tic_id, sector)
    if path is None:
        raise HTTPException(status_code=404, detail="No local processed light curve is available for this TIC ID and sector.")
    if period_days is not None and epoch_btjd is None:
        raise HTTPException(status_code=422, detail="epoch_btjd is required when period_days is supplied.")
    try:
        arrays = load_npz(path)
        time_all = np.asarray(arrays["time"], dtype=float)
        flux_options = {
            "sap": ("normalized_sap_flux", "sap_flux"),
            "pdcsap": ("normalized_pdcsap_flux", "pdcsap_flux"),
            "detrended": ("detrended_flux", "normalized_pdcsap_flux", "pdcsap_flux"),
        }
        flux_name = next((name for name in flux_options[flux_type] if name in arrays), None)
        if flux_name is None:
            raise KeyError(f"The selected {flux_type.upper()} array is not present.")
        flux_all = np.asarray(arrays[flux_name], dtype=float)
        if flux_name in {"sap_flux", "pdcsap_flux"}:
            median = float(np.nanmedian(flux_all))
            flux_all = flux_all / median if median else flux_all
        error_names = {"sap": ("normalized_sap_err", "sap_flux_err"), "pdcsap": ("normalized_pdcsap_err", "pdcsap_flux_err"), "detrended": ("normalized_pdcsap_err", "pdcsap_flux_err")}
        error_name = next((name for name in error_names[flux_type] if name in arrays), None)
        error_all = np.asarray(arrays[error_name], dtype=float) if error_name else np.full_like(flux_all, np.nan)
        quality = np.asarray(arrays.get("quality", np.zeros_like(time_all)), dtype=np.int64)
        quality_good = np.asarray(arrays.get("quality_good_mask", quality == 0), dtype=bool)
        if quality_good.shape != time_all.shape:
            quality_good = quality == 0 if quality.shape == time_all.shape else np.ones_like(time_all, dtype=bool)
        if flux_all.shape != time_all.shape:
            raise ValueError("Time and selected flux array lengths do not agree.")
        valid = np.isfinite(time_all) & np.isfinite(flux_all)
        original_indices = np.flatnonzero(valid)
        time_values = time_all[valid]
        flux_values = flux_all[valid]
        quality_values = quality[valid] if quality.shape == valid.shape else np.zeros(len(time_values), dtype=np.int64)
        quality_ok_values = quality_good[valid]
        error_values = error_all[valid] if error_all.shape == valid.shape else np.full(len(time_values), np.nan)
    except (OSError, ValueError, KeyError) as exc:
        raise HTTPException(status_code=500, detail=f"Unable to read processed NPZ: {exc}") from exc
    if not len(time_values):
        raise HTTPException(status_code=404, detail="The processed light curve has no valid points.")
    events = [dict(event) for event in _matching_events(tic_id, sector)]
    chosen = set(np.linspace(0, len(time_values) - 1, num=min(max_points, len(time_values)), dtype=int).tolist())
    for event in events:
        event_time = event.get("event_time_btjd")
        if event_time is not None:
            chosen.add(int(np.argmin(np.abs(time_values - float(event_time)))))
    indexes = np.asarray(sorted(chosen), dtype=int)
    time_values, flux_values = time_values[indexes], flux_values[indexes]
    quality_values, quality_ok_values, error_values = quality_values[indexes], quality_ok_values[indexes], error_values[indexes]
    folded = period_days is not None
    if folded:
        phase = ((time_values - float(epoch_btjd) + period_days / 2) % period_days) / period_days - 0.5
        ordering = np.argsort(phase)
        time_values, flux_values = phase[ordering], flux_values[ordering]
        quality_values, quality_ok_values, error_values = quality_values[ordering], quality_ok_values[ordering], error_values[ordering]
        for event in events:
            if event.get("event_time_btjd") is not None:
                event["phase"] = float(((float(event["event_time_btjd"]) - float(epoch_btjd) + period_days / 2) % period_days) / period_days - 0.5)
    event_times = [float(event.get("event_time_btjd")) for event in events if event.get("event_time_btjd") is not None]
    flare_events = [float(event["event_time_btjd"]) for event in events if "flare" in str(event.get("event_type", "")) and event.get("event_time_btjd") is not None]
    dip_events = [float(event["event_time_btjd"]) for event in events if "dip" in str(event.get("event_type", "")) and event.get("event_time_btjd") is not None]
    marker_values = [float(event.get("phase")) if folded and event.get("phase") is not None else float(event["event_time_btjd"]) for event in events if event.get("event_time_btjd") is not None]
    return {
        "tic_id": tic_id,
        "sector": sector,
        "source_file": str(path.relative_to(PROJECT_ROOT)).replace("\\", "/") if path.is_relative_to(PROJECT_ROOT) else str(path),
        "flux_field": flux_name,
        "flux_type": flux_type,
        "normalized": flux_name.startswith("normalized_") or flux_name == "detrended_flux",
        "folded": folded,
        "period_days": period_days,
        "epoch_btjd": epoch_btjd,
        "x_axis_label": "PHASE" if folded else "TIME (BTJD)",
        "point_count": int(len(time_values)),
        "time": time_values.tolist(),
        "flux": flux_values.tolist(),
        "uncertainty": [float(value) if np.isfinite(value) else None for value in error_values],
        "quality": quality_values.astype(int).tolist(),
        "quality_good": quality_ok_values.astype(bool).tolist(),
        "quality_mask_source": "quality_good_mask" if "quality_good_mask" in arrays else "QUALITY == 0" if "quality" in arrays else "unavailable",
        "events": events,
        "event_marker_positions": marker_values,
        "flare_event_times_btjd": flare_events,
        "dip_event_times_btjd": dip_events,
        "event_catalogue_count": len(event_times),
    }


def _npz_arrays(tic_id: str, sector: int) -> dict[str, np.ndarray]:
    path = _curve_path(tic_id, sector)
    if path is None:
        raise HTTPException(status_code=404, detail="No local processed light curve is available for this TIC ID and sector.")
    try:
        return load_npz(path)
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=500, detail="Unable to read the processed NPZ file.") from exc


def _verification_rows(tic_id: str, sector: int) -> dict[str, Any]:
    dataset = _dataset()
    return {
        key: {
            "available": dataset["verification_available"].get(key, False),
            "rows": _rows_for_tic(rows, tic_id, sector),
        }
        for key, rows in dataset["verification"].items()
    }


def _catalog_context(tic_id: str) -> dict[str, Any]:
    target = next((row for row in _target_records() if row["tic_id"] == tic_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="TIC ID is not present in the acquisition manifest.")
    return {
        "tic_id": tic_id,
        "ra_deg": target.get("ra_deg"),
        "dec_deg": target.get("dec_deg"),
        "gaia": {key: value for key, value in target.items() if key.startswith("gaia_") or key in {"gaia_match_status", "gaia_match_ambiguous"}},
        "simbad": {key: value for key, value in target.items() if key.startswith("simbad_")},
        "known_object_flags": {key: target.get(key) for key in ("known_planet", "known_candidate", "known_false_positive_toi", "known_eclipsing_binary", "catalog_periods_days", "known_object_classifications")},
        "catalog_provenance": {key: value for key, value in target.items() if key.endswith("_provenance") or key.endswith("_catalog_status")},
    }


def execute_approved_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if tool_name == "get_candidate_evidence":
        candidate_id = str(arguments.get("candidate_id", ""))
        return _candidate_by_id(candidate_id)
    if tool_name == "get_catalog_context":
        tic_id = _normalize_tic_id(arguments.get("tic_id"))
        if not re.fullmatch(r"\d+", tic_id):
            raise HTTPException(status_code=422, detail="tic_id must contain digits only.")
        return _catalog_context(tic_id)
    tic_id = _normalize_tic_id(arguments.get("tic_id"))
    try:
        sector = int(arguments.get("sector"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="A TIC ID and integer sector are required.")
    if not re.fullmatch(r"\d+", tic_id):
        raise HTTPException(status_code=422, detail="tic_id must contain digits only.")
    arrays = _npz_arrays(tic_id, sector)
    if tool_name == "summarize_quality_flags":
        return quality_summary(arrays)
    if tool_name == "compare_sap_pdcsap":
        return compare_sap_pdcsap(arrays)
    if tool_name == "fold_periodic_signal":
        try:
            result = fold_curve(arrays, float(arguments.get("period_days")), float(arguments.get("epoch_btjd")), max_points=500)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        return result
    if tool_name == "verify_candidate":
        candidate_rows = [row for row in _all_candidates() if row["tic_id"] == tic_id and row["sector"] == sector]
        return {
            "tic_id": tic_id,
            "sector": sector,
            "candidate_records": candidate_rows,
            "calculated_quality_summary": quality_summary(arrays),
            "calculated_sap_pdcsap_comparison": compare_sap_pdcsap(arrays),
            "recorded_verification": _verification_rows(tic_id, sector),
            "interpretation_limit": "Evidence summary only. It does not confirm an astrophysical classification.",
        }
    raise HTTPException(status_code=404, detail="Tool is not in the approved Python tool list.")


@app.get("/api/verification/{tic_id}")
def get_verification(tic_id: str, sector: int = Query(default=1, ge=0)) -> dict[str, Any]:
    if not re.fullmatch(r"\d+", tic_id):
        raise HTTPException(status_code=422, detail="tic_id must contain digits only.")
    arrays = _npz_arrays(tic_id, sector)
    return {
        "tic_id": tic_id,
        "sector": sector,
        "calculated_quality_summary": quality_summary(arrays),
        "calculated_sap_pdcsap_comparison": compare_sap_pdcsap(arrays),
        "recorded_verification": _verification_rows(tic_id, sector),
    }


@app.post("/api/science-tools/{tool_name}")
def run_science_tool(tool_name: str, request: ScienceToolRequest) -> dict[str, Any]:
    approved = {item["name"] for item in gemma.TOOL_DECLARATIONS}
    if tool_name not in approved:
        raise HTTPException(status_code=404, detail="Tool is not in the approved Python tool list.")
    return {"tool_name": tool_name, "result": execute_approved_tool(tool_name, request.arguments)}


@app.get("/api/gemma/status")
def gemma_status() -> dict[str, Any]:
    return {"configured": gemma.api_key_configured(), "model": gemma.MODEL_NAME, "approved_tools": [item["name"] for item in gemma.TOOL_DECLARATIONS]}


@app.get("/api/investigations")
def list_investigations() -> dict[str, Any]:
    rows = read_records(INVESTIGATIONS_PATH)
    rows.sort(key=lambda item: item.get("updated_at_utc", ""), reverse=True)
    return {"total": len(rows), "results": rows}


def _find_investigation(case_id: str, rows: list[dict[str, Any]] | None = None) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    rows = rows if rows is not None else read_records(INVESTIGATIONS_PATH)
    case = next((item for item in rows if item.get("investigation_id") == case_id), None)
    if case is None:
        raise HTTPException(status_code=404, detail="Saved investigation was not found.")
    return case, rows


@app.post("/api/investigations")
def create_investigation(request: InvestigationCreate) -> dict[str, Any]:
    candidate = _candidate_by_id(request.candidate_id)
    now = datetime.now(timezone.utc).isoformat()
    case = {
        "investigation_id": str(uuid.uuid4()),
        "candidate_id": candidate["candidate_id"],
        "tic_id": candidate["tic_id"],
        "sector": candidate["sector"],
        "title": f"TIC {candidate['tic_id']} {str(candidate.get('event_type') or 'candidate').replace('_', ' ')}",
        "hypothesis": request.hypothesis,
        "notes": request.notes,
        "status": "in_progress",
        "scientific_tests": [],
        "ai_history": [],
        "mission_progress": {"step": 0, "completed_step_ids": []},
        "created_at_utc": now,
        "updated_at_utc": now,
    }
    rows = read_records(INVESTIGATIONS_PATH)
    rows.insert(0, case)
    write_records(INVESTIGATIONS_PATH, rows)
    return case


@app.patch("/api/investigations/{case_id}")
def update_investigation(case_id: str, request: InvestigationPatch) -> dict[str, Any]:
    case, rows = _find_investigation(case_id)
    for key, value in request.model_dump(exclude_unset=True).items():
        if value is not None:
            case[key] = value
    case["updated_at_utc"] = datetime.now(timezone.utc).isoformat()
    write_records(INVESTIGATIONS_PATH, rows)
    return case


@app.post("/api/investigations/{case_id}/tests")
def add_scientific_test(case_id: str, request: ScienceToolRequest) -> dict[str, Any]:
    case, rows = _find_investigation(case_id)
    tool_name = str(request.arguments.get("tool_name", ""))
    arguments = {key: value for key, value in request.arguments.items() if key != "tool_name"}
    approved = {item["name"] for item in gemma.TOOL_DECLARATIONS}
    if tool_name not in approved:
        raise HTTPException(status_code=404, detail="Tool is not in the approved Python tool list.")
    result = execute_approved_tool(tool_name, arguments)
    test = {"tool_name": tool_name, "arguments": arguments, "result": result, "run_at_utc": datetime.now(timezone.utc).isoformat()}
    case.setdefault("scientific_tests", []).append(test)
    case["updated_at_utc"] = test["run_at_utc"]
    write_records(INVESTIGATIONS_PATH, rows)
    return test


@app.post("/api/investigations/{case_id}/chat")
def investigator_chat(case_id: str, request: ChatMessage) -> dict[str, Any]:
    case, rows = _find_investigation(case_id)
    candidate = _candidate_by_id(case["candidate_id"])
    context = {
        "candidate_id": candidate["candidate_id"], "tic_id": candidate["tic_id"], "sector": candidate["sector"],
        "event_type": candidate.get("event_type"), "event_time_btjd": candidate.get("event_time_btjd"),
        "candidate_priority_score": candidate.get("candidate_priority_score"), "star_anomaly_score": candidate.get("star_anomaly_score"),
        "features": candidate.get("features"), "anomaly_scores": candidate.get("anomaly_scores"),
        "star_ranking": candidate.get("star_ranking"), "target_catalog_fields": candidate.get("target"),
        "recorded_verification": _verification_rows(candidate["tic_id"], candidate["sector"]),
        "linked_bls_candidates": candidate.get("bls_candidates"), "linked_detection_events": candidate.get("detected_events"),
    }
    prompt = "Candidate context from the local POLARIX files (JSON):\n" + json.dumps(context, ensure_ascii=False, allow_nan=False) + "\n\nInvestigator request:\n" + request.message
    try:
        response = gemma.call_model(prompt, case.get("ai_history", []), execute_approved_tool)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        # Do not return provider request details or any credential-related text.
        raise HTTPException(status_code=502, detail=f"Gemma request failed ({type(exc).__name__}).") from exc
    now = datetime.now(timezone.utc).isoformat()
    case.setdefault("ai_history", []).extend([
        {"role": "user", "content": request.message, "created_at_utc": now},
        {"role": "assistant", "content": response["text"], "tool_calls": response["tool_calls"], "model": gemma.MODEL_NAME, "created_at_utc": now},
    ])
    case["ai_history"] = case["ai_history"][-40:]
    case["updated_at_utc"] = now
    write_records(INVESTIGATIONS_PATH, rows)
    return {"text": response["text"], "tool_calls": response["tool_calls"], "model": response["model"], "created_at_utc": now}


@app.post("/api/gemma/test-tool-call")
def test_gemma_tool_call(tic_id: str = Query(..., pattern="^\\d+$"), sector: int = Query(default=1, ge=0)) -> dict[str, Any]:
    prompt = f"For TIC {tic_id} sector {sector}, call compare_sap_pdcsap and explain the returned measured values in one short sentence. Do not invent missing measurements."
    try:
        response = gemma.call_model(prompt, [], execute_approved_tool, force_tool="compare_sap_pdcsap")
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemma live tool-call test failed ({type(exc).__name__}).") from exc
    if not response["tool_calls"]:
        raise HTTPException(status_code=502, detail="Gemma returned no approved tool call.")
    return {"model": response["model"], "tool_call_count": len(response["tool_calls"]), "tool_calls": response["tool_calls"], "text": response["text"]}


def _current_predictions() -> list[dict[str, Any]]:
    dataset = _dataset()
    persisted = read_records(PREDICTIONS_PATH)
    try:
        current = next_events(dataset["bls_candidates"], dataset["prediction_eligibility"], persisted, dataset.get("sector"))
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="Astropy is required for BTJD to UTC conversion.") from exc
    ledger_by_id = {str(row.get("prediction_id")): row for row in persisted}
    for row in current:
        ledger_by_id[row["prediction_id"]] = row
    write_records(PREDICTIONS_PATH, list(ledger_by_id.values()))
    return current


@app.get("/api/predictions")
def list_predictions(tic_id: str | None = None, status: str | None = None) -> dict[str, Any]:
    rows = _current_predictions()
    if tic_id:
        rows = [row for row in rows if row["tic_id"] == tic_id]
    if status:
        rows = [row for row in rows if row["status"] == status]
    rows.sort(key=lambda row: row["predicted_midtime_btjd"])
    return {"total": len(rows), "time_system": "BTJD = BJD_TDB - 2457000.0", "results": rows}


@app.patch("/api/predictions/{prediction_id}")
def review_prediction(prediction_id: str, request: PredictionReview) -> dict[str, Any]:
    _current_predictions()
    rows = read_records(PREDICTIONS_PATH)
    record = next((row for row in rows if row.get("prediction_id") == prediction_id), None)
    if record is None:
        raise HTTPException(status_code=404, detail="Prediction was not found in the ledger.")
    record["status"] = request.status
    record["review_note"] = request.review_note
    record["reviewed_at_utc"] = datetime.now(timezone.utc).isoformat()
    write_records(PREDICTIONS_PATH, rows)
    return record


def _casefile_payload(case: dict[str, Any]) -> dict[str, Any]:
    candidate = _candidate_by_id(case["candidate_id"])
    target = candidate.get("target") or {}
    tests = _verification_rows(candidate["tic_id"], candidate["sector"])
    calculated = execute_approved_tool("verify_candidate", {"tic_id": candidate["tic_id"], "sector": candidate["sector"]})
    predictions = [row for row in read_records(PREDICTIONS_PATH) if row.get("tic_id") == candidate["tic_id"]]
    return {
        "report_type": "POLARIX scientific case file",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "discovery_status": "candidate; not a confirmed discovery",
        "candidate": candidate,
        "stellar_metadata": _catalog_context(candidate["tic_id"]),
        "verification": {"recorded": tests, "calculated": calculated},
        "gemma_findings": case.get("ai_history", []),
        "prediction_ledger": predictions,
        "investigation": case,
        "provenance": {
            "candidate_source": "candidates.json / reports/ranked_candidates.csv",
            "feature_source": "features.csv; joined by TIC ID and sector where present",
            "event_source": "reports/peak_detection_events.csv",
            "BLS_source": "reports/bls_candidates.csv",
            "lightcurve_source": target.get("processed_path"),
            "raw_FITS_source": target.get("fits_path"),
            "catalog_sources": {key: target.get(key) for key in target if key.endswith("_provenance")},
        },
    }


@app.get("/api/investigations/{case_id}/casefile")
def download_casefile(case_id: str, format: Literal["json", "pdf"] = "json") -> Response:
    case, _ = _find_investigation(case_id)
    report = _casefile_payload(case)
    safe_id = re.sub(r"[^A-Za-z0-9_-]", "_", case_id)
    if format == "json":
        content = json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False).encode("utf-8")
        return Response(content, media_type="application/json", headers={"Content-Disposition": f"attachment; filename=polarix-case-{safe_id}.json"})
    try:
        pdf = render_pdf(report)
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="ReportLab is required for PDF case files.") from exc
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=polarix-case-{safe_id}.pdf"})
