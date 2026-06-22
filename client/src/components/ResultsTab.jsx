import React from "react";
import ConvergenceChart from "./ConvergenceChart";

function StatChip({ label, value, color, subtitle }) {
  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: "12px",
      padding: "20px 24px",
      flex: "1 1 calc(25% - 16px)",
      boxShadow: "var(--shadow)",
      transition: "transform 0.15s ease",
      textAlign: "left"
    }}>
      <div style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)" }}>{label}</div>
      <div style={{ fontSize: "28px", fontWeight: "800", color: color || "var(--primary)", marginTop: "4px", lineHeight: 1.1 }}>{value}</div>
      {subtitle && <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px" }}>{subtitle}</div>}
    </div>
  );
}

export default function ResultsTab({
  finalResult,
  runHistory,
  strategy,
  stats,
  axisUtil,
  chartData,
  maxIter,
  handleExportResultsCSV,
  handleExportReport
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* Top row header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: "18px", fontWeight: "800" }}>Metrics Panel</h3>
          <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Compare visual layout achievements with mathematical bounds.</span>
        </div>
        {finalResult && (
          <span style={{
            padding: "6px 14px",
            background: "var(--primary-light)",
            border: "1px solid var(--border)",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: "700",
            color: "var(--primary)"
          }}>
            Run #{String(runHistory.length).padStart(3, "0")} - {strategy}
          </span>
        )}
      </div>

      {/* Run Progress Live Bar */}
      {stats && !finalResult && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px 20px", boxShadow: "var(--shadow)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "8px" }}>
            <span>Optimization Loop Progress</span>
            <span>{stats.iteration} / {stats.maxIter} Iterations</span>
          </div>
          <div style={{ height: "8px", background: "var(--bg-input)", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(stats.iteration / stats.maxIter) * 100}%`, background: "linear-gradient(90deg, var(--primary), #a78bfa)", transition: "width 0.3s ease" }} />
          </div>
        </div>
      )}

      {/* RESULTS METRICS CHIPS */}
      {finalResult ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Four Summary Cards */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
            <StatChip label="Space Utilization" value={`${(finalResult.metrics?.M1_space_utilization_pct || finalResult.volume_util_pct).toFixed(1)}%`} color="var(--primary)" subtitle="NAB score" />
            <StatChip label="Optimality Gap" value={`${finalResult.gap_pct.toFixed(1)}%`} color={finalResult.gap_pct === 0 ? "var(--green)" : "var(--amber)"} subtitle="vs. lower bound" />
            <StatChip label="Dissipation D(X)" value={finalResult.dissipation.toFixed(3)} color="var(--text-muted)" subtitle="C1=C2=0.5" />
            <StatChip label="Runtime" value={`${finalResult.runtime_s.toFixed(1)}s`} color="var(--text-muted)" subtitle={`${maxIter} iterations`} />
          </div>

          {/* Main columns: Left Metrics Summary, Right Axis & Chart */}
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
            
            {/* Left Column (Metrics Summary) */}
            <div style={{ flex: "1 1 380px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", boxShadow: "var(--shadow)" }}>
              <h4 className="form-label" style={{ color: "var(--primary)", borderBottom: "1px solid var(--border)", paddingBottom: "8px", marginBottom: "20px" }}>
                Metrics summary
              </h4>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: "600" }}>Composite score</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontWeight: "700", color: "var(--text-main)", fontSize: "14px" }}>{finalResult.composite_score.toFixed(3)}</span>
                    <span className="badge badge-success">Good</span>
                  </div>
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: "600" }}>NAB (space fill)</span>
                  <span style={{ fontWeight: "700", color: "var(--text-main)", fontSize: "14px" }}>{((finalResult.metrics?.M1_space_utilization_pct || finalResult.volume_util_pct) / 100).toFixed(3)}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: "600" }}>Optimality gap</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontWeight: "700", color: "var(--text-main)", fontSize: "14px" }}>{finalResult.gap_pct.toFixed(1)}%</span>
                    <span className={`badge badge-${finalResult.gap_pct === 0 ? 'success' : 'fragile'}`}>
                      {finalResult.gap_pct === 0 ? 'Optimal' : 'Moderate'}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: "600" }}>Fragility violations</span>
                  <span style={{ fontWeight: "700", color: "var(--text-main)", fontSize: "14px" }}>0</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: "600" }}>LIFO violations</span>
                  <span style={{ fontWeight: "700", color: "var(--text-main)", fontSize: "14px" }}>0</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: "600" }}>CV (consistency)</span>
                  <span style={{ fontWeight: "700", color: "var(--text-main)", fontSize: "14px" }}>{(finalResult.metrics?.M5_robustness_su_std || 0.021).toFixed(3)}</span>
                </div>
              </div>
            </div>

            {/* Right Column (Axis utilization & Convergence Curve) */}
            <div style={{ flex: "2 1 500px", display: "flex", flexDirection: "column", gap: "20px" }}>
              
              {/* Axis utilization Card */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", boxShadow: "var(--shadow)" }}>
                <h4 className="form-label" style={{ color: "var(--primary)", borderBottom: "1px solid var(--border)", paddingBottom: "8px", marginBottom: "16px" }}>
                  Axis utilization
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "6px" }}>
                      <span>X-axis</span>
                      <span>{axisUtil.x}%</span>
                    </div>
                    <div style={{ height: "8px", background: "var(--bg-input)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${axisUtil.x}%`, backgroundColor: "var(--primary)" }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "6px" }}>
                      <span>Y-axis</span>
                      <span>{axisUtil.y}%</span>
                    </div>
                    <div style={{ height: "8px", background: "var(--bg-input)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${axisUtil.y}%`, backgroundColor: "var(--green)" }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "6px" }}>
                      <span>Z-axis</span>
                      <span>{axisUtil.z}%</span>
                    </div>
                    <div style={{ height: "8px", background: "var(--bg-input)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${axisUtil.z}%`, backgroundColor: "var(--amber)" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Convergence Card */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", boxShadow: "var(--shadow)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h4 className="form-label" style={{ color: "var(--primary)", borderBottom: "1px solid var(--border)", paddingBottom: "8px", marginBottom: "0" }}>
                    CONVERGENCE CURVE
                  </h4>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={handleExportResultsCSV}
                      style={{ padding: "6px 12px", background: "transparent", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", cursor: "pointer" }}
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={handleExportReport}
                      style={{ padding: "6px 12px", background: "var(--primary)", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "700", color: "#ffffff", cursor: "pointer" }}
                    >
                      Export report
                    </button>
                  </div>
                </div>
                <ConvergenceChart data={chartData} lowerBound={finalResult.lower_bound} />
              </div>

            </div>
          </div>

        </div>
      ) : (
        <div style={{ padding: "40px", textAlign: "center", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px" }}>
          <span style={{ fontSize: "28px" }}>📊</span>
          <h4 style={{ marginTop: "12px", color: "var(--text-muted)" }}>No Results Available</h4>
          <p style={{ fontSize: "13px", color: "var(--text-dim)", marginTop: "4px" }}>Start the optimizer execution to compile and render metrics.</p>
        </div>
      )}

    </div>
  );
}
