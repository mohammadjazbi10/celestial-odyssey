from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

BTJD_OFFSET = 2457000.0
TIME_SYSTEM = "BTJD = BJD_TDB - 2457000.0"


def next_events(
    bls_rows: list[dict[str, Any]],
    eligibility_rows: list[dict[str, Any]],
    persisted: list[dict[str, Any]],
    default_sector: int | None = None,
    now_utc: datetime | None = None,
) -> list[dict[str, Any]]:
    from astropy.time import Time

    now_utc = now_utc or datetime.now(timezone.utc)
    now_btjd = float(Time(now_utc).tdb.jd - BTJD_OFFSET)
    eligibility = {str(row.get("tic_id")): row for row in eligibility_rows}
    saved = {str(row.get("prediction_id")): row for row in persisted}
    output = []
    for row in bls_rows:
        try:
            tic_id = str(int(float(row["tic_id"])))
            period = float(row["period_days"])
            epoch = float(row["transit_epoch_btjd"])
        except (KeyError, TypeError, ValueError, OverflowError):
            continue
        if not math.isfinite(period) or period <= 0 or not math.isfinite(epoch):
            continue
        eligibility_row = eligibility.get(tic_id, {})
        sector = int(row.get("sector") or default_sector or 1)
        first_cycle = max(0, math.ceil((now_btjd - epoch) / period))
        for cycle in range(first_cycle, first_cycle + 3):
            event_btjd = epoch + cycle * period
            if event_btjd <= now_btjd:
                continue
            event_utc = Time(event_btjd + BTJD_OFFSET, format="jd", scale="tdb").utc.isot + "Z"
            identifier = f"TIC_{tic_id}_S{sector}_C{cycle}"
            previous = saved.get(identifier, {})
            output.append({
                "prediction_id": identifier,
                "tic_id": tic_id,
                "sector": sector,
                "cycle_number": cycle,
                "period_days": period,
                "epoch_btjd": epoch,
                "predicted_midtime_btjd": event_btjd,
                "predicted_midtime_utc": event_utc,
                "duration_hours": _optional_float(row.get("duration_hours")),
                "period_uncertainty_days": _optional_float(row.get("period_uncertainty_days")),
                "epoch_uncertainty_days": _optional_float(row.get("epoch_uncertainty_days")),
                "time_uncertainty_hours": _optional_float(row.get("time_uncertainty_hours")),
                "uncertainty_available": any(row.get(key) not in (None, "") for key in ("period_uncertainty_days", "epoch_uncertainty_days", "time_uncertainty_hours")),
                "status": previous.get("status", "awaiting"),
                "review_note": previous.get("review_note", ""),
                "source_status": row.get("status"),
                "followup_prediction_eligible": eligibility_row.get("eligible_for_followup_prediction"),
                "eligibility_reasons": eligibility_row.get("reasons"),
                "source_file": "reports/bls_candidates.csv",
                "time_system": TIME_SYSTEM,
                "calculated_at_utc": now_utc.isoformat(),
                "periodic_data_valid": True,
                "validity_note": "BLS period and transit epoch are present and finite; scientific follow-up eligibility is reported separately.",
            })
    return output


def _optional_float(value: Any) -> float | None:
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None
