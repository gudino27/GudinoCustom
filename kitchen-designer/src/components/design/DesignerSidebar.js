import React, { useState } from 'react';
import {
  Trash2,
  Calculator,
  Send,
  Home,
  Bath,
  ChevronLeft,
  ChevronRight,
  Camera
} from 'lucide-react';
import WallManagement from './WallManagement';
import { useLanguage } from '../../contexts/LanguageContext';
import { announce } from '../ui/LiveRegion';
import { getElementName } from './elementName';

const DesignerSidebar = ({
  // Responsive state
  isMobile,
  isTablet,

  // UI State
  sidebarCollapsed,
  setSidebarCollapsed,
  activeRoom,
  switchRoom,
  viewMode,
  setViewMode,

  // Design Data
  currentRoomData,
  setCurrentRoomData,
  selectedElement,
  elementTypes,
  scale,

  // Pricing
  showPricing,
  setShowPricing,
  calculateTotalPrice,
  basePrices,
  materialMultipliers,
  colorPricing,
  wallPricing,
  wallAvailability,

  // Actions
  addElement,
  updateElement,
  deleteElement,
  setShowQuoteForm,
  setShowARViewer,

  // Wall/Elements
  allAvailableWalls,
  selectedWall,
  setSelectedWall,
  getWallName,

  // Wall Management
  isDrawingWall,
  setIsDrawingWall,
  wallDrawStart,
  setWallDrawStart,
  setWallDrawPreview,
  toggleWallDrawingMode,
  isDoorMode,
  toggleDoorMode,
  doorModeType,
  setDoorModeType,

  // Additional state needed
  collapsedSections,
  toggleSection,
  rotateElement,
  rotateCornerCabinet,
  resetDesign,
  originalWalls,

  // Missing props added
  addWall,
  removeWall,
  customWalls,
  wallRemovalDisabled,
  getCustomWallByNumber,
  markWallAsExistedPrior,
  markWallAsNonExistentPrior,
  getCurrentWallAngle,
  rotateCustomWall,
  resizeCustomWall,
  addDoor,
  removeDoor,
  updateDoor,
  getDoorsOnWall,
  getDoorTypes
  ,
  applyFloorPlanPreset
}) => {
  const { t } = useLanguage();
  const [bulkMaterial, setBulkMaterial] = useState('');

  const isOverlayMode = isMobile;
  const showSidebar = !sidebarCollapsed || !isOverlayMode;

  const cabinetCount = currentRoomData.elements.filter(el => el.category === 'cabinet').length;

  const materialLabel = (material) =>
    t(`materials.${material}`, material.charAt(0).toUpperCase() + material.slice(1));

  // "Choose, then apply" instead of acting on change (WCAG 3.2.2)
  const applyMaterialToAllCabinets = () => {
    if (!bulkMaterial) return;
    if (!window.confirm(t('designer.confirmMaterialAll'))) return;
    const newMaterials = { ...currentRoomData.materials };
    currentRoomData.elements
      .filter(el => el.category === 'cabinet')
      .forEach(el => { newMaterials[el.id] = bulkMaterial; });
    setCurrentRoomData({ ...currentRoomData, materials: newMaterials });
    announce(t('designer.materialApplied', { material: materialLabel(bulkMaterial), count: cabinetCount }));
    setBulkMaterial('');
  };

  const handleAddElement = (key) => {
    addElement(key);
    announce(t('designer.itemAdded', { name: getElementName(t, key, elementTypes) }));
  };

  return (
    <>
      {isOverlayMode && !sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}
      <div
        className={`
          bg-white shadow-lg overflow-y-auto transition-all duration-300 ease-in-out
          ${isOverlayMode && !sidebarCollapsed
            ? 'fixed inset-y-0 left-0 z-40 w-80 max-w-[85vw]'
            : sidebarCollapsed
              ? 'w-16 p-2 pt-20'
              : 'w-80 p-6'
          }
          ${isOverlayMode && sidebarCollapsed ? 'hidden' : ''}
          ${!isOverlayMode && !sidebarCollapsed ? 'p-6' : ''}
          ${isOverlayMode && !sidebarCollapsed ? 'p-6 pt-20 pb-32' : ''}
          relative
        `}
        style={{ paddingBottom: isMobile ? 'calc(2rem + env(safe-area-inset-bottom, 0px))' : undefined }}
      >
        {!isOverlayMode && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`absolute ${sidebarCollapsed ? 'top-2 left-2' : 'top-4 right-4'} z-10 p-3 min-h-10 min-w-10 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-full flex items-center justify-center`}
            aria-label={sidebarCollapsed ? t('designer.expandSidebar') : t('designer.collapseSidebar')}
            aria-expanded={!sidebarCollapsed}
            aria-controls="kd-sidebar-content"
            title={sidebarCollapsed ? t('designer.expandSidebar') : t('designer.collapseSidebar')}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
        {sidebarCollapsed && (
          <div className="flex flex-col items-center mt-12 space-y-4">
            <button type="button" onClick={() => setShowPricing(!showPricing)} className="p-3 min-h-11 min-w-11 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 active:bg-green-300 flex items-center justify-center" aria-label={t('pricing.title')} title={t('pricing.title')}>
              <Calculator size={20} />
            </button>
            <button type="button" onClick={() => setShowQuoteForm(true)} className="p-3 min-h-11 min-w-11 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 active:bg-blue-300 flex items-center justify-center" aria-label={t('designer.sendQuote')} title={t('designer.sendQuote')}>
              <Send size={20} />
            </button>
            <button type="button" onClick={() => setShowARViewer(true)} className="p-3 min-h-11 min-w-11 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 active:bg-purple-300 flex items-center justify-center" aria-label={t('designer.viewInAR')} title={t('designer.viewInAR')}>
              <Camera size={20} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'floor' ? 'wall' : 'floor')}
              className="p-3 min-h-11 min-w-11 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 active:bg-gray-300 flex items-center justify-center"
              aria-label={viewMode === 'floor' ? t('designer.switchToWallView') : t('designer.switchToFloorPlan')}
              title={viewMode === 'floor' ? t('designer.switchToWallView') : t('designer.switchToFloorPlan')}
            >
              <span aria-hidden="true">{viewMode === 'floor' ? '🏠' : '🧱'}</span>
            </button>
          </div>
        )}
        {/* Collapsed: hidden from sight, so keep it out of the tab order too (WCAG 2.4.3) */}
        <div
          id="kd-sidebar-content"
          inert={sidebarCollapsed ? '' : undefined}
          className={`${sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'} transition-opacity duration-300`}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">{activeRoom === 'kitchen' ? t('designer.title') : t('designer.bathroomTitle')}</h2>
          </div>
          <fieldset className="mb-6 bg-gray-50 p-3 rounded-lg min-w-0">
            <legend className="sr-only">{t('designer.roomType')}</legend>
            <div className="flex gap-2">
              <button type="button" onClick={() => switchRoom('kitchen')} aria-pressed={activeRoom === 'kitchen'} className={`flex-1 p-3 min-h-11 rounded flex items-center justify-center gap-1 text-sm ${activeRoom === 'kitchen' ? 'bg-blue-700 text-white' : 'bg-white text-gray-700'}`}>
                <Home size={16} />{t('designer.kitchen', 'Kitchen')}
              </button>
              <button type="button" onClick={() => switchRoom('bathroom')} aria-pressed={activeRoom === 'bathroom'} className={`flex-1 p-3 min-h-11 rounded flex items-center justify-center gap-1 text-sm ${activeRoom === 'bathroom' ? 'bg-blue-700 text-white' : 'bg-white text-gray-700'}`}>
                <Bath size={16} />{t('designer.bathroom', 'Bathroom')}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2 text-center">{activeRoom === 'kitchen' ? t('designer.kitchen') : t('designer.bathroom')}: {currentRoomData.dimensions.width}' × {currentRoomData.dimensions.height}'</p>
          </fieldset>
          <div className="mb-6 space-y-2">
            <button type="button" onClick={() => setShowPricing(!showPricing)} className="w-full p-3 min-h-11 bg-green-700 text-white rounded hover:bg-green-800 flex items-center justify-center gap-2">
              <Calculator size={16} />{showPricing ? t('designer.hidePricing') : t('designer.showPricing')}
            </button>
            <button type="button" onClick={() => setShowQuoteForm(true)} aria-haspopup="dialog" className="w-full p-3 min-h-11 bg-blue-700 text-white rounded hover:bg-blue-800 flex items-center justify-center gap-2">
              <Send size={16} />{t('designer.sendQuote')}
            </button>
            <button type="button" onClick={() => setShowARViewer(true)} aria-haspopup="dialog" className="w-full p-3 min-h-11 bg-purple-700 text-white rounded hover:bg-purple-800 flex items-center justify-center gap-2">
              <Camera size={16} />{t('designer.viewInAR')}
            </button>
          </div>
          <fieldset className="mb-6 min-w-0">
            <legend className="block text-sm font-semibold mb-2">{t('designer.viewMode')}</legend>
            <div className="flex gap-2">
              <button type="button" onClick={() => setViewMode('floor')} aria-pressed={viewMode === 'floor'} className={`flex-1 p-3 min-h-11 rounded transition-colors ${viewMode === 'floor' ? 'bg-blue-700 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>{t('designer.floorPlan')}</button>
              <button type="button" onClick={() => setViewMode('wall')} aria-pressed={viewMode === 'wall'} className={`flex-1 p-3 min-h-11 rounded transition-colors ${viewMode === 'wall' ? 'bg-blue-700 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>{t('designer.wallView')}</button>
              <button type="button" onClick={() => setViewMode('3d')} aria-pressed={viewMode === '3d'} className={`flex-1 p-3 min-h-11 rounded transition-colors ${viewMode === '3d' ? 'bg-blue-700 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>{t('designer.view3D')}</button>
            </div>
          </fieldset>
          {viewMode === 'wall' && (
            <fieldset className="mb-6 min-w-0">
              <legend className="block text-sm font-semibold mb-2">{t('designer.selectWall')}</legend>
              <div className="grid grid-cols-2 gap-2">
                {allAvailableWalls.filter(wallNum => {
                  if (wallNum <= 4) return true;
                  const customWall = getCustomWallByNumber(wallNum);
                  return !!customWall;
                }).map(wall => (
                  <button type="button" key={wall} onClick={() => setSelectedWall(wall)} aria-pressed={selectedWall === wall} className={`p-2 text-sm rounded ${selectedWall === wall ? 'bg-blue-700 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>{getWallName(wall)}</button>
                ))}
              </div>
            </fieldset>
          )}
          <div className="mb-6 border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="block text-sm font-semibold">{t('designer.floorPlanLayouts')}</h3>
              <button
                type="button"
                onClick={() => toggleSection('floorPlanPresets')}
                className="text-xs px-2 py-1 bg-purple-700 text-white rounded hover:bg-purple-800 flex items-center gap-1"
                aria-expanded={!collapsedSections.floorPlanPresets}
                aria-controls="kd-floor-presets"
                title={t('designer.presetsHint')}
              >
                <span aria-hidden="true">🏠</span> {t('designer.presets')}
              </button>
            </div>
            {!collapsedSections.floorPlanPresets && (
              <div id="kd-floor-presets" className="mt-2 grid grid-cols-1 gap-2">
                <button type="button" onClick={() => applyFloorPlanPreset('traditional')} className="w-full p-2 bg-white border rounded hover:bg-gray-50 text-sm">{t('designer.preset.traditional')}</button>
                <button type="button" onClick={() => applyFloorPlanPreset('open-concept')} className="w-full p-2 bg-white border rounded hover:bg-gray-50 text-sm">{t('designer.preset.openConcept')}</button>
                <button type="button" onClick={() => applyFloorPlanPreset('galley-open')} className="w-full p-2 bg-white border rounded hover:bg-gray-50 text-sm">{t('designer.preset.galley')}</button>
                <button type="button" onClick={() => applyFloorPlanPreset('island-focused')} className="w-full p-2 bg-white border rounded hover:bg-gray-50 text-sm">{t('designer.preset.island')}</button>
                <button type="button" onClick={() => applyFloorPlanPreset('peninsula')} className="w-full p-2 bg-white border rounded hover:bg-gray-50 text-sm">{t('designer.preset.peninsula')}</button>
              </div>
            )}
          </div>
          <WallManagement
            wallAvailability={wallAvailability}
            collapsedSections={collapsedSections}
            toggleSection={toggleSection}
            scale={scale}
            isDrawingWall={isDrawingWall}
            toggleWallDrawingMode={toggleWallDrawingMode}
            isDoorMode={isDoorMode}
            toggleDoorMode={toggleDoorMode}
            doorModeType={doorModeType}
            setDoorModeType={setDoorModeType}
            allAvailableWalls={allAvailableWalls}
            currentRoomData={currentRoomData}
            getWallName={getWallName}
            wallPricing={wallPricing}
            addWall={addWall}
            removeWall={removeWall}
            customWalls={customWalls}
            originalWalls={originalWalls}
            setCurrentRoomData={setCurrentRoomData}
            wallRemovalDisabled={wallRemovalDisabled}
            getCustomWallByNumber={getCustomWallByNumber}
            markWallAsExistedPrior={markWallAsExistedPrior}
            markWallAsNonExistentPrior={markWallAsNonExistentPrior}
            getCurrentWallAngle={getCurrentWallAngle}
            rotateCustomWall={rotateCustomWall}
            resizeCustomWall={resizeCustomWall}
            wallDrawStart={wallDrawStart}
            setIsDrawingWall={setIsDrawingWall}
            setWallDrawStart={setWallDrawStart}
            setWallDrawPreview={setWallDrawPreview}
            addDoor={addDoor}
            removeDoor={removeDoor}
            updateDoor={updateDoor}
            getDoorsOnWall={getDoorsOnWall}
            getDoorTypes={getDoorTypes}
            onDeleteElement={deleteElement}
          />
          {cabinetCount > 0 && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">{t('designer.changeAllMaterials')}</h3>
              <label htmlFor="kd-bulk-material" className="sr-only">{t('designer.chooseMaterialAll')}</label>
              <select
                id="kd-bulk-material"
                value={bulkMaterial}
                onChange={e => setBulkMaterial(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">{t('designer.chooseMaterialAll')}</option>
                {Object.entries(materialMultipliers).map(([material, multiplier]) => (
                  <option key={material} value={material}>{materialLabel(material)} ({multiplier === 1 ? t('designer.included') : `+${Math.round((multiplier - 1) * 100)}%`})</option>
                ))}
              </select>
              <button
                type="button"
                onClick={applyMaterialToAllCabinets}
                disabled={!bulkMaterial}
                className={`w-full mt-2 p-2 min-h-11 rounded text-white ${bulkMaterial ? 'bg-blue-700 hover:bg-blue-800' : 'bg-gray-400 cursor-not-allowed'}`}
              >
                {t('designer.applyMaterialAll')}
              </button>
              <p className="text-sm text-gray-600 mt-2">{t('designer.changeAllMaterialsHint', { count: cabinetCount })}</p>
            </div>
          )}
          <div className="mb-8">
            <button
              type="button"
              onClick={() => toggleSection('cabinetOptions')}
              className="flex items-center gap-2 text-lg font-semibold mb-4 hover:text-blue-700"
              aria-expanded={!collapsedSections.cabinetOptions}
              aria-controls="kd-cabinet-options"
            >
              <span aria-hidden="true" className={`transform transition-transform ${collapsedSections.cabinetOptions ? '' : 'rotate-90'}`}>▶</span>{activeRoom === 'kitchen' ? t('designer.kitchenCabinets') : t('designer.bathroomCabinets')}
            </button>
            {!collapsedSections.cabinetOptions && (
              <div id="kd-cabinet-options" className="space-y-2">
                {Object.entries(elementTypes).filter(([key, el]) => el.category === 'cabinet' && el.room === activeRoom).map(([key, el]) => (
                  <button type="button" key={key} onClick={() => handleAddElement(key)} className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg" title={`$${basePrices[key] || 0}`}>
                    <div className="font-medium">{getElementName(t, key, elementTypes)}</div>
                    <div className="text-xs text-gray-600">{el.defaultWidth}"W × {el.defaultDepth}"D × {el.fixedHeight || el.defaultHeight}"H</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mb-8">
            <button
              type="button"
              onClick={() => toggleSection('appliances')}
              className="flex items-center gap-2 text-lg font-semibold mb-4 hover:text-blue-700"
              aria-expanded={!collapsedSections.appliances}
              aria-controls="kd-appliance-options"
            >
              <span aria-hidden="true" className={`transform transition-transform ${collapsedSections.appliances ? '' : 'rotate-90'}`}>▶</span>{t('designer.appliances')}
            </button>
            {!collapsedSections.appliances && (
              <div id="kd-appliance-options" className="space-y-2">
                {Object.entries(elementTypes).filter(([key, el]) => el.category === 'appliance' && el.room === activeRoom).map(([key, el]) => (
                  <button type="button" key={key} onClick={() => handleAddElement(key)} className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg">
                    <div className="font-medium">{getElementName(t, key, elementTypes)}</div>
                    <div className="text-xs text-gray-600">{el.defaultWidth}"W × {el.defaultDepth}"D × {el.fixedHeight}"H</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {showPricing && (
            <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h3 className="font-semibold mb-3 text-yellow-800">{t('pricing.title')}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>{t('pricing.cabinets')}:</span><span>${calculateTotalPrice().toFixed(2)}</span></div>
                {(() => {
                  const removedWalls = currentRoomData.removedWalls || [];
                  const chargeableRemoved = removedWalls.filter(w => originalWalls.includes(w));
                  const customAdded = (currentRoomData.walls || []).filter(w => !originalWalls.includes(w));
                  const totalWallCost = (chargeableRemoved.length * wallPricing.removeWall) + (customAdded.length * wallPricing.addWall);
                  return totalWallCost > 0 ? (
                    <div className="flex justify-between"><span>{t('pricing.walls')}:</span><span>${totalWallCost.toFixed(2)}</span></div>
                  ) : null;
                })()}
                <div className="border-t pt-2 font-semibold flex justify-between"><span>{t('designer.totalEstimate')}:</span><span>${calculateTotalPrice().toFixed(2)}</span></div>
                <p className="text-xs text-gray-600 mt-2">{t('designer.estimateDisclaimer')}</p>
              </div>
            </div>
          )}
          <div className="mt-8 pt-6 border-t">
            <button type="button" onClick={() => { if (window.confirm(t('designer.confirmReset'))) resetDesign(); }} className="w-full p-3 bg-red-700 text-white rounded hover:bg-red-800 flex items-center justify-center gap-2 font-medium">
              <Trash2 size={16} />{t('designer.resetDesign')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DesignerSidebar;