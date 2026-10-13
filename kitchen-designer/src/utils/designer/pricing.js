// Price estimate for the customer designer.
//
// A cabinet costs basePrice * materialMultiplier * (width / 24). Appliances
// and fixtures (fridge, stove, dishwasher, toilet...) are not sold by the shop:
// their base price is 0, which means "not in the estimate". If the shop sets a
// price above 0 in the admin Prices page, that price is added once per item
// (flat, no width or material scaling).
//
// Walls: removing a room wall costs removeWall, a custom wall costs addWall.
// A walk-in pantry is priced by what is built: pantryWall for each partition
// wall (straight 1, L 2, U 3; a side against a room wall is not built) and
// casedOpening for its opening. Pantry walls are not also charged as addWall.
//
// The same keys and defaults live in the backend
// (cabinet-photo-server/utils/price-defaults.js). Every lookup
// here has a fallback, because the tables come from the API and can be empty
// or incomplete: PricingContext starts with materialMultipliers = {}, which is
// truthy, so the hook used to take it as the multiplier table and every
// cabinet came out as basePrice * undefined = NaN.

export const DEFAULT_CABINET_PRICE = 250;

export const DEFAULT_BASE_PRICES = {
  // Kitchen Cabinets
  base: 250,
  "sink-base": 320,
  wall: 180,
  tall: 450,
  corner: 380,
  "drawer-base": 280,
  "double-drawer-base": 350,
  "glass-wall": 220,
  "open-shelf": 160,
  "island-base": 580,
  "peninsula-base": 420,
  pantry: 520,
  "refrigerator-cabinet": 400, // side panels + the cabinet over the fridge; x width / 24 like the rest
  "corner-wall": 210,
  // Bathroom Cabinets
  vanity: 280,
  "vanity-sink": 350,
  "double-vanity": 650,
  "floating-vanity": 420,
  "corner-vanity": 380,
  "vanity-tower": 320,
  medicine: 120,
  "medicine-mirror": 180,
  linen: 350,
  "linen-tower": 420,
  // Kitchen Appliances
  refrigerator: 0, // Pricing handled separately for appliances
  stove: 0,
  dishwasher: 0,
  microwave: 0,
  "wine-cooler": 0,
  "range-hood": 0,
  "double-oven": 0,
  // Bathroom Fixtures
  toilet: 0,
  bathtub: 0,
  shower: 0,
};

export const DEFAULT_MATERIAL_MULTIPLIERS = {
  laminate: 1.0, // Standard pricing (no multiplier)
  wood: 1.5, // 50% upcharge for solid wood
  plywood: 1.3, // 30% upcharge for plywood
};

export const DEFAULT_COLOR_PRICING = {
  1: 0, // Single color included
  2: 100, // Two colors add $100
  3: 200, // Three colors add $200
  custom: 500, // Custom colors add $500
};

export const DEFAULT_WALL_PRICING = {
  addWall: 1500, // Cost of each custom wall drawn in the room
  removeWall: 2000, // Cost to remove/modify a wall
  pantryWall: 1500, // Each partition wall of a walk-in pantry (was charged as addWall)
  casedOpening: 0, // Each pantry's cased opening (0 = included in the walls)
};

const toNumber = (value) => {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

const isNonEmptyObject = (value) =>
  !!value && typeof value === "object" && Object.keys(value).length > 0;

// Accepts the API's bilingual array ([{ nameEn, multiplier }]) or the old
// { name: multiplier } object. Keys are lower-cased; entries without a finite
// multiplier are dropped. Returns {} when nothing usable is left.
export const normalizeMaterialMultipliers = (raw) => {
  const result = {};
  const add = (name, multiplier) => {
    const n = toNumber(multiplier);
    if (typeof name === "string" && name && n !== null) {
      result[name.toLowerCase()] = n;
    }
  };
  if (Array.isArray(raw)) {
    raw.forEach((material) => add(material && material.nameEn, material && material.multiplier));
  } else if (raw && typeof raw === "object") {
    Object.entries(raw).forEach(([name, multiplier]) => add(name, multiplier));
  }
  return result;
};

// A usable multiplier table: the given one if it has entries, else the defaults.
export const resolveMaterialMultipliers = (raw) => {
  const normalized = normalizeMaterialMultipliers(raw);
  return Object.keys(normalized).length > 0 ? normalized : { ...DEFAULT_MATERIAL_MULTIPLIERS };
};

// Merge an API table over the defaults so a missing or partial table never
// leaves a lookup undefined.
export const withDefaults = (defaults, raw) =>
  isNonEmptyObject(raw) ? { ...defaults, ...raw } : { ...defaults };

// Wall prices over the defaults. A table saved before pantries had their own
// price has no pantryWall: it takes the shop's addWall price, which is what a
// pantry wall was charged before.
export const resolveWallPricing = (raw) => {
  const merged = withDefaults(DEFAULT_WALL_PRICING, raw);
  if (isNonEmptyObject(raw) && toNumber(raw.pantryWall) === null && toNumber(raw.addWall) !== null) {
    merged.pantryWall = toNumber(raw.addWall);
  }
  return merged;
};

export const materialMultiplierFor =(material, materialMultipliers) => {
  const table = materialMultipliers || {};
  const key = typeof material === "string" ? material.toLowerCase() : "laminate";
  const n = toNumber(table[key]);
  if (n !== null) return n;
  // Unknown material: price it as the standard (laminate) finish.
  const standard = toNumber(table.laminate);
  return standard !== null ? standard : 1.0;
};

export const cabinetPrice = (cabinet, material, { basePrices, materialMultipliers }) => {
  const basePrice = toNumber((basePrices || {})[cabinet.type]) || DEFAULT_CABINET_PRICE;
  const materialMultiplier = materialMultiplierFor(material, materialMultipliers);
  const width = toNumber(cabinet.width);
  // Size multiplier based on width (24" is standard)
  const sizeMultiplier = width !== null && width > 0 ? width / 24 : 1;
  return basePrice * materialMultiplier * sizeMultiplier;
};

// Flat price of an appliance / fixture, or null when it is not in the
// estimate (base price missing or 0).
export const appliancePrice = (type, basePrices) => {
  const n = toNumber((basePrices || {})[type]);
  return n !== null && n > 0 ? n : null;
};

// What one palette item adds to the estimate as placed (default width,
// standard finish), or null when it is not in the estimate.
export const itemPrice = (type, spec, { basePrices, materialMultipliers }) => {
  if (!spec) return null;
  if (spec.category === "cabinet") {
    return cabinetPrice({ type, width: spec.defaultWidth }, "laminate", { basePrices, materialMultipliers });
  }
  return appliancePrice(type, basePrices);
};

// Wall numbers of the pantry partitions that are standing in the room.
const pantryWallNumbers = (data) =>
  new Set(
    ((data && data.customWalls) || [])
      .filter((w) => w && w.pantryId && Number.isFinite(w.wallNumber))
      .map((w) => w.wallNumber)
  );

/**
 * Wall charges of a room: removed room walls, custom walls drawn, and the
 * partition walls and cased openings of its pantries. A pantry wall marked
 * as already there (in originalWalls) is not charged, like any other wall.
 */
export const wallCharges = (data, wallPricing) => {
  const prices = wallPricing || {};
  const price = (key) => toNumber(prices[key]) || 0;
  // A table from before pantries had their own price: charge them as custom walls
  const pantryWallPrice = toNumber(prices.pantryWall) ?? price("addWall");
  const originalWalls = (data && data.originalWalls) || [1, 2, 3, 4];
  const currentWalls = (data && data.walls) || [1, 2, 3, 4];
  const pantryWalls = pantryWallNumbers(data);

  // Only charge for removing walls that were originally present or were custom-added and saved
  const removed = ((data && data.removedWalls) || []).filter((wall) => originalWalls.includes(wall));
  // Walls beyond the original ones: pantry partitions, and the rest drawn by hand
  const added = currentWalls.filter((wall) => !originalWalls.includes(wall));
  const builtPantryWalls = added.filter((wall) => pantryWalls.has(wall));
  const customWalls = added.filter((wall) => !pantryWalls.has(wall));
  // The cased opening of a pantry whose walls are standing
  const openings = ((data && data.doors) || []).filter(
    (d) => d && d.type === "cased-opening" && d.pantryId && !d.existedPrior && currentWalls.includes(d.wallNumber)
  );

  const result = {
    removed: { count: removed.length, cost: removed.length * price("removeWall") },
    added: { count: customWalls.length, cost: customWalls.length * price("addWall") },
    pantryWalls: { count: builtPantryWalls.length, cost: builtPantryWalls.length * pantryWallPrice },
    openings: { count: openings.length, cost: openings.length * price("casedOpening") },
  };
  result.pantries = result.pantryWalls.cost + result.openings.cost;
  result.total = result.removed.cost + result.added.cost + result.pantries;
  return result;
};

/** Every charge of a room, and the total. */
export const priceBreakdown = (
  data,
  { basePrices, materialMultipliers, colorPricing, wallPricing }
) => {
  const elements = (data && data.elements) || [];
  const materials = (data && data.materials) || {};
  let cabinets = 0;
  let appliances = 0;
  let cabinetCount = 0;
  elements.forEach((el) => {
    if (el.category === "cabinet") {
      cabinetCount += 1;
      const material = materials[el.id] || "laminate";
      cabinets += cabinetPrice(el, material, { basePrices, materialMultipliers });
    } else {
      appliances += appliancePrice(el.type, basePrices) || 0;
    }
  });
  // Color upcharge based on number of colors selected (only with cabinets to color)
  const colors = cabinetCount > 0 ? toNumber((colorPricing || {})[data && data.colorCount]) || 0 : 0;
  const walls = wallCharges(data, wallPricing);
  return {
    cabinets,
    appliances,
    colors,
    walls,
    total: cabinets + appliances + colors + walls.total,
  };
};

export const calculateRoomPrice = (data, tables) => priceBreakdown(data, tables || {}).total;

// "$1234.56", matching the existing toFixed(2) display. A non-finite value
// shows as a dash instead of "$NaN" so one bad number can't blank the summary.
export const formatPrice = (value) =>
  typeof value === "number" && Number.isFinite(value) ? `$${value.toFixed(2)}` : "—";
