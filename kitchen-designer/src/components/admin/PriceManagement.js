import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Save,
  Check
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { usePricing } from '../../contexts/PricingContext';
import {
  DEFAULT_BASE_PRICES,
  DEFAULT_WALL_PRICING,
  resolveWallPricing,
  withDefaults,
} from '../../utils/designer/pricing';

// Import modular pricing components
import CabinetPricing from '../pricing/CabinetPricing';
import MaterialMultipliers from '../pricing/MaterialMultipliers';
import ColorPricing from '../pricing/ColorPricing';
import WallPricing from '../pricing/WallPricing';
import WallAvailability from '../pricing/WallAvailability';
import { SectionSaveButton, createSectionHelpers } from '../pricing/PricingUtils';

const PriceManagement = ({ token, API_BASE, userRole }) => {
  // Language context
  const { t } = useLanguage();

  // Shared pricing context
  const { refreshPricing, setMaterialMultipliers: setSharedMaterialMultipliers } = usePricing();

  // Active tab state for mobile navigation
  const [activeTab, setActiveTab] = useState('cabinets');

  // State for all pricing data: every item the designer offers, with the
  // designer's defaults until the API answers (utils/designer/pricing.js)
  const [basePrices, setBasePrices] = useState(() => ({ ...DEFAULT_BASE_PRICES }));

  const [materialMultipliers, setMaterialMultipliers] = useState([]);

  const [colorPricing, setColorPricing] = useState({
    1: 0,
    2: 100,
    3: 200,
    'custom': 500
  });

  const [wallPricing, setWallPricing] = useState(() => ({ ...DEFAULT_WALL_PRICING }));

  const [wallAvailability, setWallAvailability] = useState({
    addWallEnabled: true,
    removeWallEnabled: true
  });


  // Section-specific unsaved changes tracking
  const [sectionChanges, setSectionChanges] = useState({
    cabinets: false,
    materials: false,
    colors: false,
    walls: false,
    wallAvailability: false
  });

  // Global state for save functionality
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // Create section helper functions using the utility
  const { markSectionChanged, markSectionSaved, clearAllSectionChanges } = createSectionHelpers(
    setSectionChanges,
    setHasUnsavedChanges
  );

  // Helper function to update shared context with converted material format
  const updateSharedMaterials = (materialsArray) => {
    const materialObject = {};
    materialsArray.forEach(material => {
      materialObject[material.nameEn.toLowerCase()] = material.multiplier;
    });
    setSharedMaterialMultipliers(materialObject);
  };

  // Materials will be saved to database when "Save Changes" is clicked
  const [loadingPrices, setLoadingPrices] = useState(true);

  // Load prices on component mount
  useEffect(() => {
    loadPrices();
  }, []);

  // Load prices from API
  const loadPrices = async () => {
    try {
      const headers = {
        'Authorization': `Bearer ${token}`
      };

      const [cabinetRes, materialRes, colorRes, wallRes, wallAvailRes] = await Promise.all([
        fetch(`${API_BASE}/api/prices/cabinets`, { headers }),
        fetch(`${API_BASE}/api/prices/materials`, { headers }),
        fetch(`${API_BASE}/api/prices/colors`, { headers }),
        fetch(`${API_BASE}/api/prices/walls`, { headers }),
        fetch(`${API_BASE}/api/prices/wall-availability`, { headers })
      ]);

      if (cabinetRes.ok) {
        const cabinetData = await cabinetRes.json();
        // Saved prices over the defaults: an item the database has no row
        // for yet (e.g. refrigerator-cabinet) still shows, and saving adds it
        setBasePrices(withDefaults(DEFAULT_BASE_PRICES, cabinetData));
      }

      if (materialRes.ok) {
        const materialData = await materialRes.json();

        if (materialData) {
          // Handle both old object format and new array format
          if (Array.isArray(materialData)) {
            setMaterialMultipliers(materialData);
          } else if (typeof materialData === 'object' && Object.keys(materialData).length > 0) {
            // Convert old format to new format
            const converted = Object.entries(materialData).map(([key, multiplier], index) => ({
              id: index + 1,
              nameEn: key.charAt(0).toUpperCase() + key.slice(1),
              nameEs: key === 'laminate' ? 'Laminado' : key === 'wood' ? 'Madera' : key === 'plywood' ? 'Madera Contrachapada' : key === 'maple' ? 'Arce' : key,
              multiplier: parseFloat(multiplier)
            }));
            setMaterialMultipliers(converted);
          }
        }
      }

      if (colorRes.ok) {
        const colorData = await colorRes.json();
        if (colorData && Object.keys(colorData).length > 0) {
          setColorPricing(colorData);
        }
      }

      if (wallRes.ok) {
        const wallData = await wallRes.json();
        // pantryWall / casedOpening; an older table prices pantry walls as addWall
        setWallPricing(resolveWallPricing(wallData));
      }

      if (wallAvailRes.ok) {
        const wallAvailData = await wallAvailRes.json();
        if (wallAvailData) {
          setWallAvailability(wallAvailData);
        }
      }
    } catch (error) {
      console.error('Error loading prices:', error);
    } finally {
      setLoadingPrices(false);
    }
  };

  // Save all price changes
  const savePriceChanges = async () => {
    setSaveStatus('saving');

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const responses = await Promise.all([
        fetch(`${API_BASE}/api/prices/cabinets`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(basePrices)
        }),
        fetch(`${API_BASE}/api/prices/materials`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(materialMultipliers)
        }),
        fetch(`${API_BASE}/api/prices/colors`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(colorPricing)
        }),
        fetch(`${API_BASE}/api/prices/walls`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(wallPricing)
        }),
        fetch(`${API_BASE}/api/prices/wall-availability`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(wallAvailability)
        })
      ]);

      if (responses.every(res => res.ok)) {
        setSaveStatus('saved');

        // Clear all section changes
        clearAllSectionChanges();

        // Remove "Unsaved" status from all materials after successful save
        setMaterialMultipliers(prev => prev.map(material => ({
          ...material,
          isTemporary: false
        })));

        setTimeout(() => setSaveStatus(''), 2000);
      } else {
        throw new Error('Failed to save some prices');
      }
    } catch (error) {
      console.error('Error saving prices:', error);
      alert('Failed to save prices: ' + error.message);
      setSaveStatus('error');
    }
  };

  // Create SectionSaveButton with the necessary props
  const SectionSaveButtonWithProps = ({ sectionKey, className = "" }) => (
    <SectionSaveButton
      sectionKey={sectionKey}
      sectionChanges={sectionChanges}
      saveStatus={saveStatus}
      onSave={savePriceChanges}
      className={className}
    />
  );



  if (loadingPrices) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">{t('priceManagement.loading')}</div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'cabinets', label: t('priceManagement.cabinets') },
    { id: 'materials', label: t('priceManagement.materials') },
    { id: 'colors', label: t('priceManagement.colors') },
    { id: 'walls', label: t('priceManagement.walls') },
    ...(userRole === 'super_admin' ? [{ id: 'availability', label: t('priceManagement.availability') }] : [])
  ];

  return (
    <div className="p-3 sm:p-6">
      {/* Page Header */}
      <div className="mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <DollarSign className="text-blue-600" size={24} />
          {t('priceManagement.title')}
        </h2>
        <p className="text-sm text-gray-600 mt-1 hidden sm:block">
          {t('priceManagement.description')}
        </p>
      </div>

      {/* Mobile-Only Tab Navigation */}
      <div className="mb-4 overflow-x-auto -mx-3 px-3 md:hidden">
        <div className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={{ minHeight: '44px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Save Status Banner */}
      {saveStatus && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${saveStatus === 'saved' ? 'bg-green-50 text-green-700' :
          saveStatus === 'saving' ? 'bg-blue-50 text-blue-700' :
            'bg-red-50 text-red-700'
          }`}>
          {saveStatus === 'saved' && <Check size={18} />}
          {saveStatus === 'saved' ? t('priceManagement.saved') :
            saveStatus === 'saving' ? t('priceManagement.saving') : t('priceManagement.error')}
        </div>
      )}

      {/* Mobile: Tab Content (one at a time) */}
      <div className="space-y-4 md:hidden">
        {activeTab === 'cabinets' && (
          <CabinetPricing
            basePrices={basePrices}
            setBasePrices={setBasePrices}
            markSectionChanged={markSectionChanged}
            SectionSaveButton={SectionSaveButtonWithProps}
          />
        )}

        {activeTab === 'materials' && (
          <MaterialMultipliers
            materialMultipliers={materialMultipliers}
            setMaterialMultipliers={setMaterialMultipliers}
            markSectionChanged={markSectionChanged}
            updateSharedMaterials={updateSharedMaterials}
            refreshPricing={refreshPricing}
            SectionSaveButton={SectionSaveButtonWithProps}
          />
        )}

        {activeTab === 'colors' && (
          <ColorPricing
            colorPricing={colorPricing}
            setColorPricing={setColorPricing}
            markSectionChanged={markSectionChanged}
            SectionSaveButton={SectionSaveButtonWithProps}
          />
        )}

        {activeTab === 'walls' && (
          <WallPricing
            wallPricing={wallPricing}
            setWallPricing={setWallPricing}
            markSectionChanged={markSectionChanged}
            SectionSaveButton={SectionSaveButtonWithProps}
          />
        )}

        {activeTab === 'availability' && userRole === 'super_admin' && (
          <WallAvailability
            wallAvailability={wallAvailability}
            setWallAvailability={setWallAvailability}
            markSectionChanged={markSectionChanged}
            userRole={userRole}
            SectionSaveButton={SectionSaveButtonWithProps}
          />
        )}
      </div>

      {/* Desktop: All Sections (no tabs) */}
      <div className="hidden md:block space-y-6">
        <CabinetPricing
          basePrices={basePrices}
          setBasePrices={setBasePrices}
          markSectionChanged={markSectionChanged}
          SectionSaveButton={SectionSaveButtonWithProps}
        />

        <MaterialMultipliers
          materialMultipliers={materialMultipliers}
          setMaterialMultipliers={setMaterialMultipliers}
          markSectionChanged={markSectionChanged}
          updateSharedMaterials={updateSharedMaterials}
          refreshPricing={refreshPricing}
          SectionSaveButton={SectionSaveButtonWithProps}
        />

        <ColorPricing
          colorPricing={colorPricing}
          setColorPricing={setColorPricing}
          markSectionChanged={markSectionChanged}
          SectionSaveButton={SectionSaveButtonWithProps}
        />

        <WallPricing
          wallPricing={wallPricing}
          setWallPricing={setWallPricing}
          markSectionChanged={markSectionChanged}
          SectionSaveButton={SectionSaveButtonWithProps}
        />

        {userRole === 'super_admin' && (
          <WallAvailability
            wallAvailability={wallAvailability}
            setWallAvailability={setWallAvailability}
            markSectionChanged={markSectionChanged}
            userRole={userRole}
            SectionSaveButton={SectionSaveButtonWithProps}
          />
        )}
      </div>

      {/* Global Save Button - appears when any section has changes */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={savePriceChanges}
          disabled={!hasUnsavedChanges || saveStatus === 'saving'}
          className={`w-full md:w-auto px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition ${hasUnsavedChanges && saveStatus !== 'saving'
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          style={{ minHeight: '44px' }}
        >
          <Save size={18} />
          {saveStatus === 'saving' ? t('priceManagement.saving') : t('priceManagement.saveChanges')}
        </button>
      </div>
    </div>
  );
};

export default PriceManagement;