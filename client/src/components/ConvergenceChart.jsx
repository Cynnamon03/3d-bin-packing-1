import React from "react";

const ConvergenceChart = React.memo(function ConvergenceChart({ data, lowerBound }) {
  if (!data.length) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--text-dim)", background: "var(--bg-input)", borderRadius: 8, border: "1px solid var(--border)" }}>
        No data available yet. Start the optimizer to see the convergence chart.
      </div>
    );
  }

  const W = 600, H = 160, PAD = { t: 12, r: 16, b: 32, l: 40 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const maxIter = Math.max(...data.map((d) => d.iter), 1);
  const allBins = data.map((d) => d.bins);
  const minB = Math.min(...allBins);
  const maxB = Math.max(...allBins, minB + 1);

  const toX = (iter) => PAD.l + (iter / maxIter) * innerW;
  const toY = (bins) => PAD.t + innerH - ((bins - minB) / (maxB - minB)) * innerH;

  const pts = data.map((d) => `${toX(d.iter)},${toY(d.bins)}`).join(" ");
  const lbY = lowerBound !== null ? toY(Math.max(lowerBound, minB)) : null;
  const yTicks = [minB, Math.round((minB + maxB) / 2), maxB];

  return (
    <div style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, boxShadow: "var(--shadow)" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {/* Grid lines */}
        {yTicks.map((v, idx) => (
          <g key={idx}>
            <line x1={PAD.l} y1={toY(v)} x2={W - PAD.r} y2={toY(v)}
                  stroke="var(--border)" strokeWidth={1} strokeDasharray="4 3" />
            <text x={PAD.l - 6} y={toY(v) + 3} textAnchor="end"
                  fill="var(--text-dim)" fontSize={10} fontWeight="600">{v}</text>
          </g>
        ))}
        {/* Lower bound reference line */}
        {lbY !== null && (
          <line x1={PAD.l} y1={lbY} x2={W - PAD.r} y2={lbY}
                stroke="var(--green)" strokeWidth={1.5} strokeDasharray="6 3" opacity={0.8} />
        )}
        {/* Data polyline */}
        {pts && <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth={2.5} />}
        {/* Last point dot */}
        {data.length > 0 && (
          <circle cx={toX(data.at(-1).iter)} cy={toY(data.at(-1).bins)}
                  r={4} fill="var(--primary)" />
        )}
        {/* X axis label */}
        <text x={W / 2} y={H - 4} textAnchor="middle" fill="var(--text-dim)" fontSize={10} fontWeight="600">
          Iteration
        </text>
        {/* Y axis label */}
        <text x={10} y={H / 2} textAnchor="middle" fill="var(--text-dim)" fontSize={10} fontWeight="600"
              transform={`rotate(-90,10,${H / 2})`}>
          Bins Used
        </text>
        {/* LB legend */}
        {lbY !== null && (
          <text x={W - PAD.r} y={lbY - 4} textAnchor="end" fill="var(--green)" fontSize={9} fontWeight="bold">
            LB = {lowerBound}
          </text>
        )}
      </svg>
    </div>
  );
});

export default ConvergenceChart;
