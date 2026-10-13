import { checkWallCollision, pushAwayFromWall } from './collisionUtils';
import { isQuarterTurned } from './rotation';
export const snapToCabinet = (x, y, width, depth, excludeId, rotation, allElements, scale) => {
  const snapDistance = 8; // Increased snap distance for easier snapping
  let snappedX = x;
  let snappedY = y;
  let snapped = false;

  allElements.forEach((element) => {
    if (element.id !== excludeId && element.category === "cabinet") {
      const elX = element.x;
      const elY = element.y;

      // Calculate element dimensions based on rotation
      const elWidth = !isQuarterTurned(element.rotation) ? element.width * scale : element.depth * scale;
      const elDepth = !isQuarterTurned(element.rotation) ? element.depth * scale : element.width * scale;

      // Snap to right side of existing element
      if (
        Math.abs(elX + elWidth - x) < snapDistance &&
        Math.abs(elY - y) < elDepth &&
        Math.abs(elY + elDepth - (y + depth)) < elDepth
      ) {
        snappedX = elX + elWidth;
        snapped = true;
      }
      // Snap to left side of existing element
      else if (
        Math.abs(elX - (x + width)) < snapDistance &&
        Math.abs(elY - y) < elDepth &&
        Math.abs(elY + elDepth - (y + depth)) < elDepth
      ) {
        snappedX = elX - width;
        snapped = true;
      }
      // Snap to bottom of existing element
      else if (
        Math.abs(elY + elDepth - y) < snapDistance &&
        Math.abs(elX - x) < elWidth &&
        Math.abs(elX + elWidth - (x + width)) < elWidth
      ) {
        snappedY = elY + elDepth;
        snapped = true;
      }
      // Snap to top of existing element
      else if (
        Math.abs(elY - (y + depth)) < snapDistance &&
        Math.abs(elX - x) < elWidth &&
        Math.abs(elX + elWidth - (x + width)) < elWidth
      ) {
        snappedY = elY - depth;
        snapped = true;
      }
    }
  });

  return { x: snappedX, y: snappedY, snapped };
};
export const snapToWall = (x, y, width, depth, roomData, scale, customWalls, checkWallCollisionFn, pushAwayFromWallFn) => {
  // Use provided functions or fall back to imported ones
  const checkCollision = checkWallCollisionFn || checkWallCollision;
  const pushAway = pushAwayFromWallFn || pushAwayFromWall;
  const roomWidth = parseFloat(roomData.dimensions.width) * 12 * scale;
  const roomHeight = parseFloat(roomData.dimensions.height) * 12 * scale;
  const snapDistance = 20; // Snap threshold - cabinet must be within this distance to snap
  let snappedX = x;
  let snappedY = y;

  // Snap to each wall if within snap distance - snap EXACTLY to wall edge (0 or max)
  if (Math.abs(x) < snapDistance) snappedX = 0; // Left wall - snap exactly to 0
  if (Math.abs(x + width - roomWidth) < snapDistance) snappedX = roomWidth - width; // Right wall - snap exactly to edge
  if (Math.abs(y) < snapDistance) snappedY = 0; // Top wall - snap exactly to 0
  if (Math.abs(y + depth - roomHeight) < snapDistance) snappedY = roomHeight - depth; // Bottom wall - snap exactly to edge

  // Ensure element stays within room bounds
  snappedX = Math.max(0, Math.min(snappedX, roomWidth - width));
  snappedY = Math.max(0, Math.min(snappedY, roomHeight - depth));

  // Check if cabinet is snapped to a room boundary (flush against wall)
  const isSnappedToRoomWall =
    snappedX === 0 || // Left wall
    snappedX === roomWidth - width || // Right wall
    snappedY === 0 || // Top wall
    snappedY === roomHeight - depth; // Bottom wall

  // Check for wall collision and push away from wall if needed
  // BUT skip this check if already snapped to a room boundary to avoid creating gaps
  if (!isSnappedToRoomWall && checkCollision(x, y, width, depth, customWalls, roomData, 0)) {
    // Push cabinet away from the colliding wall
    const pushedPosition = pushAway(
      snappedX,
      snappedY,
      width,
      depth,
      customWalls,
      roomData,
      scale
    );
    if (pushedPosition) {
      return pushedPosition;
    }

    // Fallback: Try to find a nearby position that doesn't collide
    const searchRadius = 20;
    for (let offsetX = -searchRadius; offsetX <= searchRadius; offsetX += 5) {
      for (let offsetY = -searchRadius; offsetY <= searchRadius; offsetY += 5) {
        const testX = Math.max(0, Math.min(snappedX + offsetX, roomWidth - width));
        const testY = Math.max(0, Math.min(snappedY + offsetY, roomWidth - depth));

        if (!checkCollision(testX, testY, width, depth, customWalls, roomData, 0)) {
          return { x: testX, y: testY };
        }
      }
    }
  }

  return { x: snappedX, y: snappedY };
};