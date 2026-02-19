import React, { useState } from "react";
import api from "../services/api.js";

const S = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#111111",
    fontFamily: "'Instrument Sans','DM Sans',system-ui,sans-serif",
  },
  card: {
    width: 380,
    maxWidth: "90vw",
    background: "#191919",
    border: "1px solid #2A2A2A",
    borderRadius: 12,
    padding: "40px 32px",
  },
  logo: {
    textAlign: "center",
    marginBottom: 32,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 700,
    color: "#F0F0F0",
    letterSpacing: "-0.5px",
  },
  logoSub: {
    fontSize: 13,
    color: "#888888",
    marginTop: 4,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 500,
    color: "#888888",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    background: "#222222",
    border: "1px solid #2A2A2A",
    borderRadius: 8,
    color: "#F0F0F0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  },
  inputFocus: {
    borderColor: "#555555",
  },
  field: {
    marginBottom: 20,
  },
  btn: {
    width: "100%",
    padding: "12px 0",
    background: "#F0F0F0",
    color: "#111111",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
    transition: "background 0.15s",
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  error: {
    background: "rgba(248,113,113,0.06)",
    border: "1px solid rgba(248,113,113,0.2)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#F87171",
    fontSize: 13,
    marginBottom: 16,
  },
  hint: {
    textAlign: "center",
    fontSize: 12,
    color: "#555555",
    marginTop: 24,
  },
};

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await api.login(email, password);
      onLogin(data.user, data.tokens);
    } catch (err) {
      setError(err.message || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.wrapper}>
      <div style={S.card}>
        <div style={S.logo}>
          <div style={S.logoText}>FiberLytic</div>
          <div style={S.logoSub}>Fiber Construction Management</div>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div style={S.error}>{error}</div>}

          <div style={S.field}>
            <label style={S.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
              style={{
                ...S.input,
                ...(focusedField === "email" ? S.inputFocus : {}),
              }}
              placeholder="admin@fiberlytic.com"
              autoComplete="email"
              autoFocus
            />
          </div>

          <div style={S.field}>
            <label style={S.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
              style={{
                ...S.input,
                ...(focusedField === "password" ? S.inputFocus : {}),
              }}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...S.btn,
              ...(loading ? S.btnDisabled : {}),
            }}
            onMouseOver={(e) => {
              if (!loading) e.target.style.background = "#CCCCCC";
            }}
            onMouseOut={(e) => {
              e.target.style.background = "#F0F0F0";
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={S.hint}>
          Backend: localhost:3000 &middot; All users: Fiberlytic2024!
        </div>
      </div>
    </div>
  );
}
