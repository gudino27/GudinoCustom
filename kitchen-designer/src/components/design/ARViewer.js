import React, { useState, useEffect, useRef, Suspense } from 'react';
import { X, Smartphone, RotateCcw, Loader2, AlertCircle, Camera } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { FINISHES, getMaterialById } from '../../constants/materials';
import { engineRendererEnabled } from './engine3d/rendererFlag.js';
import '../css/designer.css';

// The classic exporter (its own three.js canvas) and model-viewer (~1 MB)
// load only when the AR dialog opens, never with the designer page.
const ARSceneExporter = React.lazy(() => import('./ARSceneExporter'));

// Import model-viewer web component (needs to be registered)
// This will be loaded dynamically to avoid SSR issues
const loadModelViewer = () => {
  if (typeof window !== 'undefined' && !customElements.get('model-viewer')) {
    import('@google/model-viewer');
  }
};

/**
 * ARViewer - Modal component for viewing 3D designs in AR
 * Uses Google's model-viewer for cross-platform AR support
 */
const ARViewer = ({ 
  isOpen, 
  onClose, 
  roomData, 
  elementTypes, 
  scale = 1,
  activeRoom = 'kitchen'
}) => {
  const [modelUrl, setModelUrl] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);
  const [arSupported, setArSupported] = useState(null);
  const modelViewerRef = useRef(null);
  const dialogRef = useRef(null);
  const { t } = useLanguage();
  // With the engine renderer switched on, the AR model comes from the cabinet
  // engine (the kitchen the engine 3D view shows); the classic exporter is the
  // fallback if that fails.
  const [engineAR] = useState(() => engineRendererEnabled());
  const [engineARFailed, setEngineARFailed] = useState(false);
  const exportCompleteRef = useRef(null);

  // Native <dialog>: inert background, Escape to close and focus returned to
  // the button that opened it, all handled by the browser (WCAG 2.4.3, 4.1.2)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen && dialog && !dialog.open) dialog.showModal();
  }, [isOpen]);

  // Close through the element, so the browser restores focus before unmounting
  const requestClose = () => {
    const dialog = dialogRef.current;
    if (dialog && dialog.open) dialog.close();
    else onClose();
  };

  // Load the model-viewer component the first time the dialog opens
  useEffect(() => {
    if (isOpen) loadModelViewer();
  }, [isOpen]);

  // Check AR support
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      // Check for WebXR support
      const checkARSupport = async () => {
        if ('xr' in navigator) {
          try {
            const supported = await navigator.xr.isSessionSupported('immersive-ar');
            setArSupported(supported);
          } catch {
            // On iOS, Quick Look is used instead of WebXR
            // Check for iOS
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            setArSupported(isIOS ? 'quicklook' : false);
          }
        } else {
          // Check for iOS Quick Look support
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          setArSupported(isIOS ? 'quicklook' : false);
        }
      };
      checkARSupport();
    }
  }, [isOpen]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setModelUrl(null);
      setError(null);
      setIsExporting(true);
    } else {
      // Cleanup blob URL when closing
      if (modelUrl) {
        URL.revokeObjectURL(modelUrl);
        setModelUrl(null);
      }
    }
  }, [isOpen]);

  // Handle export completion
  const handleExportComplete = (blob, exportError) => {
    setIsExporting(false);
    
    if (exportError || !blob) {
      setError(t('designer.ar.exportError'));
      console.error('Export error:', exportError);
      return;
    }
    
    const url = URL.createObjectURL(blob);
    setModelUrl(url);
  };

  exportCompleteRef.current = handleExportComplete;

  // Engine export: a plain async call, no canvas
  useEffect(() => {
    if (!isOpen || !isExporting || !engineAR || engineARFailed || !roomData) return undefined;
    let cancelled = false;
    import('./engine3d/arExport.js')
      .then(({ exportEngineGLB }) => exportEngineGLB(roomData, {
        elementTypes,
        roomType: activeRoom,
        scale,
        finishes: FINISHES,
        lookup: getMaterialById,
      }))
      .then(({ blob, bytes, notes }) => {
        if (cancelled) return;
        if (process.env.NODE_ENV !== 'production') {
          console.info(`[ARViewer] engine GLB: ${(bytes / 1024).toFixed(0)} KB`, notes.length ? notes : '');
        }
        exportCompleteRef.current(blob);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[ARViewer] engine export failed; using the classic exporter.', err);
        setEngineARFailed(true);
      });
    return () => { cancelled = true; };
  }, [isOpen, isExporting, engineAR, engineARFailed, roomData, elementTypes, activeRoom, scale]);

  // Handle regenerating the model
  const handleRegenerate = () => {
    if (modelUrl) {
      URL.revokeObjectURL(modelUrl);
    }
    setModelUrl(null);
    setError(null);
    setIsExporting(true);
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="kd-ar-title"
      className="kd-ar-dialog z-50"
    >
      {/* Modal Container - max 65vh height, positioned below navbar */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 overflow-hidden flex flex-col" style={{ maxHeight: '65vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Camera aria-hidden="true" className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <h2 id="kd-ar-title" className="text-xl font-bold text-gray-900">{t('designer.viewInAR')}</h2>
              <p className="text-sm text-gray-700">
                {t('designer.ar.roomDesign', {
                  room: activeRoom === 'kitchen' ? t('designer.kitchen') : t('designer.bathroom')
                })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label={t('a11y.close')}
          >
            <X className="w-6 h-6 text-gray-700" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {/* Export in progress */}
          {isExporting && !modelUrl && (
            <>
              {/* Hidden exporter component (classic path) */}
              {(!engineAR || engineARFailed) && (
                <Suspense fallback={null}>
                  <ARSceneExporter
                    roomData={roomData}
                    elementTypes={elementTypes}
                    scale={scale}
                    onExport={handleExportComplete}
                  />
                </Suspense>
              )}
              
              {/* Loading UI */}
              <div className="flex flex-col items-center justify-center py-8" role="status">
                <Loader2 aria-hidden="true" className="w-10 h-10 text-purple-700 animate-spin mb-3" />
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  {t('designer.ar.generating')}
                </h3>
                <p className="text-gray-700 text-sm text-center max-w-md">
                  {t('designer.ar.generatingHint')}
                </p>
              </div>
            </>
          )}

          {/* Error state */}
          {error && (
            <div className="flex flex-col items-center justify-center py-8" role="alert">
              <div className="p-3 bg-red-100 rounded-full mb-3">
                <AlertCircle aria-hidden="true" className="w-6 h-6 text-red-700" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                {t('designer.ar.exportFailed')}
              </h3>
              <p className="text-gray-700 text-sm text-center max-w-md mb-4">
                {error}
              </p>
              <button
                type="button"
                onClick={handleRegenerate}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-700 text-white text-sm rounded-lg hover:bg-purple-800 transition-colors"
              >
                <RotateCcw aria-hidden="true" className="w-4 h-4" />
                {t('designer.ar.tryAgain')}
              </button>
            </div>
          )}

          {/* Model Viewer */}
          {modelUrl && !error && (
            <div className="space-y-3">
              {/* AR Support Info */}
              {arSupported === false && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle aria-hidden="true" className="w-4 h-4 text-yellow-800 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-yellow-900 text-sm">{t('designer.ar.notAvailable')}</h3>
                    <p className="text-xs text-yellow-900 mt-0.5">
                      {t('designer.ar.notAvailableHint')}
                    </p>
                  </div>
                </div>
              )}

              {/* Model Viewer Component */}
              <div className="relative bg-gray-100 rounded-xl overflow-hidden" style={{ height: '320px' }}>
                <model-viewer
                  ref={modelViewerRef}
                  src={modelUrl}
                  ar
                  ar-modes="webxr scene-viewer quick-look"
                  camera-controls
                  auto-rotate
                  shadow-intensity="1"
                  exposure="1"
                  style={{ width: '100%', height: '100%' }}
                  poster=""
                  loading="eager"
                >
                  {/* AR Button - styled and positioned */}
                  <button
                    type="button"
                    slot="ar-button"
                    className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 px-5 py-2.5 bg-purple-700 text-white rounded-full shadow-lg hover:bg-purple-800 transition-all hover:scale-105 font-medium"
                  >
                    <Smartphone aria-hidden="true" className="w-5 h-5" />
                    {t('designer.ar.viewInSpace')}
                  </button>
                </model-viewer>
              </div>

              {/* Compact Instructions */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex flex-wrap gap-6 text-sm text-gray-700">
                  <span><strong>{t('designer.ar.rotateLabel')}</strong> {t('designer.ar.rotateHint')}</span>
                  <span><strong>{t('designer.ar.zoomLabel')}</strong> {t('designer.ar.zoomHint')}</span>
                  <span><strong>{t('designer.ar.arLabel')}</strong> {t('designer.ar.arHint')}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-500 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw aria-hidden="true" className="w-4 h-4" />
                  {t('designer.ar.regenerate')}
                </button>
                <a
                  href={modelUrl}
                  download={`${activeRoom}-design.glb`}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  {t('designer.ar.download')}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};

export default ARViewer;
