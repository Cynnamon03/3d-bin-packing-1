"""
metrics.py  -  Thesis evaluation metrics (M-1 .. M-5) for the baseline.

Implements the five operational metrics defined in the thesis
(Group 12, COSC 305), computed on the Phase-2 3D HD-GWO baseline:

  M-1  SU   Space Utilization (%)          - Solution Quality
  M-2  CSR  Constraint Satisfaction Rate (%) - Constraint Satisfaction
             (weight capacity, fragility/LBS, 80% base-support balancing)
  M-3  ET   Execution Time (ms)            - Computational Cost
  M-4  PM   Peak Memory (MB, tracemalloc)  - Computational Cost
  M-5  Rob  Robustness = std dev of SU across R independent runs

Notes for the baseline (honest-measurement policy):
  * Weight capacity IS enforced by the baseline (place_bin_dblf), so its
    compliance is measured (expected ~100%), not assumed.
  * The 80% base-support balancing constraint is NOT enforced by the
    baseline. It is *measured* here so the baseline's violation rate is
    documented - this is the gap the thesis hybrids are designed to close.
  * Fragility / load-bearing strength is not present in the BR JSON data
    and is not modeled by the baseline; it is reported as N/A and excluded
    from the CSR denominator (the thesis dataset, OR-Library wtpack,
    provides native LBS values).
"""

import math

SUPPORT_THRESHOLD = 0.80  # Christensen & Rousoe (2009); Koch et al. (2018)


# ── M-1: Space Utilization ────────────────────────────────────────────────────
def space_utilization(best, container):
    """Packed item volume / total volume of active bins, as a percentage."""
    packed_vol = sum(l * h * d for (_, _, _, l, h, d) in best.placements.values())
    bin_vol    = container['L'] * container['H'] * container['D']
    total_cap  = best.n_bins * bin_vol
    return (packed_vol / total_cap) * 100.0 if total_cap > 0 else 0.0


# ── M-2: Constraint Satisfaction Rate ─────────────────────────────────────────
def _interval_overlap(a0, a1, b0, b1):
    return max(0, min(a1, b1) - max(a0, b0))


def base_support_compliance(bin_placements):
    """
    For every placed box, check the 80% base-support balancing constraint.
    Coordinate convention (matches geometry_3d / wolf_3d):
        x: length axis, y: height axis (vertical), z: depth axis.
    A box resting on the floor (y == 0) is compliant by convention.
    A box at y > 0 is supported by boxes whose top face (py + ph) == y;
    supported area = sum of x-z footprint intersections with those boxes.

    Returns (n_compliant, n_checked, violations_list).
    """
    n_compliant = 0
    n_checked   = 0
    violations  = []

    for bp in bin_placements:
        for (x, y, z, l, h, d) in bp:
            n_checked += 1
            if y == 0:
                n_compliant += 1
                continue
            base_area = l * d
            supported = 0
            for (px, py, pz, pl, ph, pd) in bp:
                if py + ph != y:
                    continue
                ox = _interval_overlap(x, x + l, px, px + pl)
                oz = _interval_overlap(z, z + d, pz, pz + pd)
                supported += ox * oz
            ratio = supported / base_area if base_area > 0 else 0.0
            if ratio >= SUPPORT_THRESHOLD:
                n_compliant += 1
            else:
                violations.append(ratio)

    return n_compliant, n_checked, violations


def weight_compliance(best, items, weight_cap):
    """
    Per-bin cumulative weight vs. capacity. Enforced by construction in the
    baseline, but measured anyway (never hardcode violations = 0).
    Returns (n_compliant_placements, n_checked_placements, n_overweight_bins).
    """
    bin_weights = {}
    bin_members = {}
    for idx, _ in best.placements.items():
        b = best.genes[idx]
        bin_weights[b] = bin_weights.get(b, 0) + items[idx].get('weight', 1)
        bin_members.setdefault(b, []).append(idx)

    n_checked   = sum(len(v) for v in bin_members.values())
    n_compliant = 0
    overweight  = 0
    for b, wt in bin_weights.items():
        if wt <= weight_cap:
            n_compliant += len(bin_members[b])
        else:
            overweight += 1
    return n_compliant, n_checked, overweight


def constraint_satisfaction_rate(best, items, weight_cap):
    """
    M-2. Percentage of placements complying with ALL constraints that are
    measurable on the baseline (weight capacity + 80% base support).
    Fragility/LBS is N/A on this dataset and excluded from the denominator.
    """
    w_ok,  w_n,  overweight_bins = weight_compliance(best, items, weight_cap)
    s_ok,  s_n,  support_viol    = base_support_compliance(best.bin_placements)

    # A placement is "fully compliant" only if it passes both checks.
    # Weight is bin-level; support is item-level. We count an item compliant
    # on weight if its bin is within capacity.
    total_checks = s_n  # same set of placements
    # Build per-item pass/fail
    bin_weights = {}
    for idx in best.placements:
        b = best.genes[idx]
        bin_weights[b] = bin_weights.get(b, 0) + items[idx].get('weight', 1)

    # Re-walk placements for joint compliance
    n_joint = 0
    item_ids = list(best.placements.keys())
    # Map placements back to support results per bin in order:
    # simpler: recompute support per item via bin grouping
    per_bin = {}
    for idx in item_ids:
        per_bin.setdefault(best.genes[idx], []).append(idx)

    for b, members in per_bin.items():
        bp = [best.placements[i] for i in members]
        for i in members:
            (x, y, z, l, h, d) = best.placements[i]
            # support check
            if y == 0:
                sup_ok = True
            else:
                supported = 0
                for j in members:
                    (px, py, pz, pl, ph, pd) = best.placements[j]
                    if py + ph != y:
                        continue
                    supported += (_interval_overlap(x, x + l, px, px + pl) *
                                  _interval_overlap(z, z + d, pz, pz + pd))
                sup_ok = (supported / (l * d)) >= SUPPORT_THRESHOLD if l * d > 0 else False
            wt_ok = bin_weights.get(b, 0) <= weight_cap
            if sup_ok and wt_ok:
                n_joint += 1

    csr = (n_joint / total_checks) * 100.0 if total_checks else 0.0
    detail = {
        "weight_compliance_pct":  (w_ok / w_n) * 100.0 if w_n else 0.0,
        "support_compliance_pct": (s_ok / s_n) * 100.0 if s_n else 0.0,
        "support_violations":     len(support_viol),
        "overweight_bins":        overweight_bins,
        "fragility":              "N/A (no LBS attribute in BR data; thesis uses wtpack)",
    }
    return csr, detail


# ── M-5: Robustness ───────────────────────────────────────────────────────────
def robustness(su_values):
    """Sample standard deviation of SU across independent runs (M-5)."""
    n = len(su_values)
    if n < 2:
        return 0.0
    mean = sum(su_values) / n
    var  = sum((v - mean) ** 2 for v in su_values) / (n - 1)
    return math.sqrt(var)