import { useEffect } from 'react';
import { normalizeRoomData, unknownTypeIds } from '../../utils/designer/normalizeDesign';
export const useLocalStorage = ({
  kitchenData,
  bathroomData,
  setKitchenData,
  setBathroomData,
  elementTypes,
  step,
  activeRoom,
  customWalls,
  allAvailableWalls,
}) => {
  // Load saved state on component mount
  useEffect(() => {
    // Older saves: negative rotations, missing fields, walls / pantries in
    // an older shape (utils/designer/normalizeDesign.js). Items of a type
    // this version does not know cannot be drawn or edited here: left out.
    const restore = (key, setData) => {
      let saved = null;
      try {
        saved = localStorage.getItem(key);
      } catch {
        saved = null;
      }
      if (!saved) return;
      const { roomData, issues } = normalizeRoomData(saved, { elementTypes });
      if (!roomData) return;
      const unknown = unknownTypeIds(issues);
      issues
        .filter((i) => i.code === "unknown-type")
        .forEach((i) =>
          console.warn("Removing invalid element type from saved data:", i.type)
        );
      setData({
        ...roomData,
        elements: roomData.elements.filter((el) => !unknown.has(String(el.id))),
      });
    };
    restore("kitchenDesignState", setKitchenData);
    restore("bathroomDesignState", setBathroomData);
  }, []); // Only run on mount

  // Save state whenever data changes (auto-save functionality)
  useEffect(() => {
    if (step === "design") {
      localStorage.setItem("kitchenDesignState", JSON.stringify(kitchenData));
      localStorage.setItem("bathroomDesignState", JSON.stringify(bathroomData));
    }
  }, [kitchenData, bathroomData, step]);

  // Clean up deleted walls from UI whenever room data changes
  useEffect(() => {
    if (step === "design") {
      const currentRoomData = activeRoom === "kitchen" ? kitchenData : bathroomData;
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
        // Only update if there's actually a change to avoid infinite loops
        const updatedData =
          activeRoom === "kitchen"
            ? { ...kitchenData, allAvailableWalls: cleanedAvailableWalls }
            : { ...bathroomData, allAvailableWalls: cleanedAvailableWalls };

        if (activeRoom === "kitchen") {
          setKitchenData(updatedData);
        } else {
          setBathroomData(updatedData);
        }
      }
    }
  }, [
    kitchenData,
    bathroomData,
    kitchenData.customWalls,
    bathroomData.customWalls,
    kitchenData.walls,
    bathroomData.walls,
    customWalls,
    allAvailableWalls,
    activeRoom,
    step,
    setKitchenData,
    setBathroomData,
  ]);
};