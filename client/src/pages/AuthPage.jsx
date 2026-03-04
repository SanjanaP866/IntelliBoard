import { useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function AuthPage({ darkMode, toggleDarkMode }) {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async () => {
    if (!form.email || !form.password || (!isLogin && !form.name)) {
      return setError("Please fill in all fields");
    }
    setLoading(true);
    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";
      const { data } = await api.post(endpoint, form);
      login(data.token, data.user);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      {/* Background grid */}
      <div style={styles.grid} />

      <div style={styles.left}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>⬡</span>
          <span style={styles.logoText}>IntelliBoard</span>
          <button onClick={toggleDarkMode} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,marginLeft:8}} title="Toggle theme">{darkMode ? "☀️" : "🌙"}</button>
        </div>
        <h1 style={styles.tagline}>
          Real-Time<br />
          <span style={{ color: "var(--accent)" }}>Collaborative</span><br />
          Diagramming
        </h1>
        <p style={styles.sub}>
          Draw, connect, and collaborate on diagrams with your team — in real time.
        </p>
        <div style={styles.features}>
          {["Infinite canvas with pan & zoom", "Smart DFD connectors", "Live multi-user editing", "Export to PDF"].map((f) => (
            <div key={f} style={styles.featureRow}>
              <span style={{ color: "var(--accent3)" }}>✦</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.right}>
        <div className="card" style={styles.authCard}>
          <div style={styles.tabs}>
            <button
              style={{ ...styles.tab, ...(isLogin ? styles.tabActive : {}) }}
              onClick={() => { setIsLogin(true); setError(""); }}
            >Login</button>
            <button
              style={{ ...styles.tab, ...(!isLogin ? styles.tabActive : {}) }}
              onClick={() => { setIsLogin(false); setError(""); }}
            >Sign Up</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
            {!isLogin && (
              <div>
                <label style={styles.label}>Full Name</label>
                <input
                  className="input"
                  name="name"
                  placeholder="Your name"
                  value={form.name}
                  onChange={handleChange}
                />
              </div>
            )}
            <div>
              <label style={styles.label}>Email</label>
              <input
                className="input"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
            <div>
              <label style={styles.label}>Password</label>
              <input
                className="input"
                name="password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}

            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading}
              style={{ marginTop: 4, justifyContent: "center", padding: "14px" }}
            >
              {loading ? <span className="spinner" /> : (isLogin ? "Enter Board →" : "Create Account →")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    position: "relative",
    overflow: "hidden",
  },
  grid: {
    position: "absolute", inset: 0,
    backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
    backgroundSize: "40px 40px",
    opacity: 0.3,
    pointerEvents: "none",
  },
  left: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: "60px 80px",
    position: "relative",
    zIndex: 1,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 48,
  },
  logoIcon: {
    fontSize: 28,
    color: "var(--accent)",
  },
  logoText: {
    fontFamily: "var(--font-display)",
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: "-0.5px",
  },
  tagline: {
    fontSize: 52,
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: "-2px",
    marginBottom: 24,
  },
  sub: {
    color: "var(--text-muted)",
    fontSize: 16,
    lineHeight: 1.7,
    maxWidth: 380,
    marginBottom: 40,
  },
  features: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  featureRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    color: "var(--text-muted)",
  },
  right: {
    width: 420,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    position: "relative",
    zIndex: 1,
  },
  authCard: {
    width: "100%",
    padding: 32,
  },
  tabs: {
    display: "flex",
    gap: 4,
    background: "var(--surface2)",
    padding: 4,
    borderRadius: 8,
  },
  tab: {
    flex: 1,
    padding: "8px 16px",
    background: "transparent",
    border: "none",
    borderRadius: 6,
    color: "var(--text-muted)",
    fontFamily: "var(--font-display)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  tabActive: {
    background: "var(--accent)",
    color: "white",
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: 6,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
};
