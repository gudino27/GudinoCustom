import React, { useState } from 'react';
import { DollarSign, Home, Bath } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { elementTypes } from '../../constants/elementTypes';
import { getElementName } from '../design/elementName';

// Prices of every item the customer designer offers, grouped like its palette:
// cabinets (priced per 24" of width, times the material multiplier) and
// appliances / fixtures (not sold by the shop: 0 = "not in the estimate"; a
// price above 0 is added once per item). Prices saved for types the designer
// does not offer are kept and listed at the end.

const ROOMS = ['kitchen', 'bathroom'];
const typesOf = (room, category) =>
  Object.entries(elementTypes)
    .filter(([, spec]) => spec.room === room && spec.category === category)
    .map(([type]) => type);

const PriceInput = ({ id, value, onChange, step = 10 }) => (
  <div className="flex items-center">
    <span className="text-gray-500 mr-1" aria-hidden="true">$</span>
    <input
      id={id}
      type="number"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-24 p-2 border rounded focus:border-blue-500 focus:outline-none"
      min="0"
      step={step}
    />
  </div>
);

const CabinetPricing = ({
  basePrices,
  setBasePrices,
  markSectionChanged,
  SectionSaveButton
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('kitchen');
  // Appliances whose price field the admin opened with "Add a price"
  const [opened, setOpened] = useState({});

  const nameOf = (type) => getElementName(t, type, elementTypes);
  const priceOf = (type) => {
    const n = Number(basePrices[type]);
    return Number.isFinite(n) ? n : 0;
  };

  const handlePriceChange = (type, newValue) => {
    if (newValue < 0) {
      alert(t('priceManagement.negativePrice'));
      return;
    }
    setBasePrices({ ...basePrices, [type]: newValue || 0 });
    markSectionChanged('cabinets');
  };

  const removeAppliancePrice = (type) => {
    setOpened({ ...opened, [type]: false });
    handlePriceChange(type, 0);
  };

  const designerTypes = new Set(Object.keys(elementTypes));
  const otherTypes = Object.keys(basePrices)
    .filter((type) => !designerTypes.has(type))
    .sort();

  const cabinetRow = (type) => {
    const id = `price-${type}`;
    return (
      <div key={type} className="flex items-center gap-3">
        <label htmlFor={id} className="flex-1 text-sm font-medium">
          {nameOf(type)}
        </label>
        <PriceInput id={id} value={priceOf(type)} onChange={(v) => handlePriceChange(type, v)} />
      </div>
    );
  };

  const applianceRow = (type) => {
    const id = `price-${type}`;
    const name = nameOf(type);
    const priced = priceOf(type) > 0 || opened[type];
    return (
      <div key={type} className="flex items-center gap-3 flex-wrap">
        {priced ? (
          <>
            <label htmlFor={id} className="flex-1 text-sm font-medium">{name}</label>
            <PriceInput id={id} value={priceOf(type)} onChange={(v) => handlePriceChange(type, v)} />
            <button
              type="button"
              onClick={() => removeAppliancePrice(type)}
              className="text-xs text-red-700 underline hover:text-red-800 min-h-8"
              aria-label={t('priceManagement.removePriceLabel', { name })}
            >
              {t('priceManagement.removePrice')}
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-sm font-medium">{name}</span>
            <span className="text-xs text-gray-600 italic">{t('priceManagement.notInEstimate')}</span>
            <button
              type="button"
              onClick={() => setOpened({ ...opened, [type]: true })}
              className="text-xs text-blue-700 underline hover:text-blue-800 min-h-8"
              aria-label={t('priceManagement.addPriceLabel', { name })}
            >
              {t('priceManagement.addPrice')}
            </button>
          </>
        )}
      </div>
    );
  };

  const roomSection = (room) => {
    const kitchen = room === 'kitchen';
    const color = kitchen ? 'text-blue-700' : 'text-purple-700';
    return (
      <div className="space-y-6">
        <div>
          <h4 className={`text-md font-medium mb-1 ${color}`}>
            {kitchen ? t('designer.kitchenCabinets') : t('designer.bathroomCabinets')}
          </h4>
          <p className="text-xs text-gray-600 mb-3">{t('priceManagement.cabinetHint')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {typesOf(room, 'cabinet').map(cabinetRow)}
          </div>
        </div>
        <div>
          <h4 className={`text-md font-medium mb-1 ${color}`}>
            {kitchen ? t('designer.appliances') : t('designer.palette.fixtures')}
          </h4>
          <p className="text-xs text-gray-600 mb-3">{t('priceManagement.applianceHint')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {typesOf(room, 'appliance').map(applianceRow)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <DollarSign className="text-blue-600" size={20} />
        {t('priceManagement.itemsTitle')}
      </h3>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6" role="group">
        {ROOMS.map((room) => (
          <button
            key={room}
            type="button"
            aria-pressed={activeTab === room}
            onClick={() => setActiveTab(room)}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition ${
              activeTab === room
                ? `bg-white shadow-sm ${room === 'kitchen' ? 'text-blue-600' : 'text-purple-600'}`
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              {room === 'kitchen' ? <Home size={16} /> : <Bath size={16} />}
              {room === 'kitchen' ? t('priceManagement.kitchen') : t('priceManagement.bathroom')}
            </div>
          </button>
        ))}
      </div>

      {roomSection(activeTab)}

      {otherTypes.length > 0 && (
        <details className="mt-6 border-t pt-4">
          <summary className="text-sm font-medium text-gray-700 cursor-pointer">
            {t('priceManagement.otherPrices')}
          </summary>
          <p className="text-xs text-gray-600 my-3">{t('priceManagement.otherPricesHint')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherTypes.map((type) => {
              const id = `price-${type}`;
              return (
                <div key={type} className="flex items-center gap-3">
                  <label htmlFor={id} className="flex-1 text-sm font-medium capitalize">
                    {type.replace(/-/g, ' ')}
                  </label>
                  <PriceInput id={id} value={priceOf(type)} onChange={(v) => handlePriceChange(type, v)} />
                </div>
              );
            })}
          </div>
        </details>
      )}

      {/* Section Save Button for Cabinets */}
      <SectionSaveButton sectionKey="cabinets" />
    </div>
  );
};

export default CabinetPricing;
