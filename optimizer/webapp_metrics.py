"""
webapp_metrics.py  -  Thesis metrics (M-1 .. M-5) for the LIVE web app.

The web app runs the single-instance HDGWO optimizer (hd_gwo.py / wolf.py),
whose placements are 7-tuples (bin_id, x, y, z, l, h, d) keyed by item index.
This module computes the thesis metrics from that structure so the web app
can display the same M-1..M-5 numbers as the batch runner.

  M-1  SU   Space Utilization (%)              - Solution Quality
  M-2  CSR  Constraint Satisfaction Rate (%)   - Constraint Satisfaction
             (weight capacity + 80% base-support balancing; fragility N/A)
  M-3  ET   Execution Time (ms)                - Computational Cost  (timed by caller)
  M-4  PM   Peak Memory (MB)                   - Computational Cost  (tracemalloc by caller)
  M-5  Rob  Robustness = std dev of SU over runs - needs >1 run; the live
             single-run view reports it as null (see note in main_optimizer).

Coordinate convention (matches wolf.py / place_items):
    x = length axis, y = height axis (vertical), z = depth axis.
A box on the floor (y == 0) is support-compliant by convention; a box at
y > 0 must have >= 80% of its base footprint (x-z) resting on the top faces
(py + ph == y) of underlying boxes in the SAME bin.
"""

import math

SUPPORT_THRESHOLD = 0.80  # Christensen & Rousoe (2009); Koch et al. (2018)


def _overlap(a0, a1, b0, b1):
    return max(0, min(a1, b1) - max(a0, b0))


def space_utilization(placements, container, n_bins):
    """M-1. Packed volume / (n_bins * bin volume) as a percentage."""
    packed = sum(p[4] * p[5] * p[6] for p in placements.values())  # l*h*d
    bin_vol = container['L'] * container['H'] * container['D']
    cap = n_bins * bin_vol
    return (packed / cap) * 100.0 if cap > 0 else 0.0


def constraint_satisfaction(placements, items, container, weight_cap):
    """
    M-2. Percentage of placements satisfying BOTH the per-bin weight-capacity
    constraint AND the 80% base-support balancing constraint.

    Returns (csr_pct, detail_dict).
    """
    # Group placements by bin
    per_bin = {}
    bin_weight = {}
    for idx, p in placements.items():
        b = p[0]
        per_bin.setdefault(b, []).append(idx)
        bin_weight[b] = bin_weight.get(b, 0) + items[idx].get('weight', 1)

    total = len(placements)
    if total == 0:
        return 0.0, {"weight_compliance_pct": 0.0, "support_compliance_pct": 0.0,
                     "support_violations": 0, "overweight_bins": 0,
                     "fragility": "N/A (no LBS attribute in BR data)"}

    n_joint = 0
    n_weight_ok = 0
    n_support_ok = 0
    support_viol = 0
    overweight_bins = sum(1 for b, w in bin_weight.items()
                          if weight_cap is not None and w > weight_cap)

    for b, members in per_bin.items():
        wt_ok = (weight_cap is None) or (bin_weight[b] <= weight_cap)
        for i in members:
            (_, x, y, z, l, h, d) = placements[i]
            if y == 0:
                sup_ok = True
            else:
                supported = 0
                for j in members:
                    (_, px, py, pz, pl, ph, pd) = placements[j]
                    if py + ph != y:
                        continue
                    supported += (_overlap(x, x + l, px, px + pl) *
                                  _overlap(z, z + d, pz, pz + pd))
                base = l * d
                sup_ok = (supported / base) >= SUPPORT_THRESHOLD if base > 0 else False
            if wt_ok:
                n_weight_ok += 1
            if sup_ok:
                n_support_ok += 1
            else:
                support_viol += 1
            if wt_ok and sup_ok:
                n_joint += 1

    detail = {
        "weight_compliance_pct":  (n_weight_ok / total) * 100.0,
        "support_compliance_pct": (n_support_ok / total) * 100.0,
        "support_violations":     support_viol,
        "overweight_bins":        overweight_bins,
        "fragility":              "N/A (no LBS attribute in BR data)",
    }
    return (n_joint / total) * 100.0, detail


def compute_weight_capacity(items, container):
    """Same heuristic per-bin weight cap used by the batch geometry module."""
    total_wt = sum(item.get('weight', 1) for item in items)
    vol_cap  = container['L'] * container['H'] * container['D']
    vol_items = sum(i['L'] * i['H'] * i['D'] for i in items)
    lb = max(1, math.ceil(vol_items / vol_cap)) if vol_cap else 1
    return math.ceil(total_wt / lb)


def assign_weights(items, seed=42):
    """Deterministic synthetic weights (BR data has none). Controlled variable."""
    import random
    rng = random.Random(seed)
    for item in items:
        if 'weight' not in item:
            item['weight'] = rng.randint(1, 20)


def robustness(su_values):
    """M-5. Sample std dev of SU across runs. Returns None if <2 runs."""
    n = len(su_values)
    if n < 2:
        return None
    mean = sum(su_values) / n
    var = sum((v - mean) ** 2 for v in su_values) / (n - 1)
    return math.sqrt(var)