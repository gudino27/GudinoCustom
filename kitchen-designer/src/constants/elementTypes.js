// Element type definitions for kitchen and bathroom design
// Contains all available cabinets, appliances, and fixtures with their specifications
// Organized by room type (kitchen/bathroom) and category (cabinet/appliance)

export const elementTypes = {
  // ========== KITCHEN CABINETS ==========
  'base': {
    name: 'Base Cabinet',
    defaultWidth: 24,
    defaultDepth: 24,
    fixedHeight: 34.5,        // Standard counter height
    color: '#d3d3d3',
    category: 'cabinet',
    zIndex: 1,                // Render order (lower = behind)
    room: 'kitchen'
  },
  'sink-base': {
    name: 'Sink Base Cabinet',
    defaultWidth: 33,         // Wider to accommodate sink
    defaultDepth: 24,
    fixedHeight: 34.5,
    color: '#d3d3d3',
    category: 'cabinet',
    zIndex: 1,
    room: 'kitchen',
    hasSink: true             // Special rendering flag
  },
  'wall': {
    name: 'Wall Cabinet',
    defaultWidth: 24,
    defaultDepth: 12,         // Shallower depth for wall mounting
    minHeight: 12,            // Minimum height constraint
    defaultHeight: 30,
    color: '#d3d3d3',
    category: 'cabinet',
    zIndex: 2,                // Render above base cabinets
    room: 'kitchen',
    mountHeight: 54           // Default distance from floor to bottom of cabinet
  },
  'tall': {
    name: 'Tall Cabinet',
    defaultWidth: 24,
    defaultDepth: 24,
    minHeight: 40,            // Minimum height for tall cabinets
    defaultHeight: 84,        // Floor to ceiling typical
    color: '#d3d3d3',
    category: 'cabinet',
    zIndex: 1,
    room: 'kitchen'
  },
  'corner': {
    name: 'Corner Cabinet (Lazy Susan)',
    defaultWidth: 36,         // Square corner cabinet
    defaultDepth: 36,
    fixedHeight: 34.5,
    color: '#d3d3d3',
    category: 'cabinet',
    shape: 'corner',          // Special shape rendering
    zIndex: 1,
    room: 'kitchen'
  },
  'drawer-base': {
    name: 'Drawer Base Cabinet',
    defaultWidth: 18,
    defaultDepth: 24,
    fixedHeight: 34.5,
    color: '#c8c8c8',         // Slightly different color
    category: 'cabinet',
    zIndex: 1,
    room: 'kitchen',
    hasDrawers: true          // Special rendering flag
  },
  'double-drawer-base': {
    name: 'Double Drawer Base',
    defaultWidth: 30,
    defaultDepth: 24,
    fixedHeight: 34.5,
    color: '#c8c8c8',
    category: 'cabinet',
    zIndex: 1,
    room: 'kitchen',
    hasDrawers: true
  },
  'glass-wall': {
    name: 'Glass Front Wall Cabinet',
    defaultWidth: 24,
    defaultDepth: 12,
    minHeight: 12,
    defaultHeight: 30,
    color: '#e8e8e8',         // Lighter color for glass
    category: 'cabinet',
    zIndex: 2,
    room: 'kitchen',
    mountHeight: 54,
    hasGlass: true            // Special rendering flag
  },
  'open-shelf': {
    name: 'Open Shelf Cabinet',
    defaultWidth: 30,
    defaultDepth: 12,
    minHeight: 12,
    defaultHeight: 30,
    color: '#b8b8b8',
    category: 'cabinet',
    zIndex: 2,
    room: 'kitchen',
    mountHeight: 54,
    isOpen: true              // Special rendering flag
  },
  'island-base': {
    name: 'Kitchen Island',
    defaultWidth: 48,         // Larger for island
    defaultDepth: 36,
    fixedHeight: 34.5,
    color: '#a8a8a8',         // Different color for islands
    category: 'cabinet',
    zIndex: 1,
    room: 'kitchen',
    isIsland: true            // Special positioning and rendering
  },
  'peninsula-base': {
    name: 'Peninsula Cabinet',
    defaultWidth: 36,
    defaultDepth: 24,
    fixedHeight: 34.5,
    color: '#a8a8a8',
    category: 'cabinet',
    zIndex: 1,
    room: 'kitchen',
    isPeninsula: true         // Special positioning flag
  },
  'pantry': {
    name: 'Pantry Cabinet',
    defaultWidth: 24,
    defaultDepth: 24,
    minHeight: 60,
    defaultHeight: 84,
    color: '#d3d3d3',
    category: 'cabinet',
    zIndex: 1,
    room: 'kitchen',
    isPantry: true            // Special rendering flag
  },
  'refrigerator-cabinet': {
    name: 'Refrigerator Cabinet',
    defaultWidth: 41,         // 36" fridge opening + a 2.5" side panel either side
    defaultDepth: 26,         // the engine's fridge surround depth
    minHeight: 76,
    defaultHeight: 84,        // Full height like the tall and pantry cabinets
    color: '#d3d3d3',
    category: 'cabinet',
    zIndex: 0,                // Drawn under the refrigerator it houses
    room: 'kitchen',
    houses: ['refrigerator'], // Appliances that may stand inside it (utils/designer/housing.js)
    housing: {
      sidePanel: 2.5,         // Side panel either side of the opening
      topHeight: 12,          // Cabinet over the opening; the opening is the rest
      openFront: true         // The fridge may stand proud of the cabinet front
    },
    openingWidths: [30, 33, 36, 42, 48] // Fridge sizes offered in the properties panel
  },
  'corner-wall': {
    name: 'Corner Wall Cabinet',
    defaultWidth: 24,
    defaultDepth: 24,
    minHeight: 12,
    defaultHeight: 30,
    color: '#d3d3d3',
    category: 'cabinet',
    shape: 'corner',
    zIndex: 2,
    room: 'kitchen',
    mountHeight: 54
  },

  // ========== BATHROOM CABINETS ==========
  'vanity': {
    name: 'Vanity Cabinet',
    defaultWidth: 30,
    defaultDepth: 21,         // Standard vanity depth
    fixedHeight: 32,          // Lower than kitchen counters
    color: '#d3d3d3',
    category: 'cabinet',
    zIndex: 1,
    room: 'bathroom'
  },
  'vanity-sink': {
    name: 'Vanity with Sink',
    defaultWidth: 36,         // Wider for sink accommodation
    defaultDepth: 21,
    fixedHeight: 32,
    color: '#d3d3d3',
    category: 'cabinet',
    zIndex: 1,
    room: 'bathroom',
    hasSink: true
  },
  'medicine': {
    name: 'Medicine Cabinet',
    defaultWidth: 24,
    defaultDepth: 6,          // Very shallow wall mount
    fixedHeight: 30,
    color: '#d3d3d3',
    category: 'cabinet',
    zIndex: 2,
    room: 'bathroom',
    mountHeight: 48           // Higher mounting for mirror access
  },
  'linen': {
    name: 'Linen Cabinet',
    defaultWidth: 18,         // Narrow width
    defaultDepth: 21,
    defaultHeight: 84,        // Tall storage
    minHeight: 60,
    color: '#d3d3d3',
    category: 'cabinet',
    zIndex: 1,
    room: 'bathroom'
  },
  'double-vanity': {
    name: 'Double Vanity',
    defaultWidth: 60,         // Wide for two sinks
    defaultDepth: 21,
    fixedHeight: 32,
    color: '#c8c8c8',
    category: 'cabinet',
    zIndex: 1,
    room: 'bathroom',
    hasSink: true,
    isDouble: true
  },
  'floating-vanity': {
    name: 'Floating Vanity',
    defaultWidth: 48,
    defaultDepth: 18,         // Shallower for modern look
    fixedHeight: 32,
    color: '#b8b8b8',
    category: 'cabinet',
    zIndex: 1,
    room: 'bathroom',
    hasSink: true,
    isFloating: true          // Special rendering flag
  },
  'corner-vanity': {
    name: 'Corner Vanity',
    defaultWidth: 30,
    defaultDepth: 30,
    fixedHeight: 32,
    color: '#d3d3d3',
    category: 'cabinet',
    shape: 'corner',
    zIndex: 1,
    room: 'bathroom',
    hasSink: true
  },
  'vanity-tower': {
    name: 'Vanity Tower',
    defaultWidth: 12,         // Very narrow
    defaultDepth: 21,
    defaultHeight: 84,
    minHeight: 60,
    color: '#d3d3d3',
    category: 'cabinet',
    zIndex: 1,
    room: 'bathroom',
    isTower: true
  },
  'medicine-mirror': {
    name: 'Medicine Cabinet w/ Mirror',
    defaultWidth: 30,
    defaultDepth: 6,
    fixedHeight: 36,          // Larger than basic medicine cabinet
    color: '#e8e8e8',
    category: 'cabinet',
    zIndex: 2,
    room: 'bathroom',
    mountHeight: 48,
    hasMirror: true
  },
  'linen-tower': {
    name: 'Linen Tower',
    defaultWidth: 24,
    defaultDepth: 18,         // Deeper than regular linen
    defaultHeight: 84,
    minHeight: 72,
    color: '#d3d3d3',
    category: 'cabinet',
    zIndex: 1,
    room: 'bathroom',
    isTower: true
  },

  // ========== KITCHEN APPLIANCES ==========
  'refrigerator': {
    name: 'Refrigerator',
    defaultWidth: 36,         // Standard fridge width
    defaultDepth: 30,
    fixedHeight: 70,          // Tall appliance
    color: '#e0e0e0',         // Different color for appliances
    category: 'appliance',
    zIndex: 1,
    room: 'kitchen'
  },
  'stove': {
    name: 'Stove/Range',
    defaultWidth: 30,
    defaultDepth: 26,
    fixedHeight: 36,          // Counter height appliance
    color: '#e0e0e0',
    category: 'appliance',
    zIndex: 1,
    room: 'kitchen'
  },
  'dishwasher': {
    name: 'Dishwasher',
    defaultWidth: 24,         // Standard DW width
    defaultDepth: 24,
    fixedHeight: 34,          // Fits under counter
    color: '#e0e0e0',
    category: 'appliance',
    zIndex: 1,
    room: 'kitchen'
  },
  'microwave': {
    name: 'Built-in Microwave',
    defaultWidth: 30,
    defaultDepth: 15,         // Shallower for built-in
    fixedHeight: 18,          // Standard microwave height
    color: '#e0e0e0',
    category: 'appliance',
    zIndex: 2,                // Wall mounted
    room: 'kitchen',
    mountHeight: 54           // Above counter height
  },
  'wine-cooler': {
    name: 'Wine Cooler',
    defaultWidth: 24,
    defaultDepth: 24,
    fixedHeight: 34,
    color: '#d0d0d0',         // Slightly different color
    category: 'appliance',
    zIndex: 1,
    room: 'kitchen'
  },
  'range-hood': {
    name: 'Range Hood',
    defaultWidth: 36,         // Wider than stove
    defaultDepth: 18,
    fixedHeight: 12,          // Low profile
    color: '#c0c0c0',
    category: 'appliance',
    zIndex: 2,                // Wall mounted
    room: 'kitchen',
    mountHeight: 66           // Above stove height
  },
  'double-oven': {
    name: 'Double Wall Oven',
    defaultWidth: 30,
    defaultDepth: 25,
    fixedHeight: 50,          // Tall for double unit
    color: '#e0e0e0',
    category: 'appliance',
    zIndex: 1,
    room: 'kitchen'
  },

  // ========== BATHROOM FIXTURES ==========
  'toilet': {
    name: 'Toilet',
    defaultWidth: 20,
    defaultDepth: 28,         // Includes tank depth
    fixedHeight: 30,
    color: '#e0e0e0',
    category: 'appliance',    // Grouped with appliances for simplicity
    zIndex: 1,
    room: 'bathroom'
  },
  'bathtub': {
    name: 'Bathtub',
    defaultWidth: 60,         // Standard tub length
    defaultDepth: 30,
    fixedHeight: 20,          // Tub height
    color: '#e0e0e0',
    category: 'appliance',
    zIndex: 1,
    room: 'bathroom'
  },
  'shower': {
    name: 'Shower',
    defaultWidth: 36,         // Square shower
    defaultDepth: 36,
    fixedHeight: 80,          // Shower enclosure height
    color: '#e0e0e0',
    category: 'appliance',
    zIndex: 1,
    room: 'bathroom'
  }
};