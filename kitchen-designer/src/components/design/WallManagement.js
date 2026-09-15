import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { announce } from '../ui/LiveRegion';

const DOOR_MIN_WIDTH = 18;
const DOOR_MAX_WIDTH = 48;

const WallManagement = ({
  wallAvailability,
  collapsedSections,
  toggleSection,
  isDrawingWall,
  toggleWallDrawingMode,
  isDoorMode,
  toggleDoorMode,
  doorModeType,
  setDoorModeType,
  allAvailableWalls,
  currentRoomData,
  getWallName,
  wallPricing,
  addWall,
  removeWall,
  customWalls,
  originalWalls,
  setCurrentRoomData,
  wallRemovalDisabled,
  getCustomWallByNumber,
  markWallAsExistedPrior,
  markWallAsNonExistentPrior,
  getCurrentWallAngle,
  rotateCustomWall,
  resizeCustomWall,
  wallDrawStart,
  setIsDrawingWall,
  setWallDrawStart,
  setWallDrawPreview,
  addDoor,
  removeDoor,
  updateDoor,
  getDoorsOnWall,
  getDoorTypes,
  scale
}) => {
  const { t } = useLanguage();
  const [doorWidthErrors, setDoorWidthErrors] = useState({});

  if (!wallAvailability.addWallEnabled && !wallAvailability.removeWallEnabled) {
    return null;
  }

  const doorTypeLabel = (type) => t(`doors.${type}`, `${type.charAt(0).toUpperCase()}${type.slice(1)} Door`);

  return (
    <div className="mb-6 border-t pt-4">
      <div className="mb-3">
        <button
          type="button"
          onClick={() => toggleSection('wallManagement')}
          className="flex items-center gap-2 text-sm font-semibold hover:text-blue-700 mb-2"
          aria-expanded={!collapsedSections.wallManagement}
          aria-controls="kd-wall-management"
        >
          <span aria-hidden="true" className={`transform transition-transform ${collapsedSections.wallManagement ? 'rotate-0' : 'rotate-90'}`}>
            ▶
          </span>
          {t('walls.title')}
        </button>

        {/* Wall Management Buttons */}
        {wallAvailability.addWallEnabled && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={toggleWallDrawingMode}
              className="text-sm px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors bg-blue-700 text-white hover:bg-blue-800 shadow-lg"
              title={isDrawingWall ? t('designer.exitDrawingModeHint') : t('designer.drawWallHint')}
            >
              <span aria-hidden="true">✏️</span>
              {isDrawingWall ? t('designer.exitDrawingMode') : t('designer.drawWall')}
            </button>
          </div>
        )}
      </div>

      {!collapsedSections.wallManagement && (
        <div id="kd-wall-management">
          {isDrawingWall && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="text-sm font-medium text-orange-800 mb-2"><span aria-hidden="true">✏️</span> {t('designer.drawingModeActive')}</div>
              <div className="text-xs text-orange-800">
                {wallDrawStart ?
                  <><strong>{t('designer.drawStep2Label')}</strong> {t('designer.drawStep2')}</> :
                  <><strong>{t('designer.drawStep1Label')}</strong> {t('designer.drawStep1')}</>
                }
                <br /> {t('designer.customWallPrice', { price: wallPricing.addWall })}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDrawingWall(false);
                  setWallDrawStart(null);
                  setWallDrawPreview(null);
                }}
                className="mt-2 text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                {t('designer.cancelDrawing')}
              </button>
            </div>
          )}

          {/* Wall Status Grid */}
          <div className="space-y-2 mb-4">
            {allAvailableWalls.filter(wallNum => {
              // Show original walls (1-4) always
              if (wallNum <= 4) return true;
              // For custom walls, only show if they exist in customWalls array AND are either present or removed but were originally added
              const customWall = getCustomWallByNumber(wallNum);
              if (customWall) return true;
              // Don't show custom wall numbers that no longer have corresponding wall objects
              return false;
            }).map(wallNum => {
              const isPresent = (currentRoomData.walls || [1, 2, 3, 4]).includes(wallNum);
              const isRemoved = (currentRoomData.removedWalls || []).includes(wallNum);
              const customWall = getCustomWallByNumber(wallNum);
              const isCustom = !!customWall;
              const existedPrior = customWall?.existedPrior || false;
              
              // Calculate wall length for custom walls
              let wallLengthInches = 0;
              if (isCustom && customWall && scale) {
                const lengthPixels = Math.sqrt(
                  Math.pow(customWall.x2 - customWall.x1, 2) + 
                  Math.pow(customWall.y2 - customWall.y1, 2)
                );
                wallLengthInches = lengthPixels / scale;
              }

              return (
                <div key={wallNum} className="p-2 bg-gray-50 rounded border" role="group" aria-labelledby={`kd-wall-name-${wallNum}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" id={`kd-wall-name-${wallNum}`}>
                      {getWallName(wallNum)}
                      {isCustom && <span className="text-purple-700"> ({t('walls.custom')})</span>}
                    </span>
                    <span className={`text-xs px-1 rounded ${isPresent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {isPresent ? t('walls.present') : t('walls.removed')}
                    </span>
                  </div>

                  <div className="flex gap-1">
                        {/* Existed / Non-existent prior toggle for pricing */}
                        <div className="flex-2">
                          {originalWalls.includes(wallNum) ? (
                            <button
                              type="button"
                              onClick={() => {
                                  markWallAsNonExistentPrior(wallNum);

                              }}
                              className="text-xs py-1 px-2 rounded w-full bg-yellow-100 text-yellow-900 hover:bg-yellow-200"
                              title={t('designer.markNonExistentPriorHint')}
                            >
                              {t('designer.markNonExistentPrior')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                markWallAsExistedPrior(wallNum);
                              }}
                              className="text-xs py-1 px-3 rounded w-full bg-yellow-700 text-white hover:bg-yellow-800"
                              title={t('designer.markExistedPriorHint')}
                            >
                              {t('designer.markExistedPrior')}
                            </button>
                          )}
                        </div>
                    {!isPresent && (
                      <div className="flex gap-1 w-full">
                        {wallAvailability.addWallEnabled && (
                          <button
                            type="button"
                            onClick={() => addWall(wallNum)}
                            className="flex-1 text-xs py-2 px-3 min-h-10 bg-green-700 text-white rounded hover:bg-green-800 active:bg-green-800 transition-colors"
                            title={t('designer.addWallHint', { wall: getWallName(wallNum), price: wallPricing.addWall })}
                          >
                            {t('walls.add')}
                          </button>
                        )}
                        {!wallAvailability.addWallEnabled && (
                          <div className="flex-1 text-xs py-1 px-2 bg-gray-300 text-gray-800 rounded text-center">
                            {t('designer.serviceDisabled')}
                          </div>
                        )}
                        {/* For custom walls that are removed, also show delete option */}
                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(t('designer.confirmDeleteWall', { wall: getWallName(wallNum) }))) {
                                const updatedCustomWalls = customWalls.filter(w => w.wallNumber !== wallNum);
                                const updatedCurrentWalls = currentRoomData.walls.filter(w => w !== wallNum);
                                const updatedAvailableWalls = allAvailableWalls.filter(w => w !== wallNum);
                                const updatedOriginalWalls = originalWalls.filter(w => w !== wallNum);
                                const updatedRemovedWalls = (currentRoomData.removedWalls || []).filter(w => w !== wallNum);

                                //console.log('Deleting removed custom wall from status grid:', wallNum);

                                setCurrentRoomData({
                                  ...currentRoomData,
                                  customWalls: updatedCustomWalls,
                                  walls: updatedCurrentWalls,
                                  allAvailableWalls: updatedAvailableWalls,
                                  originalWalls: updatedOriginalWalls,
                                  removedWalls: updatedRemovedWalls
                                });
                              }
                            }}
                            className="text-xs py-2 px-3 min-h-10 rounded bg-red-700 text-white hover:bg-red-800 active:bg-red-800 transition-colors"
                            aria-label={t('designer.deleteWall', { wall: getWallName(wallNum) })}
                            title={t('designer.deleteWall', { wall: getWallName(wallNum) })}
                          >
                            <span aria-hidden="true">🗑️</span>
                          </button>
                        )}
                      </div>
                    )}
                    {isPresent && (
                      <>
                        {/* For custom walls, show Delete button instead of Remove */}
                        {isCustom ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(t('designer.confirmDeleteWall', { wall: getWallName(wallNum) }))) {
                                const updatedCustomWalls = customWalls.filter(w => w.wallNumber !== wallNum);
                                const updatedCurrentWalls = currentRoomData.walls.filter(w => w !== wallNum);
                                const updatedAvailableWalls = allAvailableWalls.filter(w => w !== wallNum);
                                const updatedOriginalWalls = originalWalls.filter(w => w !== wallNum);
                                const updatedRemovedWalls = (currentRoomData.removedWalls || []).filter(w => w !== wallNum);

                                //console.log('Deleting custom wall from status grid:', wallNum);

                                setCurrentRoomData({
                                  ...currentRoomData,
                                  customWalls: updatedCustomWalls,
                                  walls: updatedCurrentWalls,
                                  allAvailableWalls: updatedAvailableWalls,
                                  originalWalls: updatedOriginalWalls,
                                  removedWalls: updatedRemovedWalls
                                });
                              }
                            }}
                            className="flex-1 text-xs py-2 px-3 min-h-10 rounded bg-red-700 text-white hover:bg-red-800 active:bg-red-800 transition-colors"
                            title={t('designer.deleteWall', { wall: getWallName(wallNum) })}
                          >
                            {t('walls.delete')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => removeWall(wallNum)}
                            disabled={wallRemovalDisabled || !wallAvailability.removeWallEnabled}
                            className={`flex-1 text-xs py-2 px-3 min-h-10 rounded transition-colors ${wallRemovalDisabled || !wallAvailability.removeWallEnabled
                                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                : 'bg-red-700 text-white hover:bg-red-800 active:bg-red-800'
                              }`}
                            title={wallRemovalDisabled ? t('designer.wallRemovalPaused') :
                              !wallAvailability.removeWallEnabled ? t('designer.wallRemovalDisabled') :
                                t('designer.removeWallHint', { wall: getWallName(wallNum), price: wallPricing.removeWall })}
                          >
                            {t('common.remove')}
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Door Controls for Present Walls */}
                  {isPresent && (
                    <div className="mt-2 space-y-2">
                      {/* Existing doors on this wall */}
                      {getDoorsOnWall(wallNum).map(door => (
                        <div key={door.id} className="p-2 bg-blue-50 rounded border border-blue-200" role="group" aria-labelledby={`kd-door-name-${door.id}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-blue-800" id={`kd-door-name-${door.id}`}>
                              {doorTypeLabel(door.type)} ({door.width}")
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(t('designer.confirmRemoveDoor'))) {
                                  removeDoor(door.id);
                                  announce(t('designer.doorRemoved'));
                                }
                              }}
                              className="text-xs px-3 py-2 min-h-9 min-w-9 bg-red-100 text-red-700 rounded hover:bg-red-200 active:bg-red-300 transition-colors flex items-center justify-center"
                              aria-label={t('designer.removeDoor')}
                              title={t('designer.removeDoor')}
                            >
                              <span aria-hidden="true">✕</span>
                            </button>
                          </div>

                          {/* Position slider */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <label htmlFor={`kd-door-pos-${door.id}`} className="text-xs text-blue-800 w-16">{t('doors.position')}:</label>
                              <input
                                id={`kd-door-pos-${door.id}`}
                                type="range"
                                min="0"
                                max="100"
                                value={door.position}
                                onChange={(e) => updateDoor(door.id, { position: parseFloat(e.target.value) })}
                                aria-valuetext={`${Math.round(door.position)}%`}
                                className="flex-1 h-1 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                                style={{
                                  background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${door.position}%, #E5E7EB ${door.position}%, #E5E7EB 100%)`
                                }}
                              />
                              <span className="text-xs text-blue-800 w-8">{Math.round(door.position)}%</span>
                            </div>

                            {/* Width input */}
                            <div className="flex items-center gap-2">
                              <label htmlFor={`kd-door-width-${door.id}`} className="text-xs text-blue-800 w-16">{t('doors.width')}:</label>
                              <input
                                id={`kd-door-width-${door.id}`}
                                type="number"
                                min={DOOR_MIN_WIDTH}
                                max={DOOR_MAX_WIDTH}
                                value={door.width}
                                onChange={(e) => {
                                  const newWidth = parseFloat(e.target.value);
                                  if (newWidth >= DOOR_MIN_WIDTH && newWidth <= DOOR_MAX_WIDTH) {
                                    updateDoor(door.id, { width: newWidth });
                                  }
                                }}
                                aria-describedby={`kd-door-width-hint-${door.id}`}
                                className="flex-1 px-2 py-1 text-xs border border-blue-300 rounded focus:border-blue-500 focus:outline-none"
                              />
                              <span className="text-xs text-blue-800">{t('doors.inches')}</span>
                              <span className="sr-only" id={`kd-door-width-hint-${door.id}`}>
                                {t('designer.hint.range', { min: DOOR_MIN_WIDTH, max: DOOR_MAX_WIDTH, unit: t('doors.inches') })}
                              </span>
                            </div>

                            {/* Door type dropdown */}
                            <div className="flex items-center gap-2">
                              <label htmlFor={`kd-door-type-${door.id}`} className="text-xs text-blue-800 w-16">{t('doors.type')}:</label>
                              <select
                                id={`kd-door-type-${door.id}`}
                                value={door.type}
                                onChange={(e) => updateDoor(door.id, { type: e.target.value })}
                                className="flex-1 px-2 py-1 text-xs border border-blue-300 rounded focus:border-blue-500 focus:outline-none"
                              >
                                <option value="room">{t('doors.room')}</option>
                                <option value="standard">{t('doors.standard')}</option>
                                <option value="pantry">{t('doors.pantry')}</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Add door controls */}
                      <div className="p-2 bg-green-50 rounded border border-green-200" role="group" aria-labelledby={`kd-add-door-${wallNum}`}>
                        <div className="text-xs font-medium text-green-800 mb-2" id={`kd-add-door-${wallNum}`}>
                          {t('designer.addNewDoor')}<span className="sr-only"> – {getWallName(wallNum)}</span>
                        </div>

                        <div className="space-y-2">
                          {/* Door type dropdown */}
                          <div className="flex items-center gap-2">
                            <label htmlFor={`door-type-${wallNum}`} className="text-xs text-green-800 w-16">{t('doors.type')}:</label>
                            <select
                              id={`door-type-${wallNum}`}
                              defaultValue="room"
                              className="flex-1 px-2 py-1 text-xs border border-green-300 rounded focus:border-green-500 focus:outline-none"
                            >
                              <option value="room">{t('doors.room')}</option>
                              <option value="standard">{t('doors.standard')}</option>
                              <option value="pantry">{t('doors.pantry')}</option>
                            </select>
                          </div>

                          {/* Door width input */}
                          <div className="flex items-center gap-2">
                            <label htmlFor={`door-width-${wallNum}`} className="text-xs text-green-800 w-16">{t('doors.width')}:</label>
                            <input
                              type="number"
                              id={`door-width-${wallNum}`}
                              min={DOOR_MIN_WIDTH}
                              max={DOOR_MAX_WIDTH}
                              defaultValue="36"
                              aria-invalid={doorWidthErrors[wallNum] ? true : undefined}
                              aria-describedby={`${doorWidthErrors[wallNum] ? `kd-door-error-${wallNum} ` : ''}kd-new-door-hint-${wallNum}`}
                              className="flex-1 px-2 py-1 text-xs border border-green-300 rounded focus:border-green-500 focus:outline-none"
                            />
                            <span className="text-xs text-green-800">{t('doors.inches')}</span>
                            <span className="sr-only" id={`kd-new-door-hint-${wallNum}`}>
                              {t('designer.hint.range', { min: DOOR_MIN_WIDTH, max: DOOR_MAX_WIDTH, unit: t('doors.inches') })}
                            </span>
                          </div>

                          {/* Inline error instead of alert() (WCAG 3.3.1) */}
                          {doorWidthErrors[wallNum] && (
                            <p id={`kd-door-error-${wallNum}`} className="text-xs text-red-700">
                              {doorWidthErrors[wallNum]}
                            </p>
                          )}

                          {/* Add button */}
                          <button
                            type="button"
                            onClick={() => {
                              const typeSelect = document.getElementById(`door-type-${wallNum}`);
                              const widthInput = document.getElementById(`door-width-${wallNum}`);
                              const doorType = typeSelect.value;
                              const width = parseFloat(widthInput.value) || 36;
                              const position = 50; // Default center position

                              if (width >= DOOR_MIN_WIDTH && width <= DOOR_MAX_WIDTH) {
                                setDoorWidthErrors(prev => ({ ...prev, [wallNum]: null }));
                                addDoor(wallNum, position, width, doorType);
                                announce(t('designer.doorAdded', { wall: getWallName(wallNum) }));
                                // Reset form
                                typeSelect.value = 'room';
                                widthInput.value = '36';
                              } else {
                                const message = t('designer.error.doorWidth', { min: DOOR_MIN_WIDTH, max: DOOR_MAX_WIDTH });
                                setDoorWidthErrors(prev => ({ ...prev, [wallNum]: message }));
                                announce(message);
                                widthInput.focus();
                              }
                            }}
                            className="w-full text-xs py-2 px-3 min-h-10 bg-green-700 text-white rounded hover:bg-green-800 active:bg-green-800 transition-colors"
                            title={t('designer.addDoorHint', { wall: getWallName(wallNum) })}
                          >
                            <span aria-hidden="true">🚪</span> {t('doors.add')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Custom wall options */}
                  {isCustom && isPresent && (
                    <div className="mt-2 space-y-1">
                      <button
                        type="button"
                        aria-pressed={existedPrior}
                        onClick={() => {
                          if (existedPrior) {
                            // Remove from existed prior
                            const updatedCustomWalls = customWalls.map(wall =>
                              wall.wallNumber === wallNum
                                ? { ...wall, existedPrior: false }
                                : wall
                            );
                            const updatedOriginalWalls = originalWalls.filter(w => w !== wallNum);
                            setCurrentRoomData({
                              ...currentRoomData,
                              customWalls: updatedCustomWalls,
                              originalWalls: updatedOriginalWalls
                            });
                          } else {
                            markWallAsExistedPrior(wallNum);
                          }
                        }}
                        className={`text-xs py-1 px-2 rounded w-full ${existedPrior
                            ? 'bg-yellow-100 text-yellow-900 hover:bg-yellow-200'
                            : 'bg-yellow-700 text-white hover:bg-yellow-800'
                          }`}
                        title={existedPrior ? t('designer.unmarkExistedPriorHint') : t('designer.markExistedPriorHint')}
                      >
                        {existedPrior ? <><span aria-hidden="true">✓ </span>{t('designer.existedPriorUnmark')}</> : t('designer.markAsExistedPrior')}
                      </button>

                      <div className="space-y-1">
                        <label htmlFor={`kd-wall-length-${wallNum}`} className="block text-xs text-gray-700">{t('designer.wallLength')}: {wallLengthInches.toFixed(1)}"</label>
                        <div className="flex gap-1">
                          <input
                            id={`kd-wall-length-${wallNum}`}
                            type="number"
                            min="12"
                            step="1"
                            value={Math.round(wallLengthInches)}
                            onChange={(e) => {
                              const newLength = parseFloat(e.target.value) || 12;
                              if (resizeCustomWall) resizeCustomWall(wallNum, newLength);
                            }}
                            className="flex-1 text-xs px-1 py-1 border rounded"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label htmlFor={`kd-wall-angle-${wallNum}`} className="block text-xs text-gray-700">{t('designer.wallRotation')}: {getCurrentWallAngle(wallNum).toFixed(1)}°</label>
                        <div className="flex gap-1">
                          <input
                            id={`kd-wall-angle-${wallNum}`}
                            type="number"
                            min="-180"
                            max="180"
                            step="1"
                            value={Math.round(getCurrentWallAngle(wallNum))}
                            onChange={(e) => {
                              const newAngle = parseFloat(e.target.value) || 0;
                              rotateCustomWall(wallNum, newAngle);
                            }}
                            className="flex-1 text-xs px-1 py-1 border rounded"
                          />
                          <button
                            type="button"
                            onClick={() => rotateCustomWall(wallNum, getCurrentWallAngle(wallNum) + 15)}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            aria-label={t('designer.rotateWallBy', { deg: '+15' })}
                          >
                            +15°
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>


          {/* Wall modification cost summary */}
          {(currentRoomData.removedWalls?.length > 0 ||
            (currentRoomData.walls || []).some(wall => !originalWalls.includes(wall))) && (
              <div className="text-xs bg-yellow-50 border border-yellow-200 rounded p-2">
                <div className="font-medium text-yellow-900">{t('pricing.walls')}:</div>
                <div className="text-yellow-900">
                  {(() => {
                    const removedWalls = currentRoomData.removedWalls || [];
                    const chargeableRemoved = removedWalls.filter(wall => originalWalls.includes(wall));
                    const customAdded = (currentRoomData.walls || []).filter(wall => !originalWalls.includes(wall));

                    return (
                      <>
                        {chargeableRemoved.length > 0 && (
                          <div>{t('designer.wallsRemovedCost', { count: chargeableRemoved.length, cost: (chargeableRemoved.length * wallPricing.removeWall).toFixed(2) })}</div>
                        )}
                        {customAdded.length > 0 && (
                          <div>{t('designer.wallsAddedCost', { count: customAdded.length, cost: (customAdded.length * wallPricing.addWall).toFixed(2) })}</div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export default WallManagement;