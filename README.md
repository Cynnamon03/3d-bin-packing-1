# 3D Bin Packing — HD-GWO Optimizer

A Hybrid Discrete Grey Wolf Optimizer (HD-GWO) for the Three-Dimensional Bin
Packing Problem, with a live web-based 3D visualizer and a batch evaluation
suite. This repository is the baseline implementation supporting the
undergraduate thesis on intra-variant GWO hybridization for the constrained
3D-BPP (Group 12, BSCS, Polytechnic University of the Philippines).

The system packs a set of boxes into the minimum number of fixed-size
containers while reporting the five thesis evaluation metrics (M-1 through
M-5) on every run.

## Repository layout

```
3d-bin-packing/
├── optimizer/        Python optimizer, metrics, and batch runners
├── server/           Node.js/Express + WebSocket backend
├── client/           React + Three.js frontend (live 3D viewer)
└── data/             Bischoff–Ratcliff (BR) benchmark instances (JSON)
```

The `data/CLP-Datasets-main/BR/` folder holds the benchmark sets BR0–BR18,
100 JSON instances each. Large preprocessed splits (`data/train/`,
`data/held_out/`) are intentionally excluded from the repository because they
exceed GitHub's file-size limit; obtain them separately if needed.

## Requirements

- Python 3.12 (no third-party packages required for the core optimizer; it
  uses only the standard library)
- Node.js v22 or later (for the web app)

## Quick start

### 1. Command-line optimizer

Run a single instance and print a JSON result, including the M-1–M-5 metrics:

```bash
cd optimizer
python main_optimizer.py ../data/CLP-Datasets-main/BR/BR0/21.json --max-time 30
```

### 2. Web app (live 3D visualizer)

The web app needs two processes running at the same time, in two terminals.

Terminal 1 — backend (HTTP API on port 3001, WebSocket on port 3002):

```bash
cd server
npm install        # first time only
node index.js
```

Terminal 2 — frontend (opens http://localhost:3000):

```bash
cd client
npm install        # first time only
npm start
```

Pick an instance from the dropdown and start a run. The 3D viewer renders the
initial packing within about a second, then refreshes each iteration. Smaller
instances (for example BR0/21 at 41 items or BR0/4 at 87 items) are best for
a smooth demo; very large instances pack slowly because each iteration
re-decodes the full arrangement.

The backend spawns `python` for each run, so Python must be on the PATH of the
shell that launches `node index.js`.

## Evaluation metrics (M-1 – M-5)

Every run reports the thesis evaluation metrics:

| Metric | Name | Definition |
| --- | --- | --- |
| M-1 | Space Utilization (SU) | Packed volume as a percentage of total active-bin volume |
| M-2 | Constraint Satisfaction Rate (CSR) | Percentage of placements satisfying per-bin weight capacity and the 80% base-support balancing constraint |
| M-3 | Execution Time (ET) | Wall-clock run time in milliseconds |
| M-4 | Peak Memory (PM) | Peak memory in MB, measured with `tracemalloc` |
| M-5 | Robustness (Rob) | Standard deviation of SU across independent runs |

Notes on the baseline:

- Box weights are synthetic and deterministic (fixed seed), because the BR
  benchmark does not include native weights. This keeps weight a controlled,
  reproducible variable across runs.
- Fragility / load-bearing strength is reported as N/A on this dataset, as the
  BR JSON files carry no load-bearing-strength attribute.
- The baseline does not enforce the 80% base-support constraint, so CSR may
  fall below 100%. This is expected and documents the feasibility gap that the
  thesis hybrid configurations are designed to close.
- M-5 requires more than one run, so the live single-run web view reports it as
  N/A; use the batch metrics runner below to obtain it.

## Batch evaluation

To evaluate the baseline across many instances with several independent runs
each (the full thesis protocol uses 30 runs per instance):

```bash
cd optimizer
python run_metrics.py --set BR0 --count 10 --runs 5 --max-time 30 --out metrics_results.txt
```

Key flags:

- `--set` — BR set folder (default BR0)
- `--count` — number of instances to evaluate
- `--runs` — independent runs per instance (the thesis methodology uses 30)
- `--max-time` — per-run wall-clock limit in seconds
- `--max-items` — skip instances larger than this (the 3D baseline scales
  poorly above roughly 300 items)

Results are written as a formatted table plus a JSON dump.

## Key source files

In `optimizer/`:

- `main_optimizer.py` — command-line and streaming entry point for the web app
- `hd_gwo.py`, `wolf.py` — the HD-GWO algorithm and 3D placement engine
- `instance_reader.py` — loads BR benchmark JSON instances
- `webapp_metrics.py` — M-1–M-5 metrics for the live single-instance runs
- `run_metrics.py`, `thesis_metrics.py` — batch metrics suite (includes M-5)
- `run_phase2.py`, `wolf_3d.py`, `geometry_3d.py` — Phase-2 3D pipeline

In `server/`:

- `index.js` — Express API and WebSocket server; spawns the Python optimizer
  per run and streams its JSON events to the client

In `client/src/`:

- `App.js` — single-instance view with the live 3D viewer and metrics panel
- `BatchRunner.jsx` — multi-instance batch view with a per-instance metrics table
- `BinViewer.jsx` — Three.js 3D rendering of a packed container

## Notes for contributors

The benchmark dataset lives under `data/` but the very large preprocessed
splits are git-ignored. After any history rewrite (for example, removing
oversized files), other contributors should re-clone or run
`git fetch origin && git reset --hard origin/main` to realign their local
history.
