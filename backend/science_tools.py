from __future__ import annotations

from typing import Any

import numpy as np


def _array(arrays: dict[str, np.ndarray], *names: str) -> np.ndarray | None:
    for name in names:
        if name in arrays:
            return np.asarray(arrays[name], dtype=float)
    return None


def _finite_pair(arrays: dict[str, np.ndarray], first: np.ndarray | None, second: np.ndarray | None) -> tuple[np.ndarray, np.ndarray]:
    if first is None or second is None or first.shape != second.shape:
        return np.array([], dtype=float), np.array([], dtype=float)
    valid = np.isfinite(first) & np.isfinite(second)
    for name in ("pdcsap_valid_mask", "sap_valid_mask"):
        if name in arrays:
            mask = np.asarray(arrays[name], dtype=bool)
            if mask.shape == valid.shape:
                valid &= mask
    return first[valid], second[valid]


def quality_summary(arrays: dict[str, np.ndarray]) -> dict[str, Any]:
    time = _array(arrays, "time")
    quality = np.asarray(arrays.get("quality", []), dtype=np.int64)
    n = int(len(time)) if time is not None else int(len(quality))
    good_mask = np.asarray(arrays.get("quality_good_mask", quality == 0), dtype=bool)
    if len(good_mask) != n:
        good_mask = np.isfinite(time) if time is not None else np.zeros(n, dtype=bool)
    values, counts = np.unique(quality, return_counts=True) if len(quality) else (np.array([], dtype=int), np.array([], dtype=int))
    rejected = np.flatnonzero(~good_mask)
    return {
        "observation_count": n,
        "quality_good_count": int(good_mask.sum()),
        "quality_rejected_count": int((~good_mask).sum()),
        "quality_good_fraction": float(good_mask.mean()) if n else None,
        "quality_value_counts": {str(int(value)): int(count) for value, count in zip(values, counts)},
        "quality_mask_source": "quality_good_mask" if "quality_good_mask" in arrays else "QUALITY == 0" if len(quality) else "unavailable",
        "quality_values_available": bool(len(quality)),
        "rejected_cadence_count": int(len(rejected)),
    }


def compare_sap_pdcsap(arrays: dict[str, np.ndarray]) -> dict[str, Any]:
    sap = _array(arrays, "normalized_sap_flux")
    pdcsap = _array(arrays, "normalized_pdcsap_flux")
    sap, pdcsap = _finite_pair(arrays, sap, pdcsap)
    if len(sap) < 2:
        return {"available": False, "reason": "Both normalized SAP and PDCSAP arrays are required."}
    centered_sap = sap - np.mean(sap)
    centered_pdcsap = pdcsap - np.mean(pdcsap)
    denominator = float(np.linalg.norm(centered_sap) * np.linalg.norm(centered_pdcsap))
    correlation = float(np.dot(centered_sap, centered_pdcsap) / denominator) if denominator else None
    return {
        "available": True,
        "cadence_count": int(len(sap)),
        "sap_median": float(np.median(sap)),
        "pdcsap_median": float(np.median(pdcsap)),
        "sap_robust_scatter_mad": float(np.median(np.abs(sap - np.median(sap)))),
        "pdcsap_robust_scatter_mad": float(np.median(np.abs(pdcsap - np.median(pdcsap)))),
        "median_fractional_difference": float(np.median((sap - pdcsap) / np.where(np.abs(pdcsap) > 0, pdcsap, np.nan))),
        "pearson_correlation": correlation,
        "interpretation": "Descriptive comparison only; it is not a transit validation test.",
    }


def fold_curve(arrays: dict[str, np.ndarray], period_days: float, epoch_btjd: float, max_points: int = 2000) -> dict[str, Any]:
    if not np.isfinite(period_days) or period_days <= 0:
        raise ValueError("period_days must be a finite positive BLS period")
    if not np.isfinite(epoch_btjd):
        raise ValueError("epoch_btjd must be finite")
    time = _array(arrays, "time")
    flux = _array(arrays, "normalized_pdcsap_flux", "detrended_flux")
    if time is None or flux is None or time.shape != flux.shape:
        return {"available": False, "reason": "Time and normalized flux arrays are unavailable."}
    valid = np.isfinite(time) & np.isfinite(flux)
    for mask_name in ("pdcsap_valid_mask", "quality_good_mask"):
        if mask_name in arrays:
            mask = np.asarray(arrays[mask_name], dtype=bool)
            if mask.shape == valid.shape:
                valid &= mask
    phase = ((time[valid] - epoch_btjd + period_days / 2) % period_days) / period_days - 0.5
    folded_flux = flux[valid]
    if len(phase) > max_points:
        indexes = np.linspace(0, len(phase) - 1, max_points, dtype=int)
        phase, folded_flux = phase[indexes], folded_flux[indexes]
    order = np.argsort(phase)
    return {
        "available": bool(len(phase)),
        "period_days": float(period_days),
        "epoch_btjd": float(epoch_btjd),
        "point_count": int(len(phase)),
        "phase": phase[order].tolist(),
        "flux": folded_flux[order].tolist(),
        "phase_convention": "centered on the supplied BTJD epoch, range [-0.5, 0.5)",
    }
