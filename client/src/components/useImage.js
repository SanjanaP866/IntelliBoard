import { useState, useEffect } from "react";

// Simple hook to load an image for use with react-konva
export default function useImage(src) {
  const [state, setState] = useState({ image: null, status: "loading" });

  useEffect(() => {
    if (!src) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setState({ image: img, status: "loaded" });
    img.onerror = () => setState({ image: null, status: "error" });
    img.src = src;
  }, [src]);

  return [state.image, state.status];
}
