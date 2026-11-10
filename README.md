# POLARIX

### Discover the unusual. Investigate the unknown.

POLARIX is a planned AI-assisted astronomy platform that turns real TESS stellar light curves into candidates people can explore, test, and document. It brings anomaly detection together with scientific verification, sky-map exploration, and predictions for suitable periodic events.

**Observe → Detect → Explore → Investigate → Predict → Document**

> **Project status:** The repository currently implements public-data acquisition, catalog crossmatching, quality filtering, normalization, rolling-median detrending, QC plots, and dataset inventory. The ML discovery workflow, interactive application, Gemma 4 investigator, and prediction/case-file features described below are planned—not yet implemented.

## The opportunity

TESS monitors stellar brightness over time. Repeating dips, flares, eclipsing binaries, and irregular variability can reveal interesting astrophysical behavior, but noise and instrument effects can look unusual too. POLARIX aims to help users move beyond “this looks different” to “what evidence supports an explanation?”

The initial dataset contains **300 real TESS light-curve FITS files** from a selected observing sector. Each light curve is a time series of stellar brightness measurements.

## Features

- **Hybrid anomaly detection:** BLS searches for repeating transit-like dips; SciPy peak detection finds flare-like spikes and isolated dips; Isolation Forest and Local Outlier Factor identify unusual stars. Rank fusion combines their evidence into a review shortlist.
- **Interactive Sky Explorer:** See candidate stars in their sky context.
- **Mystery Missions:** Explore signals through guided, educational investigations.
- **Signal Lab:** Compare observations, inspect quality flags, fold light curves by period, and test possible explanations.
- **Gemma 4 Investigator:** Explore hypotheses using approved scientific tools. Python performs the calculations; Gemma explains the measured evidence, contradictions, and uncertainty.
- **Predictions and Case Files:** Estimate future event times for reliable periodic signals, track later verification, and document evidence and conclusions.

Signals receive provisional, pattern-based categories—not confirmed astronomical classifications:

| Category | Signal pattern |
|---|---|
| **Hidden Shadows** | Repeating brightness dips |
| **Sudden Flashes** | Short-lived brightness increases |
| **Strange Patterns** | Irregular or unexpected variability |
| **Single Mysteries** | Isolated unusual events |

Nonperiodic signals are not assigned recurring predictions. Periodic predictions use a measured period and reference epoch and remain subject to later verification.

## Analysis roadmap

1. Filter unreliable measurements, normalize brightness, detrend long-term variations, and extract variability features.
2. Detect periodic dips, spikes, and isolated events; measure periods, depths, durations, MAD, standard deviation, skewness, kurtosis, and amplitude.
3. Rank unusual stars by fusing detector and outlier-model rankings.
4. Let users examine candidates and test hypotheses against actual measurements and catalog information.
5. Record evidence, uncertainty, and follow-up predictions for later review.

The web architecture is **React/Vite/Tailwind** with **Plotly** and **Aladin Lite**, backed by **FastAPI** and a Python analysis service. **Gemma 4** is intended to call bounded scientific tools such as quality-flag inspection, raw/corrected comparison, period folding, odd/even depth checks, and catalog lookup. This application architecture is a target design; it is not present in the current repository.

## Current pipeline and data

The implemented command-line pipeline discovers and downloads public **TESS SPOC 120-second** light curves through [MAST](https://archive.stsci.edu/missions-and-data/tess), preserves original FITS files, quality-filters and normalizes measurements, applies rolling-median detrending, creates QC plots, and inventories results.

Catalog crossmatches use:

- [Gaia DR3](https://www.cosmos.esa.int/web/gaia/data-release-3) for stellar identity and properties
- [SIMBAD](https://simbad.cds.unistra.fr/simbad/) for object identifiers and classifications
- [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) for known planets and candidates
- [MAST TESS eclipsing-binary catalog](https://archive.stsci.edu/hlsp/tess-ebs)

Data and products are stored under `data/`: raw FITS files, processed NPZ time series, catalog snapshots, QC plots, logs, and `metadata/manifest.json`. The manifest records download counts, failures, catalog statuses, and provenance. Local `data/` is intentionally Git-ignored.

## Run with Docker

Install and start [Docker Desktop](https://www.docker.com/products/docker-desktop/), then build the image from the project directory:

```shell
docker build -t celestial-odyssey .
```

Mount `data/` to keep downloads and results on your computer.

**macOS (Terminal):**

```shell
mkdir -p data
docker run --rm --mount "type=bind,source=$(pwd)/data,target=/data/celestial-odyssey" polarix run --sector 1 --count 5 --seed 20261110
docker run --rm --mount "type=bind,source=$(pwd)/data,target=/data/celestial-odyssey" polarix run --sector 1 --count 300 --seed 20261110 --resume
```

**Windows (PowerShell; Docker Desktop with WSL 2):**

```powershell
New-Item -ItemType Directory -Force .\data | Out-Null
$dataPath = (Resolve-Path .\data).Path
docker run --rm --mount "type=bind,source=$dataPath,target=/data/celestial-odyssey" polarix run --sector 1 --count 5 --seed 20261110
docker run --rm --mount "type=bind,source=$dataPath,target=/data/celestial-odyssey" polarix run --sector 1 --count 300 --seed 20261110 --resume
```

Counts of 5, 50, and 300 are supported. The second command resumes the same deterministic sample. Without the bind mount, container data is temporary. To inspect an existing dataset, replace `run ...` with `inventory`. Follow-up downloads are optional: `followup --limit 20`.

## Scientific care

An anomaly is a candidate for investigation, not a discovery claim. Outlier scores are not probabilities; TESS data can contain gaps, noise, and instrumental artifacts; AI-generated interpretations must be grounded in scientific calculations. Reliable confirmation may require additional observations. Cite the TESS mission, SPOC, and relevant data providers when publishing results; see the [TESS data-use policy](https://archive.stsci.edu/missions-and-data/tess) and [mission paper](https://doi.org/10.1088/1538-3873/aa4be0).

**POLARIX helps make unusual signals investigable—one measured light curve at a time.**
