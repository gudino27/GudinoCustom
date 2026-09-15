import React, { useState, useRef, useEffect, useId } from 'react';
import { RotateCw, Trash2, X, ArrowLeftToLine, ArrowRightToLine } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useIsMobile } from '../../hooks/useResponsive';
import { getElementName } from './elementName';

// Module-level variable to persist panel position across component mounts
let persistedPosition = { x: 20, y: 120 };

const PANEL_WIDTH = 288; // w-72
const DOCK_MARGIN = 20;

// Number input that lets the user clear and retype a value; each valid number
// is committed straight away, and the field shows the real value again on blur.
const PositionInput = ({ id, value, min, max, onCommit, describedBy }) => {
  const [draft, setDraft] = useState(null);
  return (
    <input
      id={id}
      type="number"
      step="any"
      inputMode="decimal"
      min={min}
      max={max}
      value={draft ?? value}
      onChange={(e) => {
        setDraft(e.target.value);
        const num = parseFloat(e.target.value);
        if (!Number.isNaN(num)) onCommit(num);
      }}
      onBlur={() => setDraft(null)}
      aria-describedby={describedBy}
      className="w-full p-3 min-h-12 text-sm border rounded"
    />
  );
};

const FloatingPropertiesPanel = ({
  selectedElement,
  currentRoomData,
  setCurrentRoomData,
  elementTypes,
  updateElement,
  deleteElement,
  rotateElement,
  rotateCornerCabinet,
  materialMultipliers,
  scale = 1,
  onPositionChange,
  focusRequest = false,
  onFocusRequestHandled,
  onClose
}) => {
  const { t } = useLanguage();
  const isMobile = useIsMobile(); // Detect mobile for modal mode
  const panelRef = useRef(null);
  const headingRef = useRef(null);
  const uid = useId();
  const fieldId = (name) => `${uid}-${name}`;

  // Use persisted position from module-level variable
  const [position, setPosition] = useState(persistedPosition);

  const [isDragging, setIsDragging] = useState(false);
  const dragCacheRef = useRef({
    lastPosition: null,
    rafId: null,
    initialOffset: { x: 0, y: 0 }
  });

  // Helper function to get coordinates from mouse or touch event
  const getEventCoordinates = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  };

  // Hybrid drag handler - direct DOM manipulation for zero-lag, state update on mouse/touch up
  const handlePointerDown = (e) => {
    // Don't drag on mobile (modal mode)
    if (isMobile) return;

    e.preventDefault();
    if (!panelRef.current) return;

    const { clientX, clientY } = getEventCoordinates(e);
    const rect = panelRef.current.getBoundingClientRect();
    dragCacheRef.current.initialOffset = {
      x: clientX - rect.left,
      y: clientY - rect.top
    };

    // Disable transitions during drag for smooth movement
    if (panelRef.current) {
      panelRef.current.style.transition = 'none';
    }

    setIsDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!isDragging || !panelRef.current) return;

    const { clientX, clientY } = getEventCoordinates(e);

    // Calculate new position directly - no RAF needed for simple position updates
    const newX = clientX - dragCacheRef.current.initialOffset.x;
    const newY = clientY - dragCacheRef.current.initialOffset.y;

    // Store position in cache
    dragCacheRef.current.lastPosition = { x: newX, y: newY };

    // Direct DOM manipulation for instant visual feedback
    panelRef.current.style.left = `${newX}px`;
    panelRef.current.style.top = `${newY}px`;
  };

  const handlePointerUp = () => {
    if (!isDragging) return;

    // Re-enable transitions
    if (panelRef.current) {
      panelRef.current.style.transition = '';
    }

    // Update React state with final position for persistence
    if (dragCacheRef.current.lastPosition) {
      setPosition(dragCacheRef.current.lastPosition);
    }

    // Clear drag cache
    dragCacheRef.current = {
      lastPosition: null,
      rafId: null,
      initialOffset: { x: 0, y: 0 }
    };

    setIsDragging(false);
  };

  // Sync position changes to module-level variable for persistence
  useEffect(() => {
    persistedPosition = position;
  }, [position]);

  // Add global mouse and touch event listeners when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handlePointerMove);
      document.addEventListener('mouseup', handlePointerUp);
      document.addEventListener('touchmove', handlePointerMove);
      document.addEventListener('touchend', handlePointerUp);
      return () => {
        document.removeEventListener('mousemove', handlePointerMove);
        document.removeEventListener('mouseup', handlePointerUp);
        document.removeEventListener('touchmove', handlePointerMove);
        document.removeEventListener('touchend', handlePointerUp);
      };
    }
  }, [isDragging]);

  // Opened from the keyboard (floor plan item or element list): move focus in
  useEffect(() => {
    if (focusRequest && headingRef.current) {
      headingRef.current.focus();
      if (onFocusRequestHandled) onFocusRequestHandled();
    }
  }, [focusRequest, selectedElement, onFocusRequestHandled]);

  // Close and tell the page whether focus was inside, so it can put it back
  const closePanel = () => {
    const hadFocus = !!panelRef.current && panelRef.current.contains(document.activeElement);
    onClose({ restoreFocus: hadFocus });
  };

  // Single-click alternative to dragging the panel by its header (WCAG 2.5.7)
  const dockPanel = (side) => {
    const x = side === 'left'
      ? DOCK_MARGIN
      : Math.max(DOCK_MARGIN, window.innerWidth - PANEL_WIDTH - DOCK_MARGIN);
    setPosition((prev) => ({ ...prev, x }));
  };

  // Find the actual element object
  const element = currentRoomData.elements.find(el => el.id === selectedElement);

  if (!element) return null;

  const elementSpec = elementTypes[element.type];
  if (!elementSpec) return null;

  const elementName = getElementName(t, element.type, elementTypes);
  const materialLabel = (material) =>
    t(`materials.${material}`, material.charAt(0).toUpperCase() + material.slice(1));

  // Position of the item's footprint, in inches from the left and top walls
  const round1 = (n) => Math.round(n * 10) / 10;
  const turned = element.rotation % 180 !== 0;
  const footprintWidth = turned ? element.depth : element.width;
  const footprintDepth = turned ? element.width : element.depth;
  const maxX = Math.max(0, round1(parseFloat(currentRoomData.dimensions.width) * 12 - footprintWidth));
  const maxY = Math.max(0, round1(parseFloat(currentRoomData.dimensions.height) * 12 - footprintDepth));

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={closePanel}
        />
      )}

      {/* Properties Panel (non-modal: the floor plan stays usable) */}
      <div
        ref={panelRef}
        role="dialog"
        aria-labelledby={fieldId('title')}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            closePanel();
          }
        }}
        className={`
          bg-white shadow-xl border border-gray-200 overflow-hidden flex flex-col
          ${isMobile
            ? 'fixed bottom-4 right-4 z-50 rounded-xl w-80 max-w-[calc(100vw-2rem)]'
            : 'absolute z-50 rounded-lg w-72'
          }
        `}
        style={isMobile ? {
          maxHeight: 'calc(50vh - 2rem)',
          marginBottom: 'env(safe-area-inset-bottom, 0px)'
        } : {
          left: `${position.x}px`,
          top: `${position.y}px`,
          maxHeight: 'calc(100vh - 140px)'
        }}
      >
        {/* Header */}
        <div
          className={`bg-gray-50 p-3 border-b flex justify-between items-center select-none ${!isMobile ? 'cursor-move' : ''}`}
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
        >
          <h2
            ref={headingRef}
            id={fieldId('title')}
            tabIndex={-1}
            className="font-semibold text-gray-700 truncate pr-2 text-sm focus:outline-none"
          >
            {elementName}
          </h2>
          <div className="flex items-center">
            {!isMobile && (
              <>
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => dockPanel('left')}
                  className="text-gray-600 hover:text-gray-800 p-2 min-h-10 min-w-10 rounded-full hover:bg-gray-200 active:bg-gray-300 transition-all flex items-center justify-center"
                  aria-label={t('designer.dockLeft')}
                  title={t('designer.dockLeft')}
                >
                  <ArrowLeftToLine size={16} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => dockPanel('right')}
                  className="text-gray-600 hover:text-gray-800 p-2 min-h-10 min-w-10 rounded-full hover:bg-gray-200 active:bg-gray-300 transition-all flex items-center justify-center"
                  aria-label={t('designer.dockRight')}
                  title={t('designer.dockRight')}
                >
                  <ArrowRightToLine size={16} />
                </button>
              </>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={closePanel}
              className="text-gray-600 hover:text-gray-800 active:text-gray-800 p-2 min-h-10 min-w-10 rounded-full hover:bg-gray-200 active:bg-gray-300 active:scale-95 transition-all flex items-center justify-center"
              aria-label={t('designer.closeProperties')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto custom-scrollbar">
          <div className="space-y-4">

            {/* Position: typed alternative to dragging on the floor plan (WCAG 2.5.7) */}
            {onPositionChange && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={fieldId('posx')} className="block text-sm font-semibold text-gray-500 uppercase mb-1">{t('designer.positionX')}</label>
                  <PositionInput
                    id={fieldId('posx')}
                    value={round1(element.x / scale)}
                    min={0}
                    max={maxX}
                    describedBy={fieldId('posx-hint')}
                    onCommit={(inches) => onPositionChange(element.id, 'x', inches)}
                  />
                  <p id={fieldId('posx-hint')} className="text-xs text-gray-600 mt-1">
                    {t('designer.hint.range', { min: 0, max: maxX, unit: t('designer.unit.in') })}
                  </p>
                </div>
                <div>
                  <label htmlFor={fieldId('posy')} className="block text-sm font-semibold text-gray-500 uppercase mb-1">{t('designer.positionY')}</label>
                  <PositionInput
                    id={fieldId('posy')}
                    value={round1(element.y / scale)}
                    min={0}
                    max={maxY}
                    describedBy={fieldId('posy-hint')}
                    onCommit={(inches) => onPositionChange(element.id, 'y', inches)}
                  />
                  <p id={fieldId('posy-hint')} className="text-xs text-gray-600 mt-1">
                    {t('designer.hint.range', { min: 0, max: maxY, unit: t('designer.unit.in') })}
                  </p>
                </div>
              </div>
            )}

            {/* Material selection for cabinets */}
            {element.category === 'cabinet' && (
              <div>
                <label htmlFor={fieldId('material')} className="block text-sm font-semibold text-gray-500 uppercase mb-1">{t('designer.material')}</label>
                <select
                  id={fieldId('material')}
                  value={currentRoomData.materials?.[element.id] || 'laminate'}
                  onChange={(e) => {
                    setCurrentRoomData({
                      ...currentRoomData,
                      materials: {
                        ...currentRoomData.materials,
                        [element.id]: e.target.value
                      }
                    });
                  }}
                  className="w-full p-3 min-h-12 text-sm border rounded bg-gray-50 focus:bg-white transition-colors"
                >
                  {Object.entries(materialMultipliers).map(([material, multiplier]) => (
                    <option key={material} value={material}>
                      {materialLabel(material)} ({multiplier === 1 ? t('designer.included') : `+${Math.round((multiplier - 1) * 100)}%`})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Dimensions Group */}
            <div className="grid grid-cols-2 gap-3">
              {/* Width */}
              {elementSpec.category === 'cabinet' && (
                <div>
                  <label htmlFor={fieldId('width')} className="block text-sm font-semibold text-gray-500 uppercase mb-1">{t('designer.widthIn')}</label>
                  <input
                    id={fieldId('width')}
                    type="number"
                    step="0.5"
                    inputMode="decimal"
                    value={element.width}
                    onChange={(e) => updateElement(element.id, { width: parseFloat(e.target.value) })}
                    className="w-full p-3 min-h-12 text-sm border rounded"
                    min="12"
                    max="60"
                    aria-describedby={fieldId('width-hint')}
                  />
                  <p id={fieldId('width-hint')} className="text-xs text-gray-600 mt-1">
                    {t('designer.hint.range', { min: 12, max: 60, unit: t('designer.unit.in') })}
                  </p>
                </div>
              )}

              {/* Depth */}
              {elementSpec.category === 'cabinet' && (
                <div>
                  <label htmlFor={fieldId('depth')} className="block text-sm font-semibold text-gray-500 uppercase mb-1">{t('designer.depthIn')}</label>
                  <input
                    id={fieldId('depth')}
                    type="number"
                    step="0.5"
                    inputMode="decimal"
                    value={element.depth}
                    onChange={(e) => updateElement(element.id, { depth: parseFloat(e.target.value) })}
                    className="w-full p-3 min-h-12 text-sm border rounded"
                    min="12"
                    max="36"
                    aria-describedby={fieldId('depth-hint')}
                  />
                  <p id={fieldId('depth-hint')} className="text-xs text-gray-600 mt-1">
                    {t('designer.hint.range', { min: 12, max: 36, unit: t('designer.unit.in') })}
                  </p>
                </div>
              )}
            </div>

            {/* Height - for variable height elements */}
            {elementSpec.category === 'cabinet' && !elementSpec.fixedHeight && (
              <div>
                <label htmlFor={fieldId('height')} className="block text-sm font-semibold text-gray-500 uppercase mb-1">{t('designer.heightIn')}</label>
                <input
                  id={fieldId('height')}
                  type="number"
                  step="0.5"
                  inputMode="decimal"
                  value={element.actualHeight || elementSpec.defaultHeight}
                  onChange={(e) => updateElement(element.id, { actualHeight: parseFloat(e.target.value) })}
                  className="w-full p-3 min-h-12 text-sm border rounded"
                  min={elementSpec.minHeight || (elementSpec.mountType === 'wall' ? 12 : 40)}
                  max={elementSpec.mountType === 'wall' ? currentRoomData.dimensions.wallHeight - element.mountHeight : currentRoomData.dimensions.wallHeight}
                />
              </div>
            )}

            {/* Mount height for wall-mounted elements */}
            {elementSpec.mountHeight !== undefined && (
              <div>
                <label htmlFor={fieldId('mount')} className="block text-sm font-semibold text-gray-500 uppercase mb-1">{t('designer.mountHeightIn')}</label>
                <input
                  id={fieldId('mount')}
                  type="number"
                  step="0.5"
                  inputMode="decimal"
                  value={element.mountHeight}
                  onChange={(e) => updateElement(element.id, { mountHeight: parseFloat(e.target.value) })}
                  className="w-full p-3 min-h-12 text-sm border rounded"
                  min="0"
                  max={parseFloat(currentRoomData.dimensions.wallHeight) - (element.actualHeight || elementSpec.fixedHeight || elementSpec.defaultHeight)}
                />
              </div>
            )}

            {/* Rotation Controls */}
            <fieldset className="min-w-0">
              <legend className="block text-sm font-semibold text-gray-500 uppercase mb-2">{t('designer.rotationDeg', { deg: element.rotation })}</legend>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => rotateElement(element.id, -90)}
                  className="p-3 min-h-12 bg-gray-100 rounded hover:bg-gray-200 active:bg-gray-300 active:scale-95 transition-all flex items-center justify-center"
                  aria-label={t('designer.rotateBy', { deg: '-90' })}
                  title={t('designer.rotateBy', { deg: '-90' })}
                >
                  <RotateCw size={16} className="transform scale-x-[-1]" />
                </button>
                <button
                  type="button"
                  onClick={() => rotateElement(element.id, -15)}
                  className="p-3 min-h-12 bg-blue-50 rounded hover:bg-blue-100 active:bg-blue-200 active:scale-95 transition-all flex items-center justify-center text-sm font-medium text-blue-700"
                  title={t('designer.rotateBy', { deg: '-15' })}
                >
                  -15°
                </button>
                <button
                  type="button"
                  onClick={() => rotateElement(element.id, 15)}
                  className="p-3 min-h-12 bg-blue-50 rounded hover:bg-blue-100 active:bg-blue-200 active:scale-95 transition-all flex items-center justify-center text-sm font-medium text-blue-700"
                  title={t('designer.rotateBy', { deg: '+15' })}
                >
                  +15°
                </button>
                <button
                  type="button"
                  onClick={() => rotateElement(element.id, 90)}
                  className="p-3 min-h-12 bg-gray-100 rounded hover:bg-gray-200 active:bg-gray-300 active:scale-95 transition-all flex items-center justify-center"
                  aria-label={t('designer.rotateBy', { deg: '+90' })}
                  title={t('designer.rotateBy', { deg: '+90' })}
                >
                  <RotateCw size={16} />
                </button>
              </div>
            </fieldset>

            {/* Corner cabinet hinge direction */}
            {element.type && element.type.includes('corner') && (
              <fieldset className="min-w-0">
                <legend className="block text-sm font-semibold text-gray-500 uppercase mb-2">{t('designer.hingeDirection')}</legend>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => rotateCornerCabinet(element.id, 'left')}
                    aria-pressed={element.hingeDirection === 'left'}
                    className={`flex-1 p-3 min-h-12 text-sm font-medium rounded active:scale-95 transition-all ${element.hingeDirection === 'left' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-700 active:bg-blue-200'}`}
                  >
                    {t('designer.hingeLeft')}
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateCornerCabinet(element.id, 'right')}
                    aria-pressed={element.hingeDirection === 'right'}
                    className={`flex-1 p-3 min-h-12 text-sm font-medium rounded active:scale-95 transition-all ${element.hingeDirection === 'right' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-700 active:bg-blue-200'}`}
                  >
                    {t('designer.hingeRight')}
                  </button>
                </div>
              </fieldset>
            )}

            {/* Delete Action */}
            <div className="pt-2 border-t mt-2">
              <button
                type="button"
                onClick={() => deleteElement(element.id)}
                className="w-full p-3 min-h-12 bg-red-50 text-red-700 rounded hover:bg-red-100 active:bg-red-200 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Trash2 size={16} />
                {t('designer.removeItem')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FloatingPropertiesPanel;
