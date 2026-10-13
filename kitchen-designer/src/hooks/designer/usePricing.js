import { useState, useEffect } from 'react';
import {
  DEFAULT_BASE_PRICES,
  DEFAULT_COLOR_PRICING,
  DEFAULT_WALL_PRICING,
  calculateRoomPrice,
  normalizeMaterialMultipliers,
  resolveMaterialMultipliers,
  resolveWallPricing,
  withDefaults,
} from '../../utils/designer/pricing';
export const usePricing = ({
  sharedMaterialMultipliers,
  setSharedMaterialMultipliers,
  currentRoomData,
}) => {
  const API_BASE =
    process.env.REACT_APP_API_URL || "https://api.gudinocustom.com";

  // Base prices for each cabinet/appliance type
  const [basePrices, setBasePrices] = useState(DEFAULT_BASE_PRICES);

  // Material cost multipliers. The shared context starts as {}, which is
  // truthy, so check for entries rather than using `shared || defaults`.
  const [materialMultipliers, setMaterialMultipliers] = useState(() =>
    resolveMaterialMultipliers(sharedMaterialMultipliers)
  );

  // Color pricing
  const [colorPricing, setColorPricing] = useState(DEFAULT_COLOR_PRICING);

  // Wall modification pricing (set by admin)
  const [wallPricing, setWallPricing] = useState(DEFAULT_WALL_PRICING);

  // Wall service availability (controlled by admin)
  const [wallAvailability, setWallAvailability] = useState({
    addWallEnabled: true,
    removeWallEnabled: true,
  });

  const [pricesLoading, setPricesLoading] = useState(true);
  const loadPrices = async () => {
    try {
      const [pricesResponse, wallAvailResponse] = await Promise.all([
        fetch(`${API_BASE}/api/prices`),
        fetch(`${API_BASE}/api/prices/wall-availability`),
      ]);

      if (pricesResponse.ok) {
        const data = await pricesResponse.json();
        // Missing or partial tables fall back to the defaults, not undefined
        // (a type the API does not know yet, e.g. refrigerator-cabinet, keeps
        // its default price)
        setBasePrices(withDefaults(DEFAULT_BASE_PRICES, data.basePrices));

        // Convert new bilingual array format to old object format for backward compatibility
        const materialObject = normalizeMaterialMultipliers(data.materialMultipliers);
        if (Object.keys(materialObject).length > 0) {
          setMaterialMultipliers(materialObject);
          setSharedMaterialMultipliers(materialObject); // Update shared context
        }
        setColorPricing(withDefaults(DEFAULT_COLOR_PRICING, data.colorPricing));

        if (data.wallPricing) {
          // pantryWall / casedOpening; an older table prices pantry walls as addWall
          setWallPricing(resolveWallPricing(data.wallPricing));
        }
      } else {
        console.error("Failed to load prices, using defaults");
      }

      if (wallAvailResponse.ok) {
        const wallAvailData = await wallAvailResponse.json();
        setWallAvailability(wallAvailData);
      } else {
        console.error("Failed to load wall availability, using defaults");
      }
    } catch (error) {
      console.error("Error loading prices/settings:", error);
      // Keep default prices if API fails
    } finally {
      setPricesLoading(false);
    }
  };
  const calculateTotalPrice = (roomData = null) =>
    calculateRoomPrice(roomData || currentRoomData, {
      basePrices,
      materialMultipliers,
      colorPricing,
      wallPricing,
    });

  // Load prices on component mount
  useEffect(() => {
    loadPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync with shared pricing context when pricing version changes
  useEffect(() => {
    if (
      sharedMaterialMultipliers &&
      Object.keys(sharedMaterialMultipliers).length > 0
    ) {
      // Convert new bilingual array format to old object format if needed
      const materialObject = normalizeMaterialMultipliers(sharedMaterialMultipliers);
      if (Object.keys(materialObject).length === 0) return;
      setMaterialMultipliers(materialObject);
    }
  }, [sharedMaterialMultipliers]);

  return {
    // State
    basePrices,
    materialMultipliers,
    colorPricing,
    wallPricing,
    wallAvailability,
    pricesLoading,
    // Functions
    loadPrices,
    calculateTotalPrice,
    // Setters (if needed for external updates)
    setBasePrices,
    setMaterialMultipliers,
    setColorPricing,
    setWallPricing,
    setWallAvailability,
  };
};