import React, { useState, useRef, useMemo, useEffect } from "react";

export default function LogisticsTab({
  containerSpecs,
  setContainerSpecs,
  maxLoad,
  setMaxLoad,
  strategy,
  setStrategy,
  wolfSize,
  setWolfSize,
  maxIter,
  setMaxIter,
  fragilityConstraint,
  setFragilityConstraint,
  rotationConstraint,
  setRotationConstraint,
  lifoConstraint,
  setLifoConstraint,
  itemsList,
  setItemsList,
  setIsCustomized,
  loadingList,
  selected,
  setSelected,
  groupedInstances,
  running,
  elapsed,
  handleStartRun,
  handleStopRun,
  canRun
}) {
  const fileInputRef = useRef(null);

  // New Item Input states (encapsulated locally)
  const [newItemId, setNewItemId] = useState("BOX-001");
  const [newItemL, setNewL] = useState("");
  const [newItemH, setNewH] = useState("");
  const [newItemD, setNewD] = useState("");
  const [newItemWeight, setNewWeight] = useState("");
  const [newItemQty, setNewQty] = useState("1");
  const [newItemType, setNewItemType] = useState("Standard");
  const [newItemStop, setNewItemStop] = useState("1");

  // Keep newItemId updated based on itemsList length
  useEffect(() => {
    const nextNum = itemsList.length + 1;
    setNewItemId(`BOX-${String(nextNum).padStart(3, "0")}`);
  }, [itemsList]);

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

    // Clear inputs
    setNewL("");
    setNewH("");
    setNewD("");
    setNewWeight("");
    setNewQty("1");
    setNewItemStop("1");
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

  return (
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
  );
}
