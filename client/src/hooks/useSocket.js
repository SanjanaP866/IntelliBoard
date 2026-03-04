import { useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import api from "../api/axios";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export function useSocket(roomId, userId, onAction) {
  const socketRef = useRef(null);

  // FIX (Bug 2): The socket useEffect has deps [roomId, userId], so it only
  // runs once at mount. The onAction callback passed in is therefore captured
  // at mount-time and never updated — it always closes over the initial state.
  // Fix: store onAction in a ref and call onActionRef.current() in the listener.
  // This way the listener always invokes the *latest* handleRemoteAction with
  // up-to-date closures, without needing to re-register the socket listener.
  const onActionRef = useRef(onAction);
  useEffect(() => { onActionRef.current = onAction; }, [onAction]);

  // FIX (Bug 1): Track whether the initial DB load has been delivered.
  // Passed to BoardPage as isInitialLoad so it can decide:
  //   - true  (first connect): always overwrite local state with DB state
  //   - false (reconnect):     only restore if local canvas is empty
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    if (!roomId || !userId) return;

    initialLoadDoneRef.current = false; // reset on room change

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      socket.emit("join-room", { roomId, userId });
    });

    // Call onActionRef.current — always the latest handleRemoteAction
    socket.on("board-action", (action) => {
      onActionRef.current(action);
    });

    socket.on("load-board", (boardState) => {
      const isInitialLoad = !initialLoadDoneRef.current;
      initialLoadDoneRef.current = true;
      onActionRef.current({
        actionType: "LOAD_BOARD",
        payload: boardState,
        isInitialLoad,
      });
    });

    return () => {
      socket.disconnect();
      initialLoadDoneRef.current = false;
    };
  }, [roomId, userId]); // onAction intentionally excluded — use the ref

  const emitAction = useCallback((actionType, payload) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("board-action", { roomId, actionType, payload });
    }
  }, [roomId]);

  // Primary save: HTTP PATCH — survives socket disconnects and reconnects.
  // Falls back to socket save-board if HTTP fails.
  const saveBoard = useCallback(async (boardState) => {
    try {
      await api.patch(`/api/boards/${roomId}/state`, { boardState });
    } catch (err) {
      console.error("HTTP save failed:", err?.response?.status, err?.message);
      if (socketRef.current?.connected) {
        socketRef.current.emit("save-board", { roomId, boardState });
      }
    }
  }, [roomId]);

  return { emitAction, saveBoard };
}
