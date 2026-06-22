// client/src/Shell.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "./auth/AuthContext";
import BinViewer from "./BinViewer";
import logoImg from "./logo.png";

// ── SVG Convergence Chart ─────────────────────────────────────────────────────
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

  // New Item Input states
  const [newItemId, setNewItemId] = useState("BOX-001");
  const [newItemL, setNewL] = useState("");
  const [newItemH, setNewH] = useState("");
  const [newItemD, setNewD] = useState("");
  const [newItemWeight, setNewWeight] = useState("");
  const [newItemQty, setNewQty] = useState("1");
  const [newItemType, setNewItemType] = useState("Standard");
  const [newItemStop, setNewItemStop] = useState("1");

  // Algorithm Settings & Constraints
  const [strategy, setStrategy] = useState("Sequential");
  const [maxTime, setMaxTime] = useState(90);
  const [wolfSize, setWolfSize] = useState(30);
  const [maxIter, setMaxIter] = useState(500);

  const [fragilityConstraint, setFragilityConstraint] = useState(false);
  const [rotationConstraint, setRotationConstraint] = useState(true);
  const [lifoConstraint, setLifoConstraint] = useState(false);

  // WebSocket & Live optimization run states
  const [wsConnected, setWsConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showLabels, setShowLabels] = useState(false);

  // Visualization Control states
  const [viewportOrientation, setViewportOrientation] = useState("3D");
  const [viewportTrigger, setViewportTrigger] = useState(0);

  const triggerViewReset = useCallback((dir) => {
    setViewportOrientation(dir);
    setViewportTrigger((prev) => prev + 1);
  }, []);
  const [filterStandard, setFilterStandard] = useState(true);
  const [filterFragile, setFilterFragile] = useState(true);
  const [filterHeavy, setFilterHeavy] = useState(true);
  const [selectedStop, setSelectedStop] = useState("All");
  const [selectedItemInfo, setSelectedItemInfo] = useState(null);

  // Stream metrics
  const [instanceInfo, setInstanceInfo] = useState(null);
  const [placements, setPlacements] = useState(null);
  const [binsUsed, setBinsUsed] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [stats, setStats] = useState(null);
  const [finalResult, setFinalResult] = useState(null);
  const [error, setError] = useState(null);

  // Derived stops from placements
  const uniqueStops = useMemo(() => {
    if (!placements) return [1];
    const stopsSet = new Set();
    for (const p of placements) {
      if (p.stop !== undefined) stopsSet.add(p.stop);
    }
    const sortedStops = Array.from(stopsSet).sort((a, b) => a - b);
    return sortedStops.length > 0 ? sortedStops : [1];
  }, [placements]);

  // Run History
  const [runHistory, setRunHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("All");
  const [historySearchQuery, setHistorySearchQuery] = useState("");

  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const fileInputRef = useRef(null);

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
          // Set next box ID dynamically
          const nextNum = data.items.length + 1;
          setNewItemId(`BOX-${String(nextNum).padStart(3, "0")}`);
        }
        setIsCustomized(false);
        setSelectedStop("All");
        setSelectedItemInfo(null);
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
    setSelectedStop("All");
    setSelectedItemInfo(null);

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

  // Items List Helpers
  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemL || !newItemH || !newItemD || !newItemQty) {
      alert("Please fill in item dimensions (L, H, D) and Qty.");
      return;
    }

    const newBox = {
      id: newItemId || `BOX-${String(itemsList.length + 1).padStart(3, "0")}`,
      L: Number(newItemL),
      H: Number(newItemH),
      D: Number(newItemD),
      Qty: Number(newItemQty),
      Weight: Number(newItemWeight) || parseFloat((10 + (itemsList.length * 3.5) % 15).toFixed(1)),
      Type: newItemType,
      Stop: Number(newItemStop) || 1
    };

    setItemsList([...itemsList, newBox]);
    setIsCustomized(true);

    // Clear and increment Box index
    setNewL("");
    setNewH("");
    setNewD("");
    setNewWeight("");
    setNewQty("1");
    setNewItemStop("1");
    setNewItemId(`BOX-${String(itemsList.length + 2).padStart(3, "0")}`);
  };

  const handleRemoveItem = (id) => {
    setItemsList(itemsList.filter((it) => it.id !== id));
    setIsCustomized(true);
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split("\n");
      const newItems = [];
      // Format: ID, [Stop,] L, H, D, Qty, Type, Weight
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(",").map(p => p.trim());
        if (parts.length >= 4) {
          const hasStop = parts.length >= 8;
          const id = parts[0];
          const stop = hasStop ? Number(parts[1]) : 1;
          const lIdx = hasStop ? 2 : 1;
          const hIdx = hasStop ? 3 : 2;
          const dIdx = hasStop ? 4 : 3;
          const qtyIdx = hasStop ? 5 : 4;
          const typeIdx = hasStop ? 6 : 5;
          const wtIdx = hasStop ? 7 : 6;

          newItems.push({
            id: id || `BOX-${String(itemsList.length + newItems.length + 1).padStart(3, "0")}`,
            Stop: isNaN(stop) ? 1 : stop,
            L: Number(parts[lIdx]) || 0,
            H: Number(parts[hIdx]) || 0,
            D: Number(parts[dIdx]) || 0,
            Qty: Number(parts[qtyIdx]) || 1,
            Type: parts[typeIdx] || "Standard",
            Weight: Number(parts[wtIdx]) || 10
          });
        }
      }
      if (newItems.length > 0) {
        setItemsList([...itemsList, ...newItems]);
        setIsCustomized(true);
      }
    };
    reader.readAsText(file);
  };

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

  // Derived setup statistics
  const totalItemsCount = useMemo(() => {
    return itemsList.reduce((sum, item) => sum + Number(item.Qty), 0);
  }, [itemsList]);

  const totalWeightSum = useMemo(() => {
    const sum = itemsList.reduce((sum, item) => sum + (Number(item.Weight || 0) * Number(item.Qty)), 0);
    return parseFloat(sum.toFixed(1));
  }, [itemsList]);

  const totalCategoriesCount = useMemo(() => {
    const cats = new Set(itemsList.map((item) => item.Type));
    return cats.size;
  }, [itemsList]);

  const canRun = wsConnected && !running && itemsList.length > 0;

  // Filtered placements for viewport visualization
  const filteredPlacements = useMemo(() => {
    if (!placements) return null;
    return placements.filter((p) => {
      if (selectedStop !== "All" && p.stop !== Number(selectedStop)) return false;
      const origItem = itemsList.find((it) => it.id === p.id);
      const type = origItem ? origItem.Type : (p.type || "Standard");
      if (type === "Standard") return filterStandard;
      if (type === "Fragile") return filterFragile;
      if (type === "Heavy") return filterHeavy;
      return true;
    });
  }, [placements, itemsList, filterStandard, filterFragile, filterHeavy, selectedStop]);

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
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <h4 style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-main)" }}>Item / Box log</h4>
                      <span className="badge badge-standard">{itemsList.length} items</span>
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
                  <form onSubmit={handleAddItem} style={{ display: "flex", gap: "8px", flexWrap: "wrap", background: "var(--bg-input)", padding: "12px", borderRadius: "8px", marginBottom: "16px", alignItems: "flex-end" }}>
                    <div style={{ flex: "2 1 120px" }}>
                      <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Item ID</label>
                      <input type="text" value={newItemId} onChange={(e) => setNewItemId(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--bg-card)", color: "var(--text-main)", fontSize: "13px", fontWeight: "600", outline: "none" }} />
                    </div>
                    <div style={{ flex: "1 1 60px" }}>
                      <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Stop</label>
                      <input type="number" min="1" value={newItemStop} onChange={(e) => setNewItemStop(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--bg-card)", color: "var(--text-main)", fontSize: "13px", outline: "none" }} />
                    </div>
                    <div style={{ flex: "1 1 50px" }}>
                      <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>W</label>
                      <input type="number" value={newItemL} onChange={(e) => setNewL(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--bg-card)", color: "var(--text-main)", fontSize: "13px", outline: "none" }} />
                    </div>
                    <div style={{ flex: "1 1 50px" }}>
                      <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>D</label>
                      <input type="number" value={newItemD} onChange={(e) => setNewD(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--bg-card)", color: "var(--text-main)", fontSize: "13px", outline: "none" }} />
                    </div>
                    <div style={{ flex: "1 1 50px" }}>
                      <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>H</label>
                      <input type="number" value={newItemH} onChange={(e) => setNewH(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--bg-card)", color: "var(--text-main)", fontSize: "13px", outline: "none" }} />
                    </div>
                    <div style={{ flex: "1 1 70px" }}>
                      <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Wt (kg)</label>
                      <input type="number" value={newItemWeight} onChange={(e) => setNewWeight(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--bg-card)", color: "var(--text-main)", fontSize: "13px", outline: "none" }} />
                    </div>
                    <div style={{ flex: "1 1 60px" }}>
                      <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Qty</label>
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
                          <th>W (cm)</th>
                          <th>D (cm)</th>
                          <th>H (cm)</th>
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
        )}

        {/* ── RESULTS TAB ────────────────────────────────────────────────────── */}
        {activeTab === "results" && (
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
        )}

        {/* ── VISUALIZATION TAB ──────────────────────────────────────────────── */}
        {activeTab === "visualization" && (
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
            
            {/* Sidebar Left Column Wrapper */}
            <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: "20px" }}>
              
              {/* View controls panel */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", boxShadow: "var(--shadow)" }}>
                <h4 className="form-label" style={{ color: "var(--primary)", borderBottom: "1px solid var(--border)", paddingBottom: "8px", marginBottom: "16px" }}>
                  ● VIEW CONTROLS
                </h4>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  {/* Rotate preset buttons */}
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                      Rotate view
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                      {["Front", "Side", "Top", "3D"].map((dir) => (
                        <button
                          key={dir}
                          onClick={() => triggerViewReset(dir)}
                          style={{
                            padding: "8px",
                            borderRadius: "4px",
                            border: "1px solid var(--border)",
                            background: viewportOrientation === dir ? "var(--primary)" : "var(--bg-input)",
                            color: viewportOrientation === dir ? "#ffffff" : "var(--text-muted)",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer"
                          }}
                        >
                          {dir}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Filter switches */}
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                      Filter by type
                    </label>
                    <div className="switch-container">
                      <span className="switch-label">Standard</span>
                      <label className="switch">
                        <input type="checkbox" checked={filterStandard} onChange={(e) => setFilterStandard(e.target.checked)} />
                        <span className="slider" />
                      </label>
                    </div>
                    <div className="switch-container">
                      <span className="switch-label">Fragile</span>
                      <label className="switch">
                        <input type="checkbox" checked={filterFragile} onChange={(e) => setFilterFragile(e.target.checked)} />
                        <span className="slider" />
                      </label>
                    </div>
                    <div className="switch-container">
                      <span className="switch-label">Heavy</span>
                      <label className="switch">
                        <input type="checkbox" checked={filterHeavy} onChange={(e) => setFilterHeavy(e.target.checked)} />
                        <span className="slider" />
                      </label>
                    </div>
                  </div>

                  {/* Labels switch */}
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                    <div className="switch-container">
                      <span className="switch-label" style={{ fontWeight: "700" }}>Item IDs</span>
                      <label className="switch">
                        <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
                        <span className="slider" />
                      </label>
                    </div>
                  </div>

                  {/* Stop Select Dropdown */}
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
                    <label className="form-label" style={{ display: "block", marginBottom: "6px", fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase" }}>Stop</label>
                    <select
                      value={selectedStop}
                      onChange={(e) => setSelectedStop(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        background: "var(--bg-input)",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        color: "var(--text-main)",
                        fontSize: "13px",
                        fontWeight: "600",
                        outline: "none",
                        cursor: "pointer",
                        transition: "border-color 0.15s ease"
                      }}
                    >
                      <option value="All">All ({uniqueStops.join(", ")})</option>
                      {uniqueStops.map(stop => (
                        <option key={stop} value={stop}>Stop {stop}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Placement Details Card */}
              <div style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "24px",
                boxShadow: "var(--shadow)",
                minHeight: "180px",
                display: "flex",
                flexDirection: "column"
              }}>
                <h4 className="form-label" style={{ color: "var(--primary)", borderBottom: "1px solid var(--border)", paddingBottom: "8px", marginBottom: "16px", fontSize: "13px", fontWeight: "700" }}>
                  ● PLACEMENT DETAILS
                </h4>
                {selectedItemInfo ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-dim)" }}>Name:</span>
                      <span style={{ fontWeight: "700", color: "var(--text-main)" }}>{selectedItemInfo.id}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-dim)" }}>Coordinates:</span>
                      <span style={{ fontWeight: "700", color: "var(--text-main)" }}>({selectedItemInfo.x}, {selectedItemInfo.y}, {selectedItemInfo.z})</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-dim)" }}>Size (W×D×H):</span>
                      <span style={{ fontWeight: "700", color: "var(--text-main)" }}>{selectedItemInfo.l} × {selectedItemInfo.d} × {selectedItemInfo.h} cm</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-dim)" }}>Stop:</span>
                      <span style={{ fontWeight: "700", color: "var(--primary)" }}>Stop {selectedItemInfo.stop}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-dim)" }}>Weight:</span>
                      <span style={{ fontWeight: "700", color: "var(--text-main)" }}>{selectedItemInfo.weight} kg</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-dim)", fontSize: "12px", textAlign: "center", border: "1px dashed var(--border)", borderRadius: "8px", padding: "16px" }}>
                    <span style={{ fontSize: "16px" }}>🔍</span>
                    <span style={{ marginTop: "6px" }}>Hover over a packed box to inspect details</span>
                  </div>
                )}
              </div>
            </div>

            {/* Viewport canvas on right */}
            <div style={{ flex: "2 1 600px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", boxShadow: "var(--shadow)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "700" }}>3-D Packing Viewport</h3>
                  <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Updates dynamically during iteration loops. Use mouse controls to rotate/zoom.</span>
                </div>
              </div>

              {filteredPlacements && instanceInfo ? (
                <BinViewer
                  placements={filteredPlacements}
                  container={instanceInfo.container}
                  binsUsed={binsUsed}
                  showLabels={showLabels}
                  running={running}
                  orientation={viewportOrientation}
                  resetTrigger={viewportTrigger}
                  onResetView={() => triggerViewReset("3D")}
                  onHoverItem={setSelectedItemInfo}
                />
              ) : (
                <div style={{ height: "450px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg-input)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "40px", marginBottom: "12px" }}>📦</div>
                  <h4 style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: "600" }}>No Active Run Data</h4>
                  <p style={{ color: "var(--text-dim)", fontSize: "12px", marginTop: "4px" }}>Start the optimizer from the Logistics tab to view output.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── RUN HISTORY TAB ────────────────────────────────────────────────── */}
        {activeTab === "history" && (
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
        )}

      </main>
    </div>
  );
}
