import { checkRotatedRectCollision } from '../../utils/designer/collisionUtils';
export const useElementManagement = ({
  currentRoomData,
  setCurrentRoomData,
  elementTypes,
  scale,
  setSelectedElement,
  getDoorClearanceZones,
  onDoorClearanceWarning,
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
  const addElement = (type) => {
    const elementSpec = elementTypes[type];
    if (!elementSpec) {
      console.warn("Cannot add element: Missing elementSpec for type:", type);
      return;
    }

    // Calculate element dimensions in pixels
    const elementWidth = elementSpec.defaultWidth * scale;
    const elementDepth = elementSpec.defaultDepth * scale;

    // Try to place new element in center of room first
    let roomCenter = {
      x:
        (parseFloat(currentRoomData.dimensions.width) * 12 * scale) / 2 -
        elementWidth / 2,
      y:
        (parseFloat(currentRoomData.dimensions.height) * 12 * scale) / 2 -
        elementDepth / 2,
    };

    // Check if center position conflicts with door clearance
    if (
      checkDoorClearanceCollision(
        roomCenter.x,
        roomCenter.y,
        elementWidth,
        elementDepth
      )
    ) {
      // Find alternative position away from door clearances
      const roomWidth =
        parseFloat(currentRoomData.dimensions.width) * 12 * scale;
      const roomHeight =
        parseFloat(currentRoomData.dimensions.height) * 12 * scale;
      let foundPosition = false;

      // Try different positions in a grid pattern
      for (
        let offsetY = 0;
        offsetY < roomHeight - elementDepth && !foundPosition;
        offsetY += 50
      ) {
        for (
          let offsetX = 0;
          offsetX < roomWidth - elementWidth && !foundPosition;
          offsetX += 50
        ) {
          if (
            !checkDoorClearanceCollision(
              offsetX,
              offsetY,
              elementWidth,
              elementDepth
            )
          ) {
            roomCenter = { x: offsetX, y: offsetY };
            foundPosition = true;
          }
        }
      }

      // If no position found, warn user and use center anyway
      if (!foundPosition && onDoorClearanceWarning) {
        onDoorClearanceWarning();
      }
    }

    const newElement = {
      id: Date.now(), // Unique ID based on timestamp
      type: type,
      x: roomCenter.x, // Calculated position
      y: roomCenter.y, // Calculated position
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
  };
  const updateElement = (elementId, updates) => {
    setCurrentRoomData({
      ...currentRoomData,
      elements: currentRoomData.elements.map((el) =>
        el.id === elementId ? { ...el, ...updates } : el
      ),
    });
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
      } else if (element.type === "tall" || element.type === "linen") {
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
      updateElement(elementId, { rotation: (element.rotation + angle) % 360 });
    }
  };
  const rotateCornerCabinet = (elementId, direction) => {
    updateElement(elementId, { hingeDirection: direction });
  };
  const deleteElement = (elementId) => {
    const updatedData = {
      ...currentRoomData,
      elements: currentRoomData.elements.filter((el) => el.id !== elementId),
    };

    // Remove material selection for deleted cabinet
    if (currentRoomData.materials[elementId]) {
      const newMaterials = { ...currentRoomData.materials };
      delete newMaterials[elementId];
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