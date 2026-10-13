// Default prices for every item the customer designer offers, and the seed
// that puts any missing ones in the database.
//
// Keep these in step with kitchen-designer/src/utils/designer/pricing.js
// (DEFAULT_BASE_PRICES / DEFAULT_WALL_PRICING); the frontend test
// tests/pricing/backendDefaults.test.js fails when they drift apart.
//
// cabinet_prices (cabinet_type -> base_price)
//   Cabinets: price of a 24" wide cabinet in the standard finish; the designer
//   scales it by width / 24 and the material multiplier.
//   Appliances and fixtures: 0 means "not in the estimate" (the shop does not
//   sell them). A price above 0 is added once per item, flat.
//
// wall_pricing (modification_type -> price)
//   addWall / removeWall  custom walls drawn / room walls removed
//   pantryWall            each partition wall a walk-in pantry adds (straight
//                         pantry 1, L 2, U 3; sides against a room wall are
//                         not built, so not charged)
//   casedOpening          each pantry's cased opening (doorway without a door)

const DESIGNER_BASE_PRICES = {
  // Kitchen cabinets
  base: 250,
  'sink-base': 320,
  wall: 180,
  tall: 450,
  corner: 380,
  'drawer-base': 280,
  'double-drawer-base': 350,
  'glass-wall': 220,
  'open-shelf': 160,
  'island-base': 580,
  'peninsula-base': 420,
  pantry: 520,
  'refrigerator-cabinet': 400,
  'corner-wall': 210,
  // Bathroom cabinets
  vanity: 280,
  'vanity-sink': 350,
  'double-vanity': 650,
  'floating-vanity': 420,
  'corner-vanity': 380,
  'vanity-tower': 320,
  medicine: 120,
  'medicine-mirror': 180,
  linen: 350,
  'linen-tower': 420,
  // Kitchen appliances (0 = not in the estimate)
  refrigerator: 0,
  stove: 0,
  dishwasher: 0,
  microwave: 0,
  'wine-cooler': 0,
  'range-hood': 0,
  'double-oven': 0,
  // Bathroom fixtures (0 = not in the estimate)
  toilet: 0,
  bathtub: 0,
  shower: 0,
};

const DEFAULT_WALL_PRICING = {
  addWall: 1500,
  removeWall: 2000,
  // A pantry wall used to be charged as an added custom wall, so it starts at
  // the addWall price (the seed copies the shop's own addWall price).
  pantryWall: 1500,
  casedOpening: 0,
};

const WALL_PRICING_TABLE = `
  CREATE TABLE IF NOT EXISTS wall_pricing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    modification_type TEXT UNIQUE NOT NULL,
    price REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

/**
 * Insert the price keys the designer needs that are not in the database yet.
 * Idempotent: INSERT OR IGNORE on the UNIQUE key never touches a price the
 * shop already set. Returns the keys it inserted.
 *
 * @param {import('sqlite').Database} db
 */
async function seedMissingPrices(db) {
  const inserted = { cabinetPrices: [], wallPricing: [] };

  for (const [type, price] of Object.entries(DESIGNER_BASE_PRICES)) {
    const result = await db.run(
      'INSERT OR IGNORE INTO cabinet_prices (cabinet_type, base_price) VALUES (?, ?)',
      [type, price]
    );
    if (result && result.changes > 0) inserted.cabinetPrices.push(type);
  }

  await db.exec(WALL_PRICING_TABLE);
  // Before this seed a pantry wall was charged at the shop's addWall price;
  // start pantryWall there so estimates do not change until the shop edits it.
  const addWall = await db.get(
    "SELECT price FROM wall_pricing WHERE modification_type = 'addWall'"
  );
  const wallDefaults = {
    ...DEFAULT_WALL_PRICING,
    pantryWall:
      addWall && Number.isFinite(Number(addWall.price))
        ? Number(addWall.price)
        : DEFAULT_WALL_PRICING.pantryWall,
  };
  for (const [type, price] of Object.entries(wallDefaults)) {
    const result = await db.run(
      'INSERT OR IGNORE INTO wall_pricing (modification_type, price) VALUES (?, ?)',
      [type, price]
    );
    if (result && result.changes > 0) inserted.wallPricing.push(type);
  }

  return inserted;
}

module.exports = {
  DESIGNER_BASE_PRICES,
  DEFAULT_WALL_PRICING,
  WALL_PRICING_TABLE,
  seedMissingPrices,
};
