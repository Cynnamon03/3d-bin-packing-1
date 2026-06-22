// client/src/Shell.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "./auth/AuthContext";
import logoImg from "./logo.png";

import LogisticsTab from "./components/LogisticsTab";
import ResultsTab from "./components/ResultsTab";
import VisualizationTab from "./components/VisualizationTab";
import RunHistoryTab from "./components/RunHistoryTab";


// ── MAIN SHELL COMPONENT ──────────────────────────────────────────────────────
export default function Shell() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [activeTab, setActiveTab] = useState("logistics"); // logistics, results, visualization, history
  
  // Profile dropdown state
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Dataset selection & Loader states
  const [instances, setInstances] = useState([]);
  const [selected, setSelected] = useState("");
  const [loadingList, setLoadingList] = useState(true);

  // Dynamic Custom Configurations
  const [containerSpecs, setContainerSpecs] = useState({ L: 587, H: 233, D: 220 });
  const [maxLoad, setMaxLoad] = useState(28000);
  const [itemsList, setItemsList] = useState([]);
  const [isCustomized, setIsCustomized] = useState(false);

  // Algorithm Settings & Constraints
  const [strategy, setStrategy] = useState("Sequential");
  const [maxTime] = useState(90);
  const [wolfSize, setWolfSize] = useState(30);
  const [maxIter, setMaxIter] = useState(500);

  const [fragilityConstraint, setFragilityConstraint] = useState(false);
  const [rotationConstraint, setRotationConstraint] = useState(true);
  const [lifoConstraint, setLifoConstraint] = useState(false);

  // WebSocket & Live optimization run states
  const [wsConnected, setWsConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Stream metrics
  const [instanceInfo, setInstanceInfo] = useState(null);
  const [placements, setPlacements] = useState(null);
  const [binsUsed, setBinsUsed] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [stats, setStats] = useState(null);
  const [finalResult, setFinalResult] = useState(null);
  const [error, setError] = useState(null);

  // Run History
  const [runHistory, setRunHistory] = useState([]);

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

  // Load selected instance details
  useEffect(() => {
    if (!selected) return;
    fetch(`/api/instance-details?path=${encodeURIComponent(selected)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.container) {
          setContainerSpecs({ L: data.container.L, H: data.container.H, D: data.container.D });
        }
        if (data.items) {
          setItemsList(data.items);
        }
        setIsCustomized(false);
      })
      .catch(() => {});
  }, [selected]);

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
          const next = [...prev, { iter: msg.iteration, bins: msg.best_bins, composite: msg.best_composite }];
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
        // Persist run details
        fetch("/api/auth/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            strategy: strategy,
            instance: isCustomized ? "custom.json" : msg.instance.split(/[\\/]/).pop(),
            n_items: msg.n_items,
            space_util: msg.metrics?.M1_space_utilization_pct || msg.volume_util_pct,
            dissipation: msg.dissipation,
            runtime_s: msg.runtime_s,
            bins_used: msg.bins_used,
            placements: msg.items,
            container: msg.container
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
  }, [strategy, isCustomized, fetchRunHistory]);

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
  const handleStartRun = useCallback(async () => {
    if (!selected || running || !wsConnected) return;
    setRunning(true);
    setInstanceInfo(null);
    setPlacements(null);
    setBinsUsed(0);
    setChartData([]);
    setStats(null);
    setFinalResult(null);
    setError(null);

    let runPath = selected;

    // Always create a custom.json run path if user customized parameters
    if (isCustomized) {
      try {
        const res = await fetch("/api/instances/custom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            container: containerSpecs,
            items: itemsList
          })
        });
        const data = await res.json();
        if (data.path) {
          runPath = data.path;
        } else {
          throw new Error(data.error || "Failed to compile custom configuration");
        }
      } catch (err) {
        setError(err.message);
        setRunning(false);
        return;
      }
    }

    wsRef.current.send(JSON.stringify({ action: "run", instancePath: runPath, maxTime }));
    setActiveTab("visualization");
  }, [selected, running, wsConnected, maxTime, isCustomized, containerSpecs, itemsList]);

  const handleStopRun = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ action: "stop" }));
  }, []);

  // Exporters
  const handleExportResultsCSV = () => {
    if (!finalResult || !finalResult.items) return;
    const headers = "Sequence,Item ID,Bin ID,X,Y,Z,Length,Height,Depth\n";
    const rows = finalResult.items.map((item, idx) => 
      `${idx + 1},${item.id},Bin ${item.bin_id},${item.x},${item.y},${item.z},${item.l},${item.h},${item.d}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `STACKR-Packing-Results-${isCustomized ? "custom" : finalResult.instance.split(/[\\/]/).pop().replace('.json', '')}.csv`;
    link.click();
  };

  const handleExportReport = () => {
    window.print();
  };

  const handleExportHistory = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(runHistory, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "STACKR-optimization-history.json");
    downloadAnchor.click();
  };

  const handleLoadVisualization = useCallback((run) => {
    if (!run || !run.placements || !run.container) return;
    setPlacements(run.placements);
    setInstanceInfo({
      container: run.container,
      n_items: run.placements.length,
      lower_bound: 1
    });
    setBinsUsed(run.bins_used || 1);
    setActiveTab("visualization");
  }, []);

  // Group dataset instances
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

  // Calculate actual X, Y, Z axis utilization dynamically
  const axisUtil = useMemo(() => {
    if (!finalResult || !finalResult.items || !finalResult.container) return { x: 91, y: 84, z: 78 };
    const { L, H, D } = finalResult.container;
    let maxX = 0, maxY = 0, maxZ = 0;
    for (const item of finalResult.items) {
      if (item.x + item.l > maxX) maxX = item.x + item.l;
      if (item.y + item.h > maxY) maxY = item.y + item.h;
      if (item.z + item.d > maxZ) maxZ = item.z + item.d;
    }
    return {
      x: Math.round(Math.min(100, (maxX / L) * 100)),
      y: Math.round(Math.min(100, (maxY / H) * 100)),
      z: Math.round(Math.min(100, (maxZ / D) * 100)),
    };
  }, [finalResult]);

  const canRun = wsConnected && !running && itemsList.length > 0;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-app)", color: "var(--text-main)" }}>
      
      {/* ── HEADER (STACKR BRANDING) ────────────────────────────────────────── */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={logoImg} alt="STACKR Logo" style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "contain" }} />
          <div>
            <h1 style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-main)", letterSpacing: "-0.5px", lineHeight: 1.1 }}>STACKR</h1>
            <span style={{ fontSize: "11px", color: "var(--text-dim)", fontWeight: "600" }}>3D Bin Packing Optimizer</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {selectedInstanceObj && (
            <div style={{
              background: "var(--primary-light)",
              border: "1px solid var(--border)",
              borderRadius: "20px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: "700",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
              OR-Library Benchmark: {selectedInstanceObj.label}
            </div>
          )}

          {/* Theme Toggle */}
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
              boxShadow: "var(--shadow)",
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
                background: "var(--primary)",
                color: "#ffffff",
                fontWeight: "800",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
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

      {/* ── ERROR DISPLAY ── */}
      {error && (
        <div style={{ margin: "16px 28px 0", background: "var(--red-light)", border: "1px solid var(--red)", borderRadius: "8px", padding: "12px 18px", color: "var(--red)", fontSize: "14px" }}>
          ⚠ {error}
        </div>
      )}

      {/* ── TAB BAR ──────────────────────────────────────────────────────────── */}
      <div style={{ padding: "12px 28px 0", display: "flex", gap: "10px", borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
        {[
          { id: "logistics", label: "Logistics" },
          { id: "results", label: "Results" },
          { id: "visualization", label: "Visualization" },
          { id: "history", label: "Run history" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── MAIN LAYOUT ──────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: "28px" }}>

        {/* ── LOGISTICS TAB ──────────────────────────────────────────────────── */}
        {activeTab === "logistics" && (
<<<<<<< HEAD
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Top row structure: Left sidebar config & Right main items table */}
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
              
              {/* Left Sidebar Layout */}
              <div style={{ flex: "1 1 350px", display: "flex", flexDirection: "column", gap: "20px" }}>
                
                {/* Container card */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", boxShadow: "var(--shadow)" }}>
                  <h4 className="form-label" style={{ color: "var(--primary)", borderBottom: "1px solid var(--border)", paddingBottom: "8px", marginBottom: "16px" }}>
                    ● CONTAINER (BIN)
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                        Dimensions (cm) — W × D × H
                      </label>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          type="number"
                          value={containerSpecs.L}
                          onChange={(e) => {
                            setContainerSpecs({ ...containerSpecs, L: Number(e.target.value) });
                            setIsCustomized(true);
                          }}
                          style={{ width: "33.3%", padding: "10px", border: "1px solid var(--border)", borderRadius: "6px", background: "var(--bg-input)", color: "var(--text-main)", fontSize: "14px", fontWeight: "600", outline: "none", textAlign: "center" }}
                          disabled={running}
                        />
                        <input
                          type="number"
                          value={containerSpecs.D}
                          onChange={(e) => {
                            setContainerSpecs({ ...containerSpecs, D: Number(e.target.value) });
                            setIsCustomized(true);
                          }}
                          style={{ width: "33.3%", padding: "10px", border: "1px solid var(--border)", borderRadius: "6px", background: "var(--bg-input)", color: "var(--text-main)", fontSize: "14px", fontWeight: "600", outline: "none", textAlign: "center" }}
                          disabled={running}
                        />
                        <input
                          type="number"
                          value={containerSpecs.H}
                          onChange={(e) => {
                            setContainerSpecs({ ...containerSpecs, H: Number(e.target.value) });
                            setIsCustomized(true);
                          }}
                          style={{ width: "33.3%", padding: "10px", border: "1px solid var(--border)", borderRadius: "6px", background: "var(--bg-input)", color: "var(--text-main)", fontSize: "14px", fontWeight: "600", outline: "none", textAlign: "center" }}
                          disabled={running}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                        Max load capacity (kg)
                      </label>
                      <input
                        type="number"
                        value={maxLoad}
                        onChange={(e) => {
                          setMaxLoad(Number(e.target.value));
                          setIsCustomized(true);
                        }}
                        style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "6px", background: "var(--bg-input)", color: "var(--text-main)", fontSize: "14px", fontWeight: "600", outline: "none" }}
                        disabled={running}
                      />
                    </div>

                    {/* Dotted/Dashed Preview graphic */}
                    <div className="dashed-preview">
                      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                        <line x1="12" y1="22.08" x2="12" y2="12" />
                      </svg>
                      <span>
                        {containerSpecs.L} × {containerSpecs.D} × {containerSpecs.H} cm<br />
                        {maxLoad.toLocaleString()} kg max load
                      </span>
                    </div>
                  </div>
                </div>

                {/* Algorithm settings card */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", boxShadow: "var(--shadow)" }}>
                  <h4 className="form-label" style={{ color: "var(--primary)", borderBottom: "1px solid var(--border)", paddingBottom: "8px", marginBottom: "16px" }}>
                    ● ALGORITHM SETTINGS
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    
                    {/* Hybrid strategy badges */}
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                        Hybrid strategy
                      </label>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {["Sequential", "Embedded", "Repair-based"].map((s) => (
                          <button
                            key={s}
                            onClick={() => setStrategy(s)}
                            style={{
                              flex: 1,
                              padding: "8px 4px",
                              borderRadius: "6px",
                              border: "1px solid var(--border)",
                              background: strategy === s ? "var(--primary)" : "var(--bg-input)",
                              color: strategy === s ? "#ffffff" : "var(--text-muted)",
                              fontSize: "12px",
                              fontWeight: "700",
                              cursor: "pointer",
                              transition: "all 0.15s ease"
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "12px" }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                          Wolf pack size
                        </label>
                        <input
                          type="number"
                          value={wolfSize}
                          onChange={(e) => setWolfSize(Number(e.target.value))}
                          style={{ width: "100%", padding: "10px", border: "1px solid var(--border)", borderRadius: "6px", background: "var(--bg-input)", color: "var(--text-main)", fontSize: "14px", fontWeight: "600", outline: "none", textAlign: "center" }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                          Max iterations
                        </label>
                        <input
                          type="number"
                          value={maxIter}
                          onChange={(e) => setMaxIter(Number(e.target.value))}
                          style={{ width: "100%", padding: "10px", border: "1px solid var(--border)", borderRadius: "6px", background: "var(--bg-input)", color: "var(--text-main)", fontSize: "14px", fontWeight: "600", outline: "none", textAlign: "center" }}
                        />
                      </div>
                    </div>

                    {/* Constraints switches */}
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px", marginTop: "4px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "800", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                        Constraints
                      </label>
                      
                      <div className="switch-container">
                        <span className="switch-label">Fragility (LBS-based)</span>
                        <label className="switch">
                          <input type="checkbox" checked={fragilityConstraint} onChange={(e) => { setFragilityConstraint(e.target.checked); setIsCustomized(true); }} />
                          <span className="slider" />
                        </label>
                      </div>
                      
                      <div className="switch-container">
                        <span className="switch-label">Allow item rotation</span>
                        <label className="switch">
                          <input type="checkbox" checked={rotationConstraint} onChange={(e) => { setRotationConstraint(e.target.checked); setIsCustomized(true); }} />
                          <span className="slider" />
                        </label>
                      </div>

                      <div className="switch-container">
                        <span className="switch-label">LIFO constraint</span>
                        <label className="switch">
                          <input type="checkbox" checked={lifoConstraint} onChange={(e) => { setLifoConstraint(e.target.checked); setIsCustomized(true); }} />
                          <span className="slider" />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Main Panel Layout */}
              <div style={{ flex: "2 1 600px", display: "flex", flexDirection: "column", gap: "20px" }}>
                
                {/* Stats cards */}
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                  <div className="stat-summary-card">
                    <div className="stat-icon-wrapper" style={{ background: "var(--blue-light)", color: "var(--blue)" }}>
                      📦
                    </div>
                    <div>
                      <div style={{ fontSize: "22px", fontWeight: "800" }}>{totalItemsCount}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-dim)", fontWeight: "600" }}>Total items</div>
                    </div>
                  </div>

                  <div className="stat-summary-card">
                    <div className="stat-icon-wrapper" style={{ background: "var(--green-light)", color: "var(--green)" }}>
                      ⚖️
                    </div>
                    <div>
                      <div style={{ fontSize: "22px", fontWeight: "800" }}>{totalWeightSum} kg</div>
                      <div style={{ fontSize: "12px", color: "var(--text-dim)", fontWeight: "600" }}>Total weight</div>
                    </div>
                  </div>

                  <div className="stat-summary-card">
                    <div className="stat-icon-wrapper" style={{ background: "var(--amber-light)", color: "var(--amber)" }}>
                      🏷️
                    </div>
                    <div>
                      <div style={{ fontSize: "22px", fontWeight: "800" }}>{totalCategoriesCount}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-dim)", fontWeight: "600" }}>Item categories</div>
                    </div>
                  </div>
                </div>

                {/* Box Log / List Editor */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", boxShadow: "var(--shadow)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "18px" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <h4 style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-main)" }}>Item / Box log</h4>
                          <span className="badge badge-standard">{itemsList.length} items</span>
                        </div>
                        <p style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>
                          Manually add your own boxes below, or import a CSV.
                        </p>
                      </div>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <input
                        type="file"
                        accept=".csv"
                        ref={fileInputRef}
                        onChange={handleImportCSV}
                        style={{ display: "none" }}
                      />
                      <button
                        onClick={() => fileInputRef.current.click()}
                        style={{ padding: "6px 12px", background: "transparent", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", cursor: "pointer" }}
                      >
                        Import CSV
                      </button>
                      <button
                        onClick={(e) => handleAddItem(e)}
                        style={{ padding: "6px 12px", background: "var(--primary)", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "700", color: "#ffffff", cursor: "pointer" }}
                      >
                        Add item
                      </button>
                    </div>
                  </div>

                  {/* Add box editor row */}
                  <form onSubmit={handleAddItem} className="add-box-form" style={{ display: "flex", gap: "8px", flexWrap: "wrap", background: "var(--bg-input)", padding: "12px", borderRadius: "8px", marginBottom: "16px", alignItems: "flex-end" }}>
                    <div style={{ flex: "2 1 120px" }}>
                      <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Item ID</label>
                      <input type="text" value={newItemId} onChange={(e) => setNewItemId(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--bg-card)", color: "var(--text-main)", fontSize: "13px", fontWeight: "600", outline: "none" }} />
                    </div>
                    <div style={{ flex: "1 1 60px" }}>
                      <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Stop</label>
                      <input type="number" min="1" value={newItemStop} onChange={(e) => setNewItemStop(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--bg-card)", color: "var(--text-main)", fontSize: "13px", outline: "none" }} />
                    </div>
                    <div style={{ flex: "1 1 70px" }}>
                      <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Width (CM)</label>
                      <input type="number" value={newItemL} onChange={(e) => setNewL(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--bg-card)", color: "var(--text-main)", fontSize: "13px", outline: "none" }} />
                    </div>
                    <div style={{ flex: "1 1 70px" }}>
                      <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Depth (CM)</label>
                      <input type="number" value={newItemD} onChange={(e) => setNewD(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--bg-card)", color: "var(--text-main)", fontSize: "13px", outline: "none" }} />
                    </div>
                    <div style={{ flex: "1 1 70px" }}>
                      <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Height (CM)</label>
                      <input type="number" value={newItemH} onChange={(e) => setNewH(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--bg-card)", color: "var(--text-main)", fontSize: "13px", outline: "none" }} />
                    </div>
                    <div style={{ flex: "1 1 70px" }}>
                      <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Weight (KG)</label>
                      <input type="number" value={newItemWeight} onChange={(e) => setNewWeight(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--bg-card)", color: "var(--text-main)", fontSize: "13px", outline: "none" }} />
                    </div>
                    <div style={{ flex: "1 1 60px" }}>
                      <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Quantity</label>
                      <input type="number" value={newItemQty} onChange={(e) => setNewQty(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--bg-card)", color: "var(--text-main)", fontSize: "13px", outline: "none" }} />
                    </div>
                    <div style={{ flex: "2 1 100px" }}>
                      <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Type</label>
                      <select value={newItemType} onChange={(e) => setNewItemType(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--bg-card)", color: "var(--text-main)", fontSize: "13px", outline: "none", fontWeight: "600" }}>
                        <option value="Standard">Standard</option>
                        <option value="Fragile">Fragile</option>
                        <option value="Heavy">Heavy</option>
                      </select>
                    </div>
                    <button type="submit" style={{ padding: "8px 16px", background: "var(--primary)", border: "none", borderRadius: "4px", color: "#ffffff", fontSize: "13px", fontWeight: "700", cursor: "pointer", height: "35px" }}>
                      ✓ Add
                    </button>
                  </form>

                  {/* List Table */}
                  <div style={{ overflowX: "auto", maxHeight: "300px" }}>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Item ID</th>
                          <th>Stop</th>
                          <th>Width (cm)</th>
                          <th>Depth (cm)</th>
                          <th>Height (cm)</th>
                          <th>Weight (kg)</th>
                          <th>Qty</th>
                          <th>Type</th>
                          <th style={{ width: "60px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsList.map((item) => (
                          <tr key={item.id}>
                            <td style={{ fontWeight: "700", color: "var(--text-main)" }}>{item.id}</td>
                            <td style={{ fontWeight: "700", color: "var(--primary)" }}>{item.Stop || 1}</td>
                            <td>{item.L}</td>
                            <td>{item.D}</td>
                            <td>{item.H}</td>
                            <td>{item.Weight}</td>
                            <td style={{ fontWeight: "700" }}>{item.Qty}</td>
                            <td>
                              <span className={`badge badge-${item.Type.toLowerCase()}`}>
                                {item.Type}
                              </span>
                            </td>
                            <td>
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                style={{ background: "transparent", border: "none", color: "var(--red)", fontSize: "16px", cursor: "pointer" }}
                                title="Remove item"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Instance Selector dropdown */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px 24px", boxShadow: "var(--shadow)" }}>
                  <label style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)", display: "block", marginBottom: "6px" }}>Select Dataset Instance (Built-in OR-Library Benchmark)</label>
                  <p style={{ fontSize: "12px", color: "var(--text-dim)", marginBottom: "10px" }}>
                    Optional — load a pre-built benchmark instance instead of using your manually added items above.
                  </p>
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
              </div>
            </div>

            {/* Bottom Status bar */}
            <div style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "16px 24px",
              boxShadow: "var(--shadow)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px"
            }}>
              <div style={{ fontSize: "13px", color: "var(--text-dim)", display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ color: "var(--text-main)", fontWeight: "700" }}>{totalItemsCount}</span> items ready
                <span style={{ color: "var(--text-dim)", opacity: 0.5, margin: "0 4px" }}>·</span>
                Strategy: <span style={{ color: "var(--primary)", fontWeight: "700" }}>{strategy}</span>
                <span style={{ color: "var(--text-dim)", opacity: 0.5, margin: "0 4px" }}>·</span>
                Total: <span style={{ color: "var(--text-main)", fontWeight: "700" }}>{totalWeightSum.toLocaleString()} kg</span>
              </div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <button
                  onClick={() => {
                    setItemsList([]);
                    setIsCustomized(true);
                  }}
                  style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}
                >
                  Clear all
                </button>
                
                {!running ? (
                  <button
                    onClick={handleStartRun}
                    disabled={!canRun}
                    style={{
                      padding: "10px 24px",
                      background: canRun ? "var(--primary)" : "var(--text-dim)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: "700",
                      cursor: canRun ? "pointer" : "not-allowed",
                      transition: "all 0.15s ease",
                      whiteSpace: "nowrap"
                    }}
                  >
                    Run optimizer
                  </button>
                ) : (
                  <>
                    <button
                      disabled
                      style={{
                        padding: "10px 24px",
                        background: "var(--bg-input)",
                        border: "1px solid var(--border)",
                        color: "var(--text-muted)",
                        borderRadius: "6px",
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
                        padding: "10px 24px",
                        background: "var(--red-light)",
                        border: "1px solid var(--red)",
                        color: "var(--red)",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      ■ Stop
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
=======
          <LogisticsTab
            containerSpecs={containerSpecs}
            setContainerSpecs={setContainerSpecs}
            maxLoad={maxLoad}
            setMaxLoad={setMaxLoad}
            strategy={strategy}
            setStrategy={setStrategy}
            wolfSize={wolfSize}
            setWolfSize={setWolfSize}
            maxIter={maxIter}
            setMaxIter={setMaxIter}
            fragilityConstraint={fragilityConstraint}
            setFragilityConstraint={setFragilityConstraint}
            rotationConstraint={rotationConstraint}
            setRotationConstraint={setRotationConstraint}
            lifoConstraint={lifoConstraint}
            setLifoConstraint={setLifoConstraint}
            itemsList={itemsList}
            setItemsList={setItemsList}
            setIsCustomized={setIsCustomized}
            loadingList={loadingList}
            selected={selected}
            setSelected={setSelected}
            groupedInstances={groupedInstances}
            running={running}
            elapsed={elapsed}
            handleStartRun={handleStartRun}
            handleStopRun={handleStopRun}
            canRun={canRun}
          />
>>>>>>> 6bb359140730094da211ea3c0c6d619c8cceb3a1
        )}

        {/* ── RESULTS TAB ────────────────────────────────────────────────────── */}
        {activeTab === "results" && (
          <ResultsTab
            finalResult={finalResult}
            runHistory={runHistory}
            strategy={strategy}
            stats={stats}
            axisUtil={axisUtil}
            chartData={chartData}
            maxIter={maxIter}
            handleExportResultsCSV={handleExportResultsCSV}
            handleExportReport={handleExportReport}
          />
        )}

        {/* ── VISUALIZATION TAB ──────────────────────────────────────────────── */}
        {activeTab === "visualization" && (
          <VisualizationTab
            placements={placements}
            itemsList={itemsList}
            instanceInfo={instanceInfo}
            binsUsed={binsUsed}
            running={running}
          />
        )}

        {/* ── RUN HISTORY TAB ────────────────────────────────────────────────── */}
        {activeTab === "history" && (
          <RunHistoryTab
            runHistory={runHistory}
            handleExportHistory={handleExportHistory}
            onLoadVisualization={handleLoadVisualization}
          />
        )}

      </main>
    </div>
  );
}
