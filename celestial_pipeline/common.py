from __future__ import annotations

import json
import logging
import os
import platform
import random
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import pandas as pd


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def data_root() -> Path:
    value = os.environ.get("CELESTIAL_DATA_ROOT")
    if not value:
        value = "/data/celestial-odyssey" if os.name != "nt" else "./data"
    root = Path(value).expanduser().resolve()
    if os.name == "nt" and not os.environ.get("CELESTIAL_ALLOW_LOCAL_DATA"):
        raise RuntimeError("Set CELESTIAL_DATA_ROOT to cloud persistent storage; set CELESTIAL_ALLOW_LOCAL_DATA=1 only for deliberate local development.")
    root.mkdir(parents=True, exist_ok=True)
    return root


def ensure_layout(root: Path) -> None:
    for name in ("raw", "processed", "catalogs", "metadata", "qc", "logs", "cache"):
        (root / name).mkdir(parents=True, exist_ok=True)


def make_logger(root: Path) -> logging.Logger:
    logger = logging.getLogger("celestial_pipeline")
    logger.setLevel(logging.INFO)
    if not logger.handlers:
        handler = logging.FileHandler(root / "logs" / "acquisition.jsonl", encoding="utf-8")
        handler.setFormatter(logging.Formatter('%(message)s'))
        logger.addHandler(handler)
    return logger


def log_event(logger: logging.Logger, event: str, **fields: Any) -> None:
    logger.info(json.dumps({"timestamp_utc": utc_now(), "event": event, **fields}, default=str))


def retry(call: Callable[[], Any], *, attempts: int = 4, base_delay: float = 2.0,
          logger: logging.Logger | None = None, label: str = "request") -> Any:
    error = None
    for attempt in range(1, attempts + 1):
        try:
            return call()
        except Exception as exc:
            error = exc
            if logger:
                log_event(logger, "retry", label=label, attempt=attempt, error=repr(exc))
            if attempt < attempts:
                time.sleep(base_delay * (2 ** (attempt - 1)) + random.random())
    raise RuntimeError(f"{label} failed after {attempts} attempts: {error}") from error


def read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path) if path.exists() and path.stat().st_size else pd.DataFrame()


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    tmp.replace(path)


def write_csv(path: Path, frame: pd.DataFrame) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    frame.to_csv(tmp, index=False)
    tmp.replace(path)
