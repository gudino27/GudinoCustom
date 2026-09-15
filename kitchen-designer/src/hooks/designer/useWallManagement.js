import { getWallName, getElementsOnWall, getCustomWallByNumber, getClosestPointOnLine } from '../../utils/designer/wallViewUtils';
export const useWallManagement = ({
  currentRoomData,
  setCurrentRoomData,
  customWalls,
  allAvailableWalls,
  originalWalls,
  wallPricing,
  scale,
  wallRemovalDisabled,
  setSelectedElement,
  isDrawingWall,
  setIsDrawingWall,
  setWallDrawStart,
  setWallDrawPreview,
  isDoorMode,
  setIsDoorMode,
  setShowFloorPlanPresets,
  // Translation helper and the on-screen message callback; both optional so the
  // hook still works untranslated if another screen reuses it.
  t = (key, fallback) => (typeof fallback === "string" ? fallback : key),
  notify,
  getWallLabel = getWallName,
}) => {

  const addWall = (wallNumber) => {
    const currentWalls = currentRoomData.walls || [1, 2, 3, 4];
    const currentRemovedWalls = currentRoomData.removedWalls || [];
    if (!currentWalls.includes(wallNumber)) {
      setCurrentRoomData({
        ...currentRoomData,
        walls: [...currentWalls, wallNumber].sort(),
        removedWalls: currentRemovedWalls.filter((w) => w !== wallNumber),
      });
    }
  };

  const removeWall = (wallNumber) => {
    if (wallRemovalDisabled) {
      // Inline message instead of alert() (WCAG 3.3.1 / 4.1.3)
      if (notify) notify(t("designer.wallRemovalPaused"), "error");
      return;
    }
    const currentWalls = currentRoomData.walls || [1, 2, 3, 4];
    const currentRemovedWalls = currentRoomData.removedWalls || [];
    const isOriginalWall = originalWalls.includes(wallNumber);
    const customWall = getCustomWallByNumber(wallNumber, customWalls);
    const existedPrior = customWall?.existedPrior || false;

    if (currentWalls.includes(wallNumber)) {
      // Calculate room dimensions for getElementsOnWall
      const roomWidth = parseFloat(currentRoomData.dimensions.width) * 12 * scale;
      const roomHeight = parseFloat(currentRoomData.dimensions.height) * 12 * scale;

      // Check if any elements are on this wall before removing
      const elementsOnWall = getElementsOnWall(wallNumber, currentRoomData.elements, roomWidth, roomHeight, scale);

      // Determine if there will be a cost
      const willHaveCost = isOriginalWall || existedPrior;
      const costMessage = willHaveCost
        ? t("designer.wallRemovalCost", { price: wallPricing.removeWall })
        : t("designer.wallRemovalFree");

      let confirmMessage = `${t("designer.confirmRemoveWall", {
        wall: getWallLabel(wallNumber),
      })} ${costMessage}`;
      if (elementsOnWall.length > 0) {
        confirmMessage = `${t("designer.confirmRemoveWallWithItems", {
          wall: getWallLabel(wallNumber),
          count: elementsOnWall.length,
        })} ${costMessage}`;
      }

      if (window.confirm(confirmMessage)) {
        const newElements =
          elementsOnWall.length > 0
            ? currentRoomData.elements.filter((el) => !elementsOnWall.includes(el))
            : currentRoomData.elements;

        setCurrentRoomData({
          ...currentRoomData,
          elements: newElements,
          walls: currentWalls.filter((w) => w !== wallNumber),
          removedWalls: [...currentRemovedWalls, wallNumber],
        });
      }
    }
  };
  const toggleWallDrawingMode = () => {
    setIsDrawingWall(!isDrawingWall);
    if (isDrawingWall) {
      // Exit drawing mode - clear any pending state
      setSelectedElement(null);
      setWallDrawStart(null);
      setWallDrawPreview(null);
    }
  };
  const toggleDoorMode = () => {
    setIsDoorMode(!isDoorMode);
    if (isDoorMode) {
      setSelectedElement(null);
    }
  };
  const snapToWallEndpoints = (x, y, excludeWallId = null) => {
    const snapDistance = 12; // Snap threshold
    let bestSnap = { x, y, snapped: false };
    let minDistance = snapDistance + 1;

    // Check against existing custom walls
    for (const wall of customWalls) {
      if (wall.id === excludeWallId) continue;

      const endpoints = [
        { x: wall.x1, y: wall.y1 },
        { x: wall.x2, y: wall.y2 },
      ];

      for (const endpoint of endpoints) {
        const distance = Math.sqrt(Math.pow(x - endpoint.x, 2) + Math.pow(y - endpoint.y, 2));
        if (distance < minDistance) {
          minDistance = distance;
          bestSnap = { x: endpoint.x, y: endpoint.y, snapped: true, snapType: "wall-endpoint" };
        }
      }
    }

    // Check against room corners
    const roomWidth = parseFloat(currentRoomData.dimensions.width) * 12 * scale;
    const roomHeight = parseFloat(currentRoomData.dimensions.height) * 12 * scale;
    const roomCorners = [
      { x: 0, y: 0, name: "top-left" },
      { x: roomWidth, y: 0, name: "top-right" },
      { x: roomWidth, y: roomHeight, name: "bottom-right" },
      { x: 0, y: roomHeight, name: "bottom-left" },
    ];

    for (const corner of roomCorners) {
      const distance = Math.sqrt(Math.pow(x - corner.x, 2) + Math.pow(y - corner.y, 2));
      if (distance < minDistance) {
        minDistance = distance;
        bestSnap = { x: corner.x, y: corner.y, snapped: true, snapType: "room-corner", corner: corner.name };
      }
    }

    // Check against standard wall edges for perpendicular connections
    const standardWallEdges = [
      { x1: 0, y1: 10, x2: roomWidth, y2: 10, wallNum: 1 }, // Top wall
      { x1: roomWidth, y1: 0, x2: roomWidth, y2: roomHeight, wallNum: 2 }, // Right wall
      { x1: 0, y1: roomHeight, x2: roomWidth, y2: roomHeight, wallNum: 3 }, // Bottom wall
      { x1: 0, y1: 0, x2: 0, y2: roomHeight, wallNum: 4 }, // Left wall
    ];

    for (const edge of standardWallEdges) {
      if (!(currentRoomData.walls || []).includes(edge.wallNum)) continue;

      const closestPoint = getClosestPointOnLine(x, y, edge.x1, edge.y1, edge.x2, edge.y2);
      const distance = Math.sqrt(Math.pow(x - closestPoint.x, 2) + Math.pow(y - closestPoint.y, 2));

      if (distance < minDistance) {
        minDistance = distance;
        bestSnap = { x: closestPoint.x, y: closestPoint.y, snapped: true, snapType: "wall-edge", wallNum: edge.wallNum };
      }
    }

    return bestSnap;
  };
  const addCustomWallAtPosition = (x1, y1, x2, y2) => {
    // Snap endpoints to existing walls for seamless connections
    const snappedStart = snapToWallEndpoints(x1, y1);
    const snappedEnd = snapToWallEndpoints(x2, y2);

    const newWallId = `custom-${Date.now()}`;
    const nextWallNumber = Math.max(...allAvailableWalls) + 1;

    const newCustomWall = {
      id: newWallId,
      x1: snappedStart.x,
      y1: snappedStart.y,
      x2: snappedEnd.x,
      y2: snappedEnd.y,
      thickness: 6, // Default wall thickness in pixels
      isCustom: true,
      existedPrior: false, // Track if this wall existed before modifications
      wallNumber: nextWallNumber,
      doors: [], // Array to store doors on this wall
    };

    // Add to current room walls
    const currentWalls = currentRoomData.walls || [1, 2, 3, 4];
    setCurrentRoomData({
      ...currentRoomData,
      customWalls: [...customWalls, newCustomWall],
      allAvailableWalls: [...allAvailableWalls, nextWallNumber],
      walls: [...currentWalls, nextWallNumber].sort(),
    });

    return nextWallNumber;
  };
  const markWallAsExistedPrior = (wallNumber) => {
    const updatedCustomWalls = customWalls.map((wall) =>
      wall.wallNumber === wallNumber ? { ...wall, existedPrior: true } : wall
    );

    // Add to original walls for pricing calculation
    const updatedOriginalWalls = !originalWalls.includes(wallNumber)
      ? [...originalWalls, wallNumber]
      : originalWalls;

    setCurrentRoomData({
      ...currentRoomData,
      customWalls: updatedCustomWalls,
      originalWalls: updatedOriginalWalls,
    });
  };

  const markWallAsNonExistentPrior = (wallNumber) => {
    // For custom walls, clear existedPrior flag
    const updatedCustomWalls = customWalls.map((wall) =>
      wall.wallNumber === wallNumber ? { ...wall, existedPrior: false } : wall
    );

    // Remove from originalWalls so removing it later will not be charged
    const updatedOriginalWalls = originalWalls.filter((w) => w !== wallNumber);

    setCurrentRoomData({
      ...currentRoomData,
      customWalls: updatedCustomWalls,
      originalWalls: updatedOriginalWalls,
    });
  };
  const addDoor = (wallNumber, position, width = 32, type = "standard") => {
    const doorId = `door-${Date.now()}`;
    const newDoor = {
      id: doorId,
      wallNumber: wallNumber,
      position: position, // Position along the wall (0-100%)
      width: width, // Door width in inches
      type: type, // 'standard', 'pantry', 'room', 'double', 'sliding'
    };

    setCurrentRoomData({
      ...currentRoomData,
      doors: [...(currentRoomData.doors || []), newDoor],
    });

    return doorId;
  };
  const removeDoor = (doorId) => {
    setCurrentRoomData({
      ...currentRoomData,
      doors: (currentRoomData.doors || []).filter((door) => door.id !== doorId),
    });
  };
  const updateDoor = (doorId, updates) => {
    setCurrentRoomData({
      ...currentRoomData,
      doors: (currentRoomData.doors || []).map((door) =>
        door.id === doorId ? { ...door, ...updates } : door
      ),
    });
  };
  const applyFloorPlanPreset = (presetType) => {
    const presets = {
      traditional: {
        walls: [1, 2, 3, 4],
        removedWalls: [],
        description: "Traditional closed kitchen with all 4 walls",
      },
      "open-concept": {
        walls: [1, 2, 4], // Remove south wall (3) for open concept
        removedWalls: [3],
        description: "Open concept - south wall removed",
      },
      "galley-open": {
        walls: [1, 3], // Keep north and south walls only
        removedWalls: [2, 4],
        description: "Galley style - east and west walls removed",
      },
      "island-focused": {
        walls: [1], // Keep only north wall
        removedWalls: [2, 3, 4],
        description: "Island-focused - only north wall remains",
      },
      peninsula: {
        walls: [1, 2, 3], // Remove west wall for peninsula
        removedWalls: [4],
        description: "Peninsula layout - west wall removed",
      },
    };

    const preset = presets[presetType];
    if (preset) {
      // Update originalWalls to match the preset - walls removed by preset
      // are treated as "never existed" so user isn't charged for their removal
      // Only walls that exist in the preset are considered "original"
      setCurrentRoomData({
        ...currentRoomData,
        walls: preset.walls,
        removedWalls: [], // No removed walls since preset defines the starting layout
        originalWalls: preset.walls, // Only preset walls are "original" - removing them later will cost
        elements: [], // Clear existing elements when changing floor plan
      });
      setShowFloorPlanPresets(false);
    }
  };
  const cleanupDeletedWalls = () => {
    const currentWalls = currentRoomData.walls || [];
    const existingCustomWallNumbers = customWalls.map(
      (wall) => wall.wallNumber
    );
    const existingWallNumbers = [
      ...new Set([...currentWalls, ...existingCustomWallNumbers]),
    ];
    // Keep original walls (1-4) plus any existing custom walls
    const cleanedAvailableWalls = allAvailableWalls.filter(
      (wallNum) => wallNum <= 4 || existingWallNumbers.includes(wallNum)
    );
    if (cleanedAvailableWalls.length !== allAvailableWalls.length) {
      setCurrentRoomData({
        ...currentRoomData,
        allAvailableWalls: cleanedAvailableWalls,
      });
    }
  };
  const rotateCustomWall = (wallNumber, newAngleDegrees) => {
    const updatedCustomWalls = customWalls.map((wall) => {
      if (wall.wallNumber === wallNumber) {
        const centerX = (wall.x1 + wall.x2) / 2;
        const centerY = (wall.y1 + wall.y2) / 2;
        const length = Math.sqrt(
          Math.pow(wall.x2 - wall.x1, 2) + Math.pow(wall.y2 - wall.y1, 2)
        );
        const angleRad = (newAngleDegrees * Math.PI) / 180;
        const halfLength = length / 2;
        return {
          ...wall,
          x1: centerX - halfLength * Math.cos(angleRad),
          y1: centerY - halfLength * Math.sin(angleRad),
          x2: centerX + halfLength * Math.cos(angleRad),
          y2: centerY + halfLength * Math.sin(angleRad),
          angle: newAngleDegrees, // Store the angle for display
        };
      }
      return wall;
    });
    setCurrentRoomData({
      ...currentRoomData,
      customWalls: updatedCustomWalls,
    });
  };
  const resizeCustomWall = (wallNumber, newLengthInches) => {
    const updatedCustomWalls = customWalls.map((wall) => {
      if (wall.wallNumber === wallNumber) {
        const centerX = (wall.x1 + wall.x2) / 2;
        const centerY = (wall.y1 + wall.y2) / 2;
        const angle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);

        // Convert new length from inches to pixels (scale is pixels per inch)
        const lengthPixels = newLengthInches * scale;
        const halfLength = lengthPixels / 2;

        return {
          ...wall,
          x1: centerX - halfLength * Math.cos(angle),
          y1: centerY - halfLength * Math.sin(angle),
          x2: centerX + halfLength * Math.cos(angle),
          y2: centerY + halfLength * Math.sin(angle),
        };
      }
      return wall;
    });
    setCurrentRoomData({
      ...currentRoomData,
      customWalls: updatedCustomWalls,
    });
  };
  const getCurrentWallAngle = (wallNumber) => {
    const wall = getCustomWallByNumber(wallNumber, customWalls);
    if (wall) {
      return (
        wall.angle ||
        (Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1) * 180) / Math.PI
      );
    }
    return 0;
  };

  return {
    addWall,
    removeWall,
    toggleWallDrawingMode,
    toggleDoorMode,
    snapToWallEndpoints,
    addCustomWallAtPosition,
    markWallAsExistedPrior,
    addDoor,
    removeDoor,
    updateDoor,
    applyFloorPlanPreset,
    cleanupDeletedWalls,
    rotateCustomWall,
    resizeCustomWall,
    getCurrentWallAngle,
    markWallAsNonExistentPrior,
  };
};