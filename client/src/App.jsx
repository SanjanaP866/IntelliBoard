import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import BoardPage from "./pages/BoardPage";

// Simple client-side router using window.location.hash
function Router() {
  const { user, loading } = useAuth();
  const [route, setRoute] = useState(window.location.hash || "#/");

  // ─── Dark mode state — persisted to localStorage ─────────────────────────
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("ib_dark_mode");
    return saved !== null ? saved === "true" : true; // default dark
  });

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem("ib_dark_mode", String(next));
      return next;
    });
  };

  // Apply dark/light CSS variables to :root
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.style.setProperty("--bg", "#0a0a0f");
      root.style.setProperty("--surface", "#12121a");
      root.style.setProperty("--surface2", "#1a1a26");
      root.style.setProperty("--border", "#2a2a3d");
      root.style.setProperty("--text", "#e8e8f0");
      root.style.setProperty("--text-muted", "#7878a0");
    } else {
      root.style.setProperty("--bg", "#f4f4fb");
      root.style.setProperty("--surface", "#ffffff");
      root.style.setProperty("--surface2", "#eeeef8");
      root.style.setProperty("--border", "#d0d0e8");
      root.style.setProperty("--text", "#111120");
      root.style.setProperty("--text-muted", "#6060a0");
    }
  }, [darkMode]);

  useEffect(() => {
    const handleHash = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (!user) return <AuthPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;

  if (route.startsWith("#/board/")) {
    const roomId = route.replace("#/board/", "");
    return <BoardPage roomId={roomId} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
  }

  return <Dashboard darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
