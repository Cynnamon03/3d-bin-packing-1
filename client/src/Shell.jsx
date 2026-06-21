// client/src/Shell.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "./auth/AuthContext";
import BinViewer from "./BinViewer";
import logo from "./logo.png";

// ── SVG Convergence Chart ─────────────────────────────────────────────────────
const ConvergenceChart = React.memo(function ConvergenceChart({ data, lowerBound }) {
  if (!data.length) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--text-dim)", background: "var(--bg-input)", borderRadius: 8, border: "1px solid var(--border)" }}>
        No data available yet. Start the optimizer to see the convergence chart.
      </div>
    );
  }

  const W = 600, H = 200, PAD = { t: 12, r: 16, b: 32, l: 40 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const maxIter = Math.max(...data.map((d) => d.iter), 1);
  const allBins = data.map((d) => d.bins);
  const minB = Math.min(...allBins);
  const maxB = Math.max(...allBins, minB + 1);

  const toX = (iter) => PAD.l + (iter / maxIter) * innerW;
  const toY = (bins) => PAD.t + innerH - ((bins - minB) / (maxB - minB)) * innerH;

  const pts = data.map((d) => `${toX(d.iter)},${toY(d.bins)}`).join(" ");

  // Lower bound line y position
  const lbY = lowerBound !== null ? toY(Math.max(lowerBound, minB)) : null;

  // Y-axis tick values
  const yTicks = [minB, Math.round((minB + maxB) / 2), maxB];

  return (
    <div style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, boxShadow: "var(--shadow)" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {/* Grid lines */}
        {yTicks.map((v) => (
          <g key={v}>
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
        <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth={2.5} />
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

// ── Stat Chip Component ───────────────────────────────────────────────────────
function StatChip({ label, value, color }) {
  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: "10px",
      padding: "16px 20px",
      minWidth: "120px",
      flex: "1 1 calc(25% - 16px)",
      boxShadow: "var(--shadow)",
      transition: "transform 0.15s ease"
    }}>
      <div style={{ fontSize: "22px", fontWeight: "800", color: color || "var(--primary)" }}>{value}</div>
      <div style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)", marginTop: "4px" }}>{label}</div>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  let date;
  if (dateStr.endsWith("Z") || dateStr.includes("T")) {
    date = new Date(dateStr);
  } else {
    // SQLite format: YYYY-MM-DD HH:MM:SS -> normalize to YYYY-MM-DDTHH:MM:SSZ
    date = new Date(dateStr.replace(" ", "T") + "Z");
  }
  if (isNaN(date.getTime())) return dateStr;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// ── MAIN SHELL COMPONENT ──────────────────────────────────────────────────────
export default function Shell() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [activeTab, setActiveTab] = useState("logistics"); // logistics, results, visualization, history
  const [viewMode, setViewMode] = useState("researcher"); // researcher, logistics (results view mode)
  
  // Profile dropdown state
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Optimizer inputs
  const [instances, setInstances] = useState([]);
  const [selected, setSelected] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [strategy, setStrategy] = useState("Sequential");
  const [maxTime, setMaxTime] = useState(90);

  // Optimizer websocket & live run state
  const [wsConnected, setWsConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showLabels, setShowLabels] = useState(false);

  // Stream data
  const [instanceInfo, setInstanceInfo] = useState(null);
  const [placements, setPlacements] = useState(null);
  const [binsUsed, setBinsUsed] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [stats, setStats] = useState(null);
  const [finalResult, setFinalResult] = useState(null);
  const [error, setError] = useState(null);

  // Run History state
  const [runHistory, setRunHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("All");

  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Theme synchronization
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Load instances list
  useEffect(() => {
    fetch("/api/instances")
      .then((r) => r.json())
      .then((data) => {
        const list = data.instances || [];
        setInstances(list);
        if (list.length) setSelected(list[0].path);
        setLoadingList(false);
      })
      .catch(() => {
        setError("Cannot reach backend server. Please verify the port 3001.");
        setLoadingList(false);
      });
  }, []);

  // Fetch Run History
  const fetchRunHistory = useCallback(() => {
    fetch("/api/auth/runs", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setRunHistory)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchRunHistory();
  }, [fetchRunHistory]);

  // WebSocket message dispatcher
  const handleMessage = useCallback((msg) => {
    switch (msg.type) {
      case "instance_info":
        setInstanceInfo({ container: msg.container, n_items: msg.n_items, lower_bound: msg.lower_bound });
        break;

      case "iteration_update":
        setPlacements(msg.solution);
        setBinsUsed(msg.best_bins);
        setChartData((prev) => {
          const next = [...prev, { iter: msg.iteration, bins: msg.best_bins }];
          return next.length > 150 ? next.slice(-150) : next;
        });
        setStats({
          iteration: msg.iteration,
          maxIter: msg.max_iter,
          bins: msg.best_bins,
          dissipation: msg.best_dissipation,
          composite: msg.best_composite,
          temperature: msg.temperature,
          lastUdhc: msg.last_udhc,
          udhcAccepted: msg.udhc_accepted,
        });
        break;

      case "instance_complete":
        setPlacements(msg.items);
        setBinsUsed(msg.bins_used);
        setFinalResult(msg);
        setRunning(false);
        // Persist run details to server/db
        fetch("/api/auth/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            strategy: strategy,
            instance: msg.instance.split(/[\\/]/).pop(), // get file name
            n_items: msg.n_items,
            space_util: msg.metrics?.M1_space_utilization_pct || msg.volume_util_pct,
            dissipation: msg.dissipation,
            runtime_s: msg.runtime_s,
            bins_used: msg.bins_used
          })
        }).then(() => fetchRunHistory()).catch(() => {});
        break;

      case "stopped":
        setRunning(false);
        break;

      case "run_closed":
        if (msg.code !== 0) setError(`Optimizer process exited with code ${msg.code}`);
        setRunning(false);
        break;

      case "error":
        setError(msg.error);
        setRunning(false);
        break;

      default:
        break;
    }
  }, [strategy, fetchRunHistory]);

  const connect = useCallback(() => {
    const ws = new WebSocket("ws://localhost:3002");
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => {
      setWsConnected(false);
      reconnectRef.current = setTimeout(connect, 3000);
    };
    ws.onerror = () => {};
    ws.onmessage = (e) => {
      try {
        handleMessage(JSON.parse(e.data));
      } catch {}
    };
  }, [handleMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Keep WebSocket message callback fresh
  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.onmessage = (e) => {
        try {
          handleMessage(JSON.parse(e.data));
        } catch {}
      };
    }
  }, [handleMessage]);

  // Run timer
  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // Run handler
  const handleStartRun = useCallback(() => {
    if (!selected || running || !wsConnected) return;
    setRunning(true);
    setInstanceInfo(null);
    setPlacements(null);
    setBinsUsed(0);
    setChartData([]);
    setStats(null);
    setFinalResult(null);
    setError(null);
    wsRef.current.send(JSON.stringify({ action: "run", instancePath: selected, maxTime }));
    // Auto shift view tabs to visualization or results when run starts
    setActiveTab("visualization");
  }, [selected, running, wsConnected, maxTime]);

  const handleStopRun = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ action: "stop" }));
  }, []);

  const groupedInstances = useMemo(() => {
    const g = {};
    for (const inst of instances) {
      if (!g[inst.set]) g[inst.set] = [];
      g[inst.set].push(inst);
    }
    return g;
  }, [instances]);

  const selectedInstanceObj = useMemo(() => {
    return instances.find((i) => i.path === selected);
  }, [instances, selected]);

  const initials = user?.name ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "US";

  // Filtered history list
  const filteredHistory = useMemo(() => {
    if (historyFilter === "All") return runHistory;
    return runHistory.filter((r) => r.strategy === historyFilter);
  }, [runHistory, historyFilter]);

  const canRun = wsConnected && !running && !!selected;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-app)", color: "var(--text-main)", transition: "all 0.2s ease" }}>
      
      {/* ── TOP HEADER ───────────────────────────────────────────────────────── */}
      <header style={{
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border)",
        padding: "14px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "var(--shadow)",
        position: "sticky",
        top: 0,
        zIndex: 100
      }}>
        {/* Logo and App name */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={logo} alt="STACKR Logo" style={{ width: "36px", height: "36px", borderRadius: "8px", boxShadow: "0 2px 6px rgba(99, 102, 241, 0.2)" }} />
          <div>
            <h1 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)", letterSpacing: "-0.5px" }}>STACKR</h1>
            <span style={{ fontSize: "11px", color: "var(--text-dim)", fontWeight: "600", display: "block" }}>3-D Bin Packing Optimizer</span>
          </div>
        </div>

        {/* Selected run status badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {selectedInstanceObj && (
            <div style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border)",
              borderRadius: "20px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: "700",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: running ? "var(--amber)" : "var(--green)" }} />
              Active: {selectedInstanceObj.label}
            </div>
          )}

          {/* Theme Toggler */}
          <button
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border)",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-main)",
              fontSize: "16px",
              boxShadow: "var(--shadow)",
              transition: "transform 0.15s ease"
            }}
            title="Toggle Theme"
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>

          {/* Profile Dropdown */}
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <div
              onClick={() => setProfileOpen((o) => !o)}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "var(--primary-light)",
                color: "var(--primary)",
                fontWeight: "800",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                border: "2px solid var(--border)",
                boxShadow: "var(--shadow)"
              }}
            >
              {initials}
            </div>
            {profileOpen && (
              <div style={{
                position: "absolute",
                right: 0,
                top: "46px",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                width: "220px",
                boxShadow: "var(--shadow-lg)",
                padding: "16px",
                zIndex: 1000
              }}>
                <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "12px" }}>
                  <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-main)" }}>{user?.name || "User"}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-dim)", textTransform: "capitalize" }}>{user?.role || "Researcher"}</div>
                </div>
                <button
                  onClick={() => {
                    logout();
                    setProfileOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "transparent",
                    border: "1px solid var(--red)",
                    borderRadius: "6px",
                    color: "var(--red)",
                    fontWeight: "600",
                    fontSize: "13px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    textAlign: "center"
                  }}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── ERROR MESSAGE ── */}
      {error && (
        <div style={{ margin: "16px 28px 0", background: "rgba(239, 68, 68, 0.1)", border: "1px solid var(--red)", borderRadius: "8px", padding: "12px 18px", color: "var(--red)", fontSize: "14px" }}>
          ⚠ {error}
        </div>
      )}

      {/* ── TAB NAVIGATION ───────────────────────────────────────────────────── */}
      <div style={{ padding: "20px 28px 0", display: "flex", gap: "10px", borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
        {[
          { id: "logistics", label: "Logistics Setup" },
          { id: "visualization", label: "3-D Visualization" },
          { id: "results", label: "Optimization Results" },
          { id: "history", label: "Run History" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "12px 20px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab.id ? "3px solid var(--primary)" : "3px solid transparent",
              color: activeTab === tab.id ? "var(--primary)" : "var(--text-dim)",
              fontWeight: "700",
              fontSize: "14px",
              cursor: "pointer",
              transition: "all 0.15s ease",
              paddingBottom: "16px"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── MAIN CONTENT AREA ────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: "28px" }}>
        
        {/* ── TAB: LOGISTICS ── */}
        {activeTab === "logistics" && (
          <div style={{ display: "flex", gap: "24px", flexDirection: "column" }}>
            
            {/* Instance & Settings Card */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", boxShadow: "var(--shadow)" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: wsConnected ? "var(--green)" : "var(--red)" }} />
                WebSocket Status: {wsConnected ? "Connected" : "Disconnected (reconnecting...)"}
              </h3>
              
              <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-end" }}>
                {/* Instance Select */}
                <div style={{ flex: "2 1 300px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)", display: "block", marginBottom: "6px" }}>Select Dataset Instance</label>
                  {loadingList ? (
                    <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading instances...</span>
                  ) : (
                    <select
                      style={{ width: "100%", padding: "12px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-main)", fontSize: "14px", fontWeight: "600", outline: "none" }}
                      value={selected}
                      onChange={(e) => {
                        setSelected(e.target.value);
                        setFinalResult(null);
                        setPlacements(null);
                        setChartData([]);
                        setStats(null);
                      }}
                      disabled={running}
                    >
                      {Object.entries(groupedInstances).map(([setName, insts]) => (
                        <optgroup key={setName} label={setName}>
                          {insts.map((inst) => (
                            <option key={inst.path} value={inst.path}>{inst.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  )}
                </div>

                {/* Strategy Selector */}
                <div style={{ flex: "1 1 200px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)", display: "block", marginBottom: "6px" }}>Optimization Strategy</label>
                  <select
                    style={{ width: "100%", padding: "12px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-main)", fontSize: "14px", fontWeight: "600", outline: "none" }}
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value)}
                    disabled={running}
                  >
                    <option value="Sequential">Sequential Fit</option>
                    <option value="Embedded">Embedded SA-GWO</option>
                    <option value="Repair-based">Repair-based Optimization</option>
                  </select>
                </div>

                {/* Max Time */}
                <div style={{ flex: "1 1 120px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)", display: "block", marginBottom: "6px" }}>Time Limit (s)</label>
                  <input
                    type="number"
                    style={{ width: "100%", padding: "12px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-main)", fontSize: "14px", fontWeight: "600", outline: "none" }}
                    value={maxTime}
                    min={5}
                    max={300}
                    onChange={(e) => setMaxTime(parseInt(e.target.value, 10))}
                    disabled={running}
                  />
                </div>

                {/* Start / Stop Buttons */}
                <div style={{ display: "flex", gap: "10px" }}>
                  {!running ? (
                    <button
                      onClick={handleStartRun}
                      disabled={!canRun}
                      style={{
                        padding: "12px 24px",
                        background: canRun ? "var(--primary)" : "var(--text-dim)",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontWeight: "700",
                        cursor: canRun ? "pointer" : "not-allowed",
                        transition: "all 0.15s ease",
                        whiteSpace: "nowrap"
                      }}
                    >
                      ▶ Run Optimizer
                    </button>
                  ) : (
                    <>
                      <button
                        disabled
                        style={{
                          padding: "12px 24px",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border)",
                          color: "var(--text-muted)",
                          borderRadius: "8px",
                          fontSize: "14px",
                          fontWeight: "700",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px"
                        }}
                      >
                        <span style={{
                          display: "inline-block",
                          width: 14,
                          height: 14,
                          border: "2px solid var(--primary)",
                          borderTopColor: "transparent",
                          borderRadius: "50%",
                          animation: "spin 0.8s linear infinite"
                        }} />
                        Running... {elapsed}s
                      </button>
                      <button
                        onClick={handleStopRun}
                        style={{
                          padding: "12px 24px",
                          background: "rgba(239, 68, 68, 0.15)",
                          border: "1px solid var(--red)",
                          color: "var(--red)",
                          borderRadius: "8px",
                          fontSize: "14px",
                          fontWeight: "700",
                          cursor: "pointer",
                          transition: "all 0.15s ease"
                        }}
                      >
                        ■ Stop
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Container Details & Items List */}
            {selectedInstanceObj && (
              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 300px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", boxShadow: "var(--shadow)" }}>
                  <h4 style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>Container Specifications</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>Length (L)</span><strong style={{ color: "var(--text-main)" }}>1000 mm (Standard)</strong></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>Width (D)</span><strong style={{ color: "var(--text-main)" }}>1000 mm (Standard)</strong></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>Height (H)</span><strong style={{ color: "var(--text-main)" }}>1000 mm (Standard)</strong></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>Volume Capacity</span><strong style={{ color: "var(--text-main)" }}>1,000,000,000 mm³</strong></div>
                  </div>
                </div>

                <div style={{ flex: "2 1 500px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", boxShadow: "var(--shadow)" }}>
                  <h4 style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>Bischoff–Ratcliff File Info</h4>
                  <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.6 }}>
                    This instance contains pre-configured block types representing different sizes of boxes. The optimizer uses the <strong>HD-GWO (Discrete Grey Wolf Optimizer)</strong> algorithm combined with <strong>Simulated Annealing</strong> to pack these boxes tightly inside container volumes.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: VISUALIZATION ── */}
        {activeTab === "visualization" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", boxShadow: "var(--shadow)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "700" }}>3-D Packing Viewport</h3>
                  <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Updates dynamically during iteration loops. Use mouse controls to rotate/zoom.</span>
                </div>
                <button
                  onClick={() => setShowLabels((l) => !l)}
                  style={{
                    padding: "8px 16px",
                    background: showLabels ? "var(--amber)" : "var(--bg-input)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    color: showLabels ? "#ffffff" : "var(--text-main)",
                    fontWeight: "700",
                    fontSize: "12px",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  {showLabels ? "🏷️ Hide Labels" : "🏷️ Show Labels"}
                </button>
              </div>

              {placements && instanceInfo ? (
                <BinViewer
                  placements={placements}
                  container={instanceInfo.container}
                  binsUsed={binsUsed}
                  showLabels={showLabels}
                  running={running}
                />
              ) : (
                <div style={{ height: "400px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg-input)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "40px", marginBottom: "12px" }}>📦</div>
                  <h4 style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: "600" }}>No Active Run Data</h4>
                  <p style={{ color: "var(--text-dim)", fontSize: "12px", marginTop: "4px" }}>Start the optimizer from the Logistics Setup tab to view output.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: RESULTS ── */}
        {activeTab === "results" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* View Mode Selector (Researcher / Logistics) */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "800" }}>Metrics Panel</h3>
                <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Swap views to display scientific metrics vs operational outcomes.</span>
              </div>
              <div style={{ display: "flex", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "4px" }}>
                <button
                  onClick={() => setViewMode("researcher")}
                  style={{
                    padding: "6px 16px",
                    background: viewMode === "researcher" ? "var(--primary)" : "transparent",
                    color: viewMode === "researcher" ? "#ffffff" : "var(--text-muted)",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: "700",
                    fontSize: "13px",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  Researcher View
                </button>
                <button
                  onClick={() => setViewMode("logistics")}
                  style={{
                    padding: "6px 16px",
                    background: viewMode === "logistics" ? "var(--primary)" : "transparent",
                    color: viewMode === "logistics" ? "#ffffff" : "var(--text-muted)",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: "700",
                    fontSize: "13px",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  Logistics View
                </button>
              </div>
            </div>

            {/* Run Progress Live Bar */}
            {stats && (
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
                
                {viewMode === "researcher" ? (
                  /* RESEARCHER VIEW */
                  <>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                      <StatChip label="Composite Score" value={finalResult.composite_score.toFixed(4)} color="var(--primary)" />
                      <StatChip label="Optimality Gap" value={`${finalResult.gap_pct}%`} color={finalResult.gap_pct === 0 ? "var(--green)" : "var(--amber)"} />
                      <StatChip label="Dissipation Index" value={finalResult.dissipation.toFixed(4)} color="var(--text-muted)" />
                      <StatChip label="Execution Time" value={`${finalResult.metrics?.M3_execution_time_ms || 0} ms`} color="var(--text-muted)" />
                      <StatChip label="Peak Memory" value={`${finalResult.metrics?.M4_peak_memory_mb || 0} MB`} color="var(--text-muted)" />
                    </div>

                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", boxShadow: "var(--shadow)" }}>
                      <h4 style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "16px" }}>Full Optimization Convergence</h4>
                      <ConvergenceChart data={chartData} lowerBound={finalResult.lower_bound} />
                    </div>
                  </>
                ) : (
                  /* LOGISTICS VIEW */
                  <>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                      <StatChip label="Bins Required" value={finalResult.bins_used} color="var(--primary)" />
                      <StatChip label="Space Utilization" value={`${finalResult.metrics?.M1_space_utilization_pct || finalResult.volume_util_pct}%`} color="var(--green)" />
                      <StatChip label="Constraint Sat. Rate" value={`${finalResult.metrics?.M2_constraint_satisfaction_pct || 0}%`} color="var(--green)" />
                      <StatChip label="Total Items Packed" value={finalResult.n_items} color="var(--text-muted)" />
                    </div>

                    {finalResult.metrics?.constraint_detail && (
                      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", boxShadow: "var(--shadow)" }}>
                        <h4 style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>Constraint Breakdown</h4>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                          <div style={{ flex: "1 1 200px" }}>
                            <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--green)" }}>
                              {finalResult.metrics.constraint_detail.weight_compliance_pct.toFixed(1)}%
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Weight Limit Compliance</div>
                          </div>
                          <div style={{ flex: "1 1 200px" }}>
                            <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--green)" }}>
                              {finalResult.metrics.constraint_detail.support_compliance_pct.toFixed(1)}%
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>80% Base-Support Compliance</div>
                          </div>
                          <div style={{ flex: "1 1 200px" }}>
                            <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--green)" }}>
                              {finalResult.metrics.constraint_detail.support_violations}
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Support Violations</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Load Sequence Table */}
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", boxShadow: "var(--shadow)" }}>
                      <h4 style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>Load Sequence Layout</h4>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                          <thead>
                            <tr style={{ borderBottom: "2px solid var(--border)" }}>
                              <th style={{ padding: "10px", color: "var(--text-dim)" }}>Sequence</th>
                              <th style={{ padding: "10px", color: "var(--text-dim)" }}>Item ID</th>
                              <th style={{ padding: "10px", color: "var(--text-dim)" }}>Bin ID</th>
                              <th style={{ padding: "10px", color: "var(--text-dim)" }}>Co-ordinates (x, y, z)</th>
                              <th style={{ padding: "10px", color: "var(--text-dim)" }}>Dimensions (l × h × d)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {finalResult.items.slice(0, 15).map((item, idx) => (
                              <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                                <td style={{ padding: "10px", fontWeight: "700" }}>#{idx + 1}</td>
                                <td style={{ padding: "10px" }}>{item.id}</td>
                                <td style={{ padding: "10px" }}>Bin {item.bin_id}</td>
                                <td style={{ padding: "10px" }}>{item.x}, {item.y}, {item.z}</td>
                                <td style={{ padding: "10px" }}>{item.l} × {item.h} × {item.d}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {finalResult.items.length > 15 && (
                          <div style={{ padding: "12px", textAlign: "center", color: "var(--text-dim)", fontSize: "12px" }}>
                            + {finalResult.items.length - 15} more items. Check viewport to play load animation.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

              </div>
            ) : (
              <div style={{ padding: "40px", textAlign: "center", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px" }}>
                <span style={{ fontSize: "28px" }}>📊</span>
                <h4 style={{ marginTop: "12px", color: "var(--text-muted)" }}>No Results Available</h4>
                <p style={{ fontSize: "13px", color: "var(--text-dim)", marginTop: "4px" }}>Start the optimizer execution to compile and render metrics.</p>
              </div>
            )}

          </div>
        )}

        {/* ── TAB: RUN HISTORY ── */}
        {activeTab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "800" }}>Run History Database</h3>
                <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Saved local runs stored inside SQLite.</span>
              </div>
              
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted)" }}>Filter by Strategy:</span>
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
                        <tr key={run.id} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s" }}>
                          <td style={{ padding: "14px 16px", fontWeight: "700", color: "var(--primary)" }}>#{run.id}</td>
                          <td style={{ padding: "14px 16px", fontWeight: "600" }}>{run.instance}</td>
                          <td style={{ padding: "14px 16px" }}>
                            <span style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: "700",
                              background: run.strategy === "Repair-based" ? "rgba(167, 139, 250, 0.15)" : run.strategy === "Embedded" ? "rgba(59, 130, 246, 0.15)" : "rgba(100, 116, 139, 0.15)",
                              color: run.strategy === "Repair-based" ? "#a78bfa" : run.strategy === "Embedded" ? "#3b82f6" : "var(--text-muted)"
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
        )}

      </main>
    </div>
  );
}
