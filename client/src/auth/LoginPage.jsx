// client/src/auth/LoginPage.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import logo from "../logo.png";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!email || !password) {
      setErr("Please fill in all fields.");
      return;
    }
    setErr("");
    setLoading(true);
    try {
      await login(email, password);
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
        <p className="auth-subtitle">Sign in to continue</p>
        
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

          <div className="form-group" style={{ marginBottom: "24px" }}>
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

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p style={{ marginTop: "24px", fontSize: "14px", color: "var(--text-muted)", textAlign: "center" }}>
          No account? <Link to="/register" style={{ color: "var(--primary)", fontWeight: "600", textDecoration: "none" }}>Register</Link>
        </p>
      </div>
    </div>
  );
}