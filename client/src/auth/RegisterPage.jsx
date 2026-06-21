// client/src/auth/RegisterPage.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import logo from "../logo.png";

const ROLES = [
  { value: "researcher", label: "Researcher" },
  { value: "logistics", label: "Logistics" },
  { value: "other", label: "Other" },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("researcher");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!email || !name || !password) {
      setErr("Please fill in all fields.");
      return;
    }
    setErr("");
    setLoading(true);
    try {
      await register({ email, name, password, role });
      nav("/app");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <img src={logo} alt="STACKR Logo" style={{ width: "80px", height: "80px", display: "block", margin: "0 auto 16px", borderRadius: "16px", boxShadow: "var(--shadow)" }} />
        <h2 className="auth-title" style={{ color: "var(--text-main)" }}>STACKR</h2>
        <p className="auth-subtitle">Create your account</p>

        {err && (
          <div style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid var(--red)",
            borderRadius: "8px",
            padding: "10px 14px",
            color: "var(--red)",
            fontSize: "13px",
            marginBottom: "16px",
            textAlign: "center"
          }}>
            ⚠ {err}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="form-group">
            <label style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-dim)", display: "block", marginBottom: "6px" }}>
              Full Name
            </label>
            <input
              className="form-input"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-dim)", display: "block", marginBottom: "6px" }}>
              Email Address
            </label>
            <input
              className="form-input"
              placeholder="researcher@pup.edu.ph"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-dim)", display: "block", marginBottom: "6px" }}>
              Password
            </label>
            <input
              className="form-input"
              placeholder="••••••••"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: "24px" }}>
            <span style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-dim)", display: "block", marginBottom: "6px" }}>
              I am a...
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: "8px",
                    cursor: "pointer",
                    border: role === r.value ? "2px solid var(--primary)" : "1px solid var(--border)",
                    background: role === r.value ? "var(--primary-light)" : "var(--bg-input)",
                    color: role === r.value ? "var(--primary)" : "var(--text-muted)",
                    fontWeight: role === r.value ? "700" : "500",
                    fontSize: "13px",
                    transition: "all 0.15s ease"
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p style={{ marginTop: "24px", fontSize: "14px", color: "var(--text-muted)", textAlign: "center" }}>
          Already have an account? <Link to="/login" style={{ color: "var(--primary)", fontWeight: "600", textDecoration: "none" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}