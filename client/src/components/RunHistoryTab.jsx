import React, { useState, useMemo } from "react";

function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  let date;
  if (dateStr.endsWith("Z") || dateStr.includes("T")) {
    date = new Date(dateStr);
  } else {
    date = new Date(dateStr.replace(" ", "T") + "Z");
  }
  if (isNaN(date.getTime())) return dateStr;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function RunHistoryTab({
  runHistory,
  handleExportHistory
}) {
  // Local search and filter states
  const [historyFilter, setHistoryFilter] = useState("All");
  const [historySearchQuery, setHistorySearchQuery] = useState("");

  // Filtered run history (with Search)
  const filteredHistory = useMemo(() => {
    let list = runHistory;
    if (historyFilter !== "All") {
      list = list.filter((r) => r.strategy === historyFilter);
    }
    if (historySearchQuery.trim() !== "") {
      list = list.filter((r) =>
        r.instance.toLowerCase().includes(historySearchQuery.toLowerCase())
      );
    }
    return list;
  }, [runHistory, historyFilter, historySearchQuery]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: "18px", fontWeight: "800" }}>Run History Database</h3>
          <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Saved local runs stored inside SQLite.</span>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input
            type="text"
            placeholder="Search runs..."
            value={historySearchQuery}
            onChange={(e) => setHistorySearchQuery(e.target.value)}
            style={{
              padding: "8px 12px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: "var(--text-main)",
              fontSize: "13px",
              outline: "none",
              width: "180px"
            }}
          />
          
          <select
            value={historyFilter}
            onChange={(e) => setHistoryFilter(e.target.value)}
            style={{ padding: "8px 12px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-main)", fontSize: "13px", fontWeight: "600", outline: "none" }}
          >
            <option value="All">All Strategies</option>
            <option value="Sequential">Sequential Fit</option>
            <option value="Embedded">Embedded SA-GWO</option>
            <option value="Repair-based">Repair-based Optimization</option>
          </select>

          <button
            onClick={handleExportHistory}
            style={{ padding: "8px 12px", background: "transparent", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "13px", fontWeight: "600", color: "var(--text-muted)", cursor: "pointer" }}
          >
            Export all
          </button>
        </div>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", boxShadow: "var(--shadow)", overflow: "hidden" }}>
        {filteredHistory.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "var(--bg-input)", borderBottom: "2px solid var(--border)" }}>
                  <th style={{ padding: "14px 16px", color: "var(--text-dim)" }}>ID</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-dim)" }}>Instance File</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-dim)" }}>Strategy</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-dim)", textAlign: "center" }}>Bins Used</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-dim)", textAlign: "right" }}>Space Util.</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-dim)", textAlign: "right" }}>Runtime</th>
                  <th style={{ padding: "14px 16px", color: "var(--text-dim)", textAlign: "right" }}>Completed At</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((run) => (
                  <tr key={run.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "14px 16px", fontWeight: "700", color: "var(--primary)" }}>#{run.id.toString().padStart(3, "0")}</td>
                    <td style={{ padding: "14px 16px", fontWeight: "600" }}>{run.instance}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: "700",
                        background: run.strategy === "Repair-based" ? "var(--primary-light)" : run.strategy === "Embedded" ? "var(--blue-light)" : "var(--bg-input)",
                        color: run.strategy === "Repair-based" ? "var(--primary)" : run.strategy === "Embedded" ? "var(--blue)" : "var(--text-muted)"
                      }}>
                        {run.strategy}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: "700" }}>{run.bins_used}</td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: "600", color: "var(--green)" }}>{run.space_util}%</td>
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>{run.runtime_s}s</td>
                    <td style={{ padding: "14px 16px", textAlign: "right", color: "var(--text-dim)" }}>
                      {formatDate(run.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "48px", textAlign: "center" }}>
            <span style={{ fontSize: "28px" }}>📂</span>
            <h4 style={{ marginTop: "12px", color: "var(--text-muted)" }}>No Runs Logged</h4>
            <p style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>Runs completed in this session will populate here.</p>
          </div>
        )}
      </div>

    </div>
  );
}
