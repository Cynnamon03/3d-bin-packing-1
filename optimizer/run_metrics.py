"""
run_metrics.py  -  Baseline evaluation using the THESIS metrics.

Runs the Phase-2 3D HD-GWO baseline on BR instances, R independent runs
each, and reports the five thesis metrics:

  M-1 SU (%)   M-2 CSR (%)   M-3 ET (ms)   M-4 PM (MB)   M-5 Rob (std of SU)

Usage (from the optimizer folder):
  python run_thesis_metrics.py --set BR0 --count 5 --runs 5 --max-time 30 --out thesis_metrics_results.txt

For the thesis proper, --runs should be 30 (per the methodology); 5 is a
reasonable budget for the ITAI activity.
"""

import os
import sys
import time
import json
import random
import argparse
import tracemalloc

from instance_reader import load_instance
from geometry_3d     import assign_weights, compute_weight_capacity
from wolf_3d         import hd_gwo_3d
from metrics  import (space_utilization,
                             constraint_satisfaction_rate,
                             robustness)


def run_instance(path, pop, max_iter, max_time, runs):
    container, items = load_instance(path)
    assign_weights(items, seed=42)             # controlled variable: fixed weights
    weight_cap = compute_weight_capacity(items, container)

    su_list, csr_list, et_list, pm_list = [], [], [], []
    detail_last = None
    bins_list = []

    for r in range(runs):
        random.seed(1000 + r)                  # independent run r
        tracemalloc.start()
        t0   = time.perf_counter()
        best = hd_gwo_3d(items, container,
                         pop_size=pop, max_iter=max_iter, max_time=max_time)
        et_ms = (time.perf_counter() - t0) * 1000.0          # M-3
        _, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        pm_mb = peak / (1024 * 1024)                          # M-4

        su = space_utilization(best, container)               # M-1
        csr, detail = constraint_satisfaction_rate(best, items, weight_cap)  # M-2

        su_list.append(su)
        csr_list.append(csr)
        et_list.append(et_ms)
        pm_list.append(pm_mb)
        bins_list.append(best.n_bins)
        detail_last = detail

        print(f"    run {r+1}/{runs}: SU={su:.1f}%  CSR={csr:.1f}%  "
              f"ET={et_ms:.0f}ms  PM={pm_mb:.1f}MB  bins={best.n_bins}",
              file=sys.stderr, flush=True)

    return {
        "instance":  os.path.splitext(os.path.basename(path))[0],
        "n_items":   len(items),
        "runs":      runs,
        "bins_mode": max(set(bins_list), key=bins_list.count),
        "SU_mean":   sum(su_list) / runs,
        "CSR_mean":  sum(csr_list) / runs,
        "ET_mean":   sum(et_list) / runs,
        "PM_peak":   max(pm_list),
        "Rob":       robustness(su_list),                     # M-5
        "detail":    detail_last,
        "SU_runs":   su_list,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--set",       default="BR0")
    ap.add_argument("--count",     type=int, default=5)
    ap.add_argument("--runs",      type=int, default=5,
                    help="independent runs per instance (thesis uses 30)")
    ap.add_argument("--pop",       type=int, default=20)
    ap.add_argument("--iter",      type=int, default=50)
    ap.add_argument("--max-time",  type=int, default=30)
    ap.add_argument("--data-root", default=os.path.join("..", "data",
                                                        "CLP-Datasets-Main", "BR"))
    ap.add_argument("--max-items", type=int, default=300,
                    help="skip instances larger than this (3D baseline "
                         "initialization scales poorly above ~300 items)")
    ap.add_argument("--out",       default=None)
    args = ap.parse_args()

    set_path = os.path.join(args.data_root, args.set)
    if not os.path.isdir(set_path):
        print(f"ERROR: folder not found: {set_path}")
        sys.exit(1)

    all_files = sorted([f for f in os.listdir(set_path) if f.endswith(".json")],
                       key=lambda f: int(os.path.splitext(f)[0]))
    files = []
    for f in all_files:
        _, its = load_instance(os.path.join(set_path, f))
        if len(its) > args.max_items:
            print(f"  skipping {f} (n={len(its)} > --max-items {args.max_items})",
                  file=sys.stderr)
            continue
        files.append(f)
        if len(files) >= args.count:
            break

    results = []
    for i, fname in enumerate(files):
        print(f"\n[{i+1}/{len(files)}] {args.set}/{fname}",
              file=sys.stderr, flush=True)
        results.append(run_instance(os.path.join(set_path, fname),
                                    args.pop, args.iter, args.max_time,
                                    args.runs))

    lines = []
    lines.append("=" * 92)
    lines.append("  BASELINE RESULTS - THESIS METRICS (empirical, "
                 f"{args.runs} independent runs per instance)")
    lines.append("=" * 92)
    lines.append(f"{'Instance':<14}{'n':>6}{'Bins':>6}"
                 f"{'M-1 SU%':>10}{'M-2 CSR%':>10}{'M-3 ET(ms)':>12}"
                 f"{'M-4 PM(MB)':>12}{'M-5 Rob':>9}")
    lines.append("-" * 92)
    for r in results:
        lines.append(f"{args.set + '/' + r['instance']:<14}{r['n_items']:>6}"
                     f"{r['bins_mode']:>6}{r['SU_mean']:>10.1f}"
                     f"{r['CSR_mean']:>10.1f}{r['ET_mean']:>12.0f}"
                     f"{r['PM_peak']:>12.1f}{r['Rob']:>9.2f}")
    lines.append("-" * 92)

    n = len(results)
    lines.append(f"{'MEAN':<14}{'':>6}{'':>6}"
                 f"{sum(r['SU_mean'] for r in results)/n:>10.1f}"
                 f"{sum(r['CSR_mean'] for r in results)/n:>10.1f}"
                 f"{sum(r['ET_mean'] for r in results)/n:>12.0f}"
                 f"{max(r['PM_peak'] for r in results):>12.1f}"
                 f"{sum(r['Rob'] for r in results)/n:>9.2f}")
    lines.append("")
    lines.append("  Constraint breakdown (last run of last instance):")
    d = results[-1]["detail"]
    lines.append(f"    Weight-capacity compliance : {d['weight_compliance_pct']:.1f}%"
                 f"  (overweight bins: {d['overweight_bins']})")
    lines.append(f"    80% base-support compliance: {d['support_compliance_pct']:.1f}%"
                 f"  (violating placements: {d['support_violations']})")
    lines.append(f"    Fragility / LBS            : {d['fragility']}")
    lines.append("")
    lines.append("  NOTE: The baseline does NOT enforce the 80% base-support or")
    lines.append("  fragility constraints; CSR < 100% here documents the gap the")
    lines.append("  thesis hybrid configurations are designed to close.")
    lines.append("=" * 92)

    out = "\n".join(lines)
    print("\n" + out)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(out + "\n\n" + json.dumps(
                [{k: v for k, v in r.items() if k != "detail"} for r in results],
                indent=2))
        print(f"\nSaved to {args.out}")


if __name__ == "__main__":
    main()