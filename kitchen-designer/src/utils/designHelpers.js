import { isQuarterTurned } from './designer/rotation';
// Design utility functions for cabinet placement, snapping, and collision detection
// Contains helper functions for canvas interactions and element positioning

// Get coordinates from either touch or mouse event
export const getEventCoordinates = (e) => {
  if (e.touches && e.touches.length > 0) {
    return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
  }
  return { clientX: e.clientX, clientY: e.clientY };
};

// Snap point to nearest wall endpoint for seamless connections (only if close enough)
export const snapToWallEndpoints = (x, y, customWalls, excludeWallId = null) => {
  const snapDistance = 12; // Smaller snap distance - only snap if really close
  let bestSnap = { x, y, snapped: false };
  let minDistance = snapDistance + 1;

  customWalls.forEach(wall => {
    if (wall.id === excludeWallId) return; // Skip the wall we're currently editing

    // Check distance to both endpoints
    const startDistance = Math.sqrt(Math.pow(x - wall.x1, 2) + Math.pow(y - wall.y1, 2));
    const endDistance = Math.sqrt(Math.pow(x - wall.x2, 2) + Math.pow(y - wall.y2, 2));

    if (startDistance < minDistance) {
      minDistance = startDistance;
      bestSnap = { x: wall.x1, y: wall.y1, snapped: true };
    }

    if (endDistance < minDistance) {
      minDistance = endDistance;
      bestSnap = { x: wall.x2, y: wall.y2, snapped: true };
    }
  });

  return bestSnap;
};

// Check if cabinet would collide with custom walls using proper line-rectangle intersection
export const checkWallCollision = (x, y, width, depth, customWalls) => {
  for (const wall of customWalls) {
    // Only check walls that are present
    if (!wall || wall.x1 === undefined || wall.y1 === undefined || wall.x2 === undefined || wall.y2 === undefined) {
      continue;
    }

    // Line-rectangle intersection test
    const rectLeft = x;
    const rectRight = x + width;
    const rectTop = y;
    const rectBottom = y + depth;

    const lineX1 = wall.x1;
    const lineY1 = wall.y1;
    const lineX2 = wall.x2;
    const lineY2 = wall.y2;

    // Check if line intersects with rectangle
    // Using parametric line equation and testing against rectangle edges
    const dx = lineX2 - lineX1;
    const dy = lineY2 - lineY1;

    // Test intersection with each edge of rectangle
    const edges = [
      { x1: rectLeft, y1: rectTop, x2: rectRight, y2: rectTop },       // top
      { x1: rectRight, y1: rectTop, x2: rectRight, y2: rectBottom },   // right
      { x1: rectRight, y1: rectBottom, x2: rectLeft, y2: rectBottom }, // bottom
      { x1: rectLeft, y1: rectBottom, x2: rectLeft, y2: rectTop }      // left
    ];

    for (const edge of edges) {
      const edgeDx = edge.x2 - edge.x1;
      const edgeDy = edge.y2 - edge.y1;

      const denominator = dx * edgeDy - dy * edgeDx;
      if (Math.abs(denominator) < 0.0001) continue; // Lines are parallel

      const t1 = ((edge.x1 - lineX1) * edgeDy - (edge.y1 - lineY1) * edgeDx) / denominator;
      const t2 = ((edge.x1 - lineX1) * dy - (edge.y1 - lineY1) * dx) / denominator;

      if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
        return true; // Collision detected
      }
    }
  }
  return false;
};

// Snap cabinet to room walls
export const snapToWall = (x, y, width, depth, currentRoomData, scale, customWalls) => {
  const roomWidth = parseFloat(currentRoomData.dimensions.width) * 12 * scale;
  const roomHeight = parseFloat(currentRoomData.dimensions.height) * 12 * scale;
  const snapDistance = 12; // Increased snap distance for walls

  let snappedX = x;
  let snappedY = y;

  // Snap to left wall
  if (Math.abs(x) <= snapDistance) snappedX = 0;
  // Snap to right wall
  if (Math.abs(x + width - roomWidth) <= snapDistance) snappedX = roomWidth - width;
  // Snap to top wall
  if (Math.abs(y) <= snapDistance) snappedY = 0;
  // Snap to bottom wall
  if (Math.abs(y + depth - roomHeight) <= snapDistance) snappedY = roomHeight - depth;

  // Ensure cabinet stays within room bounds
  snappedX = Math.max(0, Math.min(snappedX, roomWidth - width));
  snappedY = Math.max(0, Math.min(snappedY, roomHeight - depth));

  // Check for collision with custom walls and find nearest non-colliding position if needed
  if (checkWallCollision(snappedX, snappedY, width, depth, customWalls)) {
    // Try to find a nearby position that doesn't collide
    const searchRadius = 20;
    for (let offsetX = -searchRadius; offsetX <= searchRadius; offsetX += 5) {
      for (let offsetY = -searchRadius; offsetY <= searchRadius; offsetY += 5) {
        const testX = Math.max(0, Math.min(snappedX + offsetX, roomWidth - width));
        const testY = Math.max(0, Math.min(snappedY + offsetY, roomHeight - depth));
        if (!checkWallCollision(testX, testY, width, depth, customWalls)) {
          return { x: testX, y: testY };
        }
      }
    }
  }

  return { x: snappedX, y: snappedY };
};

// Snap cabinet to adjacent cabinets
export const snapToCabinet = (x, y, width, depth, excludeId, rotation, currentRoomData, scale) => {
  const snapDistance = 8; // Increased snap distance for easier snapping
  let snappedX = x;
  let snappedY = y;
  let snapped = false;

  currentRoomData.elements.forEach(element => {
    if (element.id !== excludeId && element.category === 'cabinet') {
      const elX = element.x;
      const elY = element.y;
      // Calculate element dimensions based on rotation
      const elWidth = !isQuarterTurned(element.rotation) ? element.width * scale : element.depth * scale;
      const elHeight = !isQuarterTurned(element.rotation) ? element.depth * scale : element.width * scale;

      // Snap to right edge (left side of this cabinet)
      if (Math.abs(x - (elX + elWidth)) <= snapDistance && Math.abs(y - elY) <= snapDistance) {
        snappedX = elX + elWidth;
        snappedY = elY;
        snapped = true;
      }
      // Snap to left edge (right side of this cabinet)
      else if (Math.abs((x + width) - elX) <= snapDistance && Math.abs(y - elY) <= snapDistance) {
        snappedX = elX - width;
        snappedY = elY;
        snapped = true;
      }
      // Snap to bottom edge (top side of this cabinet)
      else if (Math.abs(y - (elY + elHeight)) <= snapDistance && Math.abs(x - elX) <= snapDistance) {
        snappedX = elX;
        snappedY = elY + elHeight;
        snapped = true;
      }
      // Snap to top edge (bottom side of this cabinet)
      else if (Math.abs((y + depth) - elY) <= snapDistance && Math.abs(x - elX) <= snapDistance) {
        snappedX = elX;
        snappedY = elY - depth;
        snapped = true;
      }
    }
  });

  return { x: snappedX, y: snappedY, snapped };
};

// Snap cabinet to custom walls
export const snapCabinetToCustomWall = (x, y, width, depth, excludeId, customWalls, scale) => {
  const snapDistance = 8;
  let bestSnap = { x, y, snapped: false };
  let minDistance = snapDistance + 1;

  for (const wall of customWalls) {
    if (!wall || wall.x1 === undefined) continue;

    // Calculate wall properties
    const wallLength = Math.sqrt(Math.pow(wall.x2 - wall.x1, 2) + Math.pow(wall.y2 - wall.y1, 2));
    if (wallLength === 0) continue;

    const wallAngle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);

    // Cabinet center point
    const cabinetCenterX = x + width / 2;
    const cabinetCenterY = y + depth / 2;

    // Find closest point on wall line to cabinet center
    const t = Math.max(0, Math.min(1,
      ((cabinetCenterX - wall.x1) * (wall.x2 - wall.x1) + (cabinetCenterY - wall.y1) * (wall.y2 - wall.y1)) / (wallLength * wallLength)
    ));

    const closestX = wall.x1 + t * (wall.x2 - wall.x1);
    const closestY = wall.y1 + t * (wall.y2 - wall.y1);

    const distance = Math.sqrt(Math.pow(cabinetCenterX - closestX, 2) + Math.pow(cabinetCenterY - closestY, 2));

    if (distance < minDistance) {
      // Position cabinet so its edge touches the wall
      const offsetDistance = (Math.max(width, depth) / 2) + 2; // Small gap

      const normalX = -Math.sin(wallAngle);
      const normalY = Math.cos(wallAngle);

      const snappedCenterX = closestX + normalX * offsetDistance;
      const snappedCenterY = closestY + normalY * offsetDistance;

      bestSnap = {
        x: snappedCenterX - width / 2,
        y: snappedCenterY - depth / 2,
        snapped: true,
        wallAngle: wallAngle * 180 / Math.PI
      };
      minDistance = distance;
    }
  }

  return bestSnap;
};

// Check if an element would collide with other elements
export const checkElementCollision = (elementX, elementY, elementWidth, elementHeight, draggedElement, currentRoomData, elementTypes, scale) => {
  const overlapBuffer = -5; // Allow 5px overlap (negative means elements can touch/slightly overlap)
  
  return currentRoomData.elements.some(otherElement => {
    // Skip self and non-cabinet elements
    if (otherElement.id === draggedElement.id || otherElement.category !== 'cabinet') {
      return false;
    }

    // Get element specifications for height information
    const draggedSpec = elementTypes[draggedElement.type];
    const otherSpec = elementTypes[otherElement.type];
    
    if (!draggedSpec || !otherSpec) {
      return false;
    }

    // Calculate heights and mount positions
    const draggedHeight = draggedElement.actualHeight || draggedSpec.fixedHeight || draggedSpec.defaultHeight;
    const draggedMountHeight = draggedElement.mountHeight || draggedSpec.mountHeight || 0;
    const draggedTopHeight = draggedMountHeight + draggedHeight;
    
    const otherHeight = otherElement.actualHeight || otherSpec.fixedHeight || otherSpec.defaultHeight;
    const otherMountHeight = otherElement.mountHeight || otherSpec.mountHeight || 0;
    const otherTopHeight = otherMountHeight + otherHeight;

    // Check if elements don't conflict vertically (can coexist at different heights)
    const verticalClearance = Math.max(
      draggedMountHeight - otherTopHeight,  // Distance from dragged bottom to other top
      otherMountHeight - draggedTopHeight   // Distance from other bottom to dragged top  
    );
    
    // If there's sufficient vertical clearance (>= 3 inches), allow horizontal overlap
    if (verticalClearance >= 3) {
      return false; // No collision - elements at different heights
    }

    // Calculate other element's dimensions based on rotation
    const otherWidth = !isQuarterTurned(otherElement.rotation) ? otherElement.width * scale : otherElement.depth * scale;
    const otherDepth = !isQuarterTurned(otherElement.rotation) ? otherElement.depth * scale : otherElement.width * scale;

    // AABB collision detection with overlap buffer
    const collision = !(
      elementX + elementWidth < otherElement.x + overlapBuffer ||
      elementX > otherElement.x + otherWidth - overlapBuffer ||
      elementY + elementHeight < otherElement.y + overlapBuffer ||
      elementY > otherElement.y + otherDepth - overlapBuffer
    );

    return collision;
  });
};

// Check if an element position conflicts with door clearance zones
export const checkDoorClearanceCollision = (elementX, elementY, elementWidth, elementHeight, getDoorClearanceZones, checkRotatedRectCollision) => {
  const clearanceZones = getDoorClearanceZones();

  for (const zone of clearanceZones) {
    let collision = false;
    if (zone.rotation) {
      // Rotated clearance zone (custom wall door) - use rotated rectangle collision
      collision = checkRotatedRectCollision(elementX, elementY, elementWidth, elementHeight, 0, zone.x, zone.y, zone.width, zone.height, zone.rotation);
    } else {
      // Axis-aligned clearance zone (standard wall) - simple AABB collision
      collision = !(elementX + elementWidth < zone.x ||
        elementX > zone.x + zone.width ||
        elementY + elementHeight < zone.y ||
        elementY > zone.y + zone.height);
    }

    if (collision) return true;
  }
  return false;
};

// Check collision between an axis-aligned rectangle and a rotated rectangle
export const checkRotatedRectCollision = (ax, ay, aWidth, aHeight, aRotation, bx, by, bWidth, bHeight, bRotation) => {
  // For simplicity, we'll use a conservative approach:
  // Calculate the bounding box of the rotated clearance zone and check against that
  const angleRad = (bRotation || 0) * Math.PI / 180;

  // Calculate corners of rotated rectangle
  const halfWidth = bWidth / 2;
  const halfHeight = bHeight / 2;

  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight }
  ];

  // Rotate corners and translate
  const rotatedCorners = corners.map(corner => ({
    x: bx + corner.x * Math.cos(angleRad) - corner.y * Math.sin(angleRad),
    y: by + corner.x * Math.sin(angleRad) + corner.y * Math.cos(angleRad)
  }));

  // Find bounding box of rotated rectangle
  const minX = Math.min(...rotatedCorners.map(c => c.x));
  const maxX = Math.max(...rotatedCorners.map(c => c.x));
  const minY = Math.min(...rotatedCorners.map(c => c.y));
  const maxY = Math.max(...rotatedCorners.map(c => c.y));

  // Simple AABB collision with bounding box
  return !(ax + aWidth < minX || ax > maxX || ay + aHeight < minY || ay > maxY);
};