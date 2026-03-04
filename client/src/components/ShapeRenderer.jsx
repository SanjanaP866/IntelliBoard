import { useRef, useEffect } from "react";
import { Rect, Circle, Line, Text, Image, Transformer } from "react-konva";
import useImage from "./useImage";

/**
 * FIX: Transformer was defined as inline const Tr = () => <Transformer .../>
 * React treats a new function as a new component type each render → unmounts/remounts
 * the Transformer every re-render, losing nodes([]) binding. Anchors disappeared on
 * mousemove because each mouse event triggered a re-render.
 * Fix: Transformer is rendered directly as JSX inline — never as a sub-component fn.
 */
export default function ShapeRenderer({
  shape, isSelected, onSelect, onChange, onHover, onHoverEnd,
  draggable = false,
  canEdit = true,
}) {
  const nodeRef = useRef(null);
  const trRef   = useRef(null);
  const showTr  = isSelected && draggable && canEdit;

  useEffect(() => {
    if (showTr && trRef.current && nodeRef.current) {
      trRef.current.nodes([nodeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [showTr]);

  const handleTransformEnd = () => {
    const node = nodeRef.current; if (!node) return;
    const sx = node.scaleX(), sy = node.scaleY();
    node.scaleX(1); node.scaleY(1);
    onChange({
      ...shape, x: node.x(), y: node.y(),
      ...(shape.width  !== undefined && { width:  Math.max(10, shape.width  * sx) }),
      ...(shape.height !== undefined && { height: Math.max(10, shape.height * sy) }),
      ...(shape.radius !== undefined && { radius: Math.max(5,  shape.radius * Math.max(sx, sy)) }),
    });
  };

  const common = {
    ref: nodeRef, id: shape.id,
    draggable: draggable && canEdit,
    onClick:      (e) => { e.cancelBubble = true; onSelect(shape.id); },
    onTap:        (e) => { e.cancelBubble = true; onSelect(shape.id); },
    onMouseEnter: (e) => { e.cancelBubble = true; onHover?.(shape.id); },
    onMouseLeave: ()  => onHoverEnd?.(shape.id),
    onDragEnd:    (e) => { if (canEdit) onChange({ ...shape, x: e.target.x(), y: e.target.y() }); },
    onTransformEnd: handleTransformEnd,
    stroke: shape.stroke, strokeWidth: shape.strokeWidth || 2,
  };

  const trCommon = {
    ref: trRef, rotateEnabled: false, keepRatio: false,
    boundBoxFunc: (old, nw) => (nw.width < 10 || nw.height < 10 ? old : nw),
    borderStroke: "#6c63ff", borderStrokeWidth: 1.5,
    anchorFill: "#6c63ff", anchorStroke: "white",
    anchorStrokeWidth: 1.5, anchorSize: 10, anchorCornerRadius: 2,
  };
  const allAnchors = ["top-left","top-center","top-right","middle-right","bottom-right","bottom-center","bottom-left","middle-left"];

  if (shape.type === "rect") return (
    <>
      <Rect {...common} x={shape.x} y={shape.y} width={shape.width} height={shape.height}
        fill={shape.fill || "transparent"} cornerRadius={4} />
      {showTr && <Transformer {...trCommon} enabledAnchors={allAnchors} />}
    </>
  );

  if (shape.type === "circle") return (
    <>
      <Circle {...common} x={shape.x} y={shape.y} radius={shape.radius || 50}
        fill={shape.fill || "transparent"} />
      {showTr && <Transformer {...trCommon} keepRatio={true}
        enabledAnchors={["top-left","top-right","bottom-left","bottom-right"]} />}
    </>
  );

  if (shape.type === "diamond") {
    const { x: cx, y: cy, width: w = 100, height: h = 80 } = shape;
    return (
      <>
        <Line {...common} points={[cx, cy-h/2, cx+w/2, cy, cx, cy+h/2, cx-w/2, cy]}
          fill={shape.fill || "transparent"} closed
          onDragEnd={(e) => { if (!canEdit) return; const dx=e.target.x(),dy=e.target.y(); e.target.position({x:0,y:0}); onChange({...shape,x:cx+dx,y:cy+dy}); }} />
        {showTr && <Transformer {...trCommon} enabledAnchors={allAnchors} />}
      </>
    );
  }

  if (shape.type === "parallelogram") {
    const { x, y, width: w = 120, height: h = 60 } = shape;
    const sk = w * 0.15;
    return (
      <>
        <Line {...common} points={[x+sk,y,x+w,y,x+w-sk,y+h,x,y+h]}
          fill={shape.fill || "transparent"} closed
          onDragEnd={(e) => { if (!canEdit) return; const dx=e.target.x(),dy=e.target.y(); e.target.position({x:0,y:0}); onChange({...shape,x:x+dx,y:y+dy}); }} />
        {showTr && <Transformer {...trCommon} enabledAnchors={allAnchors} />}
      </>
    );
  }

  if (shape.type === "pencil") return (
    <Line id={shape.id} points={shape.points} stroke={shape.stroke}
      strokeWidth={shape.strokeWidth || 3} tension={0.4} lineCap="round" lineJoin="round" listening={false} />
  );

  if (shape.type === "eraser") return (
    <Line id={shape.id} points={shape.points} stroke="rgba(0,0,0,1)"
      strokeWidth={shape.strokeWidth || 20} tension={0.4} lineCap="round" lineJoin="round"
      globalCompositeOperation="destination-out" listening={false} />
  );

  if (shape.type === "text") return (
    <>
      <Text {...common} x={shape.x} y={shape.y} text={shape.text || ""}
        fontSize={shape.fontSize || 16} fill={shape.stroke || "#e8e8f0"}
        fontFamily="Syne, sans-serif" width={shape.width || 200} wrap="word" lineHeight={1.5} />
      {showTr && <Transformer {...trCommon} enabledAnchors={["middle-right","middle-left","bottom-right","bottom-left"]} />}
    </>
  );

  if (shape.type === "image") return (
    <KonvaImage shape={shape} common={common} onChange={onChange} showTr={showTr} canEdit={canEdit} />
  );

  return null;
}

function KonvaImage({ shape, common, onChange, showTr, canEdit }) {
  const trRef  = useRef(null);
  const imgRef = useRef(null);
  const [img, status] = useImage(shape.src);

  useEffect(() => {
    if (showTr && trRef.current && imgRef.current) {
      trRef.current.nodes([imgRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [showTr]);

  if (status !== "loaded") return null;

  const handleTransformEnd = () => {
    const node = imgRef.current; if (!node) return;
    const sx = node.scaleX(), sy = node.scaleY();
    node.scaleX(1); node.scaleY(1);
    onChange({ ...shape, x: node.x(), y: node.y(),
      width: Math.max(20, (shape.width||200)*sx), height: Math.max(20,(shape.height||150)*sy) });
  };

  return (
    <>
      <Image {...common} ref={imgRef} x={shape.x} y={shape.y}
        width={shape.width||200} height={shape.height||150} image={img}
        onDragEnd={(e) => { if (canEdit) onChange({...shape,x:e.target.x(),y:e.target.y()}); }}
        onTransformEnd={handleTransformEnd} />
      {showTr && (
        <Transformer ref={trRef} rotateEnabled={false} keepRatio={false}
          boundBoxFunc={(o,n) => (n.width<20||n.height<20 ? o : n)}
          borderStroke="#6c63ff" borderStrokeWidth={1.5}
          anchorFill="#6c63ff" anchorStroke="white"
          anchorStrokeWidth={1.5} anchorSize={10} anchorCornerRadius={2} />
      )}
    </>
  );
}
