import {
  applyMoves,
  checkRotatedRectCollision,
  findFreePosition,
  findOverlappingElement,
  rotateWithHoused,
  seatInEmptyHousing,
  snapIntoHousing,
} from '../../utils/designer/collisionUtils';
import { carryHoused, housingChangeProblem, isHousable } from '../../utils/designer/housing';
import { footprint, normalizeRotation } from '../../utils/designer/rotation';
import { elementOverlapsWall, findWallOverlap } from '../../utils/designer/wallFaces';
import { roundInches, roundPlanPx, roundMoves } from '../../utils/designer/planUnits';
export const useElementManagement = ({
  currentRoomData,
  setCurrentRoomData,
  elementTypes,
  scale,
  setSelectedElement,
  getDoorClearanceZones,
  onDoorClearanceWarning,
  // (reason, element, detail) when an item cannot go anywhere without
  // overlapping another: reason is "noSpace" (adding) or "rotate" (turning in
  // place); or "housing" when a change to a refrigerator cabinet would leave
  // the fridge inside it no longer fitting (detail: housingChangeProblem)
  onPlacementBlocked,
}) => {
  const checkDoorClearanceCollision = (
    elementX,
    elementY,
    elementWidth,
    elementHeight
  ) => {
    const clearanceZones = getDoorClearanceZones();
    return clearanceZones.some((zone) => {
      if (zone.rotation !== undefined) {
        // Rotated clearance zone (custom wall) - use more complex collision detection
        return checkRotatedRectCollision(
          elementX,
          elementY,
          elementWidth,
          elementHeight,
          0, // Element (assumed axis-aligned)
          zone.centerX,
          zone.centerY,
          zone.width,
          zone.height,
          zone.rotation // Clearance zone
        );
      } else {
        // Axis-aligned clearance zone (standard wall) - simple AABB collision
        const collision = !(
          elementX + elementWidth < zone.x ||
          elementX > zone.x + zone.width ||
          elementY + elementHeight < zone.y ||
          elementY > zone.y + zone.height
        );
        return collision;
      }
    });
  };
  // Would a footprint (plan px) press into a drawn or pantry wall?
  const wallBlocked = (x, y, width, depth) =>
    !!findWallOverlap({ x, y, width, depth }, currentRoomData, scale);
  // The drop spot for a new element, or null when it is taken: a seat in an
  // empty housing under the drop (a fridge over a fridge cabinet), else the
  // spot itself when it is inside the room and clear of other items and
  // (unless snapped to a cabinet) of door clearance zones
  const placeAtTarget = (newElement, target, room) => {
    const elements = currentRoomData.elements;
    if (isHousable(newElement.type, elementTypes)) {
      const seat = snapIntoHousing(newElement, target.x, target.y, elements, elementTypes, scale);
      if (seat) return { x: seat.x, y: seat.y, rotation: seat.rotation };
    }
    const rotation = normalizeRotation(target.rotation || 0);
    const placed = { ...newElement, rotation };
    const size = footprint(placed, scale);
    const inRoom =
      target.x >= 0 &&
      target.y >= 0 &&
      target.x + size.width <= room.width + 0.001 &&
      target.y + size.depth <= room.depth + 0.001;
    if (!inRoom) return null;
    if (findOverlappingElement(placed, target.x, target.y, elements, elementTypes, scale)) return null;
    if (elementOverlapsWall(placed, target.x, target.y, currentRoomData, scale)) return null;
    if (!target.snapped && checkDoorClearanceCollision(target.x, target.y, size.width, size.depth)) return null;
    return { x: target.x, y: target.y, rotation };
  };
  // `target` (optional): { x, y, rotation?, snapped? } in plan px, where the
  // item was dropped on the plan. It goes there when that spot is inside the
  // room, clear of other items and (unless snapped to one) of door swings;
  // otherwise it goes to the nearest free spot to the drop. Without a target
  // it goes to the nearest free spot to the middle of the room.
  const addElement = (type, target = null) => {
    const elementSpec = elementTypes[type];
    if (!elementSpec) {
      console.warn("Cannot add element: Missing elementSpec for type:", type);
      return;
    }

    const newElement = {
      id: Date.now(), // Unique ID based on timestamp
      type: type,
      x: 0, // Set below, once a free spot is found
      y: 0,
      width: elementSpec.defaultWidth,
      depth: elementSpec.defaultDepth,
      actualHeight: elementSpec.fixedHeight || elementSpec.defaultHeight, // Use fixed height if available
      mountHeight: elementSpec.mountHeight || 0, // Wall mount height (0 for floor cabinets)
      color: elementSpec.color,
      rotation: 0, // No rotation initially
      hingeDirection: "left", // For corner cabinets
      category: elementSpec.category,
      zIndex: elementSpec.zIndex,
    };

    // Room size in pixels
    const room = {
      width: parseFloat(currentRoomData.dimensions.width) * 12 * scale,
      depth: parseFloat(currentRoomData.dimensions.height) * 12 * scale,
    };

    // Dropped on the plan: take that spot if it is free
    let spot = target ? placeAtTarget(newElement, target, room) : null;
    if (spot) {
      newElement.rotation = spot.rotation;
    }

    // Try the centre of the room (or the drop point) first, then the nearest
    // spot along the walls, then the open floor: never on top of another item
    // (unless one is mounted above the other) and, if possible, clear of door swings
    const placeOptions = {
      room,
      preferred: target
        ? { x: target.x, y: target.y }
        : {
            x: room.width / 2 - (elementSpec.defaultWidth * scale) / 2,
            y: room.depth / 2 - (elementSpec.defaultDepth * scale) / 2,
          },
      walls: currentRoomData.walls || [1, 2, 3, 4],
      // a drop that is blocked goes to the nearest free spot, wall or not
      wallsFirst: !target,
    };
    // A refrigerator goes into an empty refrigerator cabinet if there is one
    if (!spot && !target && isHousable(type, elementTypes)) {
      spot = seatInEmptyHousing(newElement, currentRoomData.elements, elementTypes, scale);
      if (spot) newElement.rotation = spot.rotation;
    }
    if (!spot) {
      spot = findFreePosition(
        newElement,
        currentRoomData.elements,
        elementTypes,
        scale,
        {
          ...placeOptions,
          isBlocked: (x, y, w, d) => checkDoorClearanceCollision(x, y, w, d) || wallBlocked(x, y, w, d),
        }
      );
    }
    if (!spot) {
      // No spot clear of the door swings: take one that only avoids other items
      spot = findFreePosition(
        newElement,
        currentRoomData.elements,
        elementTypes,
        scale,
        { ...placeOptions, isBlocked: wallBlocked }
      );
      if (spot && onDoorClearanceWarning) {
        onDoorClearanceWarning();
      }
    }
    if (!spot) {
      // The room is full: do not drop it on top of something
      if (onPlacementBlocked) onPlacementBlocked("noSpace", newElement);
      return null;
    }
    // px on the 1/16" grid (utils/designer/planUnits.js)
    newElement.x = roundPlanPx(spot.x, scale);
    newElement.y = roundPlanPx(spot.y, scale);

    const updatedData = {
      ...currentRoomData,
      elements: [...currentRoomData.elements, newElement],
    };

    // Set default material for cabinets
    if (newElement.category === "cabinet") {
      updatedData.materials = {
        ...updatedData.materials,
        [newElement.id]: "laminate",
      };
    }

    setCurrentRoomData(updatedData);
    setSelectedElement(newElement.id); // Auto-select newly added element
    return newElement;
  };
  const updateElement = (elementId, updates) => {
    // angles are stored in [0, 360): -90 / -180 broke the footprint checks
    if (updates.rotation !== undefined) {
      updates = { ...updates, rotation: normalizeRotation(updates.rotation) };
    }
    // a mount height dragged in 3D or the wall view: inches to 1/16"
    if (typeof updates.mountHeight === 'number') {
      updates = { ...updates, mountHeight: roundInches(updates.mountHeight) };
    }
    const element = currentRoomData.elements.find((el) => el.id === elementId);
    // A cabinet may not shrink (narrower opening, lower upper, shorter) round
    // the appliance inside it: the change is declined and the user told why.
    // Returns false then, true otherwise.
    const problem = element
      ? housingChangeProblem(element, updates, currentRoomData.elements, elementTypes, scale)
      : null;
    if (problem) {
      if (onPlacementBlocked) onPlacementBlocked("housing", element, problem);
      return false;
    }
    // A cabinet that houses an appliance takes it along when it moves, turns
    // or changes size (the 3D views and the properties panel come through here)
    const carried = element
      ? carryHoused(element, updates, currentRoomData.elements, elementTypes, scale)
      : [];
    setCurrentRoomData({
      ...currentRoomData,
      elements: applyMoves(
        currentRoomData.elements,
        roundMoves([{ ...updates, id: elementId }, ...carried], scale)
      ),
    });
    return true;
  };
  const updateElementDimensions = (elementId, property, value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) return;

    const element = currentRoomData.elements.find((el) => el.id === elementId);
    if (!element) return;

    const elementSpec = elementTypes[element.type];
    if (!elementSpec) {
      console.warn("Missing elementSpec for type:", element.type);
      return;
    }

    let updates = {};

    if (property === "width") {
      updates.width = numValue;
    } else if (property === "depth") {
      updates.depth = numValue;
    } else if (property === "actualHeight") {
      // Height constraints vary by element type
      if (element.type === "wall" || element.type === "medicine") {
        const maxHeight =
          parseFloat(currentRoomData.dimensions.wallHeight) -
          element.mountHeight;
        const minHeight = elementSpec.minHeight || 12;
        updates.actualHeight = Math.max(
          minHeight,
          Math.min(numValue, maxHeight)
        );
      } else if (
        element.type === "tall" ||
        element.type === "linen" ||
        element.type === "refrigerator-cabinet"
      ) {
        const maxHeight = parseFloat(currentRoomData.dimensions.wallHeight);
        const minHeight = elementSpec.minHeight || 40;
        updates.actualHeight = Math.max(
          minHeight,
          Math.min(numValue, maxHeight)
        );
      }
    } else if (property === "mountHeight") {
      // Mount height constraints for wall cabinets
      const maxMount =
        parseFloat(currentRoomData.dimensions.wallHeight) -
        element.actualHeight;
      updates.mountHeight = Math.max(0, Math.min(numValue, maxMount));
    }

    updateElement(elementId, updates);
  };
  const rotateElement = (elementId, angle) => {
    const element = currentRoomData.elements.find((el) => el.id === elementId);
    if (element) {
      // turn about the centre and stay inside the room (x, y are the footprint's corner)
      const room = {
        width: parseFloat(currentRoomData.dimensions.width) * 12 * scale,
        depth: parseFloat(currentRoomData.dimensions.height) * 12 * scale,
      };
      // and do not turn onto another item: nudge it clear, or refuse
      // (a refrigerator cabinet turns with the fridge inside it)
      const moves = rotateWithHoused(
        element,
        angle,
        room,
        currentRoomData.elements,
        elementTypes,
        scale
      );
      // nor turn into a drawn or pantry wall
      const turned = moves && { ...element, ...moves[0] };
      if (
        !moves ||
        (elementOverlapsWall(turned, turned.x, turned.y, currentRoomData, scale) &&
          !elementOverlapsWall(element, element.x, element.y, currentRoomData, scale))
      ) {
        if (onPlacementBlocked) onPlacementBlocked("rotate", element);
        return;
      }
      setCurrentRoomData({
        ...currentRoomData,
        elements: applyMoves(currentRoomData.elements, roundMoves(moves, scale)),
      });
    }
  };
  const rotateCornerCabinet = (elementId, direction) => {
    updateElement(elementId, { hingeDirection: direction });
  };
  // One id, or several (a refrigerator cabinet together with its fridge)
  const deleteElement = (elementIdOrIds) => {
    const ids = new Set(
      Array.isArray(elementIdOrIds) ? elementIdOrIds : [elementIdOrIds]
    );
    const updatedData = {
      ...currentRoomData,
      elements: currentRoomData.elements.filter((el) => !ids.has(el.id)),
    };

    // Remove material selection for deleted cabinets
    const materials = currentRoomData.materials || {};
    if ([...ids].some((id) => materials[id])) {
      const newMaterials = { ...materials };
      for (const id of ids) delete newMaterials[id];
      updatedData.materials = newMaterials;
    }

    setCurrentRoomData(updatedData);
    setSelectedElement(null);
  };

  return {
    addElement,
    updateElement,
    updateElementDimensions,
    rotateElement,
    rotateCornerCabinet,
    deleteElement,
    checkDoorClearanceCollision,
  };
};