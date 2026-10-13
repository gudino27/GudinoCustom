import React, { useEffect, useId, useRef } from 'react';
import { Trash2, X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useIsMobile } from '../../hooks/useResponsive';
import { PANTRY_DEFAULTS, partitionSides, shapeOf } from '../../utils/designer/pantry';
import { formatInchesPlain, roundInches } from '../../utils/designer/planUnits';
import InchInput from './InchInput';

const FIELD = 'w-full p-2 min-h-11 text-sm border rounded';

// Settings of the selected pantry: inside size, where its cased opening is
// and how wide, and Remove. Non-modal like the item properties panel: the
// plan stays usable. Lengths are typed in inches with fractions (24 3/8)
// and commit on Enter or blur (a size that would put a wall on an item is
// declined, and the field goes back).
const PantryPanel = ({
  pantry,
  roomData,
  scale,
  name,
  wallName,
  focusRequest,
  onFocusRequestHandled,
  onResize,
  onOpeningChange,
  onExistedPriorChange,
  onRemove,
  onClose,
}) => {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const uid = useId().replace(/:/g, '');
  const headingRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (focusRequest && headingRef.current) {
      headingRef.current.focus();
      if (onFocusRequestHandled) onFocusRequestHandled();
    }
  }, [focusRequest, onFocusRequestHandled]);

  if (!pantry) return null;
  const parts = partitionSides(pantry, roomData, scale);
  const widthIn = roundInches(pantry.width / scale);
  const depthIn = roundInches(pantry.depth / scale);
  const opening = pantry.opening || {};
  const openingSide = parts.includes(opening.side) ? opening.side : parts[0];
  const sideLengthIn = openingSide === 'n' || openingSide === 's' ? widthIn : depthIn;
  const maxOpening = Math.max(12, Math.min(PANTRY_DEFAULTS.maxOpening, Math.floor(sideLengthIn - 4)));
  const minOpening = Math.min(PANTRY_DEFAULTS.minOpening, maxOpening);
  const half = (opening.width || PANTRY_DEFAULTS.openingWidth) / 2;
  const centerMin = Math.ceil(half + 2);
  const centerMax = Math.max(centerMin, Math.floor(sideLengthIn - half - 2));
  const center = roundInches(opening.center ?? sideLengthIn / 2);
  const fmtHint = `${uid}-fraction-hint`;
  const from = openingSide === 'n' || openingSide === 's' ? t('designer.pantry.from.west') : t('designer.pantry.from.north');
  const shape = shapeOf(pantry, roomData, scale);
  const wallOf = (side) => pantry.wallNumbers?.[side];

  const close = () => {
    const hadFocus = !!panelRef.current && panelRef.current.contains(document.activeElement);
    onClose({ restoreFocus: hadFocus });
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-labelledby={`${uid}-title`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      }}
      className={`bg-white shadow-xl border border-gray-200 overflow-hidden flex flex-col z-50 ${
        isMobile ? 'fixed bottom-4 right-4 rounded-xl w-80 max-w-[calc(100vw-2rem)]' : 'fixed rounded-lg w-72'
      }`}
      style={isMobile ? { maxHeight: 'calc(60vh - 2rem)' } : { right: 20, top: 120, maxHeight: 'calc(100vh - 140px)' }}
    >
      <div className="bg-gray-50 p-3 border-b flex justify-between items-center">
        <h2 ref={headingRef} tabIndex={-1} id={`${uid}-title`} className="font-semibold text-sm focus:outline-none">
          {t('designer.pantry.panelTitle', { name })}
        </h2>
        <button
          type="button"
          onClick={close}
          className="p-2 min-h-10 min-w-10 rounded-full hover:bg-gray-200 flex items-center justify-center"
          aria-label={t('a11y.close')}
        >
          <X size={16} />
        </button>
      </div>
      <div className="p-3 space-y-4 overflow-y-auto">
        <p className="text-xs text-gray-700">
          {t('designer.pantry.shapeNow', { shape: t(`designer.pantry.shape.${shape}`) })}
        </p>
        <fieldset className="space-y-2 min-w-0">
          <legend className="text-sm font-semibold mb-1">{t('designer.pantry.title')}</legend>
          <div>
            <label htmlFor={`${uid}-w`} className="block text-xs text-gray-700 mb-1">{t('designer.pantry.width')}</label>
            <InchInput
              id={`${uid}-w`}
              value={widthIn}
              min={PANTRY_DEFAULTS.minSize}
              onCommit={(v) => onResize({ widthIn: v })}
              describedBy={`${uid}-size-hint ${fmtHint}`}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-d`} className="block text-xs text-gray-700 mb-1">{t('designer.pantry.depth')}</label>
            <InchInput
              id={`${uid}-d`}
              value={depthIn}
              min={PANTRY_DEFAULTS.minSize}
              onCommit={(v) => onResize({ depthIn: v })}
              describedBy={`${uid}-size-hint ${fmtHint}`}
              className={FIELD}
            />
          </div>
          <p id={`${uid}-size-hint`} className="text-xs text-gray-600">
            {t('designer.pantry.sizeHint', { min: formatInchesPlain(PANTRY_DEFAULTS.minSize) })}
          </p>
          <p id={fmtHint} className="text-xs text-gray-600">{t('designer.hint.fraction')}</p>
        </fieldset>
        {parts.length > 0 && (
          <fieldset className="space-y-2 min-w-0">
            <legend className="text-sm font-semibold mb-1">{t('designer.pantry.opening')}</legend>
            <div>
              <label htmlFor={`${uid}-side`} className="block text-xs text-gray-700 mb-1">{t('designer.pantry.openingWall')}</label>
              <select
                id={`${uid}-side`}
                value={openingSide}
                onChange={(e) => onOpeningChange({ side: e.target.value })}
                className="w-full p-2 min-h-11 text-sm border rounded"
              >
                {parts.map((side) => (
                  <option key={side} value={side}>
                    {`${wallName(wallOf(side))} (${t(`designer.pantry.side.${side}`)})`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-pos`} id={`${uid}-pos-label`} className="block text-xs text-gray-700 mb-1">
                {t('designer.pantry.openingPosition', { from })}
              </label>
              <InchInput
                id={`${uid}-pos`}
                value={center}
                min={centerMin}
                max={centerMax}
                onCommit={(v) => onOpeningChange({ center: v })}
                describedBy={`${uid}-pos-hint ${fmtHint}`}
                className={FIELD}
              />
              <input
                type="range"
                min={centerMin}
                max={centerMax}
                step="1"
                value={Math.max(centerMin, Math.min(centerMax, center))}
                onChange={(e) => onOpeningChange({ center: parseFloat(e.target.value) })}
                aria-labelledby={`${uid}-pos-label`}
                aria-valuetext={`${formatInchesPlain(center)} in`}
                className="w-full mt-2"
              />
              <p id={`${uid}-pos-hint`} className="text-xs text-gray-600 mt-1">
                {t('designer.hint.range', { min: formatInchesPlain(centerMin), max: formatInchesPlain(centerMax), unit: t('designer.unit.in') })}
              </p>
            </div>
            <div>
              <label htmlFor={`${uid}-ow`} className="block text-xs text-gray-700 mb-1">{t('designer.pantry.openingWidth')}</label>
              <InchInput
                id={`${uid}-ow`}
                value={opening.width || PANTRY_DEFAULTS.openingWidth}
                min={minOpening}
                max={maxOpening}
                onCommit={(v) => onOpeningChange({ width: Math.max(minOpening, Math.min(maxOpening, v)) })}
                describedBy={`${uid}-ow-hint ${fmtHint}`}
                className={FIELD}
              />
              <p id={`${uid}-ow-hint`} className="text-xs text-gray-600 mt-1">
                {t('designer.pantry.openingWidthHint', { min: formatInchesPlain(minOpening), max: formatInchesPlain(maxOpening) })}
              </p>
            </div>
          </fieldset>
        )}
        <div>
          <button
            type="button"
            aria-pressed={!!pantry.existedPrior}
            aria-describedby={`${uid}-prior-hint`}
            onClick={() => onExistedPriorChange(!pantry.existedPrior)}
            className={`w-full p-2 min-h-11 rounded text-sm font-medium ${pantry.existedPrior
              ? 'bg-yellow-100 text-yellow-900 hover:bg-yellow-200'
              : 'bg-yellow-700 text-white hover:bg-yellow-800'
            }`}
          >
            {pantry.existedPrior
              ? <><span aria-hidden="true">✓ </span>{t('designer.existedPriorUnmark')}</>
              : t('designer.markAsExistedPrior')}
          </button>
          <p id={`${uid}-prior-hint`} className="text-xs text-gray-600 mt-1">{t('designer.pantry.existedPriorHint')}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="w-full p-3 min-h-11 bg-red-700 text-white rounded hover:bg-red-800 flex items-center justify-center gap-2 text-sm font-medium"
        >
          <Trash2 size={16} />
          {t('designer.pantry.remove')}
        </button>
      </div>
    </div>
  );
};

export default PantryPanel;
