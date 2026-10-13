import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Menu, // Hamburger menu icon
  X, // Close icon
  Plus, // Zoom in icon
  Minus, // Zoom out icon
  Camera, // AR view icon
} from "lucide-react";
import ARViewer from "../design/ARViewer";
import MainNavBar from "../ui/Navigation";
import SEO from "../ui/SEO";
import { announce } from "../ui/LiveRegion";
import { useLanguage } from "../../contexts/LanguageContext";
import { getElementName } from "../design/elementName";
import "../css/designer.css";
import WallView from "../design/WallView";
import DraggableCabinet, { HousingBadge } from "../design/DraggableCabinet";
import HousingDeleteDialog from "../design/HousingDeleteDialog";
import PantryDeleteDialog from "../design/PantryDeleteDialog";
import PantryPanel from "../design/PantryPanel";
import PantrySection from "../design/PantrySection";
import PantryPlan from "../design/plan/PantryPlan";
import {
  addPantry,
  itemsAgainstPantry,
  movePantry,
  pantryDragStep,
  pantryWallInfo,
  partitionSides,
  removePantry,
  resizePantry,
  setPantryExistedPrior,
  setPantryOpening,
  sideSegment,
  startPantryDrag as startPantryPlanDrag,
  syncPantries,
} from "../../utils/designer/pantry";
import {
  elementOverlapsWall,
  elementsOnWallFace,
  parseWallKey,
  snapToWallFace,
  wallFaceKey,
  wallThicknessPx,
} from "../../utils/designer/wallFaces";
import { housingProblemText } from "../design/housingMessage";
import { housedElements } from "../../utils/designer/housing";
import DesignerSidebar from "../design/DesignerSidebar";
// Drag from the item palette onto the plan (preview + drop)
import { usePlanDrop } from "../design/palette/usePlanDrop";
import PlanDropPreview from "../design/palette/PlanDropPreview";
import Designer3D from "../design/Designer3D";
import {
  checkWallCollision,
  pushAwayFromWall,
  checkRotatedRectCollision,
  applyMoves,
  housingAround,
  moveWithHoused,
  movesOverlap,
  snapIntoHousing,
} from "../../utils/designer/collisionUtils";
import {
  checkWallCollision as wallHelpersCollision,
  pushAwayFromWall as wallHelpersPush,
} from "../../utils/wallHelpers";
import QuoteForm from "../forms/QuoteForm";
import PricingDisplay from "../design/PricingDisplay";
import ElementList from "../design/ElementList";
import { elementTypes } from "../../constants/elementTypes";
import { generatePDF, sendQuote } from "../../services/pdfService";
import { usePricing } from "../../contexts/PricingContext";
import { useAnalytics } from "../../hooks/useAnalytics";
import {
  useIsMobile,
  useIsTablet,
  useIsTouchDevice,
} from "../../hooks/useResponsive";
import FloatingPropertiesPanel from "../design/FloatingPropertiesPanel";
import DimensionsSetup from "../design/DimensionsSetup";
import { getEventCoordinates } from "../../utils/designer/coordinateUtils";
import { snapToCabinet, snapToWall } from "../../utils/designer/snappingUtils";
import {
  getDoorTypes,
  getElementsOnWall,
  getCustomWallByNumber,
  getDoorsOnWall,
  getClosestPointOnLine,
} from "../../utils/designer/wallViewUtils";
import {
  renderCornerCabinet as renderCornerCabinetHelper,
  renderDoorGraphic as renderDoorGraphicHelper,
  renderWallWithDoors as renderWallWithDoorsHelper,
  doorSymbol,
} from "../design/RenderingHelpers";
import {
  PLAN,
  formatFeetInches,
  formatInches,
  labelWidth,
} from "../design/plan/planStyle";
import {
  formatInchesPlain,
  pxToInches,
  roundInches,
  roundMoves,
} from "../../utils/designer/planUnits";
// Custom designer hooks
import { useDesignerRefs } from "../../hooks/designer/useDesignerRefs";
import { useCrossTabSync } from "../../hooks/designer/useCrossTabSync";
import { useDesignerState } from "../../hooks/designer/useDesignerState";
import { useLocalStorage } from "../../hooks/designer/useLocalStorage";
import { usePricing as useDesignerPricing } from "../../hooks/designer/usePricing";
import { useRoomManagement } from "../../hooks/designer/useRoomManagement";
import { useElementManagement } from "../../hooks/designer/useElementManagement";
import { useWallManagement as useWallMgmt } from "../../hooks/designer/useWallManagement";
import { useZoomControls } from "../../hooks/designer/useZoomControls";
import { isQuarterTurned, planTransform } from "../../utils/designer/rotation";

const KitchenDesigner = () => {
  const { dragCacheRef, canvasRef, floorPlanRef, wallViewRef, cameraRef } =
    useDesignerRefs();
  const { t, currentLanguage } = useLanguage();

  // Analytics tracking
  useAnalytics("/designer");
  // Shared pricing context
  const {
    materialMultipliers: sharedMaterialMultipliers,
    setMaterialMultipliers: setSharedMaterialMultipliers,
    basePrices: sharedBasePrices,
    setBasePrices: setSharedBasePrices,
    pricingVersion,
  } = usePricing();

  // -----------------------------
  // Device Detection and Responsive Design
  // Detect screen size and touch capabilities for mobile/tablet/desktop layouts
  // -----------------------------
  const isMobile = useIsMobile(); // < 768px
  const isTablet = useIsTablet(); // 768px - 1024px
  const isTouch = useIsTouchDevice(); // Touch input support
  // -----------------------------
  // Business Configuration
  // In production, these would come from environment variables or database
  // -----------------------------
  const COMPANY_NAME = "Gudino Custom woodworking";
  // -----------------------------
  // Application State Management
  // Controls the current step and active room being designed
  // -----------------------------
  const [step, setStep] = useState("dimensions"); // 'dimensions' or 'design'
  const [activeRoom, setActiveRoom] = useState("kitchen"); // Currently designing room
  // -----------------------------
  // Room Data State
  // Separate state objects for kitchen and bathroom designs
  // Each room maintains its own dimensions, elements, materials, and color choices
  // -----------------------------
  const [kitchenData, setKitchenData] = useState({
    dimensions: { width: "", height: "", wallHeight: "96" },
    elements: [], // Array of placed cabinets/appliances
    materials: {}, // Material choices per cabinet (by element ID)
    colorCount: 1, // Number of cabinet colors (affects pricing)
    walls: [1, 2, 3, 4], // Available walls (1=North, 2=East, 3=South, 4=West)
    removedWalls: [], // Track removed walls for pricing
    customWalls: [], // Custom drawn walls with coordinates
    allAvailableWalls: [1, 2, 3, 4], // All walls that can be managed (including custom)
    originalWalls: [1, 2, 3, 4], // Track original walls for pricing
    doors: [], // Array to store doors: {id, wallNumber, position, width, type}
  });
  const [bathroomData, setBathroomData] = useState({
    dimensions: { width: "", height: "", wallHeight: "96" },
    elements: [],
    materials: {},
    colorCount: 1,
    walls: [1, 2, 3, 4], // Available walls (1=North, 2=East, 3=South, 4=West)
    removedWalls: [], // Track removed walls for pricing
    customWalls: [], // Custom drawn walls with coordinates
    allAvailableWalls: [1, 2, 3, 4], // All walls that can be managed (including custom)
    originalWalls: [1, 2, 3, 4], // Track original walls for pricing
    doors: [], // Array to store doors: {id, wallNumber, position, width, type}
  });
  // -----------------------------
  // UI and Interaction State
  // Controls user interface elements and interactions
  // MUST BE DECLARED BEFORE CUSTOM HOOKS THAT USE THEM
  // -----------------------------
  const [selectedElement, setSelectedElement] = useState(null); // Currently selected cabinet/appliance
  const [isPanelOpen, setIsPanelOpen] = useState(false); // Track if properties panel is open on mobile
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // Mouse offset for dragging
  const [isDragging, setIsDragging] = useState(false); // Floor plan dragging state
  const [isDraggingWallView, setIsDraggingWallView] = useState(false); // Wall view dragging state
  const [dragPreviewPosition, setDragPreviewPosition] = useState(null); // Preview position during drag
  // Plan px per inch. Positions are stored in plan px at this scale, and the
  // 3D views, the AR export and the admin viewer read them back at
  // fitScale(dimensions): it only changes with the room size (and then the
  // stored positions are rescaled, useRoomManagement). Pinch / button zoom
  // is `zoom` below, a view-only factor on the SVG.
  const [scale, setScale] = useState(1);
  const [zoom, setZoom] = useState(1); // floor plan view zoom (mobile)
  const [viewMode, setViewMode] = useState("floor"); // 'floor' or 'wall' view
  // Pinch-to-zoom state (mobile only)
  const [pinchState, setPinchState] = useState({
    initialDistance: null,
    initialScale: 1,
  });
  const [lastTap, setLastTap] = useState(0); // For double-tap detection
  // Long press drag state (mobile only)
  const [longPressTimer, setLongPressTimer] = useState(null); // Long press detection timer
  const [isLongPressing, setIsLongPressing] = useState(false); // Long press active state
  const [selectedWall, setSelectedWall] = useState(1); // Wall number for wall view (1-4)
  const [showPricing, setShowPricing] = useState(false); // Show/hide pricing panel
  const [showQuoteForm, setShowQuoteForm] = useState(false); // Show/hide quote form modal
  const [showARViewer, setShowARViewer] = useState(false); // Show/hide AR viewer modal
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Sidebar collapse state
  const [showFloorPlanPresets, setShowFloorPlanPresets] = useState(false); // Show/hide floor plan preset options
  const [isDrawingWall, setIsDrawingWall] = useState(false); // Wall drawing mode
  const [wallDrawStart, setWallDrawStart] = useState(null); // Start point for wall drawing
  const [wallDrawPreview, setWallDrawPreview] = useState(null); // Preview line while drawing
  const [selectedWallForEdit, setSelectedWallForEdit] = useState(null); // Wall selected for editing
  const [wallEditMode, setWallEditMode] = useState(null); // 'length' or 'angle' editing mode
  const [showWallPreview, setShowWallPreview] = useState(false); // Toggle to show walls vs no walls
  const [wallRemovalDisabled, setWallRemovalDisabled] = useState(false); // Admin toggle to disable wall removals
  const [isRotatingWall, setIsRotatingWall] = useState(null); // Wall being rotated
  const [isDoorMode, setIsDoorMode] = useState(false); // Door placement mode
  const [doorModeType, setDoorModeType] = useState("standard"); // Type of door being placed
  // Collapsible section states
  const [collapsedSections, setCollapsedSections] = useState({
    wallManagement: false,
    cabinetOptions: false,
    appliances: false,
    properties: false,
  });
  const [rotationStart, setRotationStart] = useState(null); // Start point for wall rotation
  // Inline status / error message shown instead of alert() (WCAG 3.3.1, 4.1.3)
  const [notice, setNotice] = useState(null); // { text, tone: 'info' | 'error' }
  const [panelFocusRequest, setPanelFocusRequest] = useState(false); // keyboard opened the panel
  const panelReturnFocusRef = useRef(null); // element to focus when the panel closes
  // A refrigerator cabinet with a fridge in it waiting on "remove what?":
  // { housing, inside, returnFocus }
  const [housingDelete, setHousingDelete] = useState(null);
  // Pantry (utils/designer/pantry.js): the one selected (its panel is open),
  // "remove it and the items against it?", and the drag in progress
  const [selectedPantry, setSelectedPantry] = useState(null);
  const [pantryPanelFocus, setPantryPanelFocus] = useState(false);
  const [pantryDelete, setPantryDelete] = useState(null); // { pantryId, items, returnFocus }
  const pantryDragRef = useRef(null);
  // The room data of the last render: a pantry drag checks it is still
  // working on its own results (see handleMouseMove)
  const latestRoomDataRef = useRef(null);
  const pantryReturnFocusRef = useRef(null);
  const pantryClickGuardRef = useRef(false);
  const layoutHeadingRef = useRef(null);
  // Step 1 -> step 2 keeps the same URL, so move focus to the new heading
  // instead of leaving it on a button that no longer exists (WCAG 2.4.3)
  useEffect(() => {
    if (step === "design" && layoutHeadingRef.current) {
      layoutHeadingRef.current.focus();
    }
  }, [step]);
  // -----------------------------
  // Client Information for Quote Generation
  // Stores customer contact details and preferences
  // -----------------------------
  const [clientInfo, setClientInfo] = useState({
    name: "",
    contactPreference: "email", // 'email', 'phone', or 'text'
    email: "",
    phone: "",
    comments: "", // Special requests/notes
    includeKitchen: true, // Include kitchen in quote
    includeBathroom: false, // Include bathroom in quote
  });

  // -----------------------------
  // Derived State and Helper Variables
  // These provide easy access to the currently active room's data
  // MUST BE DEFINED BEFORE CUSTOM HOOKS THAT USE THEM
  // -----------------------------
  const currentRoomData = activeRoom === "kitchen" ? kitchenData : bathroomData;
  latestRoomDataRef.current = currentRoomData;
  const setCurrentRoomData =
    activeRoom === "kitchen" ? setKitchenData : setBathroomData;
  // Helper accessors for wall data from current room
  const customWalls = currentRoomData.customWalls || [];
  const allAvailableWalls = currentRoomData.allAvailableWalls || [1, 2, 3, 4];
  const originalWalls = currentRoomData.originalWalls || [1, 2, 3, 4];

  // Show a message on screen and read it out through the shared live region
  const notify = (text, tone = "info") => {
    setNotice({ text, tone });
    announce(text);
  };

  // Translated wall names (the util in utils/designer is English only).
  // A drawn or pantry wall's face is "7:left": "Pantry wall A — pantry side".
  const getWallLabel = (wallKey) => {
    const { wallNumber: wallNum, face } = parseWallKey(wallKey);
    const names = {
      1: t("designer.wall.north"),
      2: t("designer.wall.east"),
      3: t("designer.wall.south"),
      4: t("designer.wall.west"),
    };
    if (names[wallNum]) return names[wallNum];
    const info = pantryWallInfo(currentRoomData, wallNum);
    const name = info
      ? info.number
        ? t("designer.pantry.wallNameN", { n: info.number, letter: info.letter })
        : t("designer.pantry.wallName", { letter: info.letter })
      : t("designer.wall.custom", { n: wallNum });
    if (!face) return name;
    const wall = customWalls.find((w) => w.wallNumber === wallNum);
    const side = wall && wall.pantryId
      ? face === wall.pantryInside
        ? t("designer.pantry.pantrySide")
        : t("designer.pantry.kitchenSide")
      : face === "right"
      ? t("designer.wall.sideA")
      : t("designer.wall.sideB");
    return t("designer.wall.faceLabel", { wall: name, side });
  };

  // -----------------------------
  // Custom Hooks (after all state is declared)
  // -----------------------------
  const {
    basePrices,
    materialMultipliers,
    colorPricing,
    wallPricing,
    wallAvailability,
    pricesLoading,
    loadPrices,
    calculateTotalPrice,
    setBasePrices,
    setMaterialMultipliers,
    setColorPricing,
    setWallPricing,
    setWallAvailability,
  } = useDesignerPricing({
    sharedMaterialMultipliers,
    setSharedMaterialMultipliers,
    currentRoomData,
  });

  useLocalStorage({
    kitchenData,
    bathroomData,
    setKitchenData,
    setBathroomData,
    elementTypes,
    step,
    activeRoom,
    customWalls,
    allAvailableWalls,
  });
  // Another tab on /design saved: take its version (hooks/designer/useCrossTabSync.js)
  useCrossTabSync({ setKitchenData, setBathroomData });

  const { handleDimensionsSubmit, resetDesign, switchRoom } = useRoomManagement(
    {
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
    }
  );

  // -----------------------------
  // Regular Functions (before useEffect)
  // -----------------------------

  // Toggle collapsible sections
  const toggleSection = (sectionName) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  // Calculate extended door clearance zones for ADA compliance
  const getDoorClearanceZones = () => {
    const CLEARANCE_DEPTH_MULTIPLIER = 1.5;
    const CLEARANCE_WIDTH_MULTIPLIER = 1.0;
    const POSITION_OFFSET_X = -33;
    const POSITION_OFFSET_Y = 0;
    const clearanceZones = [];
    const doors = currentRoomData.doors || [];
    const roomWidth = parseFloat(currentRoomData.dimensions.width) * 12 * scale;
    const roomHeight =
      parseFloat(currentRoomData.dimensions.height) * 12 * scale;

    doors.forEach((door) => {
      // a cased opening (a pantry's doorway) has no leaf to swing
      if (door.type === "cased-opening") return;
      const doorWidthPixels = door.width * scale;
      const clearanceDepth = doorWidthPixels * CLEARANCE_DEPTH_MULTIPLIER;
      const clearanceWidth = doorWidthPixels * CLEARANCE_WIDTH_MULTIPLIER;
      let clearanceZone = null;

      if (door.wallNumber <= 4) {
        let wallParams;
        switch (door.wallNumber) {
          case 1:
            wallParams = {
              x: 20,
              y: 20,
              width: roomWidth + 20,
              height: 10,
              isHorizontal: true,
            };
            break;
          case 2:
            wallParams = {
              x: 30 + roomWidth,
              y: 20,
              width: 10,
              height: roomHeight + 20,
              isHorizontal: false,
            };
            break;
          case 3:
            wallParams = {
              x: 20,
              y: 30 + roomHeight,
              width: roomWidth + 20,
              height: 10,
              isHorizontal: true,
            };
            break;
          case 4:
            wallParams = {
              x: 20,
              y: 20,
              width: 10,
              height: roomHeight + 20,
              isHorizontal: false,
            };
            break;
        }
        const doorCenterX = wallParams.isHorizontal
          ? wallParams.x + (door.position / 100) * wallParams.width
          : wallParams.x + wallParams.width / 2;
        const doorCenterY = wallParams.isHorizontal
          ? wallParams.y + wallParams.height / 2
          : wallParams.y + (door.position / 100) * wallParams.height;

        if (wallParams.isHorizontal) {
          clearanceZone = {
            x: doorCenterX - clearanceWidth / 2 + POSITION_OFFSET_X,
            y:
              door.wallNumber === 1
                ? wallParams.y + wallParams.height + POSITION_OFFSET_Y
                : wallParams.y - clearanceDepth + POSITION_OFFSET_Y,
            width: clearanceWidth,
            height: clearanceDepth,
            doorId: door.id,
          };
        } else {
          clearanceZone = {
            x:
              door.wallNumber === 4
                ? wallParams.x + wallParams.width + POSITION_OFFSET_X
                : wallParams.x - clearanceDepth + POSITION_OFFSET_X,
            y: doorCenterY - clearanceWidth / 2 + POSITION_OFFSET_Y,
            width: clearanceDepth,
            height: clearanceWidth,
            doorId: door.id,
          };
        }
      } else {
        const customWall = getCustomWallByNumber(door.wallNumber, customWalls);
        if (customWall) {
          const wallLength = Math.sqrt(
            Math.pow(customWall.x2 - customWall.x1, 2) +
              Math.pow(customWall.y2 - customWall.y1, 2)
          );
          const wallAngle = Math.atan2(
            customWall.y2 - customWall.y1,
            customWall.x2 - customWall.x1
          );
          const doorPosAlongWall = (door.position / 100) * wallLength;
          const doorCenterX =
            30 + customWall.x1 + Math.cos(wallAngle) * doorPosAlongWall;
          const doorCenterY =
            30 + customWall.y1 + Math.sin(wallAngle) * doorPosAlongWall;
          const perpAngle = wallAngle + Math.PI / 2;
          const clearanceCenterX =
            doorCenterX + Math.cos(perpAngle) * (clearanceDepth / 2);
          const clearanceCenterY =
            doorCenterY + Math.sin(perpAngle) * (clearanceDepth / 2);
          clearanceZone = {
            x: clearanceCenterX - clearanceWidth / 2 + POSITION_OFFSET_X,
            y: clearanceCenterY - clearanceDepth / 2 + POSITION_OFFSET_Y,
            width: clearanceWidth,
            height: clearanceDepth,
            doorId: door.id,
            rotation: (wallAngle * 180) / Math.PI + 90,
            centerX: clearanceCenterX + POSITION_OFFSET_X,
            centerY: clearanceCenterY + POSITION_OFFSET_Y,
          };
        }
      }
      if (clearanceZone) clearanceZones.push(clearanceZone);
    });
    return clearanceZones;
  };

  // Element management hook (depends on getDoorClearanceZones)
  const {
    addElement,
    updateElement,
    updateElementDimensions,
    rotateElement,
    rotateCornerCabinet,
    deleteElement,
    checkDoorClearanceCollision,
  } = useElementManagement({
    currentRoomData,
    setCurrentRoomData,
    elementTypes,
    scale,
    setSelectedElement,
    getDoorClearanceZones,
    onDoorClearanceWarning: () =>
      notify(t("designer.notice.doorClearance"), "error"),
    onPlacementBlocked: (reason, element, detail) =>
      notify(
        reason === "housing"
          ? housingProblemText(t, detail, elementTypes)
          : t(
              reason === "rotate"
                ? "designer.notice.noRoomToRotate"
                : "designer.notice.noFreeSpace",
              { name: getElementName(t, element.type, elementTypes) }
            ),
        "error"
      ),
  });

  // ----- Palette drop target (items dragged from the sidebar) -----
  // Separate from the drag of placed items below: it only listens for drags
  // that start in the palette and adds through addElement(type, target).
  const { preview: planDropPreview, containerProps: planDropProps } =
    usePlanDrop({
      canvasRef,
      containerRef: floorPlanRef,
      currentRoomData,
      customWalls,
      elementTypes,
      scale,
      checkDoorClearanceCollision,
      addElement,
      t,
    });
  // ----- end palette drop target -----

  // Wall management hook
  const {
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
  } = useWallMgmt({
    t,
    notify,
    getWallLabel: (wallNum) => getWallLabel(wallNum),
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
  });

  // Zoom and touch gesture controls hook
  const {
    getTouchDistance,
    handleTouchStart,
    handleTouchMoveZoom,
    handleTouchEnd,
    handleDoubleTap,
    handleZoomIn,
    handleZoomOut,
  } = useZoomControls({
    // zoom, not `scale`: zooming used to change the scale positions are
    // stored at, so every pinch moved and shrank the saved design
    scale: zoom,
    setScale: setZoom,
    isDragging,
    setIsDragging,
    dragCacheRef,
    isMobile,
    pinchState,
    setPinchState,
    lastTap,
    setLastTap,
  });

  // -----------------------------
  // Effects (after all hooks and functions)
  // -----------------------------

  // Close properties panel when element changes or is deselected
  useEffect(() => {
    if (!selectedElement) {
      setIsPanelOpen(false);
    }
  }, [selectedElement]);

  // An item and a pantry are never selected together
  useEffect(() => {
    if (selectedElement) setSelectedPantry(null);
  }, [selectedElement]);

  // A pantry side on a room wall needs no partition; when a room wall is
  // removed or put back (or the room resized), rebuild the pantry's walls
  const pantrySyncKey = JSON.stringify([
    activeRoom,
    (currentRoomData.walls || []).filter((n) => n <= 4),
    currentRoomData.dimensions?.width,
    currentRoomData.dimensions?.height,
    (currentRoomData.pantries || []).length,
  ]);
  useEffect(() => {
    if (step !== "design" || !(currentRoomData.pantries || []).length) return;
    const next = syncPantries(currentRoomData, scale);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    if (
      !same(next.customWalls, currentRoomData.customWalls) ||
      !same(next.doors, currentRoomData.doors) ||
      !same(next.walls, currentRoomData.walls)
    ) {
      setCurrentRoomData(next);
    }
  }, [pantrySyncKey, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // The wall view's wall (or wall face) is gone: back to wall 1
  useEffect(() => {
    const { wallNumber } = parseWallKey(selectedWall);
    const walls = currentRoomData.customWalls || [];
    if (wallNumber > 4 && !walls.some((w) => w.wallNumber === wallNumber)) {
      setSelectedWall(1);
    }
  }, [selectedWall, currentRoomData.customWalls]);

  // Render wall with doors as openings
  const renderWallWithDoors = (wallNumber, wallRect) => {
    return renderWallWithDoorsHelper(
      wallNumber,
      wallRect,
      currentRoomData,
      customWalls,
      scale
    );
  };
  // Clean up allAvailableWalls to remove walls that no longer exist
  // Show loading screen while prices are being fetched
  if (pricesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center" role="status">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-4 text-gray-700">{t("designer.loading")}</p>
        </div>
      </div>
    );
  }
  // -----------------------------
  // Touch and Mouse Event Handlers
  // Handle dragging and interaction with elements on the canvas for both touch and mouse
  // -----------------------------
  // Get coordinates from either touch or mouse event
  // IMPORTANT: Extract immediately to avoid React event pooling issues

  // Start dragging an element in floor plan view (supports both touch and mouse with long press)
  const handleMouseDown = (e, elementId) => {
    e.preventDefault();
    const element = currentRoomData.elements.find((el) => el.id === elementId);
    if (element) {
      // Get coordinates from touch or mouse event
      const coords = getEventCoordinates(e);
      const isTouchEvent = e.type.startsWith("touch");

      // Convert coordinates to SVG coordinates
      const rect = canvasRef.current.getBoundingClientRect();
      const svgPt = canvasRef.current.createSVGPoint();
      svgPt.x = coords.clientX;
      svgPt.y = coords.clientY;
      const cursorPt = svgPt.matrixTransform(
        canvasRef.current.getScreenCTM().inverse()
      );

      // Store initial position for drag threshold and long press detection
      dragCacheRef.current.startPosition = {
        x: coords.clientX,
        y: coords.clientY,
      };
      dragCacheRef.current.hasMoved = false;

      // Calculate offset from element position to cursor
      setDragOffset({
        x: cursorPt.x - element.x - 30, // Account for canvas offset
        y: cursorPt.y - element.y - 30,
      });

      // Store potential selection for later
      dragCacheRef.current.potentialSelection = elementId;

      // MOBILE & DESKTOP: Select immediately and use threshold-based drag
      // This makes mobile work exactly like desktop - simpler and more reliable
      setSelectedElement(elementId);
      dragCacheRef.current.pendingDrag = true;
    }
  };
  // Start dragging wall-mounted element in wall view (supports both touch and mouse)
  const handleWallViewMouseDown = (e, elementId) => {
    e.preventDefault();
    const element = currentRoomData.elements.find((el) => el.id === elementId);
    // Allow height adjustment for all wall-mounted elements
    const elementSpec = elementTypes[element?.type];
    const isWallMounted = elementSpec && elementSpec.mountHeight !== undefined;
    if (element && isWallMounted) {
      setIsDraggingWallView(true);
      setSelectedElement(elementId);
      // Get coordinates from touch or mouse event
      const coords = getEventCoordinates(e);
      const rect = e.currentTarget.getBoundingClientRect();
      setDragOffset({
        x: coords.clientX,
        y: coords.clientY - rect.top,
        startMount: element.mountHeight, // Remember starting mount height
      });
    }
  };
  // Handle touch/mouse movement during dragging with hybrid DOM manipulation for zero-lag response
  const handleMouseMove = (e) => {
    // Handle wall drawing preview - show live preview as mouse moves
    if (isDrawingWall && wallDrawStart && canvasRef.current) {
      const coords = getEventCoordinates(e);
      const svgPt = canvasRef.current.createSVGPoint();
      svgPt.x = coords.clientX;
      svgPt.y = coords.clientY;
      const cursorPt = svgPt.matrixTransform(
        canvasRef.current.getScreenCTM().inverse()
      );
      setWallDrawPreview({
        x1: wallDrawStart.x,
        y1: wallDrawStart.y,
        x2: cursorPt.x - 30, // Account for canvas offset
        y2: cursorPt.y - 30,
      });
      return;
    }
    // Moving a pantry (its tag or a wall) or dragging one of its walls in or out
    if (pantryDragRef.current && canvasRef.current) {
      const drag = pantryDragRef.current;
      if (!drag.moved) {
        const coords = getEventCoordinates(e);
        if (
          Math.hypot(coords.clientX - drag.client.x, coords.clientY - drag.client.y) < 5
        ) {
          return;
        }
        drag.moved = true;
      }
      // Every step starts from the room as the drag found it; if the room
      // changed some other way since, carrying on would put the old one
      // back and lose that change: the drag ends (utils/designer/pantry.js)
      const { stale, roomData: next } = pantryDragStep(
        drag,
        latestRoomDataRef.current,
        planPoint(e),
        scale
      );
      if (stale) {
        pantryDragRef.current = null;
        return;
      }
      if (next) {
        drag.last = next;
        drag.blocked = false;
        setCurrentRoomData(next);
      } else {
        drag.blocked = true;
      }
      return;
    }
    // Check if we should start dragging based on movement threshold (both desktop and mobile)
    if (dragCacheRef.current.pendingDrag && !isDragging && selectedElement) {
      const coords = getEventCoordinates(e);
      const deltaX = Math.abs(
        coords.clientX - dragCacheRef.current.startPosition.x
      );
      const deltaY = Math.abs(
        coords.clientY - dragCacheRef.current.startPosition.y
      );
      const dragThreshold = 10; // pixels (increased from 5 for better reliability)

      if (deltaX > dragThreshold || deltaY > dragThreshold) {
        // Start dragging - user moved enough
        setIsDragging(true);
        dragCacheRef.current.pendingDrag = false;
        dragCacheRef.current.hasMoved = true;
      }
    }
    if (isDragging && selectedElement) {
      const element = currentRoomData.elements.find(
        (el) => el.id === selectedElement
      );
      if (element && canvasRef.current) {
        // Get transformation matrix immediately - no delay for zero-lag response
        const svgMatrix = canvasRef.current.getScreenCTM().inverse();

        // Get coordinates from touch or mouse event
        const coords = getEventCoordinates(e);
        const svgPt = canvasRef.current.createSVGPoint();
        svgPt.x = coords.clientX;
        svgPt.y = coords.clientY;
        const cursorPt = svgPt.matrixTransform(svgMatrix);
        // Calculate new position directly
        const newX = cursorPt.x - dragOffset.x - 30;
        const newY = cursorPt.y - dragOffset.y - 30;
        // Calculate element dimensions based on rotation (fix for 90-degree rotations)
        const elementWidth = !isQuarterTurned(element.rotation) ? element.width * scale : element.depth * scale;
        const elementDepth = !isQuarterTurned(element.rotation) ? element.depth * scale : element.width * scale;
        // Keep element within room bounds
        const roomWidth =
          parseFloat(currentRoomData.dimensions.width) * 12 * scale;
        const roomHeight =
          parseFloat(currentRoomData.dimensions.height) * 12 * scale;
        let boundedX = Math.max(0, Math.min(newX, roomWidth - elementWidth));
        let boundedY = Math.max(0, Math.min(newY, roomHeight - elementDepth));
        // Convert standard room walls to customWalls format for collision detection
        const standardWallsForCollision = [];

        if ((currentRoomData.walls || []).includes(1)) {
          standardWallsForCollision.push({
            wallNumber: 1,
            x1: 0,
            y1: 0,
            x2: roomWidth,
            y2: 0,
            thickness: 10,
          });
        }
        if ((currentRoomData.walls || []).includes(2)) {
          standardWallsForCollision.push({
            wallNumber: 2,
            x1: roomWidth,
            y1: 0,
            x2: roomWidth,
            y2: roomHeight,
            thickness: 10,
          });
        }
        if ((currentRoomData.walls || []).includes(3)) {
          standardWallsForCollision.push({
            wallNumber: 3,
            x1: 0,
            y1: roomHeight,
            x2: roomWidth,
            y2: roomHeight,
            thickness: 10,
          });
        }
        if ((currentRoomData.walls || []).includes(4)) {
          standardWallsForCollision.push({
            wallNumber: 4,
            x1: 0,
            y1: 0,
            x2: 0,
            y2: roomHeight,
            thickness: 10,
          });
        }

        // A refrigerator dragged over an empty refrigerator cabinet drops
        // into its opening (centred, flush with the back, facing the same way)
        const housedSnap = snapIntoHousing(
          element,
          boundedX,
          boundedY,
          currentRoomData.elements,
          elementTypes,
          scale
        );
        if (housedSnap) {
          const seated = { ...element, rotation: housedSnap.rotation };
          const svgNode = canvasRef.current.querySelector(
            `[data-element-id="${element.id}"]`
          );
          if (svgNode) {
            svgNode.setAttribute(
              "transform",
              planTransform(seated, housedSnap.x, housedSnap.y, scale)
            );
          }
          dragCacheRef.current.lastPosition = {
            x: housedSnap.x,
            y: housedSnap.y,
            rotation: housedSnap.rotation,
          };
          return;
        }
        // A drawn or pantry wall first: back against it, turned to face away
        // from it, on whichever side of it the item is dragged. Not for a
        // cabinet with a fridge in it (it would turn without the fridge).
        let rotation = element.rotation || 0;
        let turnedElement = element;
        let position = null;
        const housesSomething =
          housedElements(element, currentRoomData.elements, elementTypes, scale)
            .length > 0;
        if (!housesSomething) {
          const faceSnap = snapToWallFace({
            element,
            center: {
              x: boundedX + elementWidth / 2,
              y: boundedY + elementDepth / 2,
            },
            roomData: currentRoomData,
            scale,
          });
          if (faceSnap.snapped) {
            position = faceSnap;
            rotation = faceSnap.rotation;
            turnedElement = { ...element, rotation };
          }
        }
        if (!position) {
          // Then other cabinets, then the room walls
          position = snapToCabinet(
            boundedX,
            boundedY,
            elementWidth,
            elementDepth,
            element.id,
            element.rotation,
            currentRoomData.elements,
            scale
          );
          if (!position.snapped) {
            position = snapToWall(
              boundedX,
              boundedY,
              elementWidth,
              elementDepth,
              currentRoomData,
              scale,
              standardWallsForCollision,
              wallHelpersCollision,
              wallHelpersPush
            );
          }
        }
        // The room walls are already handled: the drag is clamped inside the
        // room and snapToWall sets items flush. (A right-wall-only check here
        // used to push anything near wall 2 away from it.)
        // Check for door clearance collision before allowing the move (skip if snapped to cabinet)
        if (
          !position.snapped &&
          checkDoorClearanceCollision(
            position.x,
            position.y,
            elementWidth,
            elementDepth
          )
        ) {
          // Don't allow the move if it would block door clearance (unless snapped to another cabinet)
          return;
        }
        // No landing on another item (a snap may touch it, not overlap it);
        // only an item mounted above the other, or a fridge inside its
        // fridge cabinet, may share its floor space. A fridge cabinet takes
        // the fridge inside it along, so that has to land clear too. Nor
        // into a drawn or pantry wall's thickness.
        const blockedAt = (el, x, y) => {
          const moves = moveWithHoused(
            el,
            x,
            y,
            currentRoomData.elements,
            elementTypes,
            scale
          );
          moves[0] = { ...moves[0], rotation: el.rotation || 0 };
          return (
            movesOverlap(moves, currentRoomData.elements, elementTypes, scale) ||
            elementOverlapsWall(el, x, y, currentRoomData, scale)
          );
        };
        // An item that already overlaps where it started (older designs) may move out
        const startsOverlapping = blockedAt(element, element.x, element.y);
        if (
          !startsOverlapping &&
          blockedAt(turnedElement, position.x, position.y)
        ) {
          // A snap that lands on a third item: fall back to the unsnapped spot
          if (
            position.snapped &&
            !blockedAt(element, boundedX, boundedY) &&
            !checkDoorClearanceCollision(
              boundedX,
              boundedY,
              elementWidth,
              elementDepth
            )
          ) {
            position = { x: boundedX, y: boundedY, snapped: false };
            rotation = element.rotation || 0;
            turnedElement = element;
          } else {
            // Don't allow the move: the item stays at its last free spot
            return;
          }
        }
        // HYBRID APPROACH: Direct DOM manipulation for immediate visual feedback (zero lag)
        // Find the SVG group element for this cabinet
        const svgElement = canvasRef.current.querySelector(
          `[data-element-id="${element.id}"]`
        );
        if (svgElement) {
          // Same transform DraggableCabinet draws with, for immediate visual update
          const transform = planTransform(
            turnedElement,
            position.x,
            position.y,
            scale
          );

          // Apply transform directly to DOM for zero lag response
          svgElement.setAttribute("transform", transform);
        }
        // What a fridge cabinet carries (the fridge inside) follows it
        const carried = moveWithHoused(
          turnedElement,
          position.x,
          position.y,
          currentRoomData.elements,
          elementTypes,
          scale
        ).slice(1);
        carried.forEach((move) => {
          const other = currentRoomData.elements.find((el) => el.id === move.id);
          const node = canvasRef.current.querySelector(
            `[data-element-id="${move.id}"]`
          );
          if (other && node) {
            node.setAttribute(
              "transform",
              planTransform({ ...other, ...move }, move.x, move.y, scale)
            );
          }
        });
        // Store position for React state update on mouse up
        dragCacheRef.current.lastPosition = {
          x: position.x,
          y: position.y,
          rotation,
          carried,
        };
      }
    } else if (isDraggingWallView && selectedElement) {
      // Handle wall view cabinet mount height adjustment
      const element = currentRoomData.elements.find(
        (el) => el.id === selectedElement
      );
      if (element) {
        const rect = e.currentTarget.getBoundingClientRect();
        const deltaY = e.clientY - dragOffset.x;
        const wallHeight = parseFloat(currentRoomData.dimensions.wallHeight);
        const viewScale = Math.min(800 / (wallHeight * 12), 400 / wallHeight);
        // Convert pixel movement to mount height change
        const mountHeightChange = deltaY / viewScale;
        const newMountHeight = Math.max(
          0,
          Math.min(
            wallHeight * 12 - element.height,
            dragOffset.startMount + mountHeightChange
          )
        );
        // Update mount height immediately for wall view
        setCurrentRoomData((prevData) => ({
          ...prevData,
          elements: prevData.elements.map((el) =>
            el.id === element.id
              ? { ...el, mountHeight: roundInches(newMountHeight) }
              : el
          ),
        }));
      }
    }
  };
  // Cleanup function for drag ending or click completion
  const handleMouseUp = () => {
    // A pantry drag ends (a press without a move selects the pantry)
    if (pantryDragRef.current) {
      const drag = pantryDragRef.current;
      pantryDragRef.current = null;
      setSelectedPantry(drag.id);
      // the click that follows a drag lands on the plan: not a deselect
      pantryClickGuardRef.current = drag.moved;
      setTimeout(() => {
        pantryClickGuardRef.current = false;
      }, 0);
      if (!drag.moved) {
        // a press without a move just selects it
      } else if (drag.last) {
        const p = (drag.last.pantries || []).find((q) => q.id === drag.id);
        if (p) {
          announce(
            drag.mode === "move"
              ? t("designer.pantry.moved", {
                  name: pantryLabel(p),
                  x: toInches(p.x),
                  y: toInches(p.y),
                })
              : t("designer.pantry.resized", {
                  name: pantryLabel(p),
                  w: toInches(p.width),
                  d: toInches(p.depth),
                })
          );
        }
      } else if (drag.blocked) {
        notify(t("designer.pantry.blocked"), "error");
      }
      return;
    }
    // Clear long press timer if still pending
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    // Remove visual feedback from long press
    if (isLongPressing && selectedElement) {
      const svgElement = canvasRef.current?.querySelector(
        `[data-element-id="${selectedElement}"]`
      );
      if (svgElement) {
        // Remove scale transform
        svgElement.style.transform = svgElement.style.transform.replace(
          " scale(1.05)",
          ""
        );
      }
      setIsLongPressing(false);
    }

    // If we were dragging, update React state with final position
    if (isDragging && selectedElement && dragCacheRef.current.lastPosition) {
      const finalPosition = dragCacheRef.current.lastPosition;

      // Update React state with final position to ensure proper data persistence
      // (plus the turn a snap into a fridge cabinet made, and whatever a
      // fridge cabinet carried along)
      const { carried = [], ...own } = finalPosition;
      setCurrentRoomData((prevData) => ({
        ...prevData,
        // px on the 1/16" grid (utils/designer/planUnits.js)
        elements: applyMoves(
          prevData.elements,
          roundMoves([{ ...own, id: selectedElement }, ...carried], scale)
        ),
      }));
    }

    // On mobile: Select element if it was a quick tap (not a drag)
    if (
      isTouch &&
      !isDragging &&
      !isLongPressing &&
      dragCacheRef.current.potentialSelection
    ) {
      setSelectedElement(dragCacheRef.current.potentialSelection);
    }

    // Clear drag cache
    dragCacheRef.current = {
      lastPosition: null,
      rafId: null,
      startPosition: null,
      hasMoved: false,
      pendingDrag: false,
      potentialSelection: null,
    };
    setIsDragging(false);
    setIsDraggingWallView(false);
    setDragPreviewPosition(null); // Clear preview position
  };

  // -----------------------------
  // Keyboard model for placed cabinets and appliances
  // Tab to an item, arrow keys move it, Enter edits it, Delete removes it.
  // This is the keyboard equivalent of dragging (WCAG 2.1.1, 2.5.7).
  // -----------------------------
  // Spoken / announced lengths: inches as a fraction to 1/16 ("115 3/16")
  const toInches = (px) => formatInchesPlain(pxToInches(px, scale));

  const elementName = (element) =>
    getElementName(t, element.type, elementTypes);

  const elementNumber = (element) =>
    currentRoomData.elements.indexOf(element) + 1;

  // Footprint as drawn, so a rotated item is bounded by what you can see
  const getFootprint = (element) => {
    const turned = isQuarterTurned(element.rotation);
    return {
      width: (turned ? element.depth : element.width) * scale,
      depth: (turned ? element.width : element.depth) * scale,
    };
  };

  const clampToRoom = (element, x, y) => {
    const { width, depth } = getFootprint(element);
    const roomWidth = parseFloat(currentRoomData.dimensions.width) * 12 * scale;
    const roomHeight =
      parseFloat(currentRoomData.dimensions.height) * 12 * scale;
    return {
      x: Math.max(0, Math.min(x, roomWidth - width)),
      y: Math.max(0, Math.min(y, roomHeight - depth)),
    };
  };

  // Same limits the drag uses: door clearance and other items (the shared
  // overlap rule in collisionUtils; only stacked items, or a fridge inside
  // its fridge cabinet, may overlap in plan). A fridge cabinet moves with the
  // fridge inside it. `ignoreIds` are left out of the item check.
  const isBlockedAt = (element, x, y, ignoreIds = []) => {
    const { width, depth } = getFootprint(element);
    return (
      checkDoorClearanceCollision(x, y, width, depth) ||
      // nor into a drawn or pantry wall's thickness
      elementOverlapsWall(element, x, y, currentRoomData, scale) ||
      movesOverlap(
        moveWithHoused(
          element,
          x,
          y,
          currentRoomData.elements,
          elementTypes,
          scale
        ),
        currentRoomData.elements,
        elementTypes,
        scale,
        { ignoreIds }
      )
    );
  };

  const getElementLabel = (element) =>
    t("designer.cabinetLabel", {
      name: elementName(element),
      n: elementNumber(element),
      x: toInches(element.x),
      y: toInches(element.y),
      rotation: element.rotation || 0,
    });

  const getWallItemLabel = (element) => {
    const spec = elementTypes[element.type];
    return t("designer.wallItemLabel", {
      name: elementName(element),
      n: elementNumber(element),
      height: formatInchesPlain(
        element.actualHeight || spec?.fixedHeight || spec?.defaultHeight || 0
      ),
      mount: formatInchesPlain(element.mountHeight || 0),
    });
  };

  // Move an item, and whatever it houses along with it
  const setElementPosition = (elementId, x, y) => {
    setCurrentRoomData((prevData) => {
      const element = prevData.elements.find((el) => el.id === elementId);
      if (!element) return prevData;
      return {
        ...prevData,
        elements: applyMoves(
          prevData.elements,
          roundMoves(
            moveWithHoused(
              element,
              x,
              y,
              prevData.elements,
              elementTypes,
              scale
            ),
            scale
          )
        ),
      };
    });
  };

  // Typed position, from the properties panel
  const handlePositionChange = (elementId, axis, inches) => {
    const element = currentRoomData.elements.find((el) => el.id === elementId);
    if (!element || Number.isNaN(inches)) return;
    const target = clampToRoom(
      element,
      axis === "x" ? inches * scale : element.x,
      axis === "y" ? inches * scale : element.y
    );
    // Same rule as dragging and the arrow keys: no typing an item onto another
    if (
      isBlockedAt(element, target.x, target.y) &&
      !isBlockedAt(element, element.x, element.y)
    ) {
      announce(t("designer.moveBlocked", { name: elementName(element) }));
      return;
    }
    setElementPosition(elementId, target.x, target.y);
  };

  const nudgeElement = (element, dxInches, dyInches) => {
    const target = clampToRoom(
      element,
      (Math.round(element.x / scale) + dxInches) * scale,
      (Math.round(element.y / scale) + dyInches) * scale
    );
    const name = elementName(element);
    // A fridge slides out of its fridge cabinet an inch at a time: the
    // cabinet it sits in does not block it
    const housing = housingAround(
      element,
      currentRoomData.elements,
      elementTypes,
      scale
    );
    const ignore = housing ? [housing.id] : [];
    if (
      isBlockedAt(element, target.x, target.y, ignore) &&
      !isBlockedAt(element, element.x, element.y, ignore)
    ) {
      announce(t("designer.moveBlocked", { name }));
      return;
    }
    setSelectedElement(element.id);
    setElementPosition(element.id, target.x, target.y);
    announce(
      t("designer.moved", {
        name,
        x: toInches(target.x),
        y: toInches(target.y),
      })
    );
  };

  const changeMountHeight = (element, deltaInches) => {
    const spec = elementTypes[element.type];
    if (!spec || spec.mountHeight === undefined) return;
    const height =
      element.actualHeight || spec.fixedHeight || spec.defaultHeight || 0;
    const maxMount = Math.max(
      0,
      parseFloat(currentRoomData.dimensions.wallHeight) - height
    );
    const next = Math.max(
      0,
      Math.min(maxMount, Math.round(element.mountHeight || 0) + deltaInches)
    );
    setSelectedElement(element.id);
    updateElement(element.id, { mountHeight: next });
    announce(
      t("designer.mountMoved", {
        name: elementName(element),
        mount: formatInchesPlain(next),
      })
    );
  };

  // Open the properties panel and remember where focus should go back to
  const openElementProperties = (elementId, returnFocusEl) => {
    panelReturnFocusRef.current = returnFocusEl || null;
    setSelectedElement(elementId);
    setIsPanelOpen(true);
    setPanelFocusRequest(true);
  };

  // The same item is a <g> on the floor plan and a different <g> in the wall
  // elevation, so look for whichever one is on screen right now
  const findElementNode = (elementId) =>
    elementId
      ? document.querySelector(
          `[data-element-id="${elementId}"], [data-wall-element-id="${elementId}"]`
        )
      : null;

  const restoreFocusAfterPanel = (closedElementId) => {
    const returnTo = panelReturnFocusRef.current;
    panelReturnFocusRef.current = null;
    requestAnimationFrame(() => {
      if (returnTo && document.contains(returnTo)) {
        returnTo.focus();
        return;
      }
      const onCanvas = findElementNode(closedElementId);
      if (onCanvas && onCanvas.focus) {
        onCanvas.focus();
        return;
      }
      if (layoutHeadingRef.current) layoutHeadingRef.current.focus();
    });
  };

  const closePropertiesPanel = (options = {}) => {
    const closedId = selectedElement;
    setSelectedElement(null);
    setIsPanelOpen(false);
    if (options.restoreFocus) restoreFocusAfterPanel(closedId);
    else panelReturnFocusRef.current = null;
  };

  // Remove items (the first is the one the user asked to remove) and keep
  // keyboard focus somewhere sensible
  const removeElementsWithFocus = (elements) => {
    const [element, ...others] = elements;
    const ids = new Set(elements.map((el) => el.id));
    const list = currentRoomData.elements;
    const index = list.findIndex((el) => el.id === element.id);
    const neighbour =
      list.slice(index + 1).find((el) => !ids.has(el.id)) ||
      list
        .slice(0, Math.max(0, index))
        .reverse()
        .find((el) => !ids.has(el.id)) ||
      null;
    deleteElement(elements.length > 1 ? [...ids] : element.id);
    announce(
      others.length > 0
        ? t("designer.removedBoth", {
            name: elementName(element),
            item: elementName(others[0]),
          })
        : t("designer.removed", { name: elementName(element) })
    );
    requestAnimationFrame(() => {
      const next = neighbour && findElementNode(neighbour.id);
      if (next && next.focus) next.focus();
      else if (layoutHeadingRef.current) layoutHeadingRef.current.focus();
    });
  };

  // A refrigerator cabinet with a fridge in it asks first: the cabinet only,
  // both, or neither (HousingDeleteDialog). Anything else goes straight away.
  const removeElementWithFocus = (element) => {
    const [inside] = housedElements(
      element,
      currentRoomData.elements,
      elementTypes,
      scale
    );
    if (inside) {
      setHousingDelete({
        housing: element,
        inside,
        returnFocus: document.activeElement,
      });
      return;
    }
    removeElementsWithFocus([element]);
  };

  const finishHousingDelete = (choice) => {
    const request = housingDelete;
    setHousingDelete(null);
    if (!request) return;
    const housing = currentRoomData.elements.find(
      (el) => el.id === request.housing.id
    );
    if (choice === "cancel" || !housing) {
      // back to the Remove button or the item on the plan
      requestAnimationFrame(() => {
        const back = request.returnFocus;
        if (back && document.contains(back) && back.focus) back.focus();
      });
      return;
    }
    const inside = currentRoomData.elements.find(
      (el) => el.id === request.inside.id
    );
    removeElementsWithFocus(
      choice === "both" && inside ? [housing, inside] : [housing]
    );
  };

  const handleElementKeyDown = (e, elementId) => {
    const element = currentRoomData.elements.find((el) => el.id === elementId);
    if (!element) return;
    const step = e.shiftKey ? 12 : 1; // inches

    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      openElementProperties(elementId, e.currentTarget);
    } else if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const dx =
        e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      nudgeElement(element, dx, dy);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeElementWithFocus(element);
    } else if (e.key === "Escape" && selectedElement === elementId) {
      e.preventDefault();
      setSelectedElement(null);
    }
  };

  // Wall elevation view: up/down change how high a wall item is mounted
  const handleWallElementKeyDown = (e, elementId) => {
    const element = currentRoomData.elements.find((el) => el.id === elementId);
    if (!element) return;
    const step = e.shiftKey ? 12 : 1; // inches

    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      openElementProperties(elementId, e.currentTarget);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      changeMountHeight(element, e.key === "ArrowUp" ? step : -step);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeElementWithFocus(element);
    } else if (e.key === "Escape" && selectedElement === elementId) {
      e.preventDefault();
      setSelectedElement(null);
    }
  };

  // -----------------------------
  // Pantry: a room inside the room (utils/designer/pantry.js). Added from the
  // sidebar, dragged by its tag or walls, resized by the grips on its
  // walls or in its panel, removed from the panel or with Delete.
  // -----------------------------
  const pantries = currentRoomData.pantries || [];
  const pantryLabel = (pantry) => {
    const index = pantries.findIndex((p) => p.id === pantry.id);
    return pantries.length > 1
      ? t("designer.pantry.labelN", { n: index + 1 })
      : t("designer.pantry.label");
  };
  const pantryAriaLabel = (pantry) =>
    t("designer.pantry.planLabel", {
      name: pantryLabel(pantry),
      w: toInches(pantry.width),
      d: toInches(pantry.depth),
    });
  const pantryNode = (id) =>
    canvasRef.current?.querySelector(`[data-pantry-id="${id}"] [role="button"]`);

  // Pointer position in room coordinates (plan px)
  const planPoint = (e) => {
    const coords = getEventCoordinates(e);
    const svgPt = canvasRef.current.createSVGPoint();
    svgPt.x = coords.clientX;
    svgPt.y = coords.clientY;
    const p = svgPt.matrixTransform(canvasRef.current.getScreenCTM().inverse());
    return { x: p.x - 30, y: p.y - 30 };
  };

  const handleAddPantry = (shape) => {
    const out = addPantry(currentRoomData, shape, scale);
    if (!out) {
      notify(t("designer.pantry.noSpace"), "error");
      return;
    }
    setCurrentRoomData(out.roomData);
    setSelectedElement(null);
    setSelectedPantry(out.pantry.id);
    if (viewMode !== "floor") setViewMode("floor");
    if (isMobile) setSidebarCollapsed(true);
    notify(t("designer.pantry.added"));
  };

  const startPantryDrag = (e, id, mode, side) => {
    if (isDrawingWall || !canvasRef.current) return;
    const pantry = pantries.find((p) => p.id === id);
    if (!pantry) return;
    e.stopPropagation();
    if (e.type === "mousedown") e.preventDefault();
    const coords = getEventCoordinates(e);
    let wallAt = null;
    if (side) {
      const seg = sideSegment(
        pantry,
        side,
        partitionSides(pantry, currentRoomData, scale),
        scale
      );
      wallAt = side === "n" || side === "s" ? seg.y1 : seg.x1;
    }
    pantryDragRef.current = startPantryPlanDrag(currentRoomData, {
      id,
      mode,
      side,
      wallAt,
      start: planPoint(e),
      client: { x: coords.clientX, y: coords.clientY },
      origin: { x: pantry.x, y: pantry.y },
      moved: false,
      last: null,
      blocked: false,
    });
    setSelectedElement(null);
  };

  const openPantryPanel = (id, returnFocusEl) => {
    pantryReturnFocusRef.current = returnFocusEl || null;
    setSelectedElement(null);
    setSelectedPantry(id);
    setPantryPanelFocus(true);
  };

  const closePantryPanel = ({ restoreFocus } = {}) => {
    const id = selectedPantry;
    setSelectedPantry(null);
    const back = pantryReturnFocusRef.current;
    pantryReturnFocusRef.current = null;
    if (!restoreFocus) return;
    requestAnimationFrame(() => {
      const target = back && document.contains(back) ? back : pantryNode(id);
      if (target && target.focus) target.focus();
      else if (layoutHeadingRef.current) layoutHeadingRef.current.focus();
    });
  };

  const handlePantryResize = (id, dims) => {
    const next = resizePantry(currentRoomData, id, dims, scale);
    if (!next) {
      notify(t("designer.pantry.blocked"), "error");
      return;
    }
    setCurrentRoomData(next);
    const p = next.pantries.find((q) => q.id === id);
    announce(
      t("designer.pantry.resized", {
        name: pantryLabel(p),
        w: toInches(p.width),
        d: toInches(p.depth),
      })
    );
  };

  const handlePantryOpening = (id, changes) => {
    setCurrentRoomData(setPantryOpening(currentRoomData, id, changes, scale));
  };

  // A pantry the house already has: its walls and opening aren't charged
  const handlePantryExistedPrior = (id, existedPrior) => {
    setCurrentRoomData(
      setPantryExistedPrior(currentRoomData, id, existedPrior, scale)
    );
  };

  const finishRemovePantry = (id, removeItemIds = []) => {
    setCurrentRoomData(
      removePantry(currentRoomData, id, { removeItemIds }, scale)
    );
    if (selectedPantry === id) setSelectedPantry(null);
    if (removeItemIds.includes(selectedElement)) setSelectedElement(null);
    announce(
      removeItemIds.length
        ? t("designer.pantry.removedWithItems", { count: removeItemIds.length })
        : t("designer.pantry.removed")
    );
    requestAnimationFrame(() => {
      if (layoutHeadingRef.current) layoutHeadingRef.current.focus();
    });
  };

  // Items against its walls: ask first (keep them, remove them, or cancel)
  const requestRemovePantry = (id) => {
    const items = itemsAgainstPantry(currentRoomData, id, scale);
    if (items.length) {
      setPantryDelete({ pantryId: id, items, returnFocus: document.activeElement });
      return;
    }
    finishRemovePantry(id);
  };

  const finishPantryDelete = (choice) => {
    const request = pantryDelete;
    setPantryDelete(null);
    if (!request) return;
    if (choice === "cancel") {
      requestAnimationFrame(() => {
        const back = request.returnFocus;
        if (back && document.contains(back) && back.focus) back.focus();
      });
      return;
    }
    finishRemovePantry(
      request.pantryId,
      choice === "both" ? request.items.map((el) => el.id) : []
    );
  };

  // Keyboard on a pantry's tag: Enter opens its settings, arrows move it
  // (Shift: a foot at a time), Delete removes it
  const handlePantryKeyDown = (e, id) => {
    const pantry = pantries.find((p) => p.id === id);
    if (!pantry) return;
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      openPantryPanel(id, e.currentTarget);
    } else if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const step = (e.shiftKey ? 12 : 1) * scale;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      const next = movePantry(currentRoomData, id, pantry.x + dx, pantry.y + dy, scale);
      if (!next) {
        announce(t("designer.pantry.blocked"));
        return;
      }
      setSelectedPantry(id);
      setCurrentRoomData(next);
      const p = next.pantries.find((q) => q.id === id);
      announce(
        t("designer.pantry.moved", {
          name: pantryLabel(p),
          x: toInches(p.x),
          y: toInches(p.y),
        })
      );
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      requestRemovePantry(id);
    } else if (e.key === "Escape" && selectedPantry === id) {
      e.preventDefault();
      setSelectedPantry(null);
    }
  };

  // Wall views for the quote: walls 1-4 and each face of a drawn or pantry
  // wall that has something against it
  const quoteWallKeys = () => [
    1,
    2,
    3,
    4,
    ...customWalls
      .filter((w) => (currentRoomData.walls || []).includes(w.wallNumber))
      .flatMap((w) => {
        const inside = w.pantryInside;
        const faces = inside
          ? [inside === "left" ? "right" : "left", inside]
          : ["right", "left"];
        return faces
          .filter(
            (face) =>
              elementsOnWallFace(w, face, currentRoomData.elements, scale).length > 0
          )
          .map((face) => wallFaceKey(w.wallNumber, face));
      }),
  ];

  // -----------------------------
  // Special Rendering Functions
  // Custom rendering for special cabinet types and visual effects
  // -----------------------------
  // Render corner cabinet with special L-shape (relative positioning for transformed group)
  const renderCornerCabinet = (element) => {
    return renderCornerCabinetHelper(
      element,
      scale,
      isDragging,
      handleMouseDown
    );
  };
  // Render door swing arc for cabinets
  const renderDoorGraphic = (x, y, width, depth, rotation) => {
    return renderDoorGraphicHelper(x, y, width, depth, rotation);
  };
  // -----------------------------
  // PDF Generation and Quote Functions
  // Create professional quotes and send to contractor
  // -----------------------------
  // PDF and quote services are now handled by the pdfService module
  // Wrapper function to call the PDF service
  const handleSendQuote = async () => {
    const result = await sendQuote({
      t,
      clientInfo,
      kitchenData,
      bathroomData,
      calculateTotalPrice,
      canvasRef,
      wallViewRef,
      viewMode,
      setViewMode,
      selectedWall,
      setSelectedWall,
      cameraRef,  // Pass camera ref for 3D wall views
      wallKeys: quoteWallKeys(),
      wallLabel: getWallLabel,
    });
    if (result?.success && result?.resetClientInfo) {
      setClientInfo(result.resetClientInfo);
    }
    // Failures are announced by sendQuote; also show them on the page
    if (result && !result.success && result.message) {
      notify(result.message, "error");
    }
    // Let the quote form show its own inline errors if it wants to
    return result;
  };
  // -----------------------------
  // MAIN RENDER LOGIC
  // Conditional rendering based on current application step and state
  // Controls the overall application flow and interface display
  // -----------------------------
  // STEP 1: Room Dimensions Setup
  // Initial configuration screen where users input room measurements and select room type
  if (step === "dimensions") {
    return (
      <>
        <SEO
          title={t("seo.design.title")}
          description={t("seo.design.description")}
          keywords="kitchen design tool, free kitchen planner, cabinet designer, bathroom planner, online kitchen designer, 3D kitchen visualizer, cabinet layout tool"
          canonical="https://gudinocustom.com/design"
        />
        <DimensionsSetup
          activeRoom={activeRoom}
          switchRoom={switchRoom}
          currentRoomData={currentRoomData}
          setCurrentRoomData={setCurrentRoomData}
          handleDimensionsSubmit={handleDimensionsSubmit}
          kitchenData={kitchenData}
          bathroomData={bathroomData}
        />
      </>
    );
  }
  // STEP 2: Main Design Interface
  // Full-featured design environment with sidebar controls and main canvas
  return (
    <>
      <SEO
        title={t("designer.layoutPageTitle", {
          room:
            activeRoom === "kitchen"
              ? t("designer.kitchen")
              : t("designer.bathroom"),
        })}
        description={t("seo.design.description")}
        keywords="kitchen design tool, free kitchen planner, cabinet designer, bathroom planner, online kitchen designer, 3D kitchen visualizer, cabinet layout tool"
        canonical="https://gudinocustom.com/design"
      />
      <MainNavBar />
      <main
        id="main-content"
        tabIndex={-1}
        className="min-h-screen bg-gray-100 focus:outline-none"
      >
        {/* ========== MOBILE HAMBURGER MENU ========== */}
        {/* Shows only on mobile and tablet when sidebar is collapsed */}
        {!sidebarCollapsed && isMobile && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(true)}
            className="fixed top-20 left-4 z-50 lg:hidden bg-white rounded-lg shadow-lg p-3 hover:bg-gray-50 transition-colors"
            aria-label={t("designer.closeTools")}
            aria-expanded={true}
            aria-controls="kd-sidebar-content"
          >
            <X className="h-6 w-6 text-gray-700" />
          </button>
        )}
        {sidebarCollapsed && (isMobile || isTablet) && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="fixed top-20 left-4 z-50 lg:hidden bg-white rounded-lg shadow-lg p-3 hover:bg-gray-50 transition-colors"
            aria-label={t("designer.openTools")}
            aria-expanded={false}
            aria-controls="kd-sidebar-content"
          >
            <Menu className="h-6 w-6 text-gray-700" />
          </button>
        )}

        {/* Status / error messages that used to be alert() calls */}
        {notice && (
          <div
            className="fixed top-24 left-1/2 z-50 -translate-x-1/2 transform rounded-lg px-4 py-3 shadow-lg flex items-start gap-3 bg-white border"
            style={{
              maxWidth: "90vw",
              borderColor: notice.tone === "error" ? "#b91c1c" : "#1d4ed8",
            }}
          >
            <p className={`text-sm ${notice.tone === "error" ? "text-red-700" : "text-gray-800"}`}>
              {notice.text}
            </p>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-gray-700 hover:text-gray-900 p-1 rounded-full hover:bg-gray-200"
              aria-label={t("a11y.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex h-screen">
          {/* ========== LEFT SIDEBAR ========== */}
          <DesignerSidebar
            // Responsive state
            isMobile={isMobile}
            isTablet={isTablet}
            // UI State
            sidebarCollapsed={sidebarCollapsed}
            setSidebarCollapsed={setSidebarCollapsed}
            activeRoom={activeRoom}
            switchRoom={switchRoom}
            viewMode={viewMode}
            setViewMode={setViewMode}
            // Design Data
            currentRoomData={currentRoomData}
            setCurrentRoomData={setCurrentRoomData}
            selectedElement={selectedElement}
            elementTypes={elementTypes}
            scale={scale}
            // Pricing
            showPricing={showPricing}
            setShowPricing={setShowPricing}
            calculateTotalPrice={calculateTotalPrice}
            basePrices={basePrices}
            materialMultipliers={materialMultipliers}
            colorPricing={colorPricing}
            wallPricing={wallPricing}
            wallAvailability={wallAvailability}
            // Actions
            addElement={addElement}
            updateElement={updateElement}
            deleteElement={deleteElement}
            setShowQuoteForm={setShowQuoteForm}
            setShowARViewer={setShowARViewer}
            // Wall/Elements
            allAvailableWalls={allAvailableWalls}
            selectedWall={selectedWall}
            setSelectedWall={setSelectedWall}
            getWallName={getWallLabel}
            getCustomWallByNumber={(wallNum) =>
              getCustomWallByNumber(wallNum, customWalls)
            }
            // Floor plan presets
            applyFloorPlanPreset={applyFloorPlanPreset}
            // Wall Management
            isDrawingWall={isDrawingWall}
            setIsDrawingWall={setIsDrawingWall}
            wallDrawStart={wallDrawStart}
            setWallDrawStart={setWallDrawStart}
            setWallDrawPreview={setWallDrawPreview}
            toggleWallDrawingMode={toggleWallDrawingMode}
            isDoorMode={isDoorMode}
            toggleDoorMode={toggleDoorMode}
            doorModeType={doorModeType}
            setDoorModeType={setDoorModeType}
            customWalls={customWalls}
            wallRemovalDisabled={wallRemovalDisabled}
            addWall={addWall}
            removeWall={removeWall}
            markWallAsExistedPrior={markWallAsExistedPrior}
            markWallAsNonExistentPrior={markWallAsNonExistentPrior}
            getCurrentWallAngle={getCurrentWallAngle}
            rotateCustomWall={rotateCustomWall}
            resizeCustomWall={resizeCustomWall}
            addDoor={addDoor}
            removeDoor={removeDoor}
            updateDoor={updateDoor}
            getDoorsOnWall={(wallNum) =>
              getDoorsOnWall(wallNum, currentRoomData.doors)
            }
            getDoorTypes={getDoorTypes}
            // Additional state needed
            collapsedSections={collapsedSections}
            toggleSection={toggleSection}
            rotateElement={rotateElement}
            rotateCornerCabinet={rotateCornerCabinet}
            resetDesign={resetDesign}
            originalWalls={originalWalls}
            pantryControls={
              <PantrySection
                pantries={pantries}
                scale={scale}
                selectedId={selectedPantry}
                labelFor={pantryLabel}
                onAdd={handleAddPantry}
                onSelect={(id, el) => {
                  if (viewMode !== "floor") setViewMode("floor");
                  openPantryPanel(id, el);
                }}
                onRemove={requestRemovePantry}
              />
            }
          />
          {/* ========== MAIN CANVAS AREA ========== */}
          {/* Primary design workspace containing the visual interface */}
          <div className="flex-1 p-8 overflow-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
              {/* Header */}
              {/* Title bar with room name and date */}
              <div className="flex justify-between items-start mb-6 border-b pb-4">
                <div>
                  <h1
                    ref={layoutHeadingRef}
                    tabIndex={-1}
                    className="text-2xl font-bold focus:outline-none"
                  >
                    {t("designer.layoutHeading", {
                      room:
                        activeRoom === "kitchen"
                          ? t("designer.kitchen")
                          : t("designer.bathroom"),
                    })}
                  </h1>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {new Date().toLocaleDateString(currentLanguage)}
                  </p>
                  <p className="text-xs text-gray-600">
                    {t("designer.notToScale")}
                  </p>
                </div>
              </div>
              {/* Pricing Summary */}
              <PricingDisplay
                isVisible={showPricing}
                activeRoom={activeRoom}
                currentRoomData={currentRoomData}
                setCurrentRoomData={setCurrentRoomData}
                calculateTotalPrice={calculateTotalPrice}
                colorPricing={colorPricing}
                wallPricing={wallPricing}
                originalWalls={originalWalls}
              />
              {viewMode === "3d" ? (
                /* 3D View */
                <Designer3D
                  roomData={currentRoomData}
                  setRoomData={setCurrentRoomData}
                  elementTypes={elementTypes}
                  activeRoom={activeRoom}
                  scale={scale}
                  selectedElement={selectedElement}
                  setSelectedElement={setSelectedElement}
                  updateElement={updateElement}
                  onClose={() => setViewMode("floor")}
                  cameraRef={cameraRef}
                />
              ) : viewMode === "floor" ? (
                <>
                  {/* Floor Plan Instructions (pointer and keyboard) */}
                  <p id="kd-floor-help" className="text-sm text-gray-700 mb-4">
                    {t("designer.floorInstructions")}{" "}
                    {t("designer.keyboardHelp")}
                  </p>
                  {/* Floor Plan SVG Container */}
                  {/* Main interactive canvas for cabinet placement and arrangement */}
                  <div
                    className="relative inline-block bg-white"
                    ref={floorPlanRef}
                    {...planDropProps}
                  >
                    <svg
                      ref={canvasRef}
                      id="designer-canvas-svg"
                      role="group"
                      aria-label={t("designer.floorPlanLabel")}
                      aria-describedby="kd-floor-help"
                      // zoom scales the drawing, not the plan units: the
                      // pointer maths goes through getScreenCTM
                      viewBox={`0 0 ${
                        parseFloat(currentRoomData.dimensions.width) *
                          12 *
                          scale +
                        60
                      } ${
                        parseFloat(currentRoomData.dimensions.height) *
                          12 *
                          scale +
                        60
                      }`}
                      width={
                        (parseFloat(currentRoomData.dimensions.width) *
                          12 *
                          scale +
                          60) *
                        zoom
                      }
                      height={
                        (parseFloat(currentRoomData.dimensions.height) *
                          12 *
                          scale +
                          60) *
                        zoom
                      }
                      className={
                        isDrawingWall ? "cursor-crosshair" : "cursor-default"
                      }
                      style={{
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        MozUserSelect: "none",
                        msUserSelect: "none",
                        WebkitTouchCallout: "none",
                        WebkitTapHighlightColor: "transparent",
                        touchAction: "none",
                      }}
                      onSelectStart={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                      onContextMenu={(e) => e.preventDefault()}
                      onMouseMove={handleMouseMove}
                      onMouseUp={(e) => {
                        // Handle wall drawing completion on mouse up if in drawing mode
                        if (isDrawingWall && wallDrawStart) {
                          const targetIsCanvas =
                            e.target === e.currentTarget ||
                            (e.target.tagName === "rect" &&
                              e.target.id === "room-floor") ||
                            (e.target.tagName === "rect" &&
                              e.target.getAttribute("fill") === "url(#grid)") ||
                            (e.target.tagName === "rect" &&
                              e.target.getAttribute("fill") === "white");
                          if (targetIsCanvas) {
                            const coords = getEventCoordinates(e);
                            const svgPt = canvasRef.current.createSVGPoint();
                            svgPt.x = coords.clientX;
                            svgPt.y = coords.clientY;
                            const cursorPt = svgPt.matrixTransform(
                              canvasRef.current.getScreenCTM().inverse()
                            );
                            const clickX = cursorPt.x - 30;
                            const clickY = cursorPt.y - 30;
                            const minWallLength = 20;
                            const wallLength = Math.sqrt(
                              Math.pow(clickX - wallDrawStart.x, 2) +
                                Math.pow(clickY - wallDrawStart.y, 2)
                            );
                            /*//console.log('Wall drawing mouseUp:', {
                              startX: wallDrawStart.x,
                              startY: wallDrawStart.y,
                              endX: clickX,
                              endY: clickY,
                              wallLength: wallLength.toFixed(1),
                              target: e.target.tagName
                            });*/
                            if (wallLength >= minWallLength) {
                              addCustomWallAtPosition(
                                wallDrawStart.x,
                                wallDrawStart.y,
                                clickX,
                                clickY
                              );
                              ////console.log('Wall completed via mouseUp');
                            } else if (wallLength > 5) {
                              // Only warn if they actually tried to draw something
                              notify(
                                t("designer.wallTooShort", {
                                  min: Math.ceil(minWallLength / scale),
                                }),
                                "error"
                              );
                            }
                            // Reset drawing state
                            setWallDrawStart(null);
                            setWallDrawPreview(null);
                            return;
                          }
                        }
                        // Default mouse up handling
                        handleMouseUp(e);
                      }}
                      onMouseLeave={handleMouseUp}
                      onTouchStart={handleTouchStart}
                      onTouchMove={(e) => {
                        // Prevent default for all touch moves to stop scrolling during drag
                        if (isDragging || e.touches.length === 2) {
                          e.preventDefault();
                        }
                        handleTouchMoveZoom(e);
                        // Only process drag if NOT pinch-zooming (single finger only)
                        if (e.touches.length !== 2) {
                          handleMouseMove(e);
                        }
                      }}
                      onTouchEnd={(e) => {
                        handleTouchEnd(e);
                        handleMouseUp(e);
                      }}
                      // a cancelled touch (system gesture, call) ends a
                      // drag too, or the next touch would carry it on
                      onTouchCancel={(e) => {
                        handleTouchEnd(e);
                        handleMouseUp(e);
                      }}
                      onClick={(e) => {
                        // Handle wall drawing mode with precise click-to-place
                        if (isDrawingWall) {
                          // More comprehensive check for clickable areas
                          const targetIsCanvas =
                            e.target === e.currentTarget ||
                            (e.target.tagName === "rect" &&
                              e.target.id === "room-floor") ||
                            (e.target.tagName === "rect" &&
                              e.target.getAttribute("fill") === "url(#grid)") ||
                            (e.target.tagName === "rect" &&
                              e.target.getAttribute("fill") === "white") ||
                            (e.target.tagName === "rect" &&
                              e.target.getAttribute("fill") === "#666") || // Allow clicking on wall rectangles
                            (e.target.tagName === "line" &&
                              e.target.getAttribute("stroke-dasharray") ===
                                "5,5") || // Allow clicking on preview line
                            (e.target.tagName === "line" &&
                              e.target.getAttribute("stroke") === "#666"); // Allow clicking on custom wall lines
                          if (targetIsCanvas) {
                            e.preventDefault();
                            e.stopPropagation();
                            const coords = getEventCoordinates(e);
                            const svgPt = canvasRef.current.createSVGPoint();
                            svgPt.x = coords.clientX;
                            svgPt.y = coords.clientY;
                            const cursorPt = svgPt.matrixTransform(
                              canvasRef.current.getScreenCTM().inverse()
                            );
                            const clickX = cursorPt.x - 30; // Account for canvas offset
                            const clickY = cursorPt.y - 30;
                            if (!wallDrawStart) {
                              // First click: Set start point
                              setWallDrawStart({
                                x: clickX,
                                y: clickY,
                              });
                              ////console.log('Wall drawing started at:', { x: clickX, y: clickY });
                            } else {
                              // Second click: Complete wall
                              const minWallLength = 20; // Minimum wall length in pixels
                              const wallLength = Math.sqrt(
                                Math.pow(clickX - wallDrawStart.x, 2) +
                                  Math.pow(clickY - wallDrawStart.y, 2)
                              );
                              ////console.log('Attempting to complete wall:', {
                              //  startX: wallDrawStart.x,
                              //  startY: wallDrawStart.y,
                              //  endX: clickX,
                              //  endY: clickY,
                              //  wallLength: wallLength.toFixed(1),
                              // target: e.target.tagName,
                              //  targetId: e.target.id
                              //});
                              if (wallLength >= minWallLength) {
                                addCustomWallAtPosition(
                                  wallDrawStart.x,
                                  wallDrawStart.y,
                                  clickX,
                                  clickY
                                );
                                // //console.log('Wall completed successfully');
                              } else {
                                notify(
                                  t("designer.wallTooShort", {
                                    min: Math.ceil(minWallLength / scale),
                                  }),
                                  "error"
                                );
                              }
                              // Reset drawing state
                              setWallDrawStart(null);
                              setWallDrawPreview(null);
                            }
                            return;
                          } else {
                            // Log what was clicked if not a valid target
                            /*   //console.log('Invalid wall drawing target:', {
                                tagName: e.target.tagName,
                                id: e.target.id,
                                className: e.target.className,
                                fill: e.target.getAttribute('fill'),
                                wallDrawStart: !!wallDrawStart
                              }); */
                          }
                        }
                        // Deselect elements when clicking empty canvas
                        if (pantryClickGuardRef.current) {
                          pantryClickGuardRef.current = false;
                          return;
                        }
                        if (
                          e.target === e.currentTarget ||
                          (e.target.tagName === "rect" &&
                            e.target.id === "room-floor")
                        ) {
                          setSelectedElement(null);
                          setSelectedPantry(null);
                        }
                      }}
                    >
                      {/* Grid Pattern Definition */}
                      {/* Creates visual grid overlay for measurement reference */}
                      <defs>
                        {/* Light grid from the room's corner: a line every
                            foot, a slightly darker one every 4 feet */}
                        <pattern
                          id="grid"
                          x="30"
                          y="30"
                          width={48 * scale}
                          height={48 * scale}
                          patternUnits="userSpaceOnUse"
                        >
                          <rect
                            width={48 * scale}
                            height={48 * scale}
                            fill={PLAN.paper}
                          />
                          <path
                            d={[1, 2, 3]
                              .map(
                                (i) =>
                                  `M ${i * 12 * scale} 0 V ${48 * scale} M 0 ${
                                    i * 12 * scale
                                  } H ${48 * scale}`
                              )
                              .join(" ")}
                            fill="none"
                            stroke={PLAN.gridMinor}
                            strokeWidth="0.5"
                          />
                          <path
                            d={`M ${48 * scale} 0 L 0 0 0 ${48 * scale}`}
                            fill="none"
                            stroke={PLAN.gridMajor}
                            strokeWidth="0.75"
                          />
                        </pattern>
                        {/* Wall poche: charcoal with a faint hatch */}
                        <pattern
                          id="kdWallPoche"
                          width="6"
                          height="6"
                          patternUnits="userSpaceOnUse"
                          patternTransform="rotate(45)"
                        >
                          <rect width="6" height="6" fill={PLAN.wall} />
                          <line
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="6"
                            stroke={PLAN.wallHatch}
                            strokeWidth="1.5"
                          />
                        </pattern>
                        {/* Wood Grain Pattern - Premium 2D Visual */}
                        <pattern
                          id="woodGrain"
                          x="0"
                          y="0"
                          width="40"
                          height="40"
                          patternUnits="userSpaceOnUse"
                        >
                          {/* Base wood texture lines */}
                          <path
                            d="M0,8 Q10,6 20,8 T40,8"
                            fill="none"
                            stroke="#c4a882"
                            strokeWidth="0.5"
                            opacity="0.4"
                          />
                          <path
                            d="M0,16 Q8,14 18,17 T40,15"
                            fill="none"
                            stroke="#c4a882"
                            strokeWidth="0.5"
                            opacity="0.35"
                          />
                          <path
                            d="M0,24 Q12,22 22,25 T40,23"
                            fill="none"
                            stroke="#c4a882"
                            strokeWidth="0.5"
                            opacity="0.4"
                          />
                          <path
                            d="M0,32 Q6,30 16,33 T40,31"
                            fill="none"
                            stroke="#c4a882"
                            strokeWidth="0.5"
                            opacity="0.35"
                          />
                          {/* Additional grain detail */}
                          <path
                            d="M5,4 Q15,2 25,5"
                            fill="none"
                            stroke="#b89b6a"
                            strokeWidth="0.3"
                            opacity="0.3"
                          />
                          <path
                            d="M10,20 Q20,18 30,21"
                            fill="none"
                            stroke="#b89b6a"
                            strokeWidth="0.3"
                            opacity="0.3"
                          />
                          <path
                            d="M2,36 Q12,34 22,37"
                            fill="none"
                            stroke="#b89b6a"
                            strokeWidth="0.3"
                            opacity="0.3"
                          />
                        </pattern>
                        {/* Wood Grain Pattern - Dark variant for contrast */}
                        <pattern
                          id="woodGrainDark"
                          x="0"
                          y="0"
                          width="40"
                          height="40"
                          patternUnits="userSpaceOnUse"
                        >
                          <path
                            d="M0,8 Q10,6 20,8 T40,8"
                            fill="none"
                            stroke="#8b7355"
                            strokeWidth="0.6"
                            opacity="0.5"
                          />
                          <path
                            d="M0,16 Q8,14 18,17 T40,15"
                            fill="none"
                            stroke="#8b7355"
                            strokeWidth="0.6"
                            opacity="0.45"
                          />
                          <path
                            d="M0,24 Q12,22 22,25 T40,23"
                            fill="none"
                            stroke="#8b7355"
                            strokeWidth="0.6"
                            opacity="0.5"
                          />
                          <path
                            d="M0,32 Q6,30 16,33 T40,31"
                            fill="none"
                            stroke="#8b7355"
                            strokeWidth="0.6"
                            opacity="0.45"
                          />
                          <path
                            d="M5,4 Q15,2 25,5"
                            fill="none"
                            stroke="#6b5344"
                            strokeWidth="0.4"
                            opacity="0.4"
                          />
                          <path
                            d="M10,20 Q20,18 30,21"
                            fill="none"
                            stroke="#6b5344"
                            strokeWidth="0.4"
                            opacity="0.4"
                          />
                        </pattern>
                      </defs>
                      {/* Canvas Background */}
                      <rect
                        x="0"
                        y="0"
                        width="100%"
                        height="100%"
                        fill="white"
                      />
                      {/* Room Floor with Grid Overlay */}
                      {/* Visual representation of room floor space with measurement grid */}
                      <rect
                        id="room-floor"
                        x="30"
                        y="30"
                        width={
                          parseFloat(currentRoomData.dimensions.width) *
                          12 *
                          scale
                        }
                        height={
                          parseFloat(currentRoomData.dimensions.height) *
                          12 *
                          scale
                        }
                        fill="url(#grid)"
                      />
                      {/* Wall Structures with Thickness */}
                      {/* Gray rectangles representing physical walls with realistic thickness */}
                      <g>
                        {/* Top wall (Wall 1) with doors */}
                        {(currentRoomData.walls || [1, 2, 3, 4]).includes(1) &&
                          (!showWallPreview ||
                            !currentRoomData.removedWalls?.includes(1)) && (
                            <>
                              {renderWallWithDoors(1, {
                                x: 20,
                                y: 20,
                                width:
                                  parseFloat(currentRoomData.dimensions.width) *
                                    12 *
                                    scale +
                                  20,
                                height: 10,
                                isHorizontal: true,
                              })}
                            </>
                          )}
                        {/* Bottom wall (Wall 3) with doors */}
                        {(currentRoomData.walls || [1, 2, 3, 4]).includes(3) &&
                          (!showWallPreview ||
                            !currentRoomData.removedWalls?.includes(3)) && (
                            <>
                              {renderWallWithDoors(3, {
                                x: 20,
                                y:
                                  30 +
                                  parseFloat(
                                    currentRoomData.dimensions.height
                                  ) *
                                    12 *
                                    scale,
                                width:
                                  parseFloat(currentRoomData.dimensions.width) *
                                    12 *
                                    scale +
                                  20,
                                height: 10,
                                isHorizontal: true,
                              })}
                            </>
                          )}
                        {/* Left wall (Wall 4) with doors */}
                        {(currentRoomData.walls || [1, 2, 3, 4]).includes(4) &&
                          (!showWallPreview ||
                            !currentRoomData.removedWalls?.includes(4)) && (
                            <>
                              {renderWallWithDoors(4, {
                                x: 20,
                                y: 20,
                                width: 10,
                                height:
                                  parseFloat(
                                    currentRoomData.dimensions.height
                                  ) *
                                    12 *
                                    scale +
                                  20,
                                isHorizontal: false,
                              })}
                            </>
                          )}
                        {/* Right wall (Wall 2) with doors */}
                        {(currentRoomData.walls || [1, 2, 3, 4]).includes(2) &&
                          (!showWallPreview ||
                            !currentRoomData.removedWalls?.includes(2)) && (
                            <>
                              {renderWallWithDoors(2, {
                                x:
                                  30 +
                                  parseFloat(currentRoomData.dimensions.width) *
                                    12 *
                                    scale,
                                y: 20,
                                width: 10,
                                height:
                                  parseFloat(
                                    currentRoomData.dimensions.height
                                  ) *
                                    12 *
                                    scale +
                                  20,
                                isHorizontal: false,
                              })}
                            </>
                          )}
                        {/* Wall removal indicators - show openings where walls are removed */}
                        {(currentRoomData.removedWalls || []).map((wallNum) => {
                          const roomWidth =
                            parseFloat(currentRoomData.dimensions.width) *
                            12 *
                            scale;
                          const roomHeight =
                            parseFloat(currentRoomData.dimensions.height) *
                            12 *
                            scale;
                          if (wallNum === 1) {
                            // Top wall opening
                            return (
                              <g key={`opening-${wallNum}`}>
                                <rect
                                  x="20"
                                  y="20"
                                  width={roomWidth + 20}
                                  height="10"
                                  fill="#f9fafb"
                                  stroke={PLAN.hairline}
                                  strokeWidth="1"
                                  strokeDasharray="3,3"
                                />
                                <text
                                  x={30 + roomWidth / 2}
                                  y="27"
                                  textAnchor="middle"
                                  fontSize="8"
                                  fill={PLAN.inkSoft}
                                >
                                  OPENING
                                </text>
                              </g>
                            );
                          } else if (wallNum === 3) {
                            // Bottom wall opening
                            return (
                              <g key={`opening-${wallNum}`}>
                                <rect
                                  x="20"
                                  y={30 + roomHeight}
                                  width={roomWidth + 20}
                                  height="10"
                                  fill="#f9fafb"
                                  stroke={PLAN.hairline}
                                  strokeWidth="1"
                                  strokeDasharray="3,3"
                                />
                                <text
                                  x={30 + roomWidth / 2}
                                  y={37 + roomHeight}
                                  textAnchor="middle"
                                  fontSize="8"
                                  fill={PLAN.inkSoft}
                                >
                                  OPENING
                                </text>
                              </g>
                            );
                          } else if (wallNum === 4) {
                            // Left wall opening
                            return (
                              <g key={`opening-${wallNum}`}>
                                <rect
                                  x="20"
                                  y="20"
                                  width="10"
                                  height={roomHeight + 20}
                                  fill="#f9fafb"
                                  stroke={PLAN.hairline}
                                  strokeWidth="1"
                                  strokeDasharray="3,3"
                                />
                                <text
                                  x="25"
                                  y={30 + roomHeight / 2}
                                  textAnchor="middle"
                                  fontSize="8"
                                  fill={PLAN.inkSoft}
                                  transform={`rotate(-90, 25, ${
                                    30 + roomHeight / 2
                                  })`}
                                >
                                  OPENING
                                </text>
                              </g>
                            );
                          } else if (wallNum === 2) {
                            // Right wall opening
                            return (
                              <g key={`opening-${wallNum}`}>
                                <rect
                                  x={30 + roomWidth}
                                  y="20"
                                  width="10"
                                  height={roomHeight + 20}
                                  fill="#f9fafb"
                                  stroke={PLAN.hairline}
                                  strokeWidth="1"
                                  strokeDasharray="3,3"
                                />
                                <text
                                  x={35 + roomWidth}
                                  y={30 + roomHeight / 2}
                                  textAnchor="middle"
                                  fontSize="8"
                                  fill={PLAN.inkSoft}
                                  transform={`rotate(-90, ${35 + roomWidth}, ${
                                    30 + roomHeight / 2
                                  })`}
                                >
                                  OPENING
                                </text>
                              </g>
                            );
                          }
                          return null;
                        })}
                        {/* Custom Drawn Walls */}
                        {customWalls.map((storedWall, index) => {
                          // Pantry walls store their thickness in inches
                          const wall = storedWall.pantryId
                            ? { ...storedWall, thickness: wallThicknessPx(storedWall, scale) }
                            : storedWall;
                          const wallLength = Math.sqrt(
                            Math.pow(wall.x2 - wall.x1, 2) +
                              Math.pow(wall.y2 - wall.y1, 2)
                          );
                          const wallAngle =
                            (Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1) *
                              180) /
                            Math.PI;
                          const wallIsPresent = (
                            currentRoomData.walls || []
                          ).includes(wall.wallNumber);
                          const wallIsRemoved = (
                            currentRoomData.removedWalls || []
                          ).includes(wall.wallNumber);
                          const isSelected = selectedWallForEdit === wall.id;
                          // Show wall if present and either preview is off or wall is not removed
                          if (
                            wallIsPresent &&
                            (!showWallPreview || !wallIsRemoved)
                          ) {
                            const doorsOnWall = getDoorsOnWall(
                              wall.wallNumber,
                              currentRoomData.doors
                            );
                            // A pantry's wall: press to drag the whole pantry,
                            // click to select it (not the one-wall editor)
                            const pantryWallProps =
                              wall.pantryId && !isDrawingWall
                                ? {
                                    "data-pantry-wall": wall.pantryId,
                                    style: { cursor: "move" },
                                    onMouseDown: (e) =>
                                      startPantryDrag(e, wall.pantryId, "move"),
                                    onTouchStart: (e) =>
                                      startPantryDrag(e, wall.pantryId, "move"),
                                    onClickCapture: (e) => e.stopPropagation(),
                                  }
                                : {};
                            return (
                              <g key={wall.id} {...pantryWallProps}>
                                {/* Render custom wall with door openings */}
                                {(() => {
                                  if (doorsOnWall.length === 0) {
                                    // No doors - render solid wall
                                    return (
                                      <>
                                      <rect
                                        x={30 + wall.x1}
                                        y={30 + wall.y1 - wall.thickness / 2}
                                        width={wallLength}
                                        height={wall.thickness}
                                        fill={isSelected ? "#8B5CF6" : "#666"}
                                        stroke={isSelected ? "#7C3AED" : "none"}
                                        strokeWidth={isSelected ? "2" : "0"}
                                        transform={`rotate(${wallAngle}, ${
                                          30 + wall.x1
                                        }, ${30 + wall.y1})`}
                                        style={{ cursor: "pointer" }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedWallForEdit(
                                            isSelected ? null : wall.id
                                          );
                                        }}
                                      />
                                      {!isSelected && (
                                        <rect
                                          x={30 + wall.x1}
                                          y={30 + wall.y1 - wall.thickness / 2}
                                          width={wallLength}
                                          height={wall.thickness}
                                          transform={`rotate(${wallAngle}, ${
                                            30 + wall.x1
                                          }, ${30 + wall.y1})`}
                                          fill="url(#kdWallPoche)"
                                          pointerEvents="none"
                                        />
                                      )}
                                      </>
                                    );
                                  }
                                  // Has doors - render wall segments with openings
                                  const wallLengthInches = wallLength / scale;
                                  const sortedDoors = doorsOnWall.sort(
                                    (a, b) => a.position - b.position
                                  );
                                  const wallSegments = [];
                                  let currentPos = 0; // Position as percentage
                                  sortedDoors.forEach((door, index) => {
                                    const doorWidthPercentage =
                                      (door.width / wallLengthInches) * 100;
                                    const halfDoorWidth =
                                      doorWidthPercentage / 2;
                                    const doorStart = Math.max(
                                      0,
                                      door.position - halfDoorWidth
                                    );
                                    const doorEnd = Math.min(
                                      100,
                                      door.position + halfDoorWidth
                                    );
                                    // Add wall segment before door
                                    if (currentPos < doorStart) {
                                      wallSegments.push(
                                        <g key={`wall-${wall.wallNumber}-segment-${index}`}>
                                        <rect
                                          x={
                                            30 +
                                            wall.x1 +
                                            (currentPos / 100) * wallLength
                                          }
                                          y={30 + wall.y1 - wall.thickness / 2}
                                          width={
                                            ((doorStart - currentPos) / 100) *
                                            wallLength
                                          }
                                          height={wall.thickness}
                                          fill={isSelected ? "#8B5CF6" : "#666"}
                                          stroke={
                                            isSelected ? "#7C3AED" : "none"
                                          }
                                          strokeWidth={isSelected ? "2" : "0"}
                                          transform={`rotate(${wallAngle}, ${
                                            30 + wall.x1
                                          }, ${30 + wall.y1})`}
                                          style={{ cursor: "pointer" }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedWallForEdit(
                                              isSelected ? null : wall.id
                                            );
                                          }}
                                        />
                                        {!isSelected && (
                                          <rect
                                            x={
                                              30 +
                                              wall.x1 +
                                              (currentPos / 100) * wallLength
                                            }
                                            y={30 + wall.y1 - wall.thickness / 2}
                                            width={
                                              ((doorStart - currentPos) / 100) *
                                              wallLength
                                            }
                                            height={wall.thickness}
                                            transform={`rotate(${wallAngle}, ${
                                              30 + wall.x1
                                            }, ${30 + wall.y1})`}
                                            fill="url(#kdWallPoche)"
                                            pointerEvents="none"
                                          />
                                        )}
                                        </g>
                                      );
                                    }
                                    // The door, drawn architecturally in the
                                    // wall's own frame: leaf and swing on
                                    // the +y side of the wall as drawn
                                    const doorCenterX =
                                      30 +
                                      wall.x1 +
                                      (door.position / 100) * wallLength;
                                    const doorCenterY = 30 + wall.y1;
                                    wallSegments.push(
                                      <g
                                        key={`door-${door.id}`}
                                        transform={`rotate(${wallAngle}, ${
                                          30 + wall.x1
                                        }, ${30 + wall.y1})`}
                                      >
                                        {doorSymbol({
                                          key: `door-symbol-${door.id}`,
                                          type: door.type,
                                          u0:
                                            30 +
                                            wall.x1 +
                                            (doorStart / 100) * wallLength,
                                          u1:
                                            30 +
                                            wall.x1 +
                                            (doorEnd / 100) * wallLength,
                                          face:
                                            30 + wall.y1 + wall.thickness / 2,
                                          inward: 1,
                                          thickness: wall.thickness,
                                        })}
                                        <text
                                          x={doorCenterX}
                                          y={doorCenterY - wall.thickness / 2 - 4}
                                          textAnchor="middle"
                                          fontSize="10"
                                          fill={PLAN.ink}
                                          stroke={PLAN.paper}
                                          strokeWidth="3"
                                          paintOrder="stroke"
                                          pointerEvents="none"
                                        >
                                          {formatInches(door.width)}
                                        </text>
                                      </g>
                                    );
                                    currentPos = doorEnd;
                                  });
                                  // Add final wall segment after last door
                                  if (currentPos < 100) {
                                    wallSegments.push(
                                      <g key={`wall-${wall.wallNumber}-segment-final`}>
                                      <rect
                                        x={
                                          30 +
                                          wall.x1 +
                                          (currentPos / 100) * wallLength
                                        }
                                        y={30 + wall.y1 - wall.thickness / 2}
                                        width={
                                          ((100 - currentPos) / 100) *
                                          wallLength
                                        }
                                        height={wall.thickness}
                                        fill={isSelected ? "#8B5CF6" : "#666"}
                                        stroke={isSelected ? "#7C3AED" : "none"}
                                        strokeWidth={isSelected ? "2" : "0"}
                                        transform={`rotate(${wallAngle}, ${
                                          30 + wall.x1
                                        }, ${30 + wall.y1})`}
                                        style={{ cursor: "pointer" }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedWallForEdit(
                                            isSelected ? null : wall.id
                                          );
                                        }}
                                      />
                                      {!isSelected && (
                                        <rect
                                          x={
                                            30 +
                                            wall.x1 +
                                            (currentPos / 100) * wallLength
                                          }
                                          y={30 + wall.y1 - wall.thickness / 2}
                                          width={
                                            ((100 - currentPos) / 100) *
                                            wallLength
                                          }
                                          height={wall.thickness}
                                          transform={`rotate(${wallAngle}, ${
                                            30 + wall.x1
                                          }, ${30 + wall.y1})`}
                                          fill="url(#kdWallPoche)"
                                          pointerEvents="none"
                                        />
                                      )}
                                      </g>
                                    );
                                  }
                                  return wallSegments;
                                })()}
                                {/* Wall adjustment handles - only show when selected */}
                                {isSelected && (
                                  <>
                                    {/* Start point handle */}
                                    <circle
                                      cx={30 + wall.x1}
                                      cy={30 + wall.y1}
                                      r="6"
                                      fill="#10B981"
                                      stroke="white"
                                      strokeWidth="2"
                                      style={{ cursor: "move" }}
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setWallEditMode("start-point");
                                        // TODO: Add drag handling for start point
                                      }}
                                    />
                                    {/* End point handle */}
                                    <circle
                                      cx={30 + wall.x2}
                                      cy={30 + wall.y2}
                                      r="6"
                                      fill="#EF4444"
                                      stroke="white"
                                      strokeWidth="2"
                                      style={{ cursor: "move" }}
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setWallEditMode("end-point");
                                        // TODO: Add drag handling for end point
                                      }}
                                    />
                                    {/* Wall info overlay */}
                                    <g
                                      transform={`translate(${
                                        30 + (wall.x1 + wall.x2) / 2
                                      }, ${30 + (wall.y1 + wall.y2) / 2 - 15})`}
                                    >
                                      <rect
                                        x="-25"
                                        y="-8"
                                        width="50"
                                        height="16"
                                        fill="rgba(0,0,0,0.8)"
                                        rx="8"
                                      />
                                      <text
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fontSize="8"
                                        fill="white"
                                        fontWeight="bold"
                                      >
                                        {formatFeetInches(wallLength / scale / 12)}
                                      </text>
                                    </g>
                                  </>
                                )}
                                {/* Wall existed prior indicator */}
                                {wall.existedPrior && !wall.pantryId && (
                                  <text
                                    x={30 + (wall.x1 + wall.x2) / 2}
                                    y={30 + (wall.y1 + wall.y2) / 2 + 20}
                                    textAnchor="middle"
                                    fontSize="8"
                                    fill="#047857"
                                    fontWeight="bold"
                                  >
                                    {`✓ ${t("designer.existedPriorLabel")}`}
                                  </text>
                                )}
                              </g>
                            );
                          }
                          return null;
                        })}
                        {/* Wall Drawing Preview */}
                        {wallDrawPreview && (
                          <line
                            x1={30 + wallDrawPreview.x1}
                            y1={30 + wallDrawPreview.y1}
                            x2={30 + wallDrawPreview.x2}
                            y2={30 + wallDrawPreview.y2}
                            stroke="#ff6b6b"
                            strokeWidth="4"
                            strokeDasharray="5,5"
                            strokeLinecap="round"
                            opacity="0.8"
                          />
                        )}
                        {/* Wall Drawing Start Point Indicator */}
                        {wallDrawStart && (
                          <g>
                            <circle
                              cx={30 + wallDrawStart.x}
                              cy={30 + wallDrawStart.y}
                              r="6"
                              fill="#ff6b6b"
                              stroke="white"
                              strokeWidth="2"
                            />
                            <text
                              x={30 + wallDrawStart.x}
                              y={30 + wallDrawStart.y - 10}
                              textAnchor="middle"
                              fontSize="10"
                              fill="#ff6b6b"
                              fontWeight="bold"
                            >
                              START
                            </text>
                          </g>
                        )}
                      </g>
                      {/* Pantries: a tint over the inside and the tag to drag
                          them by (under the items) */}
                      <g transform="translate(30, 30)">
                        <PantryPlan
                          layer="floor"
                          pantries={pantries}
                          roomData={currentRoomData}
                          scale={scale}
                          selectedId={selectedPantry}
                          interactive={!isDrawingWall}
                          labelFor={pantryLabel}
                          ariaLabelFor={pantryAriaLabel}
                          existedPriorLabel={t("designer.existedPriorLabel")}
                          onPointerDown={startPantryDrag}
                          onKeyDown={handlePantryKeyDown}
                        />
                      </g>
                      {/* Room Dimensions */}
                      {/* Dimension lines with extension lines and 45-degree
                          ticks, the size centred on a knockout */}
                      {(() => {
                        const roomW =
                          parseFloat(currentRoomData.dimensions.width) *
                          12 *
                          scale;
                        const roomH =
                          parseFloat(currentRoomData.dimensions.height) *
                          12 *
                          scale;
                        const tick = 3.5;
                        const wLabel = formatFeetInches(
                          currentRoomData.dimensions.width
                        );
                        const hLabel = formatFeetInches(
                          currentRoomData.dimensions.height
                        );
                        const wKnock = labelWidth(wLabel, 10);
                        const hKnock = labelWidth(hLabel, 10);
                        const cx = 30 + roomW / 2;
                        const cy = 30 + roomH / 2;
                        const ext = { stroke: PLAN.line, strokeWidth: 0.6 };
                        const dim = { stroke: PLAN.ink, strokeWidth: 0.8 };
                        const tk = { stroke: PLAN.ink, strokeWidth: 1.2 };
                        const text = {
                          textAnchor: "middle",
                          dominantBaseline: "central",
                          fontSize: 10,
                          fontWeight: 600,
                          fontFamily: "Arial, Helvetica, sans-serif",
                          fill: PLAN.ink,
                        };
                        return (
                          <g pointerEvents="none">
                            {/* Width, above the top wall */}
                            <line x1="30" y1="4" x2="30" y2="17" {...ext} />
                            <line
                              x1={30 + roomW}
                              y1="4"
                              x2={30 + roomW}
                              y2="17"
                              {...ext}
                            />
                            <line x1="30" y1="10" x2={30 + roomW} y2="10" {...dim} />
                            <line
                              x1={30 - tick}
                              y1={10 + tick}
                              x2={30 + tick}
                              y2={10 - tick}
                              {...tk}
                            />
                            <line
                              x1={30 + roomW - tick}
                              y1={10 + tick}
                              x2={30 + roomW + tick}
                              y2={10 - tick}
                              {...tk}
                            />
                            <rect
                              x={cx - wKnock / 2}
                              y="3"
                              width={wKnock}
                              height="14"
                              fill={PLAN.paper}
                            />
                            <text x={cx} y="10" {...text}>
                              {wLabel}
                            </text>
                            {/* Depth, left of the left wall */}
                            <line x1="4" y1="30" x2="17" y2="30" {...ext} />
                            <line
                              x1="4"
                              y1={30 + roomH}
                              x2="17"
                              y2={30 + roomH}
                              {...ext}
                            />
                            <line x1="10" y1="30" x2="10" y2={30 + roomH} {...dim} />
                            <line
                              x1={10 - tick}
                              y1={30 + tick}
                              x2={10 + tick}
                              y2={30 - tick}
                              {...tk}
                            />
                            <line
                              x1={10 - tick}
                              y1={30 + roomH + tick}
                              x2={10 + tick}
                              y2={30 + roomH - tick}
                              {...tk}
                            />
                            <g transform={`rotate(-90, 10, ${cy})`}>
                              <rect
                                x={10 - hKnock / 2}
                                y={cy - 7}
                                width={hKnock}
                                height="14"
                                fill={PLAN.paper}
                              />
                              <text x="10" y={cy} {...text}>
                                {hLabel}
                              </text>
                            </g>
                          </g>
                        );
                      })()}
                      {/* Render Design Elements */}
                      {/* Container for all cabinets and appliances, sorted by z-index for proper layering */}
                      <g transform="translate(30, 30)">
                        {currentRoomData.elements
                          .sort((a, b) => a.zIndex - b.zIndex)
                          .map((element, index) => (
                            <DraggableCabinet
                              key={element.id}
                              element={element}
                              scale={scale}
                              isSelected={element.id === selectedElement}
                              isDragging={isDragging}
                              selectedElement={selectedElement}
                              dragPreviewPosition={dragPreviewPosition}
                              onMouseDown={handleMouseDown}
                              onKeyDown={handleElementKeyDown}
                              ariaLabel={getElementLabel(element)}
                              describedBy="kd-floor-help"
                              elementTypes={elementTypes}
                              renderCornerCabinet={renderCornerCabinet}
                              renderDoorGraphic={renderDoorGraphic}
                              currentRoomData={currentRoomData}
                            />
                          ))}
                        {/* The selected pantry's outline and wall grips */}
                        <PantryPlan
                          layer="handles"
                          pantries={pantries}
                          roomData={currentRoomData}
                          scale={scale}
                          selectedId={selectedPantry}
                          interactive={!isDrawingWall}
                          sideLabel={(side) =>
                            t("designer.pantry.resizeHandle", {
                              side: t(`designer.pantry.side.${side}`).toLowerCase(),
                            })
                          }
                          onPointerDown={startPantryDrag}
                        />
                        {/* Number badge and name of each refrigerator
                            cabinet with a fridge in it, above the fridge */}
                        {currentRoomData.elements.map((element) => (
                          <HousingBadge
                            key={`housing-badge-${element.id}`}
                            element={element}
                            scale={scale}
                            elementTypes={elementTypes}
                            currentRoomData={currentRoomData}
                            onMouseDown={handleMouseDown}
                          />
                        ))}
                      </g>
                      {/* Enhanced Drag Preview - Ghost Element */}
                      {dragPreviewPosition &&
                        isDragging &&
                        dragPreviewPosition.x !== undefined &&
                        dragPreviewPosition.y !== undefined && (
                          <g transform="translate(30, 30)" opacity="0.5">
                            {(() => {
                              const previewElement =
                                currentRoomData.elements.find(
                                  (el) =>
                                    el.id === dragPreviewPosition.elementId
                                );
                              if (!previewElement) return null;
                              const elementSpec =
                                elementTypes[previewElement.type];
                              if (!elementSpec) return null;
                              // Enhanced visual feedback with snap indicators
                              const snapIndicatorColor =
                                dragPreviewPosition.snapped
                                  ? "#22c55e"
                                  : "#3b82f6";
                              const strokeWidth = dragPreviewPosition.snapped
                                ? "3"
                                : "2";
                              return (
                                <g>
                                  {/* Snap target indicator */}
                                  {dragPreviewPosition.snapped &&
                                    dragPreviewPosition.snapTarget &&
                                    dragPreviewPosition.snapTarget.x !==
                                      undefined &&
                                    dragPreviewPosition.snapTarget.y !==
                                      undefined && (
                                      <rect
                                        x={dragPreviewPosition.snapTarget.x - 5}
                                        y={dragPreviewPosition.snapTarget.y - 5}
                                        width={
                                          dragPreviewPosition.snapTarget.width +
                                          10
                                        }
                                        height={
                                          dragPreviewPosition.snapTarget
                                            .height + 10
                                        }
                                        fill="none"
                                        stroke="#22c55e"
                                        strokeWidth="2"
                                        strokeDasharray="8,4"
                                        opacity="0.7"
                                      />
                                    )}
                                  {/* Ghost element */}
                                  <rect
                                    x={dragPreviewPosition.x}
                                    y={dragPreviewPosition.y}
                                    width={previewElement.width * scale}
                                    height={previewElement.depth * scale}
                                    fill="none"
                                    stroke={snapIndicatorColor}
                                    strokeWidth={strokeWidth}
                                    strokeDasharray="5,5"
                                    rx="2"
                                  />
                                  {/* Element type indicator */}
                                  <text
                                    x={
                                      dragPreviewPosition.x +
                                      (previewElement.width * scale) / 2
                                    }
                                    y={
                                      dragPreviewPosition.y +
                                      (previewElement.depth * scale) / 2
                                    }
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize="12"
                                    fill={snapIndicatorColor}
                                    fontWeight="bold"
                                    opacity="0.8"
                                  >
                                    {elementSpec.name}
                                  </text>
                                  {/* Smooth position indicators */}
                                  <circle
                                    cx={dragPreviewPosition.x}
                                    cy={dragPreviewPosition.y}
                                    r="3"
                                    fill={snapIndicatorColor}
                                    opacity="0.6"
                                  />
                                  <circle
                                    cx={
                                      dragPreviewPosition.x +
                                      previewElement.width * scale
                                    }
                                    cy={
                                      dragPreviewPosition.y +
                                      previewElement.depth * scale
                                    }
                                    r="3"
                                    fill={snapIndicatorColor}
                                    opacity="0.6"
                                  />
                                </g>
                              );
                            })()}
                          </g>
                        )}
                      {/* Wall Number Tags */}
                      {/* Wall numbers as used in the wall view and door
                          settings (1 north / top, 2 east / right, 3 south /
                          bottom, 4 west / left), tagged on the wall itself,
                          clear of any door in it */}
                      <g pointerEvents="none" aria-hidden="true">
                        {[1, 2, 3, 4].map((wallNum) => {
                          const roomW =
                            parseFloat(currentRoomData.dimensions.width) *
                            12 *
                            scale;
                          const roomH =
                            parseFloat(currentRoomData.dimensions.height) *
                            12 *
                            scale;
                          const horizontal = wallNum === 1 || wallNum === 3;
                          // Same span and percent space the wall drawing uses
                          const spanPx = (horizontal ? roomW : roomH) + 20;
                          const lengthIn =
                            parseFloat(
                              horizontal
                                ? currentRoomData.dimensions.width
                                : currentRoomData.dimensions.height
                            ) * 12;
                          const doorsHere = getDoorsOnWall(
                            wallNum,
                            currentRoomData.doors
                          );
                          const removed = (
                            currentRoomData.removedWalls || []
                          ).includes(wallNum);
                          const clearOfDoors = (p) =>
                            doorsHere.every(
                              (door) =>
                                Math.abs(p - door.position) >
                                (door.width / lengthIn) * 50 + 6
                            );
                          const candidates = removed
                            ? [25, 75, 12, 88]
                            : [50, 25, 75, 12, 88];
                          const pos =
                            candidates.find(clearOfDoors) ?? candidates[0];
                          const along = 20 + (pos / 100) * spanPx;
                          const cx = horizontal
                            ? along
                            : wallNum === 4
                            ? 25
                            : 35 + roomW;
                          const cy = horizontal
                            ? wallNum === 1
                              ? 25
                              : 35 + roomH
                            : along;
                          return (
                            <g key={`wall-tag-${wallNum}`}>
                              <rect
                                x={cx - 10}
                                y={cy - 6.5}
                                width="20"
                                height="13"
                                rx="3"
                                fill={PLAN.paper}
                                stroke={PLAN.wall}
                                strokeWidth="1"
                              />
                              <text
                                x={cx}
                                y={cy}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize="9"
                                fontWeight="700"
                                fontFamily="Arial, Helvetica, sans-serif"
                                fill={PLAN.ink}
                              >
                                {`#${wallNum}`}
                              </text>
                            </g>
                          );
                        })}
                      </g>
                    </svg>
                    <PlanDropPreview preview={planDropPreview} />
                  </div>

                  {/* Mobile Zoom Controls */}
                  {isMobile && viewMode === "floor" && (
                    <div className="fixed bottom-20 right-4 z-30 flex flex-col gap-2 lg:hidden">
                      <button
                        type="button"
                        onClick={handleZoomIn}
                        className="bg-white rounded-lg shadow-lg p-3 hover:bg-gray-50 transition-colors"
                        aria-label={t("designer.zoomIn")}
                      >
                        <Plus className="h-6 w-6 text-gray-700" />
                      </button>
                      <button
                        type="button"
                        onClick={handleZoomOut}
                        className="bg-white rounded-lg shadow-lg p-3 hover:bg-gray-50 transition-colors"
                        aria-label={t("designer.zoomOut")}
                      >
                        <Minus className="h-6 w-6 text-gray-700" />
                      </button>
                      <div className="bg-white rounded-lg shadow-lg px-3 py-2 text-xs text-gray-700 text-center font-medium">
                        {Math.round(zoom * 100)}%
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Wall Elevation View */
                /* Alternative view showing cabinet placement on selected wall */
                <div>
                  <h2 className="text-lg font-semibold mb-4">
                    {t("designer.wallElevation", {
                      wall: getWallLabel(selectedWall),
                    })}
                  </h2>
                  <p id="kd-wall-help" className="text-sm text-gray-700 mb-4">
                    {t("designer.wallViewKeyboardHelp")}
                  </p>
                  <WallView
                    currentRoomData={currentRoomData}
                    selectedWall={selectedWall}
                    selectedElement={selectedElement}
                    elementTypes={elementTypes}
                    scale={scale}
                    wallViewRef={wallViewRef}
                    isDraggingWallView={isDraggingWallView}
                    isTouch={isTouch}
                    getElementsOnWall={getElementsOnWall}
                    handleMouseMove={handleMouseMove}
                    handleMouseUp={handleMouseUp}
                    handleWallViewMouseDown={handleWallViewMouseDown}
                    onElementKeyDown={handleWallElementKeyDown}
                    getElementLabel={getWallItemLabel}
                    describedBy="kd-wall-help"
                    wallLabel={getWallLabel(selectedWall)}
                  />
                </div>
              )}
              {/* Element List Summary */}
              <ElementList
                currentRoomData={currentRoomData}
                viewMode={viewMode}
                elementTypes={elementTypes}
                scale={scale}
                selectedElement={selectedElement}
                onSelectElement={openElementProperties}
              />
            </div>
          </div>
        </div>
        {/* Mobile: Properties Button - appears when cabinet selected */}
        {selectedElement && isMobile && !isPanelOpen && (
          <button
            type="button"
            onClick={(e) => openElementProperties(selectedElement, e.currentTarget)}
            className="fixed bottom-4 right-4 z-40 bg-blue-700 text-white rounded-full p-4 shadow-lg hover:bg-blue-800 active:bg-blue-800 active:scale-95 transition-all flex items-center justify-center gap-2"
            style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <svg
              aria-hidden="true"
              focusable="false"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6"></path>
              <path d="m4.2 4.2 4.2 4.2m5.6 5.6 4.2 4.2"></path>
              <path d="M1 12h6m6 0h6"></path>
              <path d="m4.2 19.8 4.2-4.2m5.6-5.6 4.2-4.2"></path>
            </svg>
            <span className="font-medium">{t("designer.properties")}</span>
          </button>
        )}

        {/* Floating Properties Panel */}
        {/* Desktop: Show immediately when element selected */}
        {/* Mobile: Show only when button clicked */}
        {selectedElement && (!isMobile || isPanelOpen) && (
          <FloatingPropertiesPanel
            selectedElement={selectedElement}
            currentRoomData={currentRoomData}
            setCurrentRoomData={setCurrentRoomData}
            elementTypes={elementTypes}
            updateElement={updateElement}
            deleteElement={(elementId) => {
              const element = currentRoomData.elements.find(
                (el) => el.id === elementId
              );
              if (element) removeElementWithFocus(element);
            }}
            rotateElement={rotateElement}
            rotateCornerCabinet={rotateCornerCabinet}
            materialMultipliers={materialMultipliers}
            scale={scale}
            onPositionChange={handlePositionChange}
            focusRequest={panelFocusRequest}
            onFocusRequestHandled={() => setPanelFocusRequest(false)}
            onClose={closePropertiesPanel}
          />
        )}
      </main>
      {/* Quote Form Modal */}
      <QuoteForm
        isVisible={showQuoteForm}
        onClose={() => setShowQuoteForm(false)}
        clientInfo={clientInfo}
        setClientInfo={setClientInfo}
        kitchenData={kitchenData}
        bathroomData={bathroomData}
        calculateTotalPrice={calculateTotalPrice}
        onSendQuote={handleSendQuote}
      />
      {/* The selected pantry's settings */}
      {selectedPantry &&
        viewMode === "floor" &&
        pantries.some((p) => p.id === selectedPantry) && (
          <PantryPanel
            pantry={pantries.find((p) => p.id === selectedPantry)}
            roomData={currentRoomData}
            scale={scale}
            name={pantryLabel(pantries.find((p) => p.id === selectedPantry))}
            wallName={(n) => getWallLabel(n)}
            focusRequest={pantryPanelFocus}
            onFocusRequestHandled={() => setPantryPanelFocus(false)}
            onResize={(dims) => handlePantryResize(selectedPantry, dims)}
            onOpeningChange={(changes) =>
              handlePantryOpening(selectedPantry, changes)
            }
            onExistedPriorChange={(flag) =>
              handlePantryExistedPrior(selectedPantry, flag)
            }
            onRemove={() => requestRemovePantry(selectedPantry)}
            onClose={closePantryPanel}
          />
        )}
      {/* Remove a pantry with items against its walls: ask first */}
      <PantryDeleteDialog
        request={pantryDelete}
        onRemovePantry={() => finishPantryDelete("pantry")}
        onRemoveBoth={() => finishPantryDelete("both")}
        onCancel={() => finishPantryDelete("cancel")}
      />
      {/* Remove a refrigerator cabinet with a fridge in it: ask first */}
      <HousingDeleteDialog
        request={housingDelete}
        elementTypes={elementTypes}
        onRemoveCabinet={() => finishHousingDelete("cabinet")}
        onRemoveBoth={() => finishHousingDelete("both")}
        onCancel={() => finishHousingDelete("cancel")}
      />
      {/* AR Viewer Modal */}
      <ARViewer
        isOpen={showARViewer}
        onClose={() => setShowARViewer(false)}
        roomData={currentRoomData}
        elementTypes={elementTypes}
        scale={scale}
        activeRoom={activeRoom}
      />
    </>
  );
};
export default KitchenDesigner;