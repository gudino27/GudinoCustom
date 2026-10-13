import React, { useState, useRef, useEffect, useId } from 'react';
import { RotateCw, Trash2, X, ArrowLeftToLine, ArrowRightToLine, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useIsMobile } from '../../hooks/useResponsive';
import { getElementName } from './elementName';
import { isQuarterTurned } from '../../utils/designer/rotation';
import {
  UPPER_HEIGHT_RANGE,
  housingBay,
  housingChangeProblem,
  housingOf,
  openingWidth,
  widthForOpening,
} from '../../utils/designer/housing';
import { housingProblemText } from './housingMessage';
import InchInput from './InchInput';
import { formatInches, formatInchesPlain, roundInches } from '../../utils/designer/planUnits';

// Module-level variable to persist panel position across component mounts;
// null until the user moves it, so it opens docked to the right, clear of the
// sidebar's View Mode buttons
let persistedPosition = null;

const PANEL_WIDTH = 288; // w-72
const DOCK_MARGIN = 20;
const PANEL_TOP = 120;

const rightDockX = () =>
  typeof window === 'undefined'
    ? DOCK_MARGIN
    : Math.max(DOCK_MARGIN, window.innerWidth - PANEL_WIDTH - DOCK_MARGIN);

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
  const [position, setPosition] = useState(
    () => persistedPosition || { x: rightDockX(), y: PANEL_TOP }
  );

  const [isDragging, setIsDragging] = useState(false);
  // Why the last change to a refrigerator cabinet was declined (shown in the
  // panel; the page also announces it), cleared by another item or a change
  const [refusal, setRefusal] = useState(null);
  useEffect(() => {
    setRefusal(null);
  }, [selectedElement]);

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
    const x = side === 'left' ? DOCK_MARGIN : rightDockX();
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
  const turned = isQuarterTurned(element.rotation);
  const footprintWidth = turned ? element.depth : element.width;
  const footprintDepth = turned ? element.width : element.depth;
  const maxX = Math.max(0, roundInches(parseFloat(currentRoomData.dimensions.width) * 12 - footprintWidth));
  const maxY = Math.max(0, roundInches(parseFloat(currentRoomData.dimensions.height) * 12 - footprintDepth));

  // A refrigerator cabinet (houses an appliance): changes that would leave the
  // fridge inside no longer fitting are declined by updateElement
  const housing = housingOf(element, elementTypes);
  const wallHeight = parseFloat(currentRoomData.dimensions.wallHeight) || 96;
  const changeHousing = (updates) => {
    const problem = housingChangeProblem(element, updates, currentRoomData.elements, elementTypes, scale);
    const ok = updateElement(element.id, updates);
    setRefusal(ok === false && problem ? housingProblemText(t, problem, elementTypes) : null);
  };
  const housingHeight = element.actualHeight || elementSpec.defaultHeight;
  const housingHeightMin = elementSpec.minHeight || 40;
  const housingHeightMax = Math.max(housingHeightMin, wallHeight);
  const upperMax = housing
    ? Math.max(UPPER_HEIGHT_RANGE.min, Math.min(UPPER_HEIGHT_RANGE.max, housingHeight - 12))
    : UPPER_HEIGHT_RANGE.max;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  // Hints read the limits as fractions ("Between 12 and 47 1/4 in"); every
  // inch box also points at the shared "e.g. 24 3/8" hint
  const range = (min, max) => t('designer.hint.range', { min: formatInchesPlain(min), max: formatInchesPlain(max), unit: t('designer.unit.in') });
  const fmtHint = fieldId('fraction-hint');
  const describe = (...ids) => [...ids, fmtHint].filter(Boolean).join(' ');
  const refusalId = refusal ? fieldId('refusal') : null;
  const heightMin = elementSpec.minHeight || (elementSpec.mountType === 'wall' ? 12 : 40);
  const heightMax = (parseFloat(currentRoomData.dimensions.wallHeight) || 96) - (elementSpec.mountType === 'wall' ? (Number(element.mountHeight) || 0) : 0);
  const mountMax = Math.max(0, (parseFloat(currentRoomData.dimensions.wallHeight) || 96) - (element.actualHeight || elementSpec.fixedHeight || elementSpec.defaultHeight));

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

            {/* How to type a length; every inch box points here */}
            <p id={fmtHint} className="text-xs text-gray-600">{t('designer.hint.fraction')}</p>

            {/* Position: typed alternative to dragging on the floor plan (WCAG 2.5.7) */}
            {onPositionChange && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={fieldId('posx')} className="block text-sm font-semibold text-gray-500 uppercase mb-1">{t('designer.positionX')}</label>
                  <InchInput
                    id={fieldId('posx')}
                    value={roundInches(element.x / scale)}
                    min={0}
                    max={maxX}
                    live
                    describedBy={describe(fieldId('posx-hint'))}
                    onCommit={(inches) => onPositionChange(element.id, 'x', inches)}
                  />
                  <p id={fieldId('posx-hint')} className="text-xs text-gray-600 mt-1">
                    {range(0, maxX)}
                  </p>
                </div>
                <div>
                  <label htmlFor={fieldId('posy')} className="block text-sm font-semibold text-gray-500 uppercase mb-1">{t('designer.positionY')}</label>
                  <InchInput
                    id={fieldId('posy')}
                    value={roundInches(element.y / scale)}
                    min={0}
                    max={maxY}
                    live
                    describedBy={describe(fieldId('posy-hint'))}
                    onCommit={(inches) => onPositionChange(element.id, 'y', inches)}
                  />
                  <p id={fieldId('posy-hint')} className="text-xs text-gray-600 mt-1">
                    {range(0, maxY)}
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
              {/* Width (a refrigerator cabinet's is committed on Enter / blur, and may be declined) */}
              {elementSpec.category === 'cabinet' && housing && (
                <div>
                  <label htmlFor={fieldId('width')} className="block text-sm font-semibold text-gray-500 uppercase mb-1">{t('designer.widthIn')}</label>
                  <InchInput
                    id={fieldId('width')}
                    value={element.width}
                    min={12}
                    max={60}
                    onCommit={(w) => changeHousing({ width: clamp(w, 12, 60) })}
                    describedBy={describe(fieldId('width-hint'), refusalId)}
                    invalid={!!refusal}
                  />
                  <p id={fieldId('width-hint')} className="text-xs text-gray-600 mt-1">
                    {range(12, 60)}
                  </p>
                </div>
              )}
              {elementSpec.category === 'cabinet' && !housing && (
                <div>
                  <label htmlFor={fieldId('width')} className="block text-sm font-semibold text-gray-500 uppercase mb-1">{t('designer.widthIn')}</label>
                  <InchInput
                    id={fieldId('width')}
                    value={element.width}
                    min={12}
                    max={60}
                    live
                    onCommit={(w) => updateElement(element.id, { width: w })}
                    describedBy={describe(fieldId('width-hint'))}
                  />
                  <p id={fieldId('width-hint')} className="text-xs text-gray-600 mt-1">
                    {range(12, 60)}
                  </p>
                </div>
              )}

              {/* Depth */}
              {elementSpec.category === 'cabinet' && (
                <div>
                  <label htmlFor={fieldId('depth')} className="block text-sm font-semibold text-gray-500 uppercase mb-1">{t('designer.depthIn')}</label>
                  <InchInput
                    id={fieldId('depth')}
                    value={element.depth}
                    min={12}
                    max={36}
                    live
                    onCommit={(d) => updateElement(element.id, { depth: d })}
                    describedBy={describe(fieldId('depth-hint'))}
                  />
                  <p id={fieldId('depth-hint')} className="text-xs text-gray-600 mt-1">
                    {range(12, 36)}
                  </p>
                </div>
              )}
            </div>

            {/* Refrigerator cabinet: overall height (to the ceiling or the tall
                cabinets' line) and the cabinet over the opening; neither may
                come down onto the fridge inside */}
            {housing && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={fieldId('height')} className="block text-sm font-semibold text-gray-500 uppercase mb-1">{t('designer.heightIn')}</label>
                  <InchInput
                    id={fieldId('height')}
                    value={housingHeight}
                    min={housingHeightMin}
                    max={housingHeightMax}
                    onCommit={(h) => changeHousing({ actualHeight: clamp(h, housingHeightMin, housingHeightMax) })}
                    describedBy={describe(fieldId('height-hint'), refusalId)}
                    invalid={!!refusal}
                  />
                  <p id={fieldId('height-hint')} className="text-xs text-gray-600 mt-1">
                    {t('designer.refrigeratorHeightHint', { min: formatInchesPlain(housingHeightMin), max: formatInchesPlain(housingHeightMax) })}
                  </p>
                </div>
                <div>
                  <label htmlFor={fieldId('upper')} className="block text-sm font-semibold text-gray-500 uppercase mb-1">{t('designer.upperHeight')}</label>
                  <InchInput
                    id={fieldId('upper')}
                    value={housing.topHeight}
                    min={UPPER_HEIGHT_RANGE.min}
                    max={upperMax}
                    onCommit={(u) => changeHousing({ upperHeight: clamp(u, UPPER_HEIGHT_RANGE.min, upperMax) })}
                    describedBy={describe(fieldId('upper-hint'), refusalId)}
                    invalid={!!refusal}
                  />
                  <p id={fieldId('upper-hint')} className="text-xs text-gray-600 mt-1">
                    {t('designer.upperHeightHint', {
                      min: formatInchesPlain(UPPER_HEIGHT_RANGE.min),
                      max: formatInchesPlain(upperMax),
                      open: formatInchesPlain(housingBay(element, elementTypes, 1).top - (Number(element.mountHeight) || 0)),
                    })}
                  </p>
                </div>
              </div>
            )}

            {/* Why the last size change was declined (visible; the page's
                notice announces it through the live region) */}
            {housing && refusal && (
              <p
                id={fieldId('refusal')}
                className="flex items-start gap-2 p-3 text-sm rounded border border-red-300 bg-red-50 text-red-800"
              >
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>{refusal}</span>
              </p>
            )}

            {/* Height - for variable height elements */}
            {elementSpec.category === 'cabinet' && !elementSpec.fixedHeight && !housing && (
              <div>
                <label htmlFor={fieldId('height')} className="block text-sm font-semibold text-gray-500 uppercase mb-1">{t('designer.heightIn')}</label>
                <InchInput
                  id={fieldId('height')}
                  value={element.actualHeight || elementSpec.defaultHeight}
                  min={heightMin}
                  max={Math.max(heightMin, heightMax)}
                  live
                  onCommit={(h) => updateElement(element.id, { actualHeight: h })}
                  describedBy={describe(fieldId('height-hint'))}
                />
                <p id={fieldId('height-hint')} className="text-xs text-gray-600 mt-1">
                  {range(heightMin, Math.max(heightMin, heightMax))}
                </p>
              </div>
            )}

            {/* Mount height for wall-mounted elements */}
            {elementSpec.mountHeight !== undefined && (
              <div>
                <label htmlFor={fieldId('mount')} className="block text-sm font-semibold text-gray-500 uppercase mb-1">{t('designer.mountHeightIn')}</label>
                <InchInput
                  id={fieldId('mount')}
                  value={element.mountHeight}
                  min={0}
                  max={mountMax}
                  live
                  onCommit={(m) => updateElement(element.id, { mountHeight: m })}
                  describedBy={describe(fieldId('mount-hint'))}
                />
                <p id={fieldId('mount-hint')} className="text-xs text-gray-600 mt-1">
                  {range(0, mountMax)}
                </p>
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

            {/* Refrigerator cabinet: the opening sets the cabinet width */}
            {Array.isArray(elementSpec.openingWidths) && housingOf(element, elementTypes) && (() => {
              const opening = Math.round(openingWidth(element, elementTypes) * 100) / 100;
              const panel = housingOf(element, elementTypes).sidePanel;
              const listed = elementSpec.openingWidths.includes(opening);
              return (
                <div>
                  <label htmlFor={fieldId('opening')} className="block text-sm font-semibold text-gray-500 uppercase mb-1">{t('designer.openingWidth')}</label>
                  <select
                    id={fieldId('opening')}
                    value={String(opening)}
                    onChange={(e) => changeHousing({
                      width: widthForOpening(element.type, parseFloat(e.target.value), elementTypes),
                    })}
                    className="w-full p-3 min-h-12 text-sm border rounded bg-gray-50 focus:bg-white transition-colors"
                    aria-describedby={`${fieldId('opening-hint')}${refusal ? ` ${fieldId('refusal')}` : ''}`}
                    aria-invalid={!!refusal || undefined}
                  >
                    {!listed && (
                      <option value={String(opening)}>{t('designer.openingCustom', { width: formatInchesPlain(opening) })}</option>
                    )}
                    {elementSpec.openingWidths.map((w) => (
                      <option key={w} value={String(w)}>{formatInches(w)}</option>
                    ))}
                  </select>
                  <p id={fieldId('opening-hint')} className="text-xs text-gray-600 mt-1">
                    {t('designer.openingWidthHint', { panel: formatInchesPlain(panel) })}
                  </p>
                </div>
              );
            })()}

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
