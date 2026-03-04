import { useState, useEffect } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Dashboard({ darkMode, toggleDarkMode }) {
  const { user, logout } = useAuth();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [joinId, setJoinId] = useState("");
  const [creating, setCreating] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const loadBoards = async () => {
    try {
      const { data } = await api.get("/api/boards");
      setBoards(data);
    } catch (err) {
      console.error("Failed to load boards", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBoards(); }, []);

  const createBoard = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post("/api/boards", { title: newTitle });
      setBoards((prev) => [data, ...prev]);
      setNewTitle("");
      window.location.hash = `#/board/${data.roomId}`;
    } catch { alert("Failed to create board"); }
    finally { setCreating(false); }
  };

  const joinBoard = async () => {
    if (!joinId.trim()) return;
    try {
      await api.get(`/api/boards/${joinId.trim()}`);
      window.location.hash = `#/board/${joinId.trim()}`;
    } catch { alert("Board not found. Check the Room ID."); }
  };

  const deleteBoard = async (roomId) => {
    if (!confirm("Delete this board? This cannot be undone.")) return;
    try {
      await api.delete(`/api/boards/${roomId}`);
      setBoards((prev) => prev.filter((b) => b.roomId !== roomId));
    } catch { alert("Failed to delete board"); }
  };

  const copyRoomId = (roomId) => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopiedId(roomId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={{ fontSize: 22, color: "var(--accent)" }}>⬡</span>
          <span style={styles.logo}>IntelliBoard</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Welcome, <strong style={{ color: "var(--text)" }}>{user.name}</strong>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={toggleDarkMode} title="Toggle theme" style={{ fontSize: 16, padding: "5px 10px" }}>
            {darkMode ? "☀️" : "🌙"}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.actionsBar}>
          <h1 style={styles.pageTitle}>My Boards</h1>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowJoin((v) => !v)}>
              🔗 Join by ID
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                placeholder="Board title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createBoard()}
                style={{ width: 200, padding: "8px 14px" }}
              />
              <button className="btn btn-primary btn-sm" onClick={createBoard} disabled={creating || !newTitle.trim()}>
                {creating ? <span className="spinner" /> : "+ New Board"}
              </button>
            </div>
          </div>
        </div>

        {showJoin && (
          <div style={styles.joinPanel}>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
              Paste the full Room ID shared by a collaborator:
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 13 }}
              />
              <button className="btn btn-primary btn-sm" onClick={joinBoard}>Join →</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
            <div className="spinner" style={{ width: 40, height: 40 }} />
          </div>
        ) : boards.length === 0 ? (
          <div style={styles.empty}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>◻</div>
            <p style={{ color: "var(--text-muted)" }}>No boards yet. Create your first one above!</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {boards.map((board) => {
              const isOwner = board.owner._id === user.id || board.owner._id?.toString() === user.id;
              const isCopied = copiedId === board.roomId;
              return (
                <div key={board.roomId} style={styles.boardCard}>
                  <div style={styles.cardTop}>
                    <div style={styles.boardIcon}>{board.title.charAt(0).toUpperCase()}</div>
                    {!isOwner && <span style={styles.collabBadge}>Collaborator</span>}
                  </div>

                  <h3 style={styles.boardTitle}>{board.title}</h3>
                  <p style={styles.boardMeta}>Updated {formatDate(board.updatedAt)}</p>

                  {/* Room ID row — full ID with copy button */}
                  <div style={styles.roomIdRow}>
                    <span style={styles.roomIdLabel}>Room ID</span>
                    <div style={styles.roomIdBox}>
                      <span style={styles.roomIdText} title={board.roomId}>
                        {board.roomId}
                      </span>
                      <button
                        onClick={() => copyRoomId(board.roomId)}
                        style={{
                          ...styles.copyBtn,
                          color: isCopied ? "var(--success)" : "var(--text-muted)",
                          borderColor: isCopied ? "var(--success)" : "var(--border)",
                        }}
                        title="Copy Room ID"
                      >
                        {isCopied ? "✓" : "⎘"}
                      </button>
                    </div>
                  </div>

                  <div style={styles.cardActions}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => { window.location.hash = `#/board/${board.roomId}`; }}
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      Open →
                    </button>
                    {isOwner && (
                      <button className="btn btn-danger btn-sm" onClick={() => deleteBoard(board.roomId)}>
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", display: "flex", flexDirection: "column" },
  header: {
    height: 60, borderBottom: "1px solid var(--border)",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 32px", background: "var(--surface)",
    position: "sticky", top: 0, zIndex: 100,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  logo: { fontWeight: 800, fontSize: 18, letterSpacing: "-0.5px" },
  main: { flex: 1, padding: "40px", maxWidth: 1200, margin: "0 auto", width: "100%" },
  actionsBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 24, flexWrap: "wrap", gap: 12,
  },
  pageTitle: { fontSize: 28, fontWeight: 800, letterSpacing: "-1px" },
  joinPanel: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: 16, marginBottom: 24, maxWidth: 560,
  },
  empty: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", padding: 80, color: "var(--text-muted)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 20,
  },
  boardCard: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 14, padding: 20,
  },
  cardTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  boardIcon: {
    width: 42, height: 42, borderRadius: 10,
    background: "linear-gradient(135deg, var(--accent), var(--accent2))",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 18, fontWeight: 800, color: "white",
  },
  collabBadge: {
    fontSize: 10, padding: "3px 8px", borderRadius: 20,
    background: "rgba(67,232,216,0.15)", color: "var(--accent3)",
    border: "1px solid rgba(67,232,216,0.3)", fontWeight: 600, letterSpacing: "0.5px",
  },
  boardTitle: { fontSize: 16, fontWeight: 700, marginBottom: 4, letterSpacing: "-0.3px" },
  boardMeta: { fontSize: 12, color: "var(--text-muted)", marginBottom: 10 },
  roomIdRow: { marginBottom: 14 },
  roomIdLabel: {
    display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
    letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: 5,
  },
  roomIdBox: {
    display: "flex", alignItems: "center", gap: 6,
    background: "var(--surface2)", border: "1px solid var(--border)",
    borderRadius: 7, padding: "5px 8px",
  },
  roomIdText: {
    flex: 1, fontFamily: "var(--font-mono)", fontSize: 11,
    color: "var(--accent)", letterSpacing: "0.3px",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    minWidth: 0,
  },
  copyBtn: {
    background: "none", border: "1px solid",
    borderRadius: 5, padding: "2px 7px", cursor: "pointer",
    fontSize: 13, transition: "all 0.15s", flexShrink: 0,
    fontFamily: "var(--font-display)",
  },
  cardActions: { display: "flex", gap: 8 },
};
