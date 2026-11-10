
# 🌌 POLARIX
### Discover the Unusual. Investigate the Unknown.
**Team Name** - Zenkai
**Team Members** - 1.Rajesh Kumar Swain
               2.Mohammad Jazbi
               3.Abankita Behera
**An AI-Powered Platform for Astronomical Anomaly Discovery, Scientific Investigation & Future Predictions**

POLARIX combines real NASA TESS observations, hybrid machine learning, scientific verification, and Google Gemma 4 to help users discover, explore, investigate, and document unusual stellar behavior.

**Observe → Detect → Explore → Investigate → Predict → Document**

> **Project Status:** Integration in progress. The data acquisition and preprocessing pipeline is implemented. The ML discovery outputs and interactive application are being integrated. Features described below represent the intended complete platform; their availability depends on the current implementation.

---

## 1. Overview

Space telescopes generate enormous amounts of astronomical observations. Within these datasets, unusual stellar brightness patterns may indicate planetary transits, stellar flares, eclipsing binaries, intrinsic variability, or instrumental artifacts.

Identifying unusual signals is only the first challenge. Understanding their possible causes requires scientific analysis, external catalog verification, and careful interpretation.

**POLARIX bridges the gap between automated anomaly detection and evidence-based astronomical investigation.**

The platform aims to make real astronomical data accessible to researchers, students, and citizen scientists through interactive visualizations and AI-assisted scientific reasoning.

### Our Objectives

- Detect and rank unusual stellar signals using hybrid ML.
- Visualize real telescope observations and astronomical objects.
- Investigate candidates through scientific Python tools.
- Cross-verify findings using established astronomical catalogs.
- Use Gemma 4 to evaluate hypotheses and explain evidence.
- Predict future occurrences of suitable periodic events.
- Document investigations in reproducible scientific case files.

---

## 2. Dataset & Astronomical Sources

### NASA TESS Observations

POLARIX's initial dataset contains **300 real NASA TESS SPOC light-curve FITS files**, acquired at a 120-second cadence from a selected observing sector.

Each light curve contains measurements of stellar brightness over time, enabling the detection of periodic and irregular variations.

The project preserves original observations and produces processed time series for downstream analysis.

### Astronomical Catalogs

| Source | Purpose |
|---|---|
| [NASA TESS / MAST](https://archive.stsci.edu/missions-and-data/tess) | Original stellar light curves and observation metadata |
| [Gaia DR3](https://www.cosmos.esa.int/web/gaia/data-release-3) | Stellar positions, distances, and physical properties |
| [SIMBAD](https://simbad.cds.unistra.fr/simbad/) | Known astronomical identities and classifications |
| [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) | Known exoplanets and planetary candidates |
| [TESS Eclipsing Binary Catalog](https://archive.stsci.edu/hlsp/tess-ebs) | Known eclipsing binary systems |

Catalog matches provide supporting context, not automatic confirmation of a new discovery.

---

## 3. How POLARIX Works

```text
            NASA TESS Light Curves
                     |
                     v
           Data Preprocessing
      Quality Filtering & Detrending
                     |
                     v
          Hybrid Anomaly Detection
       BLS | Peaks | Isolation Forest
                 | LOF
                     |
                     v
           Candidate Ranking
                     |
                     v
       Discover Anomalies / Sky Map
                     |
                     v
           Candidate Workspace
                     |
          +----------+----------+
          |                     |
          v                     v
      Signal Lab         Gemma 4 Investigator
   Scientific Tests      Hypothesis Evaluation
          |                     |
          +----------+----------+
                     |
                     v
       Scientific Catalog Verification
       Gaia | SIMBAD | Exoplanet Archive
                     |
                     v
          Evidence-Based Findings
                     |
          +----------+----------+
          |                     |
          v                     v
    Future Predictions     Scientific Case Files
```

### Step 1: Data Preprocessing

The preprocessing pipeline prepares real TESS observations for analysis.

- Read and preserve original FITS files.
- Remove unreliable measurements using quality flags.
- Normalize stellar brightness.
- Apply rolling-median detrending.
- Produce processed light curves and quality-control plots.
- Record data provenance and processing information.

### Step 2: Hybrid Anomaly Detection

POLARIX combines complementary algorithms to detect different signal patterns.

| Algorithm | Scientific Purpose |
|---|---|
| **Box Least Squares (BLS)** | Detect repeating transit-like brightness dips |
| **SciPy Peak Detection** | Identify sudden brightness changes and isolated events |
| **Isolation Forest** | Identify globally unusual stellar behavior |
| **Local Outlier Factor (LOF)** | Detect stars differing from similar observations |
| **Rank Fusion** | Combine detector evidence into prioritized candidates |

Statistical features include standard deviation, median absolute deviation (MAD), skewness, kurtosis, amplitude, and other variability measurements.
Below images show our analysis of data:

<img width="1280" height="832" alt="WhatsApp Image 2026-11-10 at 5 19 51 PM" src="https://github.com/user-attachments/assets/3446daff-1748-4d1a-b795-800f37ecd4cc" />
<img width="1280" height="832" alt="WhatsApp Image 2026-11-10 at 5 19 53 PM" src="https://github.com/user-attachments/assets/807e4d1b-25ff-403e-b278-5928650ba031" />
<img width="1280" height="832" alt="WhatsApp Image 2026-11-10 at 5 19 52 PM" src="https://github.com/user-attachments/assets/02f1b6f6-f534-4e58-8d10-007e5b0a47e2" />


### Step 3: Candidate Categorization

Detected anomalies are organized into four provisional categories.

| Category | Observed Pattern |
|---|---|
| **Hidden Shadows** | Repeating brightness dips |
| **Sudden Flashes** | Short-duration brightness increases |
| **Strange Patterns** | Irregular or unexpected variability |
| **Single Mysteries** | Isolated unusual events |

These categories describe signal behavior, not confirmed astronomical classifications.

### Step 4: Scientific Investigation

Users examine candidate light curves, execute scientific tests, compare possible explanations, and inspect external catalog information.

### Step 5: Prediction & Documentation

For suitable periodic candidates, POLARIX calculates future event times and maintains prediction records. Scientific Case Files preserve evidence, test results, explanations, and uncertainty.

---

## 4. Platform Features

### Dashboard

Provides an overview of the analyzed dataset, including:

- Processed-star and anomaly counts.
- Distribution of anomaly categories.
- High-ranking candidates.
- Recent investigations.
- Links to scientific analysis tools.

### Discover Anomalies

An interactive candidate browser supporting:

- Ranked anomaly lists.
- Signal categories and detector scores.
- Search, sorting, and filtering.
- Candidate selection and investigation.


### Candidate Workspace

A dedicated scientific workspace for each star, displaying its available metadata, observations, anomaly evidence, and investigation history.

### Signal Lab

Interactive light-curve analysis using actual TESS measurements.

Features include:

- Brightness-versus-time visualization.
- SAP and PDCSAP flux comparison.
- Quality flag inspection.
- Detected event markers.
- Period folding for periodic signals.
- Odd/even transit-depth comparison.
- Interactive zoom and signal inspection.

### Interactive Sky Explorer

Uses **Aladin Lite** to display analyzed stars in their astronomical sky context.

Users can explore real stellar coordinates, inspect candidate information, filter anomalies, and open individual investigations.

### Mystery Missions

Guided astronomical investigations designed to make scientific exploration interactive.

Each mission provides:

- A real candidate and scientific objective.
- Evidence-based clues.
- Investigation steps.
- Links to Signal Lab and Gemma 4.
- Progress tracking and saved conclusions.

### My Investigations

Allows users to save, reopen, and continue candidate investigations, including scientific tests, AI findings, notes, and mission progress.

---

## 5. Gemma 4: AI Scientific Investigator

POLARIX integrates **Google Gemma 4 26B A4B Instruction-Tuned**, using the model identifier:

`gemma-4-26b-a4b-it`

The integration uses Google's `google-genai` Python SDK and the Gemini API.

Gemma acts as an evidence-grounded scientific reasoning assistant rather than a replacement for scientific calculations.

### Applications

1. **Anomaly Interpretation:** Explain why a star was flagged using actual ML evidence.
2. **Hypothesis Generation:** Consider planetary transits, eclipsing binaries, stellar variability, flares, and instrumental artifacts.
3. **Scientific Tool Calling:** Request approved Python functions through the FastAPI backend.
4. **Catalog Verification:** Interpret Gaia, SIMBAD, and exoplanet catalog matches.
5. **Ask the Star:** Answer candidate-specific questions using available evidence.
6. **Evidence Evaluation:** Compare supporting and contradicting findings.
7. **Prediction Interpretation:** Explain calculated future events and their limitations.
8. **Case File Summarization:** Organize findings into readable scientific reports.

### Scientific Tool Calling

Gemma can request approved functions such as:

| Tool | Function |
|---|---|
| `inspect_quality_flags` | Identify questionable measurements |
| `compare_raw_corrected` | Compare SAP and PDCSAP observations |
| `fold_at_period` | Examine periodic signal consistency |
| `check_odd_even_depth` | Test differences between alternating dips |
| `get_crossmatch` | Retrieve relevant catalog information |

**Python performs scientific calculations. Gemma interprets the returned evidence.**

Tool execution is controlled by the backend. The model does not receive unrestricted Python execution access.

---

## 6. Scientific Verification

POLARIX combines two complementary verification approaches.

### Signal-Level Verification

Scientific Python tools investigate whether a detected signal is consistent with real stellar behavior or may be affected by observational artifacts.

Tests include:

- TESS quality flag inspection.
- Raw versus corrected flux comparison.
- Period-folded signal analysis.
- Odd/even transit-depth checks.
- Examination of event consistency and available observations.

### Astronomical Catalog Verification

POLARIX crossmatches candidates with established astronomical databases.

- **SIMBAD:** Known object identity and classification.
- **Gaia DR3:** Stellar properties and nearby-source information.
- **NASA Exoplanet Archive:** Existing planetary systems and candidates.
- **TESS Eclipsing Binary Catalog:** Known binary-system associations.

The investigation distinguishes confirmed catalog matches, ambiguous matches, unavailable information, and possible contamination.

Catalog information is combined with measured light-curve evidence to evaluate hypotheses.

---

## 7. Future Predictions & Prediction Ledger

POLARIX extends candidate investigation into testable future-event forecasting.

For suitable periodic signals, the system uses measured BLS periods and reference epochs to calculate upcoming event times.

### Prediction Workflow

```text
Detected Periodic Signal
          |
          v
Measured Period & Epoch
          |
          v
Future Event Calculation
          |
          v
Predicted Time & Event Window
          |
          v
Prediction Ledger
          |
          v
Later Observation & Verification
```

### Prediction Ledger

Each prediction may record:

- Candidate identifier.
- Measured period and reference epoch.
- Predicted event time.
- Event duration and uncertainty where available.
- Calculation timestamp and provenance.
- Verification status.

Supported statuses are **Awaiting Observation**, **Supported**, and **Contradicted**.

Predictions are not treated as confirmed events. Nonperiodic signals are not assigned recurring forecasts.

---

## 8. Scientific Case Files

POLARIX provides structured documentation for astronomical investigations.

A Scientific Case File may include:

- Candidate identity and TESS provenance.
- Stellar metadata and catalog matches.
- ML anomaly scores and detected events.
- Scientific verification results.
- Gemma 4 hypotheses and tool execution history.
- Supporting and contradicting evidence.
- Future predictions and verification status.
- Scientific limitations and unresolved questions.

Reports are intended to support JSON export and, where implemented, PDF generation.

---

## 9. Technology Stack

| Component | Technologies |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Visualization | Plotly, Aladin Lite |
| Backend | Python, FastAPI |
| Astronomical Processing | Astropy, Lightkurve, Astroquery |
| Scientific Computing | NumPy, Pandas, SciPy |
| Machine Learning | scikit-learn, BLS, Isolation Forest, LOF |
| AI Investigator | Google Gemma 4 26B A4B, `google-genai` |
| Data Formats | FITS, NPZ, CSV, JSON |
| Containerization | Docker |

### Architecture

**TESS FITS → Processing & ML → FastAPI → Scientific Tools / Gemma 4 → React Interface**

The backend manages astronomical data, scientific calculations, catalog queries, predictions, and AI interactions. The frontend provides interactive exploration and investigation.

---

## 10. Current Implementation & Repository Data

The existing data pipeline supports:

- Public TESS SPOC light-curve acquisition through MAST.
- Original FITS preservation.
- Quality filtering and normalization.
- Rolling-median detrending.
- Quality-control plots.
- Catalog crossmatching.
- Dataset inventory and provenance tracking.

The project stores local scientific data under `data/`, including:

- Raw FITS observations.
- Processed NPZ light curves.
- Catalog snapshots.
- Quality-control plots.
- Processing logs.
- `metadata/manifest.json`.

The manifest records dataset counts, download failures, catalog statuses, and provenance.

**Local scientific data is excluded from Git through `.gitignore`.**

ML integration, frontend functionality, Gemma 4 tool calling, and prediction/reporting features should be validated against the current application before being marked complete.

---

## 11. Installation & Running

### Prerequisites

- Docker Desktop
- Python and Node.js for direct local development, if supported by the repository
- A Google Gemini API key for Gemma 4 functionality

### Environment Configuration

Store the API key in the backend `.env` file:

```env
GEMINI_API_KEY=your_api_key_here
GEMMA_MODEL=gemma-4-26b-a4b-it
```

Never commit `.env` or expose credentials through frontend code.

### Docker: Data Pipeline

Build the existing data-processing image using the repository's Dockerfile:

```bash
docker build -t celestial-odyssey .
```

Mount a local `data/` directory to preserve observations and processing results.

**macOS / Linux**

```bash
mkdir -p data

docker run --rm \
  --mount "type=bind,source=$(pwd)/data,target=/data/celestial-odyssey" \
  polarix run --sector 1 --count 5 --seed 20261110
```

**Windows PowerShell**

```powershell
New-Item -ItemType Directory -Force .\data | Out-Null
$dataPath = (Resolve-Path .\data).Path

docker run --rm `
  --mount "type=bind,source=$dataPath,target=/data/celestial-odyssey" `
  polarix run --sector 1 --count 5 --seed 20261110
```

To resume the larger dataset acquisition, use the same mount with `--count 300 --resume`.

> **Note:** The existing Docker instructions use `celestial-odyssey` as the image name but `polarix` in the run command. These must match. Confirm the actual image name, container entry point, and current frontend/backend startup commands before publishing installation instructions.

---

## 12. Scientific Reliability & Limitations

POLARIX is designed as a candidate discovery and investigation platform, not an automated discovery-confirmation system.

Important considerations:

- Anomalies are not automatically new astronomical discoveries.
- ML outlier scores are not calibrated discovery probabilities.
- TESS observations contain gaps, noise, and instrumental artifacts.
- Catalog crossmatches may be ambiguous or incomplete.
- Gemma-generated explanations require measured supporting evidence.
- Periodic predictions depend on the reliability of fitted parameters.
- Scientific confirmation may require independent follow-up observations.

All scientific conclusions should distinguish observed measurements, model-generated hypotheses, catalog information, and unresolved uncertainty.

---

## 13. Future Scope

- Expand analysis beyond the initial 300 light curves.
- Support additional TESS observing sectors.
- Introduce advanced time-series anomaly detection.
- Improve automated verification and candidate ranking.
- Incorporate additional astronomical surveys.
- Support collaborative citizen-science investigations.
- Extend long-term prediction tracking and follow-up analysis.

---

## 14. References & Acknowledgments

POLARIX builds on publicly accessible astronomical datasets and scientific software.

- [NASA TESS Mission](https://tess.mit.edu/)
- [MAST Archive](https://archive.stsci.edu/)
- [TESS Mission Paper](https://doi.org/10.1088/1538-3873/aa4be0)
- [Gaia DR3](https://www.cosmos.esa.int/web/gaia/data-release-3)
- [SIMBAD Astronomical Database](https://simbad.cds.unistra.fr/simbad/)
- [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/)
- [Astropy](https://www.astropy.org/)
- [Lightkurve](https://docs.lightkurve.org/)

---

### POLARIX
**Discover the Unusual. Investigate the Unknown.**

*Turning astronomical anomalies into evidence-based scientific investigations.*
