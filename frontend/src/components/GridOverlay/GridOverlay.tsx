import { type Map } from '../../api';
import './GridOverlay.css';

interface GridOverlayProps {
  map: Map;
}

function GridOverlay({ map }: GridOverlayProps) {
  if (!map.grid_enabled) {
    return null;
  }

  const gridColor = map.grid_color || 'white';
  const gridOpacity = (map.grid_opacity ?? 100) / 100;
  const gridCols = map.grid_cols || 10;
  const gridRows = map.grid_rows || 10;


  // Map actual color names to CSS colors
  const colorMap: Record<string, string> = {
    'white': '#ffffff',
    'black': '#000000',
    'pink': '#ec4899'
  };

  const strokeColor = colorMap[gridColor] || gridColor;

  return (
    <svg
      width={map.width}
      height={map.height}
      viewBox={`0 0 ${map.width} ${map.height}`}
      className="grid-overlay-svg"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        opacity: gridOpacity,
        pointerEvents: 'none',
        display: 'block'
      }}
    >
      {/* Vertical lines - always from top to bottom of map */}
      {Array.from({ length: gridCols + 1 }).map((_, i) => {
        const x = (map.width / gridCols) * i;
        return (
          <line
            key={`v-${i}`}
            x1={x}
            y1={0}
            x2={x}
            y2={map.height}
            stroke={strokeColor}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}

      {/* Horizontal lines - always from left to right of map */}
      {Array.from({ length: gridRows + 1 }).map((_, i) => {
        const y = (map.height / gridRows) * i;
        return (
          <line
            key={`h-${i}`}
            x1={0}
            y1={y}
            x2={map.width}
            y2={y}
            stroke={strokeColor}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

export default GridOverlay;



