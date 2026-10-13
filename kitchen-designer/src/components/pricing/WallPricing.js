import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

// Room features the designer charges for: wall changes, and walk-in pantries
// (each partition wall + the cased opening; see utils/designer/pricing.js).
const FIELDS = {
  walls: [
    { key: 'addWall', label: 'priceManagement.addWall', hint: 'priceManagement.addWallHint' },
    { key: 'removeWall', label: 'priceManagement.removeWall', hint: 'priceManagement.removeWallHint' },
  ],
  pantries: [
    { key: 'pantryWall', label: 'priceManagement.pantryWall' },
    { key: 'casedOpening', label: 'priceManagement.casedOpening', hint: 'priceManagement.casedOpeningHint' },
  ],
};

const WallPricing = ({
  wallPricing,
  setWallPricing,
  markSectionChanged,
  SectionSaveButton
}) => {
  const { t } = useLanguage();

  const handleWallPriceChange = (type, newValue) => {
    if (newValue < 0) {
      alert(t('priceManagement.negativePrice'));
      return;
    }
    setWallPricing({ ...wallPricing, [type]: newValue || 0 });
    markSectionChanged('walls');
  };

  const field = ({ key, label, hint }) => {
    const id = `wall-price-${key}`;
    const hintId = hint ? `${id}-hint` : undefined;
    return (
      <div key={key}>
        <div className="flex items-center gap-3">
          <label htmlFor={id} className="flex-1 text-sm font-medium">
            {t(label)}
          </label>
          <div className="flex items-center">
            <span className="text-gray-500 mr-1" aria-hidden="true">$</span>
            <input
              id={id}
              type="number"
              value={Number(wallPricing[key]) || 0}
              onChange={(e) => handleWallPriceChange(key, parseFloat(e.target.value))}
              aria-describedby={hintId}
              className="w-24 p-2 border rounded focus:border-blue-500 focus:outline-none"
              min="0"
              step="50"
            />
          </div>
        </div>
        {hint && <p id={hintId} className="text-xs text-gray-600 mt-1">{t(hint)}</p>}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <div className="w-5 h-5 bg-gray-500 rounded-sm border-2 border-gray-300" aria-hidden="true" />
        {t('priceManagement.wallsTitle')}
      </h3>

      <h4 className="text-md font-medium mb-1 text-gray-800">{t('priceManagement.wallChanges')}</h4>
      <p className="text-sm text-gray-600 mb-4">{t('priceManagement.wallsHint')}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {FIELDS.walls.map(field)}
      </div>

      <h4 className="text-md font-medium mt-6 mb-1 text-gray-800">{t('priceManagement.pantries')}</h4>
      <p className="text-sm text-gray-600 mb-4">{t('priceManagement.pantriesHint')}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {FIELDS.pantries.map(field)}
      </div>

      {/* Section Save Button for Wall Pricing */}
      <SectionSaveButton sectionKey="walls" />
    </div>
  );
};

export default WallPricing;
