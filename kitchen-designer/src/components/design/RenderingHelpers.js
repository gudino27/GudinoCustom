import React from 'react';
import { getDoorsOnWall, getCustomWallByNumber } from '../../utils/designer/wallViewUtils';
import { getMaterialById } from '../../constants/materials';

export const renderCornerCabinet = (element, scale, isDragging, handleMouseDown) => {
  const size = element.width * scale;
  
  // Get material color if set
  const materialData = element.materialId ? getMaterialById(element.materialId) : null;
  const fillColor = materialData ? materialData.hex : '#d3d3d3';
  
  // Create L-shaped path based on hinge direction (using relative coordinates)
  const path =
    element.hingeDirection === "left"
      ? `M 0 0
       L ${size} 0
       L ${size} ${size * 0.6}
       L ${size * 0.6} ${size * 0.6}
       L ${size * 0.6} ${size}
       L 0 ${size}
       Z`
      : `M 0 0
       L ${size} 0
       L ${size} ${size}
       L ${size * 0.4} ${size}
       L ${size * 0.4} ${size * 0.6}
       L 0 ${size * 0.6}
       Z`;
  return (
    <g>
      {/* Base cabinet shape */}
      <path
        d={path}
        fill={fillColor}
        stroke="#333"
        strokeWidth="1"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={(e) => handleMouseDown(e, element.id)}
      />
      {/* Wood grain texture overlay */}
      <path
        d={path}
        fill="url(#woodGrain)"
        stroke="none"
        style={{ pointerEvents: 'none' }}
      />
      {/* Door outlines and graphics */}
      {element.hingeDirection === "left" ? (
        <>
          {/* Door division lines */}
          <line
            x1={size * 0.6}
            y1={0}
            x2={size * 0.6}
            y2={size * 0.6}
            stroke="#333"
            strokeWidth="1"
          />
          <line
            x1={0}
            y1={size * 0.6}
            x2={size * 0.6}
            y2={size * 0.6}
            stroke="#333"
            strokeWidth="1"
          />

          {/* Door outline rectangles to show door locations */}
          {/* Top horizontal door */}
          <rect
            x={size * 0.6 + 2}
            y={2}
            width={size * 0.4 - 4}
            height={size * 0.6 - 4}
            fill="none"
            stroke="#666"
            strokeWidth="0.5"
            rx="2"
          />
          {/* Left vertical door */}
          <rect
            x={2}
            y={size * 0.6 + 2}
            width={size * 0.6 - 4}
            height={size * 0.4 - 4}
            fill="none"
            stroke="#666"
            strokeWidth="0.5"
            rx="2"
          />

          {/* Door swing arcs now handled by renderDoorGraphic in DraggableCabinet */}
        </>
      ) : (
        <>
          {/* Door division lines */}
          <line
            x1={size * 0.4}
            y1={0}
            x2={size * 0.4}
            y2={size * 0.6}
            stroke="#333"
            strokeWidth="1"
          />
          <line
            x1={size * 0.4}
            y1={size * 0.6}
            x2={size}
            y2={size * 0.6}
            stroke="#333"
            strokeWidth="1"
          />

          {/* Door outline rectangles to show door locations */}
          {/* Left horizontal door */}
          <rect
            x={2}
            y={2}
            width={size * 0.4 - 4}
            height={size * 0.6 - 4}
            fill="none"
            stroke="#666"
            strokeWidth="0.5"
            rx="2"
          />
          {/* Right vertical door */}
          <rect
            x={size * 0.4 + 2}
            y={size * 0.6 + 2}
            width={size * 0.6 - 4}
            height={size * 0.4 - 4}
            fill="none"
            stroke="#666"
            strokeWidth="0.5"
            rx="2"
          />

          {/* Door swing arcs now handled by renderDoorGraphic in DraggableCabinet */}
        </>
      )}
    </g>
  );
};
export const renderDoorGraphic = (x, y, width, depth, rotation) => {
  const cx =
    rotation === 0
      ? x
      : rotation === 90
      ? x + depth
      : rotation === 180
      ? x + width
      : x;
  const cy =
    rotation === 0
      ? y + depth
      : rotation === 90
      ? y
      : rotation === 180
      ? y
      : y + width;
  const radius = Math.min(width, depth) * 0.3;
  const startAngle = rotation;
  const endAngle = rotation + 90;
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);
  return (
    <g pointerEvents="none">
      {/* Door leaf (open) and its swing */}
      <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="#9ca3af" strokeWidth="0.6" />
      <path
        d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`}
        fill="none"
        stroke="#9ca3af"
        strokeWidth="0.6"
        strokeDasharray="2 1.5"
      />
    </g>
  );
};

// Architectural look of the room walls: a charcoal poche (pattern
// "kdWallPoche", defined in the plan's <defs>) drawn over each wall segment.
// The segment rect underneath keeps fill "#666": the plan's wall-drawing
// click handler recognises walls by that fill.
const WALL_FILL = '#666';
const WALL_LOOK = 'url(#kdWallPoche)';
const DOOR_INK = '#1f2937';
const SWING_INK = '#6b7280';

/**
 * A wall segment: the clickable rect plus its poche on top. Extra props
 * (transform, handlers) go on both / the clickable one.
 */
export const wallSegment = (key, x, y, width, height, props = {}) => {
  const { transform, ...rest } = props;
  return (
    <g key={key}>
      <rect x={x} y={y} width={width} height={height} fill={WALL_FILL} transform={transform} {...rest} />
      <rect x={x} y={y} width={width} height={height} fill={WALL_LOOK} transform={transform} pointerEvents="none" />
    </g>
  );
};

/**
 * Plan symbol of a door in a wall, drawn in wall coordinates: the wall runs
 * along +u, its inside face is at v = face, and the room is on the `inward`
 * side (+1: +v, -1: -v). For a horizontal wall u = x, v = y; for a vertical
 * wall pass `vertical` and u = y, v = x.
 *
 * Standard / pantry / room doors: one leaf hinged at the start jamb, open
 * 90 degrees into the room, with its swing arc. Double: two leaves. Sliding:
 * two overlapping panels in the opening. Cased opening: jambs and a dashed
 * head, no leaf.
 */
export const doorSymbol = ({ key, type, u0, u1, face, inward = 1, vertical = false, thickness = 10 }) => {
  const L = Math.max(0, u1 - u0);
  if (L <= 0) return null;
  // (u, v) -> [x, y]
  const P = (u, v) => (vertical ? [v, u] : [u, v]);
  const line = (a, b, props) => {
    const [x1, y1] = P(a[0], a[1]);
    const [x2, y2] = P(b[0], b[1]);
    return <line x1={x1} y1={y1} x2={x2} y2={y2} {...props} />;
  };
  // Arc from `from` to `to` about a hinge, radius r. The sweep flag flips
  // when the axes are swapped (vertical) or the room side flips.
  const arc = (from, to, r, cw) => {
    const [x1, y1] = P(from[0], from[1]);
    const [x2, y2] = P(to[0], to[1]);
    const sweep = (cw ? 1 : 0) ^ (vertical ? 1 : 0) ^ (inward < 0 ? 1 : 0);
    return (
      <path
        d={`M ${x1} ${y1} A ${r} ${r} 0 0 ${sweep} ${x2} ${y2}`}
        fill="none"
        stroke={SWING_INK}
        strokeWidth="0.75"
      />
    );
  };
  const leafProps = { stroke: DOOR_INK, strokeWidth: 1.6, strokeLinecap: 'butt' };
  const jambs = (
    <>
      {line([u0, face], [u0, face - inward * thickness], { stroke: DOOR_INK, strokeWidth: 1 })}
      {line([u1, face], [u1, face - inward * thickness], { stroke: DOOR_INK, strokeWidth: 1 })}
    </>
  );
  let leaves;
  if (type === 'cased-opening') {
    // Cased opening (a pantry's doorway): no leaf, the head over it drawn
    // dashed on both faces of the wall
    const head = { stroke: DOOR_INK, strokeWidth: 0.8, strokeDasharray: '4 3' };
    leaves = (
      <>
        {line([u0, face], [u1, face], head)}
        {line([u0, face - inward * thickness], [u1, face - inward * thickness], head)}
      </>
    );
  } else if (type === 'sliding') {
    const mid = face - inward * thickness / 2;
    leaves = (
      <>
        {line([u0, mid - 1.5], [u0 + L * 0.55, mid - 1.5], leafProps)}
        {line([u1 - L * 0.55, mid + 1.5], [u1, mid + 1.5], leafProps)}
      </>
    );
  } else if (type === 'double') {
    const h = L / 2;
    leaves = (
      <>
        {line([u0, face], [u0, face + inward * h], leafProps)}
        {arc([u0, face + inward * h], [u0 + h, face], h, false)}
        {line([u1, face], [u1, face + inward * h], leafProps)}
        {arc([u1, face + inward * h], [u1 - h, face], h, true)}
      </>
    );
  } else {
    leaves = (
      <>
        {line([u0, face], [u0, face + inward * L], leafProps)}
        {arc([u0, face + inward * L], [u1, face], L, false)}
      </>
    );
  }
  return (
    <g key={key} pointerEvents="none">
      {jambs}
      {leaves}
    </g>
  );
};

export const renderWallWithDoors = (wallNumber, wallRect, currentRoomData, customWalls, scale) => {
  const doors = getDoorsOnWall(wallNumber, currentRoomData.doors);
  const { x, y, width, height, isHorizontal } = wallRect;

  if (doors.length === 0) {
    // No doors, render solid wall
    return wallSegment(`wall-${wallNumber}`, x, y, width, height);
  }

  // Sort doors by position for proper rendering
  const sortedDoors = doors.sort((a, b) => a.position - b.position);
  const wallElements = [];
  let currentPos = 0; // Position along wall (0-100%)

  // The room side of this wall: below the top wall (1), above the bottom
  // wall (3), right of the left wall (4), left of the right wall (2)
  const inward = wallNumber === 3 || wallNumber === 2 ? -1 : 1;
  const face = isHorizontal
    ? (inward > 0 ? y + height : y)
    : (inward > 0 ? x + width : x);
  const thickness = isHorizontal ? height : width;

  sortedDoors.forEach((door, index) => {
    // Calculate door width as percentage of wall length
    let wallLengthInches;
    if (wallNumber <= 4) {
      // Room walls: wall represents room dimension in feet, so convert to inches
      wallLengthInches = isHorizontal
        ? parseFloat(currentRoomData.dimensions.width) * 12
        : parseFloat(currentRoomData.dimensions.height) * 12;
    } else {
      // Custom walls: calculate actual wall length from coordinates
      const customWall = getCustomWallByNumber(wallNumber, customWalls);
      if (customWall) {
        const wallLengthPixels = Math.sqrt(
          Math.pow(customWall.x2 - customWall.x1, 2) +
            Math.pow(customWall.y2 - customWall.y1, 2)
        );
        // Convert pixels to inches: pixels / (scale factor) gives feet, then * 12 for inches
        wallLengthInches = (wallLengthPixels / scale / 12) * 12; // This simplifies to wallLengthPixels / scale
      } else {
        // Fallback: assume 8 feet if custom wall not found
        wallLengthInches = 96;
      }
    }

    // Door width as percentage of wall length
    const doorWidthPercentage = (door.width / wallLengthInches) * 100;
    const halfDoorWidth = doorWidthPercentage / 2;

    // Ensure door doesn't go beyond wall boundaries
    const doorStart = Math.max(0, door.position - halfDoorWidth);
    const doorEnd = Math.min(100, door.position + halfDoorWidth);

    // Add wall segment before door
    if (currentPos < doorStart) {
      wallElements.push(
        isHorizontal
          ? wallSegment(
              `wall-${wallNumber}-segment-${index}`,
              x + (currentPos / 100) * width,
              y,
              ((doorStart - currentPos) / 100) * width,
              height
            )
          : wallSegment(
              `wall-${wallNumber}-segment-${index}`,
              x,
              y + (currentPos / 100) * height,
              width,
              ((doorStart - currentPos) / 100) * height
            )
      );
    }

    // The opening (white, so wall drawing can still start on it) and the
    // door drawn architecturally: leaf plus swing into the room
    const u0 = isHorizontal ? x + (doorStart / 100) * width : y + (doorStart / 100) * height;
    const u1 = isHorizontal ? x + (doorEnd / 100) * width : y + (doorEnd / 100) * height;
    wallElements.push(
      <g key={`door-${door.id}`}>
        {isHorizontal ? (
          <rect x={u0} y={y} width={u1 - u0} height={height} fill="white" />
        ) : (
          <rect x={x} y={u0} width={width} height={u1 - u0} fill="white" />
        )}
        {doorSymbol({
          key: `door-symbol-${door.id}`,
          type: door.type,
          u0,
          u1,
          face,
          inward,
          vertical: !isHorizontal,
          thickness,
        })}
      </g>
    );

    // Move current position past this door
    currentPos = doorEnd;
  });
  // Add final wall segment after last door
  if (currentPos < 100) {
    wallElements.push(
      isHorizontal
        ? wallSegment(
            `wall-${wallNumber}-final`,
            x + (currentPos / 100) * width,
            y,
            ((100 - currentPos) / 100) * width,
            height
          )
        : wallSegment(
            `wall-${wallNumber}-final`,
            x,
            y + (currentPos / 100) * height,
            width,
            ((100 - currentPos) / 100) * height
          )
    );
  }
  return wallElements;
};