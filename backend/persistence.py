from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any


_lock = threading.RLock()


def read_records(path: Path) -> list[dict[str, Any]]:
    with _lock:
        if not path.is_file():
            return []
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, list) else []


def write_records(path: Path, records: list[dict[str, Any]]) -> None:
    with _lock:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(json.dumps(records, indent=2, ensure_ascii=False, allow_nan=False), encoding="utf-8")
        os.replace(temporary, path)
