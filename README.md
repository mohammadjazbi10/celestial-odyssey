# Celestial Odyssey real-data acquisition

This package acquires only public archive measurements. It does not create replacement or simulated observations. Run it in a cloud VM/notebook with a persistent volume mounted at `CELESTIAL_DATA_ROOT`; the default is `/data/celestial-odyssey` on Linux and `./data` for local development. The acquisition command refuses to write to a Windows user profile by default, so configure an explicit mounted cloud path before running it on a laptop.

## Setup and staged runs

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e .
export CELESTIAL_DATA_ROOT=/mnt/persistent/celestial-odyssey

# Five targets: discover, fetch, crossmatch, preprocess, inventory
celestial-data run --sector 1 --count 5 --seed 20261110
# Expand the same deterministic sample to a milestone and the full set
celestial-data run --sector 1 --count 50 --seed 20261110 --resume
celestial-data run --sector 1 --count 300 --seed 20261110 --resume
celestial-data inventory
```

Pick a sector where the MAST search returns at least 300 unique public SPOC 120-second light curves. Discovery checks the selected sector and fails clearly when the archive does not provide enough unique targets. A run can be resumed safely: successful FITS downloads are retained and verified; failed work is logged and retried on subsequent runs. `--eval-tic-file` accepts a newline-separated list of real TIC IDs to reserve as evaluation examples before random sampling. Known confirmed planets, planet candidates, and cataloged eclipsing binaries found by the archive crossmatches are also labeled `split=evaluation` in the final `targets.csv`; other targets are labeled `train`. No TIC IDs are invented by the pipeline.

Follow-up download is opt-in and limited to the highest-priority targets in the manifest:

```bash
celestial-data followup --limit 20
```

Priority favors targets with more available sectors and catalog flags. No follow-up files are downloaded by the main command.

## Data layout

```text
$CELESTIAL_DATA_ROOT/
  raw/tic-<id>/sector-<n>.fits
  processed/tic-<id>/sector-<n>.npz
  catalogs/{gaia_dr3,simbad,known_objects,tess_ebs,sector_availability}.csv
  metadata/targets.csv, target_metadata.json, manifest.json
  qc/tic-<id>-sector-<n>.png
  logs/acquisition.jsonl
```

NPZ files preserve original time, SAP/PDCSAP flux and uncertainties, quality, centroid/background arrays when present, their source-column availability, the raw quality mask, the finite-value mask, and processed normalized/detrended arrays. FITS files remain untouched. Gaia/SIMBAD matches are coordinate based and include match separations; matches beyond the configured radius are not accepted, and near-tied matches are explicitly marked ambiguous. A no-match is a valid catalog result, distinct from a query failure.

Catalog snapshots carry source names, query URLs/table names, and UTC retrieval timestamps. Planet rows retain archive dispositions and are separated into confirmed planets and candidates. TESS-EB coverage uses the public MAST HLSP catalog CSV. Catalog service failures are logged and are not converted to empty successful matches.

## Cloud persistence

Set `CELESTIAL_DATA_ROOT` to a durable mounted path (for example, a persistent block volume or object-storage FUSE mount) in the cloud job. The package writes and caches data only under that root. It does not provision cloud infrastructure or upload to an account. Keep the persistent volume attached between staged runs. Network egress to [MAST](https://mast.stsci.edu/api/v0/), [ESA Gaia TAP](https://gea.esac.esa.int/tap-server/tap), [CDS SIMBAD](https://simbad.cds.unistra.fr/simbad/sim-tap), [NASA Exoplanet Archive TAP](https://exoplanetarchive.ipac.caltech.edu/TAP/), and the [MAST TESS-EB catalog](https://archive.stsci.edu/hlsp/tess-ebs) is required. MAST is the official TESS archive; SPOC is selected by product provenance and 120-second exposure metadata. TESS-EB v1.0 covers Sectors 1–26, so its no-match does not imply that a target is not an eclipsing binary.

The included Docker image is cloud-runner ready. Build/push it to your cloud container registry, attach a persistent volume at `/data`, and run the staged commands above with `docker run -v <persistent-volume-mount>:/data <image> run ...`. The repository does not create cloud resources or receive cloud credentials.

## Output contract

`targets.csv` is the join point for the React Aladin Lite map and ML tools: TIC, coordinates, sector, Gaia DR3 and SIMBAD identifiers/classifications, known-object flags, periods where reported, paths, cadence, provenance, quality counts, and evaluation split. `target_metadata.json` preserves nested source records. Per-source catalog CSVs are also available for scientific verification. `manifest.json` records the random seed, query configuration, counts, versions, and retrieval timestamps.

## Limitations surfaced in inventory

Inventory distinguishes downloaded light curves from unique targets, successful catalog matches from explicit non-matches, and failures from unattempted work. It reports available and downloaded follow-up sectors, observation point counts, and persistent disk use. A completed target count is never inferred from the requested count.
