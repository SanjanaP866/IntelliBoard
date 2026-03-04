import { Circle } from "react-konva";
import { getAnchorPoint } from "../pages/BoardPage";

/**
 * Shows 4 anchor points on the edges of a shape when in ARROW mode.
 * Uses the SAME getAnchorPoint() function as BoardPage so positions are
 * always consistent between visual display and stored arrow coordinates.
 * 
 * Each anchor reports back its side name ("top"|"right"|"bottom"|"left")
 * so arrows can reconnect to the correct side when shapes are moved.
 */
export default function AnchorPoints({ shape, onAnchorClick }) {
  if (!shape) return null;

  const sides = ["top", "right", "bottom", "left"];

  return (
    <>
      {sides.map((side) => {
        const pt = getAnchorPoint(shape, side);
        return (
          <Circle
            key={side}
            x={pt.x}
            y={pt.y}
            radius={8}
            hitStrokeWidth={24}   // large invisible click zone
            fill="#6c63ff"
            stroke="white"
            strokeWidth={2.5}
            shadowColor="#6c63ff"
            shadowBlur={10}
            shadowOpacity={0.7}
            onMouseEnter={(e) => {
              e.target.radius(11);
              e.target.getLayer().batchDraw();
            }}
            onMouseLeave={(e) => {
              e.target.radius(8);
              e.target.getLayer().batchDraw();
            }}
            onClick={(e) => {
              e.cancelBubble = true;
              // Pass side name so arrow can reconnect to same face on drag
              onAnchorClick(shape.id, pt.x, pt.y, side);
            }}
          />
        );
      })}
    </>
  );
}
