import { useState, useEffect, useRef } from "react";

/**
 * Chat panel — collapsible sidebar for real-time board chat.
 * Props:
 *   messages      : [{ id, userId, userName, text, ts }]
 *   onSend        : (text) => void
 *   currentUserId : string  — the local user's ID; their msgs appear on LEFT
 *   isOpen        : bool
 *   onToggle      : () => void
 *   unread        : number  — badge count shown when panel is closed
 */
export default function Chat({
  messages,
  onSend,
  currentUserId,
  isOpen,
  onToggle,
  unread,
}) {
  const [draft, setDraft] = useState("");
  const [hoveredId, setHoveredId] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const textareaRef = useRef(null);
  const [atBottom, setAtBottom] = useState(true);

  // ── Scroll behaviour ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && atBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, atBottom]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  };

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // ── Send ────────────────────────────────────────────────────────────────────
  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setAtBottom(true);
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const formatTime = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const formatDate = (ts) => {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const initials = (name = "?") =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const avatarHue = (id = "") => {
    let h = 0;
    for (let i = 0; i < id.length; i++)
      h = (h * 31 + id.charCodeAt(i)) & 0xffff;
    return h % 360;
  };

  // ── Message enrichment ──────────────────────────────────────────────────────
  // isMine = true  → YOUR message  → bubble on RIGHT side
  // isMine = false → other's msg   → bubble on LEFT side
  const enriched = messages.map((msg, i) => {
    const prev = messages[i - 1];
    // String comparison handles ObjectId vs string mismatches
    const isMine = String(msg.userId) === String(currentUserId);
    const isContinuation =
      prev &&
      String(prev.userId) === String(msg.userId) &&
      msg.ts - prev.ts < 3 * 60 * 1000;
    const showDate = !prev || formatDate(msg.ts) !== formatDate(prev.ts);
    return { ...msg, isMine, isContinuation, showDate };
  });

  const charCount = draft.length;
  const nearLimit = charCount > 420;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        title={isOpen ? "Close chat" : "Open chat"}
        style={{
          position: "fixed",
          bottom: 24,
          right: isOpen ? PANEL_W + 16 : 16,
          zIndex: 800,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "var(--accent)",
          border: "none",
          color: "white",
          fontSize: 18,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 20px rgba(108,99,255,0.5)",
          transition: "right 0.25s ease",
          flexShrink: 0,
        }}
      >
        {isOpen ? "✕" : "💬"}
        {!isOpen && unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              background: "var(--accent2)",
              color: "white",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              border: "2px solid var(--surface)",
              animation: "chatBadgePulse 1.5s infinite",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: isOpen ? 0 : -PANEL_W,
          bottom: 0,
          width: PANEL_W,
          zIndex: 700,
          display: "flex",
          flexDirection: "column",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: isOpen ? "-6px 0 32px rgba(0,0,0,0.35)" : "none",
          transition: "right 0.25s ease",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "0 16px",
            height: 54,
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            background: "var(--surface2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>💬</span>
            <span
              style={{
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: "-0.3px",
                color: "var(--text)",
              }}
            >
              Board Chat
            </span>
          </div>
          <span
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              background: "var(--surface)",
              padding: "2px 8px",
              borderRadius: 10,
              border: "1px solid var(--border)",
            }}
          >
            {messages.length} {messages.length !== 1 ? "msgs" : "msg"}
          </span>
        </div>

        {/* Messages list */}
        <div
          ref={listRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                fontSize: 13,
                gap: 10,
                padding: "60px 0",
                opacity: 0.8,
              }}
            >
              <span style={{ fontSize: 36 }}>💬</span>
              <span style={{ fontWeight: 600 }}>No messages yet</span>
              <span
                style={{
                  fontSize: 12,
                  textAlign: "center",
                  lineHeight: 1.6,
                  opacity: 0.7,
                }}
              >
                Start a conversation
                <br />
                with your collaborators!
              </span>
            </div>
          )}

          {enriched.map((msg) => {
            const hue = avatarHue(msg.userId);

            return (
              <div key={msg.id}>
                {/* Date separator */}
                {msg.showDate && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      margin: "14px 2px 10px",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background: "var(--border)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        fontWeight: 600,
                        letterSpacing: "0.5px",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(msg.ts)}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background: "var(--border)",
                      }}
                    />
                  </div>
                )}

                {/*
                  LAYOUT:
                    YOUR messages (isMine=true):
                      • Row direction: "row-reverse"  → avatar RIGHT, bubble to its LEFT (right-aligned)
                      • Bubble aligns RIGHT within the chat panel
                      • Accent colour bubble

                    OTHERS' messages (isMine=false):
                      • Row direction: "row"           → avatar LEFT, bubble to its RIGHT (left-aligned)
                      • Bubble aligns LEFT within the chat panel
                      • Neutral surface bubble
                */}
                <div
                  onMouseEnter={() => setHoveredId(msg.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    display: "flex",
                    flexDirection: msg.isMine ? "row-reverse" : "row",
                    alignItems: "flex-end",
                    gap: 7,
                    marginTop: msg.isContinuation ? 2 : 10,
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: `hsl(${hue},55%,48%)`,
                      color: "white",
                      fontSize: 9,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      visibility: msg.isContinuation ? "hidden" : "visible",
                      boxShadow: "0 0 0 2px var(--surface)",
                    }}
                  >
                    {initials(msg.userName)}
                  </div>

                  {/* Bubble column */}
                  <div
                    style={{
                      maxWidth: "76%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: msg.isMine ? "flex-end" : "flex-start",
                      gap: 2,
                    }}
                  >
                    {/* Name + time (first in group) */}
                    {!msg.isContinuation && (
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-muted)",
                          display: "flex",
                          gap: 5,
                          alignItems: "center",
                          flexDirection: msg.isMine ? "row-reverse" : "row",
                          paddingLeft: msg.isMine ? 0 : 3,
                          paddingRight: msg.isMine ? 3 : 0,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            color: msg.isMine
                              ? "var(--accent)"
                              : `hsl(${hue},65%,60%)`,
                          }}
                        >
                          {msg.isMine ? "You" : msg.userName}
                        </span>
                        <span style={{ opacity: 0.55 }}>
                          {formatTime(msg.ts)}
                        </span>
                      </div>
                    )}

                    {/* Hover timestamp for continuation messages */}
                    {msg.isContinuation && hoveredId === msg.id && (
                      <div
                        style={{
                          fontSize: 9,
                          color: "var(--text-muted)",
                          opacity: 0.55,
                          alignSelf: msg.isMine ? "flex-end" : "flex-start",
                          paddingLeft: msg.isMine ? 0 : 3,
                          paddingRight: msg.isMine ? 3 : 0,
                        }}
                      >
                        {formatTime(msg.ts)}
                      </div>
                    )}

                    {/* Bubble */}
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: msg.isMine
                          ? "14px 14px 4px 14px"
                          : "14px 14px 14px 4px",
                        background: msg.isMine
                          ? "linear-gradient(135deg, var(--accent), #8078ff)"
                          : "var(--surface2)",
                        color: msg.isMine ? "white" : "var(--text)",
                        fontSize: 13,
                        lineHeight: 1.55,
                        wordBreak: "break-word",
                        border: msg.isMine ? "none" : "1px solid var(--border)",
                        boxShadow: msg.isMine
                          ? "0 2px 10px rgba(108,99,255,0.3)"
                          : "0 1px 4px rgba(0,0,0,0.2)",
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div ref={bottomRef} style={{ height: 4 }} />
        </div>

        {/* Scroll-to-bottom nudge */}
        {!atBottom && isOpen && (
          <button
            onClick={() => {
              setAtBottom(true);
              bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            style={{
              position: "absolute",
              bottom: 80,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10,
              padding: "4px 14px",
              background: "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 12px rgba(108,99,255,0.5)",
              whiteSpace: "nowrap",
            }}
          >
            ↓ New messages
          </button>
        )}

        {/* Input area */}
        <div
          style={{
            padding: "10px 10px 12px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            flexShrink: 0,
            background: "var(--surface2)",
          }}
        >
          <div style={{ display: "flex", gap: 7, alignItems: "flex-end" }}>
            <textarea
              ref={(el) => {
                inputRef.current = el;
                textareaRef.current = el;
              }}
              value={draft}
              rows={1}
              onChange={(e) => {
                setDraft(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height =
                  Math.min(e.target.scrollHeight, 96) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
                e.stopPropagation();
              }}
              placeholder="Message the team…"
              maxLength={500}
              style={{
                flex: 1,
                padding: "8px 11px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                color: "var(--text)",
                fontSize: 13,
                outline: "none",
                fontFamily: "var(--font-display)",
                resize: "none",
                lineHeight: 1.5,
                overflow: "hidden",
                transition: "border-color 0.15s",
                minHeight: 36,
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim()}
              title="Send (Enter)"
              style={{
                width: 36,
                height: 36,
                background: draft.trim() ? "var(--accent)" : "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                color: draft.trim() ? "white" : "var(--text-muted)",
                fontSize: 15,
                cursor: draft.trim() ? "pointer" : "not-allowed",
                opacity: draft.trim() ? 1 : 0.4,
                transition: "background 0.15s, color 0.15s",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ➤
            </button>
          </div>

          {nearLimit && (
            <div
              style={{
                fontSize: 10,
                color: charCount >= 490 ? "var(--danger)" : "var(--text-muted)",
                textAlign: "right",
                paddingRight: 2,
              }}
            >
              {500 - charCount} characters left
            </div>
          )}

          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              opacity: 0.5,
              textAlign: "center",
            }}
          >
            Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>

      <style>{`
        @keyframes chatBadgePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.18); }
        }
      `}</style>
    </>
  );
}

const PANEL_W = 310;