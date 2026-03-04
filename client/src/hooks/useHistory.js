import { useState, useCallback, useRef } from "react";

export function useHistory(initialState = []) {
  const [past, setPast] = useState([]);
  const [present, setPresent] = useState(initialState);
  const [future, setFuture] = useState([]);

  const committedRef = useRef(initialState);

  const set = useCallback((updater, mode = false) => {
    const compute = (base) => {
      const safeBase = Array.isArray(base) ? base.filter(Boolean) : base;
      const result =
        typeof updater === "function" ? updater(safeBase) : updater;
      return Array.isArray(result) ? result.filter(Boolean) : result;
    };

    // PREVIEW (local drag)
    if (mode === "preview") {
      setPresent((prev) => {
        const next = compute(prev);
        return Array.isArray(next) ? next.filter(Boolean) : next;
      });
      return;
    }

    // REMOTE (socket)
    if (mode === "remote") {
      setPresent((prev) => {
        const next = compute(prev);
        committedRef.current = next;
        return next;
      });
      return;
    }

    // LOCAL COMMIT
    setPresent((prev) => {
      const next = compute(prev);
      const snapshot = Array.isArray(committedRef.current)
        ? committedRef.current.filter(Boolean)
        : committedRef.current;

      committedRef.current = next;

      setPast((p) => [...p, snapshot]);
      setFuture([]);

      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (!prevPast.length) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      const current = committedRef.current;
      committedRef.current = previous;
      setFuture((f) => [current, ...f]);
      setPresent(previous);
      return prevPast.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (!prevFuture.length) return prevFuture;
      const next = prevFuture[0];
      const current = committedRef.current;
      committedRef.current = next;
      setPast((p) => [...p, current]);
      setPresent(next);
      return prevFuture.slice(1);
    });
  }, []);

  return {
    shapes: present,
    setShapes: set,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    getCommitted: () => committedRef.current,
  };
}
