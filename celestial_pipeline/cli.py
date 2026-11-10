from __future__ import annotations

import argparse
import json
import traceback
from pathlib import Path

import numpy as np
import pandas as pd
from astropy.io import fits

from .common import data_root, ensure_layout, log_event, make_logger, write_csv, write_json
from .crossmatch import crossmatch_gaia, crossmatch_simbad
from .discovery import discover_spoc_targets, download_sector_lightcurve
from .followup import discover_followup_sectors, download_followup
from .known_objects import crossmatch_planets, crossmatch_tess_ebs
from .manifest import build_manifest
from .preprocess import process_fits


def _load_eval_tics(file_path: str | None) -> set[int]:
    if not file_path:
        return set()
    p = Path(file_path)
    if not p.exists():
        raise FileNotFoundError(f"Evaluation TIC list does not exist: {p}")
    values = pd.read_csv(p, header=None).iloc[:, 0].astype(str).str.extract(r"(\d+)", expand=False).dropna()
    return set(values.astype("int64"))


def run_pipeline(args) -> dict:
    root = data_root()
    ensure_layout(root)
    logger = make_logger(root)
    config = {"sector": args.sector, "count": args.count, "seed": args.seed,
              "eval_tic_file": args.eval_tic_file, "resume": args.resume,
              "quality_bitmask": args.quality_bitmask}
    targets = discover_spoc_targets(args.sector, args.count, args.seed, root,
                                    eval_tics=_load_eval_tics(args.eval_tic_file), logger=logger)
    write_csv(root / "metadata" / "discovery_sample.csv", targets)
    failures = []
    for row in targets.itertuples(index=False):
        tic, sector = int(row.tic_id), int(row.sector)
        raw_path = root / "raw" / f"tic-{tic}" / f"sector-{sector}.fits"
        processed_path = root / "processed" / f"tic-{tic}" / f"sector-{sector}.npz"
        qc_path = root / "qc" / f"tic-{tic}-sector-{sector}.png"
        try:
            if not raw_path.exists() or not args.resume:
                raw_path, _ = download_sector_lightcurve(tic, sector, root, logger)
            else:
                with fits.open(raw_path, memmap=False) as hdus:
                    required = {"TIME", "SAP_FLUX", "SAP_FLUX_ERR", "PDCSAP_FLUX", "PDCSAP_FLUX_ERR", "QUALITY"}
                    missing = required.difference(set(hdus[1].columns.names))
                    if missing:
                        raise ValueError(f"cached FITS missing required columns {sorted(missing)}")
            processed_ok = False
            if args.resume and processed_path.exists() and qc_path.exists():
                try:
                    with np.load(processed_path, allow_pickle=False) as saved:
                        needed = {"time", "sap_flux", "sap_flux_err", "pdcsap_flux", "pdcsap_flux_err",
                                  "quality", "original_valid_mask", "processed_mask", "detrended_flux"}
                        processed_ok = needed.issubset(saved.files) and len(saved["time"]) > 0 and \
                            len(saved["processed_mask"]) == len(saved["time"])
                except Exception:
                    processed_ok = False
            if not processed_ok:
                process_info = process_fits(raw_path, processed_path, qc_path,
                                            quality_bitmask=args.quality_bitmask)
                log_event(logger, "preprocess_complete", tic_id=tic, **process_info)
            with fits.open(raw_path, memmap=False) as hdus:
                header = hdus[1].header
                file_tic = header.get("TICID", hdus[0].header.get("TICID"))
                file_sector = header.get("SECTOR", hdus[0].header.get("SECTOR"))
                if file_tic is not None and int(file_tic) != tic:
                    raise ValueError(f"FITS TICID {file_tic} does not match requested TIC {tic}")
                if file_sector is not None and int(file_sector) != sector:
                    raise ValueError(f"FITS sector {file_sector} does not match requested sector {sector}")
        except Exception as exc:
            failure = {"tic_id": tic, "sector": sector, "stage": "lightcurve_or_preprocess", "error": repr(exc)}
            failures.append(failure)
            log_event(logger, "target_failure", **failure, traceback=traceback.format_exc())

    valid = targets[targets.apply(lambda r: (root / "raw" / f"tic-{int(r.tic_id)}" / f"sector-{int(r.sector)}.fits").exists(), axis=1)].copy()
    for idx, target in valid.iterrows():
        path = root / "raw" / f"tic-{int(target.tic_id)}" / f"sector-{int(target.sector)}.fits"
        try:
            with fits.open(path, memmap=False) as hdus:
                targets.loc[idx, "ra_deg"] = hdus[1].header.get("RA_OBJ", targets.loc[idx, "ra_deg"])
                targets.loc[idx, "dec_deg"] = hdus[1].header.get("DEC_OBJ", targets.loc[idx, "dec_deg"])
                targets.loc[idx, "fits_provenance"] = hdus[1].header.get("AUTHOR", "SPOC")
        except Exception as exc:
            log_event(logger, "fits_metadata_failure", tic_id=int(target.tic_id), error=repr(exc))
    crossmatch_targets = targets.copy()
    # Keep catalog coverage for all selected TICs, including a target whose FITS download failed.
    source_modules = [
        ("gaia", lambda: crossmatch_gaia(crossmatch_targets, root, logger=logger)),
        ("simbad", lambda: crossmatch_simbad(crossmatch_targets, root, logger=logger)),
        ("planets", lambda: crossmatch_planets(crossmatch_targets, root, logger=logger)),
        ("tess_ebs", lambda: crossmatch_tess_ebs(crossmatch_targets, root, logger=logger)),
        ("followup_sectors", lambda: discover_followup_sectors(crossmatch_targets, root, logger=logger)),
    ]
    for name, operation in source_modules:
        try:
            frame = operation()
            failure_record = root / "catalogs" / f"{name}_failure.json"
            if failure_record.exists():
                failure_record.unlink()
            log_event(logger, "catalog_complete", catalog=name, rows=len(frame))
        except Exception as exc:
            failure = {"stage": name, "error": repr(exc)}
            failures.append(failure)
            write_json(root / "catalogs" / f"{name}_failure.json", failure)
            log_event(logger, "catalog_failure", **failure, traceback=traceback.format_exc())
    # Add match-status rows for targets whose catalogs could not be queried.
    for filename, status_col, fail_name in (("gaia_dr3.csv", "gaia_match_status", "gaia"),
                                             ("simbad.csv", "simbad_match_status", "simbad")):
        path = root / "catalogs" / filename
        if path.exists():
            frame = pd.read_csv(path)
        else:
            frame = pd.DataFrame(columns=["tic_id", status_col])
        have = set(pd.to_numeric(frame.get("tic_id", pd.Series(dtype=int)), errors="coerce").dropna().astype(int))
        missing = crossmatch_targets[~crossmatch_targets.tic_id.isin(have)]["tic_id"]
        if len(missing):
            frame = pd.concat([frame, pd.DataFrame({"tic_id": missing, status_col: "query_failed"})], ignore_index=True)
            write_csv(path, frame)
    _, inventory = build_manifest(targets, root, config, failures)
    print(json.dumps(inventory, indent=2))
    return inventory


def print_inventory() -> None:
    root = data_root()
    path = root / "metadata" / "manifest.json"
    if not path.exists():
        raise SystemExit(f"No inventory found at {path}; run celestial-data run first.")
    print(path.read_text(encoding="utf-8"))


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="celestial-data", description="Public archive TESS data acquisition")
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run", help="discover, download, crossmatch, preprocess, and inventory")
    run.add_argument("--sector", type=int, required=True)
    run.add_argument("--count", type=int, choices=(5, 50, 300), required=True)
    run.add_argument("--seed", type=int, default=20261110)
    run.add_argument("--eval-tic-file", help="Newline/CSV list of public known-example TIC IDs held out of random sample")
    run.add_argument("--quality-bitmask", type=int, default=175)
    run.add_argument("--resume", action="store_true")
    run.set_defaults(func=run_pipeline)
    follow = sub.add_parser("followup", help="download one additional sector for high-priority targets")
    follow.add_argument("--limit", type=int, default=20)
    inv = sub.add_parser("inventory", help="print final inventory")
    inv.set_defaults(func=lambda _: print_inventory())
    args = parser.parse_args(argv)
    result = args.func(args) if args.command != "inventory" else args.func(args)
    if args.command == "followup":
        root = data_root()
        ensure_layout(root)
        logger = make_logger(root)
        targets = pd.read_csv(root / "metadata" / "targets.csv")
        availability = pd.read_csv(root / "catalogs" / "sector_availability.csv")
        result = download_followup(targets, availability, root, args.limit, logger)
        print(result.to_string(index=False))


if __name__ == "__main__":
    main()
