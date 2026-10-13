import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatPrice, wallCharges } from '../../utils/designer/pricing';

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

  // Price of some of the items alone (no color, wall or pantry charges), from
  // the same calculateTotalPrice as the total and the quote
  const itemsPrice = (elements) =>
    calculateTotalPrice({
      ...currentRoomData,
      elements,
      removedWalls: [],
      walls: originalWalls,
      doors: [],
      colorCount: null,
    });
  const elements = currentRoomData.elements || [];
  const baseCabinetPrice = hasCabinets ? itemsPrice(elements.filter((el) => el.category === "cabinet")) : 0;
  // Appliances / fixtures the shop chose to price (0 = not in the estimate)
  const appliancePrice = itemsPrice(elements.filter((el) => el.category !== "cabinet"));

  // Wall modifications and pantries (always shown if > 0)
  const walls = wallCharges({ ...currentRoomData, originalWalls }, wallPricing);
  const totalWallCost = walls.removed.cost + walls.added.cost;

  // The same total as the quote: cabinets, priced appliances, the color
  // upcharge (only with cabinets), walls and pantries
  const totalEstimate = Math.max(0, calculateTotalPrice(currentRoomData));

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
          <span>{formatPrice(baseCabinetPrice)}</span>
        </div>

        {appliancePrice > 0 && (
          <div className="flex justify-between">
            <span>{t('pricing.appliances')}:</span>
            <span>{formatPrice(appliancePrice)}</span>
          </div>
        )}

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
            <span>{formatPrice(totalWallCost)}</span>
          </div>
        )}

        {/* Pantry partition walls and cased openings */}
        {walls.pantries > 0 && (
          <div className="flex justify-between">
            <span>{t('pricing.pantries')}:</span>
            <span>{formatPrice(walls.pantries)}</span>
          </div>
        )}

        {/* Total price display */}
        <div className="border-t pt-2 font-semibold flex justify-between">
          <span>{t('designer.totalEstimate')}:</span>
          <span>{formatPrice(totalEstimate)}</span>
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