from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np


@lru_cache(maxsize=32)
def load_npz_cached(path_string: str, modified_ns: int) -> dict[str, np.ndarray]:
    """Cache parsed arrays by path and mtime so repeated UI/API reads do not reopen NPZs."""
    del modified_ns
    with np.load(path_string, allow_pickle=False) as archive:
        return {name: np.asarray(archive[name]) for name in archive.files if name != "metadata_json"}


def load_npz(path: Path) -> dict[str, np.ndarray]:
    return load_npz_cached(str(path), path.stat().st_mtime_ns)
