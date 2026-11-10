from __future__ import annotations

import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from astropy.io import fits
from scipy.ndimage import median_filter


ARRAY_ALIASES = {
    "time": ("TIME",), "sap_flux": ("SAP_FLUX",), "sap_flux_err": ("SAP_FLUX_ERR",),
    "pdcsap_flux": ("PDCSAP_FLUX",), "pdcsap_flux_err": ("PDCSAP_FLUX_ERR",),
    "quality": ("QUALITY",), "sap_bkg": ("SAP_BKG",), "sap_bkg_err": ("SAP_BKG_ERR",),
    "mom_centr1": ("MOM_CENTR1",), "mom_centr2": ("MOM_CENTR2",),
    "mom_centr1_err": ("MOM_CENTR1_ERR",), "mom_centr2_err": ("MOM_CENTR2_ERR",),
    "pos_corr1": ("POS_CORR1",), "pos_corr2": ("POS_CORR2",),
}


def _header_value(hdus, key: str, default=None):
    for hdu in hdus:
        if key in hdu.header:
            return hdu.header[key]
    return default


def process_fits(fits_path: Path, out_path: Path, qc_path: Path, *,
                 quality_bitmask: int = 175, detrend_window: int = 301) -> dict:
    """Preserve raw arrays/masks and add normalized, conservative rolling-median detrending."""
    with fits.open(fits_path, memmap=False) as hdus:
        if len(hdus) < 2 or hdus[1].data is None:
            raise ValueError(f"Missing light curve binary table: {fits_path}")
        data = hdus[1].data
        colnames = {name.upper(): name for name in data.names or []}
        arrays: dict[str, np.ndarray] = {}
        availability = {}
        for alias, candidates in ARRAY_ALIASES.items():
            col = next((colnames[c] for c in candidates if c in colnames), None)
            availability[alias] = col is not None
            if col is not None:
                arr = np.asarray(data[col])
                arrays[alias] = np.asarray(arr.filled(np.nan) if np.ma.isMaskedArray(arr) else arr)
        for req in ("time", "sap_flux", "sap_flux_err", "pdcsap_flux", "pdcsap_flux_err", "quality"):
            if req not in arrays:
                raise ValueError(f"Required column {req} absent in {fits_path}")
        time_arr = arrays["time"].astype(float)
        flux = arrays["pdcsap_flux"].astype(float)
        quality = arrays["quality"].astype(np.int64)
        quality_good = (quality & quality_bitmask) == 0
        finite = np.isfinite(time_arr) & np.isfinite(flux)
        original_mask = quality_good & finite
        if original_mask.sum() < 20:
            raise ValueError(f"Insufficient quality-filtered points ({original_mask.sum()}) in {fits_path}")
        med = float(np.nanmedian(flux[original_mask]))
        if not np.isfinite(med) or med == 0:
            raise ValueError(f"Invalid median PDCSAP flux in {fits_path}")
        normalized = flux / med
        # Rolling median only on already finite/good samples, interpolated across gaps. Width is odd.
        idx = np.arange(len(flux))
        good_idx = idx[original_mask]
        compact = normalized[original_mask]
        width = max(31, min(detrend_window, (len(compact) // 7) * 2 + 1))
        if width % 2 == 0:
            width += 1
        smooth_compact = median_filter(compact, size=width, mode="nearest")
        trend = np.interp(idx, good_idx, smooth_compact)
        trend[~np.isfinite(trend) | (trend == 0)] = 1.0
        detrended = normalized / trend
        processed_mask = original_mask & np.isfinite(detrended)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {**arrays, "quality_good_mask": quality_good, "finite_mask": finite,
                   "original_valid_mask": original_mask, "processed_mask": processed_mask,
                   "normalized_pdcsap_flux": normalized, "trend": trend,
                   "detrended_flux": detrended,
                   "metadata_json": np.asarray(json.dumps({
                       "fits_path": str(fits_path), "ra_deg": _header_value(hdus, "RA_OBJ"),
                       "dec_deg": _header_value(hdus, "DEC_OBJ"), "tic_id": _header_value(hdus, "TICID"),
                       "sector": _header_value(hdus, "SECTOR"), "camera": _header_value(hdus, "CAMERA"),
                       "ccd": _header_value(hdus, "CCD"), "data_product": _header_value(hdus, "DATAURI"),
                       "available_columns": availability, "quality_bitmask": quality_bitmask,
                       "detrend_window_samples": int(width), "units": "PDCSAP normalized by median"
                   }, default=str))}
        np.savez_compressed(out_path, **payload)
        plot_mask = processed_mask
        qc_path.parent.mkdir(parents=True, exist_ok=True)
        fig, axes = plt.subplots(2, 1, figsize=(10, 6), sharex=True)
        axes[0].plot(time_arr[finite], normalized[finite], color="0.65", lw=0.5, label="normalized PDCSAP")
        axes[0].plot(time_arr[original_mask], normalized[original_mask], color="#2266aa", lw=0.7, label="quality kept")
        axes[0].plot(time_arr[original_mask], trend[original_mask], color="#dd7722", lw=1, label="median trend")
        axes[0].legend(loc="best", fontsize=8)
        axes[1].plot(time_arr[plot_mask], detrended[plot_mask], color="#204060", lw=0.6)
        axes[1].set_xlabel("BTJD (days)")
        axes[0].set_ylabel("Normalized flux")
        axes[1].set_ylabel("Detrended flux")
        fig.suptitle(f"{fits_path.stem} | kept {int(processed_mask.sum())}/{len(time_arr)} points")
        fig.tight_layout()
        fig.savefig(qc_path, dpi=140)
        plt.close(fig)
        return {"n_observations": int(len(time_arr)), "n_quality_good": int(quality_good.sum()),
                "n_processed": int(processed_mask.sum()), "n_quality_rejected": int((~quality_good).sum()),
                "median_pdcsap_flux": med, "processed_path": str(out_path), "qc_plot_path": str(qc_path),
                "available_columns": availability, "ra_deg": _header_value(hdus, "RA_OBJ"),
                "dec_deg": _header_value(hdus, "DEC_OBJ"), "sector": _header_value(hdus, "SECTOR")}
