import React, { useState } from "react";
// Tool options for the whiteboard
export const TOOLS = {
  SELECT: "select",
  PENCIL: "pencil",
  ERASER: "eraser",
  RECT: "rect",
  CIRCLE: "circle",
  DIAMOND: "diamond",
  PARALLELOGRAM: "parallelogram",
  ARROW: "arrow",
  TEXT: "text",
  IMAGE: "image",
};

const toolButtons = [
  { tool: TOOLS.SELECT, icon: "↖", label: "Select" },
  { tool: TOOLS.PENCIL, icon: "✏", label: "Pencil" },
  { tool: TOOLS.ERASER, icon: "⌫", label: "Eraser" },
  { tool: "divider" },
  { tool: TOOLS.RECT, icon: "▭", label: "Rect" },
  { tool: TOOLS.CIRCLE, icon: "○", label: "Circle" },
  { tool: TOOLS.DIAMOND, icon: "◇", label: "Diamond" },
  { tool: TOOLS.PARALLELOGRAM, icon: "▱", label: "Para" },
  { tool: "divider" },
  { tool: TOOLS.ARROW, icon: "→", label: "Arrow" },
  { tool: TOOLS.TEXT, icon: "T", label: "Text" },
  { tool: TOOLS.IMAGE, icon: "🖼", label: "Image" },
];


// Small inline copy button for room ID in toolbar
function CopyRoomIdBtn({ roomId }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard.writeText(roomId || "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      title="Copy full Room ID to share"
      style={{
        background: copied ? "rgba(76,175,136,0.15)" : "var(--surface2)",
        border: `1px solid ${copied ? "var(--success)" : "var(--border)"}`,
        borderRadius: 5, padding: "1px 6px", cursor: "pointer",
        fontSize: 11, color: copied ? "var(--success)" : "var(--text-muted)",
        fontFamily: "var(--font-display)", fontWeight: 600, transition: "all 0.15s",
        flexShrink: 0,
      }}
    >
      {copied ? "✓ Copied" : "⎘ Copy ID"}
    </button>
  );
}

export default function Toolbar({
  activeTool,
  setActiveTool,
  strokeColor,
  setStrokeColor,
  fillColor,
  setFillColor,
  fillEnabled,
  setFillEnabled,
  strokeWidth,
  setStrokeWidth,
  textSize,
  setTextSize,
  onImageUpload,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClear,
  onExportPDF,
  onFitContent,
  onBack,
  boardTitle,
  roomId,
  darkMode,
  toggleDarkMode,
  canEdit = true,
  isOwner = false,
  onShowPerms,
}) {
  return (
    <div style={styles.toolbar}>
      {/* ── Top row: nav + board title + actions ── */}
      <div style={styles.topRow} className="tb-top-row">
        <button onClick={onBack} style={styles.backBtn}>← Dashboard</button>

        <div style={styles.boardInfo} className="tb-board-info">
          <span style={styles.boardTitle} className="tb-board-title">{boardTitle}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} className="tb-room-id">
              {roomId}
            </span>
            <CopyRoomIdBtn roomId={roomId} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }} className="tb-top-actions">
          {/* Dark / Light mode toggle */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={toggleDarkMode}
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            style={{ fontSize: 16, padding: "5px 10px" }}
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
          {isOwner && (
            <button className="btn btn-ghost btn-sm" onClick={onShowPerms} title="Manage collaborator permissions">
              👥 Perms
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onFitContent} title="Fit all content into view (Ctrl+F)">⊡ Fit</button>
          <button className="btn btn-ghost btn-sm" onClick={onExportPDF}>⬇ PDF</button>
          <button className="btn btn-danger btn-sm" onClick={onClear}>🗑 Clear</button>
        </div>
      </div>

      {/* ── Tools row ── */}
      <div style={styles.toolsRow} className="tb-tools-row">
        {/* Tool buttons */}
        <div style={styles.toolGroup}>
          {toolButtons.map((btn, i) => {
            if (btn.tool === "divider") return <div key={i} style={styles.divider} />;
            return (
              <button
                key={btn.tool}
                title={btn.label}
                className={`tb-tool-btn${activeTool === btn.tool ? " tb-tool-btn-active" : ""}`}
                style={{
                  ...styles.toolBtn,
                  ...(activeTool === btn.tool ? styles.toolBtnActive : {}),
                }}
                onClick={() => {
                  if (!canEdit && btn.tool !== TOOLS.SELECT) return;
                  if (btn.tool === TOOLS.IMAGE) onImageUpload();
                  else setActiveTool(btn.tool);
                }}
              >
                <span style={{ fontSize: 15 }}>{btn.icon}</span>
                <span style={{ fontSize: 10 }} className="tb-tool-label">{btn.label}</span>
              </button>
            );
          })}
        </div>

        <div style={styles.divider} />

        {/* Stroke color */}
        <div style={styles.optionGroup}>
          <label style={styles.optLabel}>Stroke</label>
          <div style={{ position: "relative" }}>
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => setStrokeColor(e.target.value)}
              style={styles.colorPicker}
              title="Stroke color"
            />
            <div style={{
              position: "absolute", bottom: -2, right: -2,
              width: 10, height: 10, borderRadius: "50%",
              background: strokeColor,
              border: "1px solid var(--border)",
              pointerEvents: "none",
            }} />
          </div>
        </div>

        {/* Fill color with toggle */}
        <div style={styles.optionGroup}>
          <label style={styles.optLabel}>Fill</label>
          {/* Toggle fill on/off */}
          <button
            onClick={() => setFillEnabled((v) => !v)}
            title={fillEnabled ? "Disable fill" : "Enable fill"}
            style={{
              ...styles.fillToggle,
              background: fillEnabled ? "var(--accent)" : "var(--surface2)",
              borderColor: fillEnabled ? "var(--accent)" : "var(--border)",
              color: fillEnabled ? "white" : "var(--text-muted)",
            }}
          >
            {fillEnabled ? "●" : "○"}
          </button>
          {/* Color picker — only active when fill is enabled */}
          <div style={{ position: "relative", opacity: fillEnabled ? 1 : 0.35 }}>
            <input
              type="color"
              value={fillColor}
              onChange={(e) => { setFillColor(e.target.value); setFillEnabled(true); }}
              style={styles.colorPicker}
              title="Fill color"
              disabled={!fillEnabled}
            />
            <div style={{
              position: "absolute", bottom: -2, right: -2,
              width: 10, height: 10, borderRadius: "50%",
              background: fillEnabled ? fillColor : "transparent",
              border: "1px solid var(--border)",
              pointerEvents: "none",
            }} />
          </div>
        </div>

        <div style={styles.divider} />

        {/* Stroke width */}
        <div style={styles.optionGroup}>
          <label style={styles.optLabel}>Width</label>
          <input
            type="range"
            min="1"
            max="20"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            style={{ width: 72, accentColor: "var(--accent)" }} className="tb-slider"
          />
          <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 18, fontFamily: "var(--font-mono)" }}>{strokeWidth}</span>
        </div>

        <div style={styles.divider} />

        {/* Text size — only relevant for the Text tool, but always visible for discoverability */}
        <div style={{
          ...styles.optionGroup,
          opacity: activeTool === "text" ? 1 : 0.45,
          transition: "opacity 0.15s",
        }}>
          <label style={styles.optLabel}>Text</label>
          <input
            type="range"
            min="10"
            max="72"
            step="2"
            value={textSize}
            onChange={(e) => setTextSize(Number(e.target.value))}
            style={{ width: 72, accentColor: "var(--accent)" }} className="tb-slider"
          />
          <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 22, fontFamily: "var(--font-mono)" }}>{textSize}</span>
        </div>

        <div style={styles.divider} />

        {/* Undo / Redo */}
        <div style={styles.optionGroup}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >↩ Undo</button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >↪ Redo</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  toolbar: {
    background: "var(--surface)",
    borderBottom: "1px solid var(--border)",
    userSelect: "none",
    flexShrink: 0,
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px",
    borderBottom: "1px solid var(--border)",
    gap: 12,
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "var(--font-display)",
    padding: "4px 8px",
    borderRadius: 6,
    transition: "color 0.1s",
    whiteSpace: "nowrap",
  },
  boardInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  boardTitle: {
    fontWeight: 700,
    fontSize: 15,
  },
  toolsRow: {
    display: "flex",
    alignItems: "center",
    padding: "6px 16px",
    gap: 4,
    overflowX: "auto",
    flexWrap: "nowrap",
  },
  toolGroup: {
    display: "flex",
    gap: 2,
    alignItems: "center",
  },
  toolBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 1,
    padding: "5px 8px",
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 7,
    color: "var(--text-muted)",
    cursor: "pointer",
    transition: "all 0.1s",
    minWidth: 44,
    fontFamily: "var(--font-display)",
  },
  toolBtnActive: {
    background: "rgba(108,99,255,0.15)",
    border: "1px solid var(--accent)",
    color: "var(--accent)",
  },
  divider: {
    width: 1,
    height: 34,
    background: "var(--border)",
    margin: "0 6px",
    flexShrink: 0,
  },
  optionGroup: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  optLabel: {
    fontSize: 10,
    color: "var(--text-muted)",
    fontWeight: 600,
    letterSpacing: "0.4px",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  colorPicker: {
    width: 28,
    height: 28,
    border: "1px solid var(--border)",
    borderRadius: 6,
    cursor: "pointer",
    padding: 2,
    background: "var(--surface2)",
  },
  fillToggle: {
    border: "1px solid",
    borderRadius: 5,
    width: 24,
    height: 24,
    cursor: "pointer",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s",
    fontFamily: "var(--font-display)",
    padding: 0,
  },
};
