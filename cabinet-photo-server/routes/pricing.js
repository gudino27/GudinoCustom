// This file contains all pricing-related API endpoints
// REQUIRED IMPORTS
const express = require("express");
const router = express.Router();
const { authenticateUser, requireRole } = require("../middleware/auth");
const { validatePricing, validateMaterials } = require("../middleware/validation");
const { getDb, queueDbOperation } = require("../db-helpers");
const { handleError } = require("../utils/error-handler");
const {
  DESIGNER_BASE_PRICES,
  DEFAULT_WALL_PRICING,
  WALL_PRICING_TABLE,
} = require("../utils/price-defaults");
// Prices come back from the database over the defaults, so an item the
// designer offers always has a price even before the seed in init-database.js
// has run (appliances and fixtures default to 0 = not in the estimate).
// Adding keys keeps the response backward compatible.
// Get all the pricing data
router.get("/", async (req, res) => {
  try {
    const db = await getDb();
    // Get cabinet prices
    const cabinetPrices = await db.all("SELECT * FROM cabinet_prices");
    const basePrices = { ...DESIGNER_BASE_PRICES };
    cabinetPrices.forEach((item) => {
      basePrices[item.cabinet_type] = parseFloat(item.base_price);
    });
    // Get material multipliers - return new bilingual array format
    const materials = await db.all("SELECT * FROM material_pricing");
    const materialMultipliers = materials.map((item) => ({
      id: item.id,
      nameEn: item.material_name_en,
      nameEs: item.material_name_es,
      multiplier: parseFloat(item.multiplier),
    }));
    // Get color pricing
    const colors = await db.all("SELECT * FROM color_pricing");
    const colorPricing = {};
    colors.forEach((item) => {
      const key = isNaN(item.color_count)
        ? item.color_count
        : parseInt(item.color_count);
      colorPricing[key] = parseFloat(item.price_addition);
    });
    // Get wall pricing
    const wallPricing = { ...DEFAULT_WALL_PRICING };
    try {
      const walls = await db.all("SELECT * FROM wall_pricing");
      if (walls.length > 0) {
        walls.forEach((item) => {
          wallPricing[item.modification_type] = parseFloat(item.price);
        });
      }
    } catch (wallError) {
      console.log("Wall pricing table does not exist yet, using defaults");
    }
    console.log("Loaded prices with materials:", {
      basePrices,
      materialMultipliers,
      colorPricing,
      wallPricing,
    });
    res.json({
      basePrices,
      materialMultipliers,
      colorPricing,
      wallPricing,
    });
  } catch (error) {
    handleError(error, "Failed to load prices", res, 500);
  }
});
// Update the cabinet prices
router.put("/cabinets", authenticateUser, requireRole('super_admin'), validatePricing, async (req, res) => {
  try {
    const prices = req.body;
    console.log("Updating cabinet prices:", prices);
    await queueDbOperation(async () => {
      const db = await getDb();
      // Use a transaction for consistency
      await db.run("BEGIN TRANSACTION");
      try {
        // Upsert each cabinet price: a type without a row yet (a new
        // designer item, an appliance the shop starts pricing) is inserted
        // instead of the UPDATE silently doing nothing
        for (const [cabinetType, price] of Object.entries(prices)) {
          await db.run(
            `INSERT INTO cabinet_prices (cabinet_type, base_price, updated_at)
             VALUES (?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(cabinet_type) DO UPDATE
             SET base_price = excluded.base_price, updated_at = CURRENT_TIMESTAMP`,
            [cabinetType, price]
          );
        }
        await db.run("COMMIT");
      } 
      catch (error) {
        await db.run("ROLLBACK");
        throw error;
      }
    });
    res.json({ success: true, message: "Cabinet prices updated successfully" });
  } catch (error) {
    handleError(error, "Failed to update cabinet prices", res, 500);
  }
});
router.get("/cabinets", async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all(
      "SELECT * FROM cabinet_prices ORDER BY cabinet_type"
    );
    const cabinets = { ...DESIGNER_BASE_PRICES };
    rows.forEach((row) => {
      cabinets[row.cabinet_type] = parseFloat(row.base_price);
    });
    console.log("Loaded cabinet prices:", cabinets);
    res.json(cabinets);
  } catch (error) {
    handleError(error, "Failed to fetch cabinet prices", res, 500);
  }
});
router.get("/materials", async (req, res) => {
  try {
    const db = await getDb();
    const materials = await db.all(
      "SELECT * FROM material_pricing ORDER BY material_name_en"
    );
    // Return bilingual format for frontend
    const materialArray = materials.map((m) => ({
      id: m.id,
      nameEn: m.material_name_en,
      nameEs: m.material_name_es,
      multiplier: parseFloat(m.multiplier),
      updated_at: m.updated_at,
      updated_by: m.updated_by,
    }));
    //await db.close();
    console.log("Loaded materials:", materialArray);
    res.json(materialArray);
  } catch (error) {
    handleError(error, "Failed to fetch materials", res, 500);
  }
});
// Update the material multipliers
router.put("/materials", authenticateUser, requireRole('super_admin'), validateMaterials, async (req, res) => {
  try {
    const materials = req.body;
    console.log("Saving materials:", materials);
    await queueDbOperation(async () => {
      const db = await getDb();
      // Start a transaction
      await db.run("BEGIN TRANSACTION");
      try {
        // Delete all existing materials
        await db.run("DELETE FROM material_pricing");
        // Insert all materials (including new ones)
        const stmt = await db.prepare(
          "INSERT INTO material_pricing (material_name_en, material_name_es, multiplier) VALUES (?, ?, ?)"
        );
        for (const material of materials) {
          await stmt.run(material.nameEn, material.nameEs, material.multiplier);
          console.log(
            `Inserted material: ${material.nameEn}/${material.nameEs} with multiplier: ${material.multiplier}`
          );
        }
        await stmt.finalize();
        await db.run("COMMIT");
        console.log("Materials saved successfully");
      } catch (error) {
        await db.run("ROLLBACK");
        throw error;
      }
    });
    res.json({ success: true, message: "Materials saved successfully" });
  } catch (error) {
    handleError(error, "Failed to save materials", res, 500);
  }
});
// Update the color pricing
router.put("/colors", authenticateUser, requireRole('super_admin'), validatePricing, async (req, res) => {
  try {
    const colors = req.body;
    console.log("Updating color pricing:", colors);

    await queueDbOperation(async () => {
      const db = await getDb();
      // Use a transaction for consistency
      await db.run("BEGIN TRANSACTION");
      try {
        // Update each color price
        for (const [colorCount, price] of Object.entries(colors)) {
          await db.run(
            `UPDATE color_pricing 
             SET price_addition = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE color_count = ?`,
            [price, colorCount]
          );
        }
        await db.run("COMMIT");
      } catch (error) {
        await db.run("ROLLBACK");
        throw error;
      }
    });
    res.json({ success: true, message: "Color pricing updated successfully" });
  } catch (error) {
    handleError(error, "Failed to update color pricing", res, 500);
  }
});
router.get("/colors", async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all(
      "SELECT * FROM color_pricing ORDER BY color_count"
    );
    const colors = {};
    rows.forEach((row) => {
      const key = isNaN(row.color_count)
        ? row.color_count
        : parseInt(row.color_count);
      colors[key] = parseFloat(row.price_addition);
    });
    console.log("Loaded color pricing:", colors);
    res.json(colors);
  } catch (error) {
    handleError(error, "Failed to fetch color pricing", res, 500);
  }
});
router.get("/history", async (req, res) => {
  try {
    const db = await getDb();
    const history = await db.all(`
      SELECT 'cabinet' as type, cabinet_type as item, base_price as value, updated_at 
      FROM cabinet_prices 
      UNION ALL
      SELECT 'material' as type, (material_name_en || ' / ' || material_name_es) as item, multiplier as value, updated_at 
      FROM material_pricing
      UNION ALL
      SELECT 'color' as type, color_count as item, price_addition as value, updated_at 
      FROM color_pricing
      ORDER BY updated_at DESC
      LIMIT 50
    `);
    res.json(history);
  } catch (error) {
    handleError(error, "Failed to fetch price history", res, 500);
  }
});
// Wall pricing endpoints
router.get("/walls", async (req, res) => {
  try {
    const db = await getDb();
    // Ensure wall_pricing table exists
    await db.run(WALL_PRICING_TABLE);
    // Database values over the defaults (addWall, removeWall, pantryWall,
    // casedOpening)
    const rows = await db.all(
      "SELECT * FROM wall_pricing ORDER BY modification_type"
    );
    const walls = { ...DEFAULT_WALL_PRICING };
    rows.forEach((row) => {
      walls[row.modification_type] = parseFloat(row.price);
    });
    console.log("Loaded wall pricing:", walls);
    res.json(walls);
  } catch (error) {
    handleError(error, "Failed to fetch wall pricing", res, 500);
  }
});
router.put("/walls", authenticateUser, requireRole('super_admin'), validatePricing, async (req, res) => {
  try {
    const wallPricing = req.body;
    console.log("Updating wall pricing:", wallPricing);
    await queueDbOperation(async () => {
      const db = await getDb();
      // Ensure wall_pricing table exists
      await db.run(WALL_PRICING_TABLE);
      // Use a transaction for better performance and consistency
      await db.run("BEGIN TRANSACTION");
      try {
        // Update each wall price (using REPLACE to handle both INSERT and UPDATE)
        for (const [modificationType, price] of Object.entries(wallPricing)) {
          await db.run(
            `
            REPLACE INTO wall_pricing (modification_type, price, updated_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
          `,
            [modificationType, price]
          );
        }

        await db.run("COMMIT");
      } catch (error) {
        await db.run("ROLLBACK");
        throw error;
      }
    });
    console.log("Wall pricing updated successfully");
    res.json({ success: true });
  } catch (error) {
    handleError(error, "Failed to update wall pricing", res, 500);
  }
});
// Wall availability endpoints
router.get("/wall-availability", async (req, res) => {
  try {
    const db = await getDb();

    // Try to get wall availability from database
    const rows = await db.all(
      "SELECT * FROM wall_availability ORDER BY service_type"
    );
    const availability = {};
    if (rows.length > 0) {
      rows.forEach((row) => {
        availability[row.service_type + "Enabled"] = Boolean(row.is_enabled);
      });
    } else {
      // Default values if table is empty
      availability.addWallEnabled = true;
      availability.removeWallEnabled = true;
    }
    //await db.close();
    res.json(availability);
  } catch (error) {
    handleError(error, "Failed to fetch wall availability", res, 500);
  }
});
router.put("/wall-availability", authenticateUser, requireRole('super_admin'), async (req, res) => {
  try {
    const db = await getDb();
    const wallAvailability = req.body;
    console.log("Updating wall availability:", wallAvailability);
    // Ensure wall_availability table exists
    await db.run(`
      CREATE TABLE IF NOT EXISTS wall_availability (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_type TEXT UNIQUE NOT NULL,
        is_enabled BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Update each wall availability setting
    for (const [key, enabled] of Object.entries(wallAvailability)) {
      const serviceType = key.replace("Enabled", "");
      await db.run(
        `
        REPLACE INTO wall_availability (service_type, is_enabled, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `,
        [serviceType, enabled ? 1 : 0]
      );
    }
    //await db.close();
    console.log("Wall availability updated successfully");
    res.json({ success: true });
  } catch (error) {
    handleError(error, "Failed to update wall availability", res, 500);
  }
});
// EXPORTS
module.exports = router;
