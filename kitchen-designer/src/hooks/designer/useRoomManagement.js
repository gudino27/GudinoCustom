// Allowed room sizes, shown as hint text and checked on submit (WCAG 3.3.1/3.3.3)
export const DIMENSION_LIMITS = {
  width: { min: 5, max: 50 },
  height: { min: 5, max: 40 },
  wallHeight: { min: 84, max: 144 },
};

export const useRoomManagement = ({
  currentRoomData,
  activeRoom,
  setActiveRoom,
  kitchenData,
  bathroomData,
  setKitchenData,
  setBathroomData,
  setSelectedElement,
  setStep,
  setScale,
  setViewMode,
  step,
}) => {
  // Returns { ok: true } or { ok: false, errors: { field: 'required' | 'range' } }
  // so the form can show and announce what is wrong instead of failing silently.
  const handleDimensionsSubmit = () => {
    const dims = currentRoomData.dimensions;
    const errors = {};

    Object.keys(DIMENSION_LIMITS).forEach((field) => {
      const raw = dims[field];
      const value = parseFloat(raw);
      if (raw === "" || raw === null || raw === undefined || Number.isNaN(value)) {
        errors[field] = "required";
      } else if (
        value < DIMENSION_LIMITS[field].min ||
        value > DIMENSION_LIMITS[field].max
      ) {
        errors[field] = "range";
      }
    });

    if (Object.keys(errors).length > 0) {
      return { ok: false, errors };
    }

    // Calculate optimal canvas scale based on room size
    const widthInches = parseFloat(dims.width) * 12;
    const heightInches = parseFloat(dims.height) * 12;
    const maxCanvasSize = 600;
    const newScale = Math.min(
      maxCanvasSize / widthInches,
      maxCanvasSize / heightInches
    );
    setScale(newScale);
    setStep("design"); // Move to design interface
    return { ok: true };
  };
  const resetDesign = () => {
    if (activeRoom === "kitchen") {
      setKitchenData({
        dimensions: { width: "", height: "", wallHeight: "96" },
        elements: [],
        materials: {},
        colorCount: 1,
      });
    } else {
      setBathroomData({
        dimensions: { width: "", height: "", wallHeight: "96" },
        elements: [],
        materials: {},
        colorCount: 1,
      });
    }
    setSelectedElement(null);
    setStep("dimensions");
    localStorage.removeItem(`${activeRoom}DesignState`);
  };
  const switchRoom = (room) => {
    setActiveRoom(room);
    setSelectedElement(null);
    setViewMode("floor");

    // Get the target room's data
    const roomData = room === "kitchen" ? kitchenData : bathroomData;

    // If the target room has no dimensions set, go back to dimensions step
    if (!roomData.dimensions.width || !roomData.dimensions.height) {
      setStep("dimensions");
    } else {
      // Room has dimensions, update canvas scale and stay in design step
      const widthInches = parseFloat(roomData.dimensions.width) * 12;
      const heightInches = parseFloat(roomData.dimensions.height) * 12;
      const maxCanvasSize = 600;
      const newScale = Math.min(
        maxCanvasSize / widthInches,
        maxCanvasSize / heightInches
      );
      setScale(newScale);
      // Ensure we're on design step if room has dimensions
      if (step !== "design") {
        setStep("design");
      }
    }
  };

  return {
    handleDimensionsSubmit,
    resetDesign,
    switchRoom,
  };
};
