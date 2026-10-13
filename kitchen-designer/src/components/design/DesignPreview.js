import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, X, Home, Bath, Box, Download, AlertTriangle, Loader2 } from 'lucide-react';
import PlanView, { planOrder, wallLabelFor, wallViewKeys } from './plan/PlanView';
import WallView from './WallView';
import EngineErrorBoundary from './engine3d/EngineErrorBoundary';
import { engineRendererEnabled } from './engine3d/rendererFlag';
import { getElementName } from './elementName';
import { elementTypes } from '../../constants/elementTypes';
import { getMaterialById } from '../../constants/materials';
import { getElementsOnWall } from '../../utils/designer/wallViewUtils';
import { normalizeRoomData, fitScale } from '../../utils/designer/normalizeDesign';
import { housingOf } from '../../utils/designer/housing';
import { formatInches } from './plan/planStyle';
import { formatFeet } from '../../utils/designer/planUnits';
import { useLanguage } from '../../contexts/LanguageContext';

// The admin viewer's picture of a submitted design: the floor plan and wall
// views drawn with the customer designer's own components (read-only), and
// the cabinet-engine 3D view in view-only mode with its camera toolbar
// (walls 1-4, top, Photo). The engine view falls back to the classic 3D view
// by itself; the classic one is also used when the renderer flag says so.
//
// Props are those of the old DesignPreview; `interactive` / `onUpdateElement`
// are accepted and ignored (the viewer is view-only).
const EngineRoom3D = React.lazy(() => import('./EngineRoom3D'));
const DesignEditor3D = React.lazy(() => import('./DesignEditor3D'));

const noop = () => {};

const itemHeight = (element) => {
  const spec = elementTypes[element.type] || {};
  return Number(element.actualHeight) || spec.fixedHeight || spec.defaultHeight || null;
};

const finishName = (element, roomData) => {
  if (element.materialId) {
    const m = getMaterialById(element.materialId);
    if (m) return m.brand ? `${m.brand} ${m.name}` : m.name;
    return String(element.materialId);
  }
  const legacy = roomData.materials && roomData.materials[element.id];
  return legacy ? String(legacy) : '—';
};

/** A PNG (twice the size) of an SVG element; resolves to a Blob. */
const svgToPng = (svg) => new Promise((resolve, reject) => {
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  const img = new Image();
  img.onload = () => {
    try {
      const w = Number(svg.getAttribute('width')) || img.width;
      const h = Number(svg.getAttribute('height')) || img.height;
      const canvas = document.createElement('canvas');
      canvas.width = w * 2;
      canvas.height = h * 2;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no image'))), 'image/png');
    } catch (err) {
      reject(err);
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('svg did not load'));
  };
  img.src = url;
});

const saveBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function Loading({ label }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-100" role="status">
      <Loader2 aria-hidden="true" className="w-8 h-8 animate-spin motion-reduce:animate-none text-blue-700" />
      <span className="ml-3 text-sm text-gray-700">{label}</span>
    </div>
  );
}

const DesignPreview = ({ designData, hasKitchen, hasBathroom }) => {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState('floor');
  const [selectedWall, setSelectedWall] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [activeRoom, setActiveRoom] = useState(hasKitchen ? 'kitchen' : 'bathroom');
  const [saving, setSaving] = useState(false);
  const [engineView] = useState(() => engineRendererEnabled());
  const planRef = useRef(null);

  useEffect(() => {
    if (hasKitchen) setActiveRoom('kitchen');
    else if (hasBathroom) setActiveRoom('bathroom');
  }, [hasKitchen, hasBathroom]);

  // a new room or design: back to wall 1, nothing selected
  useEffect(() => {
    setSelectedWall(1);
    setSelectedItem(null);
  }, [activeRoom, designData]);

  const rawRoom = activeRoom === 'kitchen'
    ? (hasKitchen ? designData.kitchen_data : null)
    : (hasBathroom ? designData.bathroom_data : null);
  // normalizeRoomData is idempotent: safe on data DesignViewer already normalised
  const { roomData, issues: ownIssues } = useMemo(
    () => normalizeRoomData(rawRoom, { elementTypes }),
    [rawRoom]
  );
  // what the first pass (DesignViewer's normalizeDesign) found, if it ran
  const issues = (designData.normalizeIssues && designData.normalizeIssues[activeRoom]) || ownIssues;
  const scale = roomData ? fitScale(roomData.dimensions) : 1;
  const ordered = useMemo(() => (roomData ? planOrder(roomData.elements) : []), [roomData]);
  const roomName = activeRoom === 'kitchen' ? t('designViewer.kitchen') : t('designViewer.bathroom');
  const wallKeys = useMemo(() => (roomData ? wallViewKeys(roomData, scale) : []), [roomData, scale]);
  const usable = !!roomData && parseFloat(roomData.dimensions.width) > 0 && parseFloat(roomData.dimensions.height) > 0;

  const roomSwitcher = hasKitchen && hasBathroom && (
    <div className="flex items-center justify-center mb-4">
      <div className="bg-white rounded-lg p-1 shadow-sm border" role="group">
        {[['kitchen', Home, 'bg-blue-100 text-blue-800'], ['bathroom', Bath, 'bg-purple-100 text-purple-800']].map(([room, Icon, on]) => (
          <button
            key={room}
            type="button"
            onClick={() => setActiveRoom(room)}
            aria-pressed={activeRoom === room}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${activeRoom === room ? `${on} font-medium` : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            <Icon aria-hidden="true" className="w-4 h-4" />
            {room === 'kitchen' ? t('designViewer.kitchen') : t('designViewer.bathroom')}
          </button>
        ))}
      </div>
    </div>
  );

  if (!usable) {
    return (
      <div className="design-preview">
        {roomSwitcher}
        <div className="text-center p-8 text-gray-700">
          {activeRoom === 'kitchen' ? <Home aria-hidden="true" className="w-12 h-12 mx-auto mb-2" /> : <Bath aria-hidden="true" className="w-12 h-12 mx-auto mb-2" />}
          <p>{t('designViewer.preview.noData', { room: roomName.toLowerCase() })}</p>
        </div>
      </div>
    );
  }

  const planTitle = t('designViewer.preview.planTitle', { room: roomName });

  const savePlan = async () => {
    const svg = planRef.current;
    if (!svg || saving) return;
    setSaving(true);
    const base = `${activeRoom}-plan${designData.id ? `-${designData.id}` : ''}`;
    try {
      saveBlob(await svgToPng(svg), `${base}.png`);
    } catch (err) {
      // the PNG needs the SVG to load as an image; the SVG itself always saves
      console.warn('[DesignPreview] PNG export failed, saving the SVG', err);
      saveBlob(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }), `${base}.svg`);
    } finally {
      setSaving(false);
    }
  };

  const floorPlan = (ref, style) => (
    <PlanView
      ref={ref}
      style={style}
      roomData={roomData}
      elementTypes={elementTypes}
      scale={scale}
      selectedId={selectedItem}
      title={planTitle}
      className="mx-auto"
    />
  );

  const wallButtons = (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('designViewer.preview.wallViews')}>
      {wallKeys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => setSelectedWall(key)}
          aria-pressed={selectedWall === key}
          className={`px-3 py-2 rounded-lg text-sm transition-colors ${selectedWall === key ? 'bg-blue-700 text-white shadow-md' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
        >
          {wallLabelFor(t, roomData, key)}
        </button>
      ))}
    </div>
  );

  const wallView = (
    <WallView
      currentRoomData={roomData}
      selectedWall={selectedWall}
      selectedElement={selectedItem}
      elementTypes={elementTypes}
      scale={scale}
      isDraggingWallView={false}
      isTouch={false}
      getElementsOnWall={getElementsOnWall}
      handleWallViewMouseDown={noop}
      wallLabel={wallLabelFor(t, roomData, selectedWall)}
    />
  );

  const classic3d = (
    <Suspense fallback={<Loading label={t('designer.view3d.loading')} />}>
      <DesignEditor3D roomData={roomData} elementTypes={elementTypes} scale={scale} interactive={false} />
    </Suspense>
  );
  const view3d = (
    <div key={activeRoom} className="w-full h-full">
      {engineView ? (
        <EngineErrorBoundary
          fallback={classic3d}
          onError={(error) => console.error('[DesignPreview] the engine 3D view could not load; showing the classic view.', error)}
        >
          <Suspense fallback={<Loading label={t('designer.view3d.loading')} />}>
            <EngineRoom3D
              roomData={roomData}
              elementTypes={elementTypes}
              scale={scale}
              roomType={activeRoom}
              interactive={false}
            />
          </Suspense>
        </EngineErrorBoundary>
      ) : classic3d}
    </div>
  );

  const counts = {
    cabinets: roomData.elements.filter((el) => el.category === 'cabinet').length,
    appliances: roomData.elements.filter((el) => el.category === 'appliance').length,
    pantries: (roomData.pantries || []).length,
    doors: (roomData.doors || []).length,
    sqft: (parseFloat(roomData.dimensions.width) * parseFloat(roomData.dimensions.height)).toFixed(0),
  };
  const images = activeRoom === 'kitchen'
    ? { floor: designData.floor_plan_image, walls: Array.isArray(designData.wall_view_images) ? designData.wall_view_images : [] }
    : { floor: null, walls: [] };

  const tabs = [
    ['floor', t('designViewer.preview.floorPlan')],
    ['walls', t('designViewer.preview.wallViews')],
    ['3d', t('designViewer.preview.view3d')],
  ];

  return (
    <div className="design-preview">
      {roomSwitcher}

      {/* Room measurements */}
      <div className="mb-4 p-3 bg-white rounded-lg border">
        <div className="text-center mb-2">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-gray-800 font-medium">
            {activeRoom === 'kitchen' ? <Home aria-hidden="true" className="w-4 h-4" /> : <Bath aria-hidden="true" className="w-4 h-4" />}
            {planTitle}
          </span>
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><dt className="inline text-gray-700">{t('designViewer.preview.width')}:</dt> <dd className="inline font-medium">{formatFeet(roomData.dimensions.width)}</dd></div>
          <div><dt className="inline text-gray-700">{t('designViewer.preview.depth')}:</dt> <dd className="inline font-medium">{formatFeet(roomData.dimensions.height)}</dd></div>
          <div><dt className="inline text-gray-700">{t('designViewer.preview.wallHeight')}:</dt> <dd className="inline font-medium">{formatInches(roomData.dimensions.wallHeight)}</dd></div>
          <div><dt className="inline text-gray-700">{t('designViewer.preview.walls')}:</dt> <dd className="inline font-medium">{(roomData.walls || []).filter((n) => n <= 4).map((n) => `#${n}`).join(' ') || '—'}</dd></div>
        </dl>
      </div>

      {/* Older designs: what was read differently */}
      {issues.length > 0 && (
        <details className="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-900">
          <summary className="cursor-pointer font-medium flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="w-4 h-4" />
            {t('designViewer.preview.legacyTitle', { n: issues.length })}
          </summary>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            {issues.map((issue, i) => <li key={i}>{issue.message}</li>)}
          </ul>
        </details>
      )}

      {/* View tabs */}
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div className="flex bg-gray-100 p-1 rounded-lg" role="group">
          {tabs.map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              aria-pressed={viewMode === mode}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === mode ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-700 hover:text-gray-900'}`}
            >
              {mode === '3d' && <Box aria-hidden="true" className="w-4 h-4" />}
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'floor' && (
            <button
              type="button"
              onClick={savePlan}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:opacity-60"
            >
              <Download aria-hidden="true" className="w-4 h-4" />
              {t('designViewer.preview.savePlan')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFullscreen(true)}
            className="p-2 text-gray-700 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
            aria-label={t('designViewer.preview.fullscreen')}
            title={t('designViewer.preview.fullscreen')}
          >
            <Maximize2 aria-hidden="true" className="w-5 h-5" />
          </button>
        </div>
      </div>

      {viewMode === 'floor' && (
        <div className="border-2 rounded-lg p-4 bg-white shadow-sm overflow-auto">
          {floorPlan(planRef)}
        </div>
      )}

      {viewMode === 'walls' && (
        <div className="space-y-4">
          {wallButtons}
          <div className="border-2 rounded-lg p-4 bg-white shadow-sm overflow-auto">{wallView}</div>
        </div>
      )}

      {viewMode === '3d' && !showFullscreen && (
        <div className="border-2 rounded-lg overflow-hidden bg-gray-50 relative" style={{ height: 600 }}>
          {view3d}
        </div>
      )}
      {viewMode === '3d' && (
        <p className="mt-2 text-xs text-gray-700">{t('designViewer.preview.view3dHint')}</p>
      )}

      {/* Items, numbered as on the plan */}
      <div className="mt-4 bg-white rounded-lg border">
        <h4 className="px-3 pt-3 font-semibold text-sm">{t('designViewer.preview.items', { n: ordered.length })}</h4>
        <p className="px-3 text-xs text-gray-700">{t('designViewer.preview.itemsHint')}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm mt-2">
            <thead>
              <tr className="text-left text-gray-700 border-b">
                <th scope="col" className="px-3 py-2">#</th>
                <th scope="col" className="px-3 py-2">{t('designViewer.preview.colItem')}</th>
                <th scope="col" className="px-3 py-2">{t('designViewer.preview.colSize')}</th>
                <th scope="col" className="px-3 py-2">{t('designViewer.preview.colRotation')}</th>
                <th scope="col" className="px-3 py-2">{t('designViewer.preview.colFinish')}</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((el, i) => {
                const known = !!elementTypes[el.type];
                const h = itemHeight(el);
                const selected = selectedItem !== null && String(selectedItem) === String(el.id);
                const housing = housingOf(el, elementTypes);
                return (
                  <tr key={el.id} className={`border-b last:border-0 ${selected ? 'bg-blue-50' : ''}`}>
                    <td className="px-3 py-1.5 font-mono">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedItem(selected ? null : el.id)}
                        aria-pressed={selected}
                        className="text-left text-blue-800 hover:underline"
                      >
                        {known ? getElementName(t, el.type, elementTypes) : `${el.type} (${t('designViewer.preview.unknownType')})`}
                      </button>
                      {housing && el.upperHeight ? (
                        <span className="ml-2 text-xs text-gray-700">{t('designViewer.preview.upperHeight', { h: formatInches(el.upperHeight) })}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {formatInches(el.width)} × {formatInches(el.depth)}{h ? ` × ${formatInches(h)}` : ''}
                    </td>
                    <td className="px-3 py-1.5">{Math.round(el.rotation || 0)}°</td>
                    <td className="px-3 py-1.5">{finishName(el, roomData)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Room statistics */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          [counts.cabinets, t('designViewer.preview.cabinets'), 'text-blue-800'],
          [counts.appliances, t('designViewer.preview.appliances'), 'text-green-800'],
          [counts.pantries, t('designViewer.preview.pantries'), 'text-purple-800'],
          [counts.doors, t('designViewer.preview.doors'), 'text-gray-800'],
          [counts.sqft, t('designViewer.preview.sqft'), 'text-orange-800'],
        ].map(([value, label, color]) => (
          <div key={label} className="bg-white rounded-lg p-3 text-center border">
            <div className={`text-lg font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-700">{label}</div>
          </div>
        ))}
      </div>

      {/* The pictures the customer's quote carried */}
      {(images.floor || images.walls.length > 0) && (
        <details className="mt-4 p-3 bg-white rounded-lg border text-sm">
          <summary className="cursor-pointer font-medium">{t('designViewer.preview.submittedImages')}</summary>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {images.floor && (
              <figure>
                <img src={images.floor} alt={t('designViewer.preview.floorPlan')} className="max-w-full border rounded" />
                <figcaption className="text-xs text-gray-700 mt-1">{t('designViewer.preview.floorPlan')}</figcaption>
              </figure>
            )}
            {images.walls.map((view, i) => (
              <figure key={i}>
                <img src={view.image} alt={t('designViewer.preview.wallImage', { n: view.wall })} className="max-w-full border rounded" />
                <figcaption className="text-xs text-gray-700 mt-1">{t('designViewer.preview.wallImage', { n: view.wall })}</figcaption>
              </figure>
            ))}
          </div>
        </details>
      )}

      {/* Fullscreen */}
      {showFullscreen && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4" style={{ zIndex: 1000 }} role="dialog" aria-modal="true" aria-label={planTitle}>
          <div className="bg-white rounded-xl w-full max-w-6xl flex flex-col overflow-hidden" style={{ height: '90vh' }}>
            <div className="p-4 border-b flex items-center justify-between bg-gray-50">
              <h3 className="text-xl font-bold text-gray-800">{planTitle}</h3>
              <button
                type="button"
                onClick={() => setShowFullscreen(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                aria-label={t('designViewer.preview.close')}
              >
                <X aria-hidden="true" className="w-6 h-6 text-gray-700" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-100">
              {viewMode === '3d' ? (
                <div className="w-full h-full bg-white rounded-lg shadow-lg overflow-hidden relative">{view3d}</div>
              ) : viewMode === 'walls' ? (
                <div className="space-y-4 bg-white p-4 rounded-lg">
                  {wallButtons}
                  <div className="overflow-auto">{wallView}</div>
                </div>
              ) : (
                <div className="bg-white p-4 rounded-lg shadow-lg">
                  {floorPlan(null, { width: '100%' })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesignPreview;
