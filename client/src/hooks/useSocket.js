import { useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import api from "../api/axios";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export function useSocket(roomId, userId, onAction) {
  const socketRef = useRef(null);

  const onActionRef = useRef(onAction);
  useEffect(() => { onActionRef.current = onAction; }, [onAction]);

  // Chat callback ref — same pattern as onAction
  const onChatRef = useRef(null);

  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    // Wait until both roomId AND userId are available before connecting.
    // user?.id is resolved asynchronously from AuthContext — if we connect
    // before it's ready, join-room fires with userId=undefined and the socket
    // is placed in the wrong (or no) room, so no messages are ever relayed.
    if (!roomId || !userId) return;

    initialLoadDoneRef.current = false;

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

    // Relay incoming chat messages to BoardPage via the registered handler
    socket.on("chat-message", (message) => {
      onChatRef.current?.(message);
    });

    return () => {
      socket.disconnect();
      initialLoadDoneRef.current = false;
    };
  }, [roomId, userId]);

  const emitAction = useCallback((actionType, payload) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("board-action", { roomId, actionType, payload });
    }
  }, [roomId]);

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

  // FIX: roomId was missing from deps — emitChat always captured the stale
  // roomId from the first render (often undefined), so the server received
  // { roomId: undefined, message } and socket.to(undefined) matched no room.
  const emitChat = useCallback((_roomId, message) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("chat-message", { roomId, message });
    }
  }, [roomId]);

  const setOnChat = useCallback((fn) => {
    onChatRef.current = fn;
  }, []);

  return { emitAction, saveBoard, emitChat, setOnChat };
}
