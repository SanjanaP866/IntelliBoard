import { useState, useRef, useCallback, useEffect } from "react";
import { Stage, Layer, Line, Arrow, Rect as KonvaRect } from "react-konva";
import { v4 as uuidv4 } from "uuid";
import jsPDF from "jspdf";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useHistory } from "../hooks/useHistory";
import { useSocket } from "../hooks/useSocket";
import Toolbar, { TOOLS } from "../components/Toolbar";
import ShapeRenderer from "../components/ShapeRenderer";
import AnchorPoints from "../components/AnchorPoints";

function throttle(fn, ms) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    }
  };
}

export default function BoardPage({ roomId, darkMode, toggleDarkMode }) {
  const { user } = useAuth();
  const [boardTitle, setBoardTitle] = useState("Loading...");
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [canEdit, setCanEdit] = useState(true); // permission: owner always true
  const [isOwner, setIsOwner] = useState(false);
  const [boardData, setBoardData] = useState(null); // full board object for permissions UI

  const { shapes, setShapes, undo, redo, canUndo, canRedo, getCommitted } =
    useHistory([]);
  const shapesRef = useRef(shapes);
  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  const [activeTool, setActiveTool] = useState(TOOLS.SELECT);
  const activeToolRef = useRef(TOOLS.SELECT);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  // All drawing options in refs so mouse handlers never read stale closures
  const [strokeColor, setStrokeColor] = useState("#6c63ff");
  const [fillColor, setFillColor] = useState("#ffffff");
  const [fillEnabled, setFillEnabled] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const strokeColorRef = useRef("#6c63ff");
  const fillColorRef = useRef("#ffffff");
  const fillEnabledRef = useRef(false);
  const strokeWidthRef = useRef(2);
  useEffect(() => {
    strokeColorRef.current = strokeColor;
  }, [strokeColor]);
  useEffect(() => {
    fillColorRef.current = fillColor;
  }, [fillColor]);
  useEffect(() => {
    fillEnabledRef.current = fillEnabled;
  }, [fillEnabled]);
  useEffect(() => {
    strokeWidthRef.current = strokeWidth;
  }, [strokeWidth]);

  const shiftRef = useRef(false);
  const [shiftHeld, setShiftHeld] = useState(false);

  const isDrawing = useRef(false);
  const currentPath = useRef(null);
  const drawStart = useRef(null);

  // Stage pan/zoom
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const stageRef = useRef(null);
  const stagePosRef = useRef({ x: 0, y: 0 });
  const stageScaleRef = useRef(1);
  useEffect(() => {
    stagePosRef.current = stagePos;
  }, [stagePos]);
  useEffect(() => {
    stageScaleRef.current = stageScale;
  }, [stageScale]);

  // Window size — FIX #3: use real window size for Stage, recompute on resize
  const [winSize, setWinSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });
  useEffect(() => {
    const onResize = () =>
      setWinSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [selectedId, setSelectedId] = useState(null);
  const [hoveredShapeId, setHoveredShapeId] = useState(null);
  const [showDeleteBtn, setShowDeleteBtn] = useState(false);
  const [deleteBtnPos, setDeleteBtnPos] = useState({ x: 0, y: 0 });

  // Arrow tool
  const [arrowStart, setArrowStart] = useState(null);
  const arrowStartRef = useRef(null);
  useEffect(() => {
    arrowStartRef.current = arrowStart;
  }, [arrowStart]);
  const [mouseCanvasPos, setMouseCanvasPos] = useState({ x: 0, y: 0 });

  // Text tool
  const [textBox, setTextBox] = useState(null);
  const [textBoxDraft, setTextBoxDraft] = useState(null);
  const textBoxRef = useRef(null);
  const textareaRef = useRef(null);
  useEffect(() => {
    textBoxRef.current = textBox;
  }, [textBox]);

  // Permissions panel
  const [showPerms, setShowPerms] = useState(false);
  const [permSaving, setPermSaving] = useState(null);

  const saveTimeout = useRef(null);
  const darkModeRef = useRef(darkMode);
  useEffect(() => {
    darkModeRef.current = darkMode;
  }, [darkMode]);

  // ─── Load board + determine permissions ────────────────────────────────────
  useEffect(() => {
    api
      .get(`/api/boards/${roomId}`)
      .then(({ data }) => {
        setBoardTitle(data.title);
        setBoardData(data);
        const ownerId = data.owner?._id || data.owner;
        const amOwner =
          ownerId === user?.id || ownerId?.toString() === user?.id;
        setIsOwner(amOwner);
        if (!amOwner) {
          const perms = data.collaboratorPermissions || {};
          const perm = perms[user?.id];
          // Default to "edit" for backwards compat if no entry yet
          setCanEdit(perm !== "view");
        } else {
          setCanEdit(true);
        }
        setLoadingBoard(false);
      })
      .catch(() => setLoadingBoard(false));
  }, [roomId, user?.id]);

  useEffect(() => {
    const dn = (e) => {
      if (e.key === "Shift") {
        shiftRef.current = true;
        setShiftHeld(true);
      }
    };
    const up = (e) => {
      if (e.key === "Shift") {
        shiftRef.current = false;
        setShiftHeld(false);
      }
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // FIX #4: save board to DB on page unload so content isn't lost
  useEffect(() => {
    const onUnload = () => {
      const state = getCommitted();
      if (!state.length) return;
      // FIX: Two bugs were here:
      // 1. localStorage.getItem("token") — wrong key. AuthContext uses "ib_token".
      //    The XHR was sending "Authorization: Bearer null" → 401 → save failed silently.
      // 2. navigator.sendBeacon(..., // comment) — the comment was the second argument
      //    (evaluates to undefined). sendBeacon fired with no body/auth, causing a 401
      //    AND racing with the XHR below. Removed entirely.
      // Synchronous XHR is the only reliable save during beforeunload.
      const token = localStorage.getItem("ib_token");
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("PATCH", `/api/boards/${roomId}/state`, false); // false = synchronous
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.send(JSON.stringify({ boardState: state }));
      } catch (_) {}
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [roomId, getCommitted]);

  useEffect(() => {
    const refresh = async () => {
      const { data } = await api.get(`/api/boards/${roomId}`);
      setBoardData(data);
    };

    const interval = setInterval(refresh, 3000);

    return () => clearInterval(interval);
  }, [roomId]);

  // ─── Socket ─────────────────────────────────────────────────────────────────
  const handleRemoteAction = useCallback(
    (action) => {
      const { actionType, payload, isInitialLoad } = action;

      if (actionType === "LOAD_BOARD") {
        // FIX (Bug 1 + Bug 2):
        // Old code: if (payload && payload.length > 0) { setShapes(payload) }
        // Problem A: This ran on EVERY socket reconnect, resetting canvas to the
        //   last DB save and wiping unsaved in-progress work.
        // Problem B: Empty boards (newly cleared) would never load at all.
        //
        // Fix: useSocket now passes isInitialLoad=true only on the FIRST connect.
        // On first connect — always restore from DB (it is the authority).
        // On reconnect  — only restore if local canvas is empty (preserve work).
        if (isInitialLoad) {
          // First load: DB is the source of truth, always apply it
          setShapes((payload || []).filter(Boolean), "remote");
        } else {
          // Reconnect: use functional form to check current state atomically
          setShapes((prev) => {
            if (prev.length === 0 && payload && payload.length > 0) {
              return payload.filter(Boolean);
            }
            return prev; // keep local work — don't let reconnect wipe it
          }, "remote");
        }
        return;
      }

      // FIX (Bug 2 — shapes disappear with two simultaneous users):
      // Old code read `const cur = shapesRef.current` once at the top, then used
      // `setShapes([...cur, payload])`. shapesRef is updated by a useEffect which
      // runs AFTER the render — it lags behind. When two socket events arrive in
      // the same React batch (common during rapid collaborative drawing), both
      // read the same stale shapesRef value. The second setShapes call overwrites
      // the first, making one user's shapes disappear from the other's canvas.
      //
      // Fix: use functional setState `prev => [...]` everywhere. React guarantees
      // that prev is always the actual latest state, not a stale snapshot.
      if (["ADD_SHAPE", "ADD_ARROW", "ADD_IMAGE"].includes(actionType)) {
        if (payload) {
          setShapes((prev) => {
            // Idempotent: skip if this shape id already exists (handles duplicates)
            if (prev.some((s) => s && s.id === payload.id)) return prev;
            return [...prev, payload];
          }, "remote");
        }
      } else if (actionType === "UPDATE_SHAPE") {
        setShapes(
          (prev) => prev.map((s) => (s && s.id === payload.id ? payload : s)),
          "remote",
        );
      } else if (actionType === "DELETE_SHAPE") {
        setShapes(
          (prev) => prev.filter((s) => s && s.id !== payload.id),
          "remote",
        );
      } else if (actionType === "DRAW_PATH") {
        setShapes((prev) => {
          const clean = Array.isArray(prev) ? prev.filter(Boolean) : [];

          const exists = clean.some((s) => s.id === payload.id);

          if (exists) {
            return clean.map((s) =>
              s.id === payload.id ? { ...s, points: payload.points } : s,
            );
          }

          return [...clean, payload];
        }, "remote");
      } else if (actionType === "CLEAR_BOARD") {
        setShapes([], "remote");
      } else if (actionType === "PERM_UPDATE") {
        if (payload?.userId === user?.id) {
          setCanEdit(payload.permission !== "view");
        }
      }
    },
    [setShapes, user?.id],
  );

  const { emitAction, saveBoard } = useSocket(
    roomId,
    user?.id,
    handleRemoteAction,
  );

  const scheduleSave = useCallback(
    (ns) => {
      // Debounce DB saves: restart the 2500ms timer on every action.
      // 1500ms was too short — rapid pencil strokes each triggered a separate save.
      clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => saveBoard(ns), 2500);
    },
    [saveBoard],
  );

  const addShape = useCallback(
    (shape) => {
      if (!shape || !canEdit) return;

      setShapes((prev) => {
        const ns = [...prev, shape];
        scheduleSave(ns);
        return ns;
      });

      emitAction("ADD_SHAPE", shape);
    },
    [setShapes, emitAction, scheduleSave, canEdit],
  );

  const deleteShape = useCallback(
    (id) => {
      if (!canEdit) return;
      setShapes((prev) => {
        const ns = prev.filter((s) => s && s.id !== id);
        scheduleSave(ns);
        return ns;
      });

      emitAction("DELETE_SHAPE", { id });
      setSelectedId(null);
      setShowDeleteBtn(false);
    },
    [setShapes, emitAction, scheduleSave, canEdit],
  );

  // ─── Coordinate helpers ──────────────────────────────────────────────────────
  const getCanvasPos = useCallback(() => {
    const pos = stageRef.current.getPointerPosition();
    const sc = stageScaleRef.current,
      sp = stagePosRef.current;
    return { x: (pos.x - sp.x) / sc, y: (pos.y - sp.y) / sc };
  }, []);

  const canvasToScreen = useCallback((cx, cy) => {
    const sc = stageScaleRef.current,
      sp = stagePosRef.current;
    const rect = stageRef.current?.container().getBoundingClientRect();
    return {
      x: (rect?.left || 0) + cx * sc + sp.x,
      y: (rect?.top || 0) + cy * sc + sp.y,
    };
  }, []);

  // Show delete button near selected shape
  const updateDeleteBtn = useCallback(
    (id) => {
      if (!id || !canEdit) {
        setShowDeleteBtn(false);
        return;
      }
      const shape = getCommitted().find((s) => s && s.id === id);
      if (!shape) {
        setShowDeleteBtn(false);
        return;
      }
      const b = getShapeBounds(shape);
      if (!b) {
        setShowDeleteBtn(false);
        return;
      }
      const screenPos = canvasToScreen(b.x + b.w, b.y);
      setDeleteBtnPos({ x: screenPos.x + 6, y: screenPos.y - 14 });
      setShowDeleteBtn(true);
    },
    [canEdit, getCommitted, canvasToScreen],
  );

  useEffect(() => {
    if (selectedId) updateDeleteBtn(selectedId);
    else setShowDeleteBtn(false);
  }, [selectedId, shapes, stageScale, stagePos]);

  // ─── Mouse Down ──────────────────────────────────────────────────────────────
  const handleMouseDown = (e) => {
    const onStage = e.target === e.target.getStage();
    if (onStage) {
      setSelectedId(null);
    }

    const tool = activeToolRef.current;
    if (tool === TOOLS.SELECT || tool === TOOLS.ARROW) return;

    // FIX #5: if pencil/eraser/shape tools, NEVER proceed if click is on a shape
    if (!onStage) return;

    if (!canEdit) return; // view-only users can't draw

    const pos = getCanvasPos();

    if (tool === TOOLS.TEXT) {
      isDrawing.current = true;
      drawStart.current = pos;
      return;
    }

    if (tool === TOOLS.PENCIL || tool === TOOLS.ERASER) {
      isDrawing.current = true;
      const id = uuidv4();

      currentPath.current = {
        id,
        type: tool === TOOLS.ERASER ? "eraser" : "pencil",
        points: [pos.x, pos.y],
        stroke: strokeColorRef.current,
        strokeWidth:
          tool === TOOLS.ERASER
            ? strokeWidthRef.current * 8
            : strokeWidthRef.current,
      };

      setShapes((prev) => [...prev, currentPath.current], "preview");

      return;
    }

    isDrawing.current = true;
    drawStart.current = pos;
  };

  // ─── Mouse Move ──────────────────────────────────────────────────────────────
  const handleMouseMove = () => {
    if (!stageRef.current) return;

    const pos = getCanvasPos();
    const tool = activeToolRef.current;
    setMouseCanvasPos(pos);

    if (!isDrawing.current) return;

    // ───── Pencil / Eraser ─────
    if (tool === TOOLS.PENCIL || tool === TOOLS.ERASER) {
      if (!currentPath.current) return;

      currentPath.current = {
        ...currentPath.current,
        points: [...currentPath.current.points, pos.x, pos.y],
      };

      // FIX: Capture currentPath.current into a local const BEFORE entering
      // the setShapes updater. React 18 batches updates — the updater may not
      // execute until after handleMouseUp has run and set currentPath.current = null.
      // Reading the ref lazily inside the updater causes: Cannot read properties
      // of null (reading 'id'). Capturing it here guarantees the updater closes
      // over the non-null value that existed at call time.
      const path = currentPath.current;

      setShapes((prev) => {
        const clean = Array.isArray(prev) ? prev.filter(Boolean) : [];
        const exists = clean.some((s) => s.id === path.id);
        if (exists) {
          return clean.map((s) => s.id === path.id ? path : s);
        }
        return [...clean, path];
      }, "preview");

      emitThrottled("DRAW_PATH", path);
      return;
    }

    // ───── Other Shape Tools ─────
    if (!drawStart.current) return;

    const { x: sx, y: sy } = drawStart.current;

    if (tool === TOOLS.TEXT) {
      const x = Math.min(sx, pos.x);
      const y = Math.min(sy, pos.y);
      const w = Math.abs(pos.x - sx);
      const h = Math.abs(pos.y - sy);

      if (w > 10 && h > 10) {
        setTextBoxDraft({ x, y, width: w, height: h });
      }

      return;
    }

    const fill = fillEnabledRef.current ? fillColorRef.current : "transparent";

    const preview = buildShape(
      tool,
      sx,
      sy,
      pos.x,
      pos.y,
      strokeColorRef.current,
      fill,
      strokeWidthRef.current,
      "_preview",
      shiftRef.current,
    );

    if (preview) {
      setShapes((prev) => {
        if (!Array.isArray(prev)) return prev;

        const filtered = prev.filter((s) => s && s.id !== "_preview");

        return [...filtered, preview];
      }, "preview");
    }
  };

  const emitThrottled = useCallback(
    throttle((t, p) => emitAction(t, p), 50),
    [emitAction],
  );

  // ─── Mouse Up ────────────────────────────────────────────────────────────────
  const handleMouseUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (!stageRef.current) return;
    const pos = getCanvasPos();
    const tool = activeToolRef.current;

    if (tool === TOOLS.PENCIL || tool === TOOLS.ERASER) {
      const finalPath = currentPath.current;
      if (!finalPath) return;
      // Clear the ref FIRST before setShapes so that any pending preview
      // updater that hasn't flushed yet will find currentPath.current === null
      // and safely skip (the guard at top of handleMouseMove handles this).
      // Then use the captured finalPath local const — never the ref — inside
      // the updater.
      currentPath.current = null;
      setShapes((prev) => {
        const base = prev.filter((s) => s && s.id !== finalPath.id);
        const ns = [...base, finalPath];
        scheduleSave(ns);
        return ns;
      });
      // Emit final committed path so remote users get the complete stroke
      // (emitThrottled may have swallowed the last points in the 50ms window)
      emitAction("DRAW_PATH", finalPath);
      return;
    }

    if (tool === TOOLS.TEXT) {
      const draft = textBoxDraft;
      if (draft && draft.width > 20 && draft.height > 20) {
        setTextBox(draft);
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
      setTextBoxDraft(null);
      drawStart.current = null;
      return;
    }

    if (!drawStart.current) return;

    const { x: sx, y: sy } = drawStart.current;

    const fill = fillEnabledRef.current ? fillColorRef.current : "transparent";

    const shape = buildShape(
      tool,
      sx,
      sy,
      pos.x,
      pos.y,
      strokeColorRef.current,
      fill,
      strokeWidthRef.current,
      uuidv4(),
      shiftRef.current,
    );

    if (shape) {
      setShapes((prev) => {
        const base = prev.filter((s) => s && s.id !== "_preview");
        const ns = [...base, shape];
        scheduleSave(ns);
        return ns;
      });

      emitAction("ADD_SHAPE", shape);
    } else {
      // just remove preview safely
      setShapes(
        (prev) => prev.filter((s) => s && s.id !== "_preview"),
        "preview",
      );
    }

    drawStart.current = null;
  };

  // ─── Wheel ───────────────────────────────────────────────────────────────────
  const handleWheel = (e) => {
    e.evt.preventDefault();
    const oldScale = stageScaleRef.current;
    const pointer = stageRef.current.getPointerPosition();
    if (e.evt.ctrlKey) {
      const dir = e.evt.deltaY < 0 ? 1.08 : 1 / 1.08;
      const newScale = Math.min(Math.max(oldScale * dir, 0.1), 5);
      const mpt = {
        x: (pointer.x - stagePosRef.current.x) / oldScale,
        y: (pointer.y - stagePosRef.current.y) / oldScale,
      };
      setStageScale(newScale);
      setStagePos({
        x: pointer.x - mpt.x * newScale,
        y: pointer.y - mpt.y * newScale,
      });
    } else {
      setStagePos((p) => ({ x: p.x - e.evt.deltaX, y: p.y - e.evt.deltaY }));
    }
  };

  // ─── Fit to content ──────────────────────────────────────────────────────────
  const fitToContent = useCallback(() => {
    const all = getCommitted().filter(Boolean);
    if (!all.length) {
      setStageScale(1);
      setStagePos({ x: 0, y: 0 });
      return;
    }
    let mnx = Infinity,
      mny = Infinity,
      mxx = -Infinity,
      mxy = -Infinity;
    all.forEach((s) => {
      const b = getShapeBounds(s);
      if (!b) return;
      mnx = Math.min(mnx, b.x);
      mny = Math.min(mny, b.y);
      mxx = Math.max(mxx, b.x + b.w);
      mxy = Math.max(mxy, b.y + b.h);
    });
    const cw = mxx - mnx || 1,
      ch = mxy - mny || 1;
    const sw = winSize.w,
      sh = winSize.h - 100,
      pad = 80;
    const ns = Math.min((sw - pad * 2) / cw, (sh - pad * 2) / ch, 2);
    setStageScale(ns);
    setStagePos({
      x: (sw - cw * ns) / 2 - mnx * ns,
      y: (sh - ch * ns) / 2 - mny * ns,
    });
  }, [getCommitted, winSize]);

  // ─── Arrow anchors ───────────────────────────────────────────────────────────
  const handleAnchorClick = useCallback(
    (shapeId, ax, ay, side) => {
      const cur = arrowStartRef.current;
      if (!cur) {
        setArrowStart({ shapeId, x: ax, y: ay, side });
      } else {
        if (cur.shapeId === shapeId) {
          setArrowStart(null);
          return;
        }
        const arrow = {
          id: uuidv4(),
          type: "arrow",
          fromShapeId: cur.shapeId,
          fromSide: cur.side,
          toShapeId: shapeId,
          toSide: side,
          points: [cur.x, cur.y, ax, ay],
          stroke: strokeColorRef.current,
          strokeWidth: strokeWidthRef.current,
        };
        addShape(arrow);
        setArrowStart(null);
      }
    },
    [addShape],
  );

  // ─── Shape change (drag / resize) ────────────────────────────────────────────
  const handleShapeChange = useCallback(
    (updated) => {
      if (!canEdit) return;

      setShapes((prev) => {
        // 1️⃣ Update the changed shape
        let ns = prev.map((s) => (s.id === updated.id ? updated : s));

        // 2️⃣ Recalculate arrows that depend on this shape
        ns = ns.map((s) => {
          if (!s || s.type !== "arrow") return s;

          let u = { ...s, points: [...s.points] };

          if (s.fromShapeId === updated.id) {
            const p = getAnchorPoint(updated, s.fromSide || "right");
            u.points = [p.x, p.y, u.points[2], u.points[3]];
          }

          if (s.toShapeId === updated.id) {
            const p = getAnchorPoint(updated, s.toSide || "left");
            u.points = [u.points[0], u.points[1], p.x, p.y];
          }

          return u;
        });

        // 3️⃣ Persist latest state
        scheduleSave(ns);

        return ns;
      });

      emitAction("UPDATE_SHAPE", updated);
    },
    [setShapes, emitAction, scheduleSave, canEdit],
  );

  // ─── Text submit ─────────────────────────────────────────────────────────────
  const handleTextSubmit = useCallback(
    (text) => {
      const tb = textBoxRef.current;
      setTextBox(null);
      if (!text?.trim() || !tb) return;
      addShape({
        id: uuidv4(),
        type: "text",
        x: tb.x,
        y: tb.y,
        width: tb.width,
        height: tb.height,
        text: text.trim(),
        stroke: strokeColorRef.current,
        fontSize: 16,
        wrap: "word",
      });
    },
    [addShape],
  );

  // ─── Image upload ─────────────────────────────────────────────────────────────
  const handleImageUpload = () => {
    if (!canEdit) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        const sc = stageScaleRef.current,
          sp = stagePosRef.current;
        const cx = (winSize.w / 2 - sp.x) / sc,
          cy = ((winSize.h - 100) / 2 - sp.y) / sc;
        const shape = {
          id: uuidv4(),
          type: "image",
          src: re.target.result,
          x: cx - 150,
          y: cy - 100,
          width: 300,
          height: 200,
          stroke: "transparent",
          strokeWidth: 0,
        };
        addShape(shape);
        emitAction("ADD_IMAGE", shape);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // ─── Permission change (owner only) ──────────────────────────────────────────
  const handlePermChange = async (userId, permission) => {
    setPermSaving(userId);
    try {
      const { data } = await api.patch(`/api/boards/${roomId}/permissions`, {
        userId,
        permission,
      });
      setBoardData((prev) =>
        prev
          ? { ...prev, collaboratorPermissions: data.collaboratorPermissions }
          : prev,
      );
      // Broadcast perm change so the affected user sees it in real time
      emitAction("PERM_UPDATE", { userId, permission });
    } catch (err) {
      alert("Failed to update permission");
    } finally {
      setPermSaving(null);
    }
  };

  const handleClear = () => {
    if (!canEdit) return;
    if (!confirm("Clear the board?")) return;
    setShapes([]);
    emitAction("CLEAR_BOARD", {});
    saveBoard([]);
  };

  const handleExportPDF = () => {
    const stage = stageRef.current;
    // FIX #3: Export at 1:1 with background color so no black areas
    const savedScale = stage.scaleX();
    const savedX = stage.x(),
      savedY = stage.y();
    // Reset to show all content
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    const url = stage.toDataURL({ pixelRatio: 1.5, mimeType: "image/png" });
    stage.scale({ x: savedScale, y: savedScale });
    stage.position({ x: savedX, y: savedY });
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "px",
      format: [stage.width(), stage.height()],
    });
    pdf.addImage(url, "PNG", 0, 0, stage.width(), stage.height());
    pdf.save(`${boardTitle || "board"}.pdf`);
  };

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) undo();
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      )
        redo();
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId)
        deleteShape(selectedId);
      if (e.key === "Escape") {
        setArrowStart(null);
        setTextBox(null);
        setTextBoxDraft(null);
        setSelectedId(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        fitToContent();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo, selectedId, deleteShape, fitToContent]);

  if (loadingBoard)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );

  const valid = Array.isArray(shapes) ? shapes.filter(Boolean) : [];
  const drawShapes = valid.filter(
    (s) => s.type === "pencil" || s.type === "eraser",
  );
  const mainShapes = valid.filter(
    (s) => s.type !== "pencil" && s.type !== "eraser" && s.type !== "arrow",
  );
  const arrows = valid.filter((s) => s.type === "arrow");
  const isSelect = activeTool === TOOLS.SELECT;
  const isArrow = activeTool === TOOLS.ARROW;
  const isText = activeTool === TOOLS.TEXT;
  const canvasBg = darkMode ? "#0a0a0f" : "#f4f4fb";
  const dotColor = darkMode ? "#2a2a3d" : "#c4c4dd";
  const stageH = winSize.h - 100;

  const toScreenBox = (box) => {
    if (!box) return null;
    const tl = canvasToScreen(box.x, box.y);
    return {
      left: tl.x,
      top: tl.y,
      width: box.width * stageScale,
      height: box.height * stageScale,
    };
  };
  const draftScreen = toScreenBox(textBoxDraft);
  const textScreen = toScreenBox(textBox);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <Toolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        strokeColor={strokeColor}
        setStrokeColor={setStrokeColor}
        fillColor={fillColor}
        setFillColor={setFillColor}
        fillEnabled={fillEnabled}
        setFillEnabled={setFillEnabled}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        onImageUpload={handleImageUpload}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onClear={handleClear}
        onExportPDF={handleExportPDF}
        onFitContent={fitToContent}
        onBack={() => {
          window.location.hash = "#/";
        }}
        boardTitle={boardTitle}
        roomId={roomId}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        shiftHeld={shiftHeld}
        canEdit={canEdit}
        isOwner={isOwner}
        onShowPerms={() => setShowPerms((v) => !v)}
      />

      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          background: canvasBg,
        }}
      >
        {/* Dot grid background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`,
            backgroundSize: `${30 * stageScale}px ${30 * stageScale}px`,
            backgroundPosition: `${stagePos.x}px ${stagePos.y}px`,
            pointerEvents: "none",
            opacity: 0.8,
          }}
        />

        <Stage
          ref={stageRef}
          width={winSize.w}
          height={stageH}
          scaleX={stageScale}
          scaleY={stageScale}
          x={stagePos.x}
          y={stagePos.y}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          // FIX (Bug 3 — black rectangle on canvas):
          // The Stage x/y props move the <canvas> HTML element on screen.
          // A Konva canvas has a transparent background by default, which some
          // browsers composite as black (especially when the KonvaRect in Layer 1
          // uses globalCompositeOperation on its buffer). Setting background on
          // the canvas element itself ensures the transparent areas show the
          // correct canvas background color instead of black.
          style={{
            cursor: getCursor(activeTool, arrowStart, canEdit),
            background: canvasBg,
          }}
          // Stage only pans in SELECT mode — and only when dragging the background
          draggable={isSelect && canEdit}
          onDragEnd={(e) => {
            if (e.target === e.target.getStage())
              setStagePos({ x: e.target.x(), y: e.target.y() });
          }}
        >
          {/*
           * Layer 1 — pencil strokes + eraser
           * FIX #3: KonvaRect painted as full bg so eraser destination-out
           * shows the canvas background color, not transparent/black.
           * Size is large enough to cover any pan position.
           */}
          <Layer>
            <KonvaRect
              x={-50000}
              y={-50000}
              width={100000}
              height={100000}
              fill={canvasBg}
              listening={false}
            />
            {drawShapes.map((s) => (
              <ShapeRenderer
                key={s.id}
                shape={s}
                isSelected={false}
                draggable={false}
                canEdit={false}
                onSelect={() => {}}
                onChange={() => {}}
                onHover={() => {}}
                onHoverEnd={() => {}}
              />
            ))}
          </Layer>

          {/* Layer 2 — shapes + arrows + anchors */}
          <Layer>
            {mainShapes.map((s) => (
              <ShapeRenderer
                key={s.id}
                shape={s}
                isSelected={selectedId === s.id}
                draggable={isSelect}
                canEdit={canEdit}
                onSelect={(id) => {
                  if (isSelect) setSelectedId(id);
                }}
                onChange={handleShapeChange}
                onHover={(id) => {
                  if (isArrow) setHoveredShapeId(id);
                }}
                onHoverEnd={() => setHoveredShapeId(null)}
              />
            ))}

            {arrows.map((a) => (
              <Arrow
                key={a.id}
                points={a.points}
                stroke={a.stroke || "#6c63ff"}
                strokeWidth={Math.max(a.strokeWidth || 2, 2)}
                fill={a.stroke || "#6c63ff"}
                pointerLength={16}
                pointerWidth={14}
                tension={0}
                lineCap="round"
              />
            ))}

            {isArrow && arrowStart && (
              <Arrow
                points={[
                  arrowStart.x,
                  arrowStart.y,
                  mouseCanvasPos.x,
                  mouseCanvasPos.y,
                ]}
                stroke="#6c63ff"
                strokeWidth={2}
                fill="#6c63ff"
                pointerLength={14}
                pointerWidth={12}
                dash={[8, 6]}
                opacity={0.6}
                tension={0}
              />
            )}

            {isArrow && hoveredShapeId && (
              <AnchorPoints
                shape={valid.find((s) => s && s.id === hoveredShapeId)}
                onAnchorClick={handleAnchorClick}
              />
            )}
          </Layer>
        </Stage>

        {/* ── FIX #2: Delete button near selected shape ── */}
        {showDeleteBtn && canEdit && selectedId && (
          <button
            onClick={() => deleteShape(selectedId)}
            title="Delete shape (Del)"
            style={{
              position: "fixed",
              left: deleteBtnPos.x,
              top: deleteBtnPos.y,
              zIndex: 500,
              background: "#ff4d4f",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "3px 9px",
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 700,
              boxShadow: "0 2px 8px rgba(255,77,79,0.4)",
              lineHeight: 1.5,
            }}
          >
            ✕
          </button>
        )}

        {/* Text box drag preview */}
        {isText && draftScreen && (
          <div
            style={{
              position: "fixed",
              left: draftScreen.left,
              top: draftScreen.top,
              width: draftScreen.width,
              height: draftScreen.height,
              border: "2px dashed #6c63ff",
              borderRadius: 4,
              pointerEvents: "none",
              background: "rgba(108,99,255,0.05)",
            }}
          />
        )}

        {/* Text box input */}
        {textBox && textScreen && (
          <div
            style={{
              position: "fixed",
              left: textScreen.left,
              top: textScreen.top,
              width: Math.max(textScreen.width, 120),
              zIndex: 1000,
            }}
          >
            <textarea
              ref={textareaRef}
              autoFocus
              placeholder="Type… Enter to place, Shift+Enter for newline"
              style={{
                width: "100%",
                minHeight: Math.max(textScreen.height, 40),
                background: darkMode
                  ? "rgba(18,18,26,0.97)"
                  : "rgba(255,255,255,0.97)",
                color: "var(--text)",
                border: "2px solid var(--accent)",
                borderRadius: 6,
                padding: "8px 10px",
                fontFamily: "Syne, sans-serif",
                fontSize: 15,
                resize: "none",
                outline: "none",
                boxShadow: "0 4px 20px rgba(108,99,255,0.25)",
                lineHeight: 1.5,
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleTextSubmit(e.target.value);
                }
                if (e.key === "Escape") {
                  setTextBox(null);
                }
              }}
              onBlur={(e) =>
                setTimeout(() => handleTextSubmit(e.target.value), 150)
              }
            />
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginTop: 3,
                paddingLeft: 2,
              }}
            >
              Enter to place · Shift+Enter for new line · Esc to cancel
            </div>
          </div>
        )}

        {/* View-only banner */}
        {!canEdit && (
          <div
            style={{
              position: "absolute",
              top: 12,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(255,180,0,0.15)",
              border: "1px solid rgba(255,180,0,0.4)",
              borderRadius: 8,
              padding: "6px 18px",
              fontSize: 12,
              color: "#ffb400",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            👁 View-only mode — you can browse but not edit
          </div>
        )}

        {/* Arrow hint */}
        {isArrow && (
          <div
            style={{
              position: "absolute",
              bottom: 56,
              left: "50%",
              transform: "translateX(-50%)",
              background: arrowStart
                ? "rgba(108,99,255,0.12)"
                : "var(--surface)",
              border: `1px solid ${arrowStart ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 8,
              padding: "8px 18px",
              fontSize: 13,
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {arrowStart ? (
              <>
                <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                  ●
                </span>{" "}
                FROM set — hover a shape, click an anchor · Esc to cancel
              </>
            ) : (
              "Hover a shape to reveal anchors, then click one to start an arrow"
            )}
          </div>
        )}

        {/* Text hint */}
        {isText && !textBox && (
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "6px 16px",
              fontSize: 12,
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            Click and drag to draw a text box
          </div>
        )}

        {/* Shift constrain hint */}
        {[
          TOOLS.RECT,
          TOOLS.CIRCLE,
          TOOLS.DIAMOND,
          TOOLS.PARALLELOGRAM,
        ].includes(activeTool) && (
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--surface)",
              border: `1px solid ${shiftHeld ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 12,
              color: shiftHeld ? "var(--accent)" : "var(--text-muted)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {shiftHeld
              ? "⇧ Equal width & height"
              : "Hold ⇧ Shift for equal dimensions"}
          </div>
        )}

        {/* Zoom + Fit */}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 12px",
            display: "flex",
            gap: 8,
            alignItems: "center",
            fontSize: 12,
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <button
            onClick={() =>
              setStageScale((s) => Math.max(+(s - 0.1).toFixed(2), 0.1))
            }
            style={zBtn}
          >
            −
          </button>
          {Math.round(stageScale * 100)}%
          <button
            onClick={() =>
              setStageScale((s) => Math.min(+(s + 0.1).toFixed(2), 5))
            }
            style={zBtn}
          >
            +
          </button>
          <button
            onClick={() => {
              setStageScale(1);
              setStagePos({ x: 0, y: 0 });
            }}
            style={{ ...zBtn, fontSize: 10 }}
          >
            Origin
          </button>
          <button
            onClick={fitToContent}
            title="Fit all (Ctrl+F)"
            style={{
              ...zBtn,
              fontSize: 10,
              borderLeft: "1px solid var(--border)",
              paddingLeft: 8,
              color: "var(--accent)",
            }}
          >
            ⊡ Fit
          </button>
        </div>

        {/* ── Permissions panel (owner only) ── */}
        {showPerms && isOwner && boardData && (
          <div
            style={{
              position: "fixed",
              top: 110,
              right: 16,
              zIndex: 900,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
              minWidth: 300,
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                Collaborator Permissions
              </span>
              <button
                onClick={() => setShowPerms(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 18,
                  color: "var(--text-muted)",
                }}
              >
                ✕
              </button>
            </div>
            {!boardData.collaborators ||
            boardData.collaborators.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                No collaborators yet. Share your Room ID to invite people.
              </p>
            ) : (
              boardData.collaborators.map((collab) => {
                const collabId = collab._id || collab;
                const name = collab.name || collab.email || collabId;
                const current =
                  (boardData.collaboratorPermissions || {})[collabId] || "edit";
                return (
                  <div
                    key={collabId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {name}
                    </span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {["edit", "view"].map((p) => (
                        <button
                          key={p}
                          disabled={permSaving === collabId}
                          onClick={() => handlePermChange(collabId, p)}
                          style={{
                            padding: "3px 10px",
                            borderRadius: 5,
                            fontSize: 12,
                            cursor: "pointer",
                            fontWeight: 600,
                            transition: "all 0.15s",
                            background:
                              current === p
                                ? "var(--accent)"
                                : "var(--surface2)",
                            color:
                              current === p ? "white" : "var(--text-muted)",
                            border: `1px solid ${current === p ? "var(--accent)" : "var(--border)"}`,
                            opacity: permSaving === collabId ? 0.6 : 1,
                          }}
                        >
                          {p === "edit" ? "✏ Edit" : "👁 View"}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildShape(
  tool,
  x1,
  y1,
  x2,
  y2,
  stroke,
  fill,
  sw,
  id,
  constrain = false,
) {
  let w = Math.abs(x2 - x1),
    h = Math.abs(y2 - y1);
  if (w < 4 && h < 4) return null;
  if (constrain) {
    const s = Math.max(w, h);
    w = s;
    h = s;
  }
  const l = Math.min(x1, x2),
    t = Math.min(y1, y2);
  const base = { id, stroke, fill, strokeWidth: sw };
  if (tool === TOOLS.RECT)
    return { ...base, type: "rect", x: l, y: t, width: w, height: h };
  if (tool === TOOLS.CIRCLE)
    return {
      ...base,
      type: "circle",
      x: x1 + (x2 - x1) / 2,
      y: y1 + (y2 - y1) / 2,
      radius: Math.max(w, h) / 2,
    };
  if (tool === TOOLS.DIAMOND)
    return {
      ...base,
      type: "diamond",
      x: (x1 + x2) / 2,
      y: (y1 + y2) / 2,
      width: w,
      height: h,
    };
  if (tool === TOOLS.PARALLELOGRAM)
    return { ...base, type: "parallelogram", x: l, y: t, width: w, height: h };
  return null;
}

function getShapeBounds(shape) {
  if (!shape) return null;
  if (shape.type === "circle") {
    const r = shape.radius || 50;
    return { x: shape.x - r, y: shape.y - r, w: r * 2, h: r * 2 };
  }
  if (shape.type === "diamond") {
    const hw = (shape.width || 100) / 2,
      hh = (shape.height || 80) / 2;
    return {
      x: shape.x - hw,
      y: shape.y - hh,
      w: shape.width || 100,
      h: shape.height || 80,
    };
  }
  if (shape.type === "pencil" || shape.type === "eraser") {
    const pts = shape.points || [];
    if (pts.length < 2) return null;
    let mnx = pts[0],
      mny = pts[1],
      mxx = pts[0],
      mxy = pts[1];
    for (let i = 0; i < pts.length; i += 2) {
      mnx = Math.min(mnx, pts[i]);
      mxx = Math.max(mxx, pts[i]);
      mny = Math.min(mny, pts[i + 1]);
      mxy = Math.max(mxy, pts[i + 1]);
    }
    return { x: mnx, y: mny, w: mxx - mnx || 1, h: mxy - mny || 1 };
  }
  if (shape.type === "text")
    return {
      x: shape.x,
      y: shape.y,
      w: shape.width || 200,
      h: (shape.fontSize || 16) * 2,
    };
  if (shape.type === "image")
    return {
      x: shape.x,
      y: shape.y,
      w: shape.width || 300,
      h: shape.height || 200,
    };
  return {
    x: shape.x || 0,
    y: shape.y || 0,
    w: shape.width || 100,
    h: shape.height || 60,
  };
}

export function getAnchorPoint(shape, side) {
  const b = getShapeBounds(shape);
  if (!b) return { x: 0, y: 0 };
  const cx = b.x + b.w / 2,
    cy = b.y + b.h / 2;
  if (side === "top") return { x: cx, y: b.y };
  if (side === "bottom") return { x: cx, y: b.y + b.h };
  if (side === "left") return { x: b.x, y: cy };
  if (side === "right") return { x: b.x + b.w, y: cy };
  return { x: cx, y: cy };
}

function getCursor(tool, arrowStart, canEdit) {
  if (!canEdit) return "default";
  if (tool === TOOLS.PENCIL) return "crosshair";
  if (tool === TOOLS.ERASER) return "cell";
  if (tool === TOOLS.ARROW) return arrowStart ? "crosshair" : "default";
  if (tool === TOOLS.TEXT) return "crosshair";
  if (
    [TOOLS.RECT, TOOLS.CIRCLE, TOOLS.DIAMOND, TOOLS.PARALLELOGRAM].includes(
      tool,
    )
  )
    return "crosshair";
  return "default";
}

const zBtn = {
  background: "none",
  border: "none",
  color: "var(--text-muted)",
  cursor: "pointer",
  fontSize: 16,
  fontFamily: "var(--font-mono)",
  padding: "0 2px",
};
