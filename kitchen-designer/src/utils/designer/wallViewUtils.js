import { isQuarterTurned } from './rotation';

export const getWallName = (wallNumber) => {
  const wallNames = { 1: "North", 2: "East", 3: "South", 4: "West" };
  return wallNames[wallNumber] || `Custom Wall ${wallNumber}`;
};
export const getDoorTypes = () => {
  return [
    { value: "standard", label: "Standard Door", width: 32 },
    { value: "pantry", label: "Pantry Door", width: 24 },
    { value: "room", label: "Room Connection", width: 36 },
    { value: "double", label: "Double Door", width: 64 },
    { value: "sliding", label: "Sliding Door", width: 48 },
  ];
};
export const getElementsOnWall = (wallNumber, elements = [], roomWidth, roomHeight, scale, threshold = 20) => {
  if (!elements) return [];
  return elements.filter((element) => {
    const elementWidth = !isQuarterTurned(element.rotation) ? element.width * scale : element.depth * scale;
    const elementDepth = !isQuarterTurned(element.rotation) ? element.depth * scale : element.width * scale;

    switch (wallNumber) {
      case 1: // North/Top wall
        return element.y < threshold;
      case 2: // East/Right wall
        return element.x + elementWidth > roomWidth - threshold;
      case 3: // South/Bottom wall
        return element.y + elementDepth > roomHeight - threshold;
      case 4: // West/Left wall
        return element.x < threshold;
      default:
        return false;
    }
  });
};
export const getCustomWallByNumber = (wallNumber, customWalls) => {
  return customWalls.find((wall) => wall.wallNumber === wallNumber);
};
export const getDoorsOnWall = (wallNumber, doors = []) => {
  return doors.filter((door) => door.wallNumber === wallNumber);
};
export const getClosestPointOnLine = (px, py, x1, y1, x2, y2) => {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  if (lenSq === 0) return { x: x1, y: y1 }; // Point is on the line start
  let param = dot / lenSq;
  // Clamp to line segment
  if (param < 0) param = 0;
  if (param > 1) param = 1;
  return {
    x: x1 + param * C,
    y: y1 + param * D,
  };
};