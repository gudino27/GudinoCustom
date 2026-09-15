import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const PricingDisplay = ({
  isVisible,
  activeRoom,
  currentRoomData,
  setCurrentRoomData,
  calculateTotalPrice,
  colorPricing,
  wallPricing,
  originalWalls
}) => {
  const { t } = useLanguage();

  if (!isVisible) return null;

  const hasCabinets = currentRoomData.elements.some(
    (el) => el.category === "cabinet"
  );

  // Compute base cabinet-only price (ignore color and wall mods)
  const baseCabinetPrice = hasCabinets
    ? calculateTotalPrice({
        ...currentRoomData,
        removedWalls: [],
        walls: currentRoomData.originalWalls || [1, 2, 3, 4],
        colorCount: 1,
      })
    : 0;

  // Color upcharge only applies when cabinets exist
  const colorCharge = hasCabinets ? (colorPricing[currentRoomData.colorCount] || 0) : 0;

  // Compute wall modification costs (always shown if > 0)
  const removedWalls = currentRoomData.removedWalls || [];
  const chargeableRemoved = removedWalls.filter((wall) => originalWalls.includes(wall));
  const customAdded = (currentRoomData.walls || []).filter((wall) => !originalWalls.includes(wall));
  const totalWallCost = (chargeableRemoved.length * wallPricing.removeWall) + (customAdded.length * wallPricing.addWall);

  const totalEstimate = Math.max(0, baseCabinetPrice + colorCharge + totalWallCost);

  return (
    <div className="mb-6 p-4 bg-blue-50 rounded-lg">
      <h2 className="font-semibold mb-3">{t('designer.pricingSummary', { room: activeRoom === 'kitchen' ? t('designer.kitchen') : t('designer.bathroom') })}</h2>
      <div className="space-y-2 text-sm">
        {!hasCabinets && (
          <p className="text-xs text-gray-700">{t('designer.noCabinetsYet')}</p>
        )}
        {/* Base cabinet pricing */}
        <div className="flex justify-between">
          <span>{t('designer.baseCabinetPrice')}:</span>
          <span>${baseCabinetPrice.toFixed(2)}</span>
        </div>

        {/* Color options selector */}
        <div className="flex justify-between">
          <label htmlFor="kd-color-options">{t('designer.colorOptions')}:</label>
          <select
            id="kd-color-options"
            value={currentRoomData.colorCount}
            onChange={(e) => setCurrentRoomData({
              ...currentRoomData,
              colorCount: e.target.value
            })}
            className="px-2 py-1 border rounded text-xs bg-white"
            disabled={!hasCabinets}
          >
            <option value={1}>{t('designer.colors.single')}</option>
            <option value={2}>{t('designer.colors.two')}</option>
            <option value={3}>{t('designer.colors.three')}</option>
            <option value="custom">{t('designer.colors.custom')}</option>
          </select>
        </div>

        {/* Wall modification pricing */}
        {totalWallCost > 0 && (
          <div className="flex justify-between">
            <span>{t('pricing.walls')}:</span>
            <span>${totalWallCost.toFixed(2)}</span>
          </div>
        )}

        {/* Total price display */}
        <div className="border-t pt-2 font-semibold flex justify-between">
          <span>{t('designer.totalEstimate')}:</span>
          <span>${totalEstimate.toFixed(2)}</span>
        </div>

        {/* Pricing disclaimer */}
        <p className="text-xs text-gray-700 mt-2">
          {t('designer.estimateDisclaimer')}
        </p>
      </div>
    </div>
  );
};

export default PricingDisplay;