// ThreeShowroomViewer - Three.js based 360 panorama viewer with material swapping
// Replaces Pannellum viewer for enhanced material swapping capabilities
import React, { useState, useEffect, useRef, useCallback, useId, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Pause,
  Play,
  MapPin
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';
import { announce } from '../ui/LiveRegion';
import PanoramaSphere from './PanoramaSphere';
import PanoramaControls from './PanoramaControls';
import ShowroomHotspots3D from './ShowroomHotspots3D';
import MaterialSwapPanel from './MaterialSwapPanel';
import ShowroomNavigation from './ShowroomNavigation';

// Degrees turned per button press / arrow key (Shift turns faster)
const LOOK_STEP = 10;
const LOOK_STEP_LARGE = 30;
// Field-of-view degrees per zoom step
const ZOOM_STEP = 10;

const CONTROL_BUTTON_CLASS =
  'flex items-center justify-center w-10 h-10 rounded-lg bg-black bg-opacity-60 hover:bg-opacity-80 text-white transition-colors';

const ThreeShowroomViewer = ({
  showroomData,
  currentRoom,
  onRoomChange,
  onHotspotClick,
  autoFocus = false
}) => {
  const { t, currentLanguage } = useLanguage();
  const prefersReducedMotion = usePrefersReducedMotion();
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const controlsApiRef = useRef(null);
  const legendButtonRefs = useRef({});
  const previousRoomIdRef = useRef(currentRoom?.id);

  const keyboardHintId = useId();
  const hotspotsHeadingId = useId();
  const materialsHeadingId = useId();
  const materialPanelId = useId();

  // State for material swapping
  const [selectedElement, setSelectedElement] = useState(null);
  const [materialSelections, setMaterialSelections] = useState({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMaterialPanel, setShowMaterialPanel] = useState(false);
  const [focusMaterialPanel, setFocusMaterialPanel] = useState(false);
  // Auto-rotation starts paused for visitors who asked for reduced motion
  const [rotationPaused, setRotationPaused] = useState(prefersReducedMotion);

  const API_URL = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';

  const autoRotateEnabled = !!showroomData?.settings?.auto_rotate_enabled;

  // Initialize material selections with defaults when room changes
  useEffect(() => {
    if (currentRoom?.swappable_elements) {
      const defaults = {};
      currentRoom.swappable_elements.forEach(element => {
        if (element.default_material_id) {
          defaults[element.id] = element.default_material_id;
        } else if (element.available_materials?.length > 0) {
          // Use first available material as default
          const defaultMat = element.available_materials.find(m => m.is_default) || element.available_materials[0];
          if (defaultMat) {
            defaults[element.id] = defaultMat.id;
          }
        }
      });
      setMaterialSelections(defaults);
    }
  }, [currentRoom]);

  // Respect a reduced-motion preference that is turned on while the tour is open
  useEffect(() => {
    if (prefersReducedMotion) {
      setRotationPaused(true);
    }
  }, [prefersReducedMotion]);

  // Let the visitor start steering straight away after "Start Tour"
  useEffect(() => {
    if (autoFocus) {
      viewerRef.current?.focus({ preventScroll: true });
    }
  }, [autoFocus]);

  // Handle element click - toggle material panel
  const handleElementClick = useCallback((element, fromLegend = false) => {
    // If clicking the same element, toggle the panel off
    if (selectedElement?.id === element.id && showMaterialPanel) {
      setShowMaterialPanel(false);
      setSelectedElement(null);
    } else {
      // Otherwise, select this element and show panel
      setSelectedElement(element);
      setShowMaterialPanel(true);
      // Opened from the keyboard-reachable list, so send focus into the panel
      setFocusMaterialPanel(fromLegend === true);
    }
  }, [selectedElement, showMaterialPanel]);

  // Handle material selection
  const handleMaterialSelect = useCallback((elementId, materialId) => {
    setMaterialSelections(prev => ({
      ...prev,
      [elementId]: materialId
    }));
  }, []);

  // Close material panel
  const handleCloseMaterialPanel = useCallback(() => {
    // Don't drop focus when the panel that holds it is removed
    const panel = document.getElementById(materialPanelId);
    if (panel && panel.contains(document.activeElement)) {
      const returnTarget = (selectedElement && legendButtonRefs.current[selectedElement.id]) || viewerRef.current;
      returnTarget?.focus({ preventScroll: true });
    }
    setShowMaterialPanel(false);
    setSelectedElement(null);
  }, [materialPanelId, selectedElement]);

  // Handle hotspot click - delegate to parent or handle room navigation
  const handleHotspotClick = useCallback((hotspot) => {
    if (hotspot.hotspot_type === 'link_room' && hotspot.link_room_id) {
      const targetRoom = showroomData?.rooms?.find(r => r.id === hotspot.link_room_id);
      if (targetRoom) {
        onRoomChange(targetRoom);
      }
    } else if (onHotspotClick) {
      onHotspotClick(hotspot);
    }
  }, [showroomData, onRoomChange, onHotspotClick]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Arrow keys look around, + / - zoom, while the viewer has focus
  const handleViewerKeyDown = useCallback((event) => {
    // Leave browser shortcuts (zoom, back, ...) alone
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const controls = controlsApiRef.current;
    if (!controls) return;

    const step = event.shiftKey ? LOOK_STEP_LARGE : LOOK_STEP;

    switch (event.key) {
      case 'ArrowLeft':
        controls.look(step, 0);
        break;
      case 'ArrowRight':
        controls.look(-step, 0);
        break;
      case 'ArrowUp':
        controls.look(0, step);
        break;
      case 'ArrowDown':
        controls.look(0, -step);
        break;
      case '+':
      case '=':
        controls.zoom(-ZOOM_STEP);
        break;
      case '-':
      case '_':
        controls.zoom(ZOOM_STEP);
        break;
      default:
        return;
    }

    event.preventDefault();
  }, []);

  // Not every browser focuses a tabindex container on click, and the wheel only
  // zooms while the viewer has focus
  const handleViewerPointerDown = useCallback(() => {
    viewerRef.current?.focus({ preventScroll: true });
  }, []);

  const look = useCallback((leftDegrees, upDegrees) => {
    controlsApiRef.current?.look(leftDegrees, upDegrees);
  }, []);

  const zoom = useCallback((fovDelta) => {
    controlsApiRef.current?.zoom(fovDelta);
  }, []);

  // Get current room name
  const roomName = currentLanguage === 'es' ? currentRoom?.room_name_es : currentRoom?.room_name_en;
  const roomDescription = currentLanguage === 'es' ? currentRoom?.room_description_es : currentRoom?.room_description_en;

  // Announce a room change, and catch focus when the control that changed it is gone
  useEffect(() => {
    const roomId = currentRoom?.id;
    if (previousRoomIdRef.current === roomId) return;
    previousRoomIdRef.current = roomId;

    if (roomName) {
      announce(t('showroom.nowViewing', { name: roomName }));
    }
    const container = containerRef.current;
    if (container && !container.contains(document.activeElement)) {
      viewerRef.current?.focus({ preventScroll: true });
    }
  }, [currentRoom, roomName, t]);

  // Build full image URL
  const panoramaUrl = currentRoom?.image_360_url
    ? (currentRoom.image_360_url.startsWith('http')
        ? currentRoom.image_360_url
        : `${API_URL}${currentRoom.image_360_url}`)
    : null;

  if (!currentRoom || !panoramaUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <p className="text-white">{t('showroom.loading')}</p>
      </div>
    );
  }

  const hotspots = currentRoom.hotspots || [];
  const swappableElements = currentRoom.swappable_elements || [];

  // Readable name for a hotspot, for the list of points of interest
  const getHotspotLabel = (hotspot) => {
    const title = currentLanguage === 'es' ? hotspot.title_es : hotspot.title_en;
    if (title) return title;

    if (hotspot.hotspot_type === 'link_room' && hotspot.link_room_id) {
      const targetRoom = showroomData?.rooms?.find(r => r.id === hotspot.link_room_id);
      const targetName = currentLanguage === 'es' ? targetRoom?.room_name_es : targetRoom?.room_name_en;
      if (targetName) return t('showroom.goToRoom', { name: targetName });
    }

    return t('showroom.hotspotInfo');
  };

  const fullscreenLabel = isFullscreen ? t('showroom.exitFullscreen') : t('showroom.fullscreen');

  return (
    <div
      ref={containerRef}
      className="showroom-ui relative w-full h-full bg-gray-900"
    >
      {/* Focusable, keyboard-operable wrapper around the canvas */}
      <div
        ref={viewerRef}
        className="showroom-viewer relative w-full h-full"
        tabIndex={0}
        role="application"
        aria-label={t('showroom.viewerLabel')}
        aria-describedby={keyboardHintId}
        onKeyDown={handleViewerKeyDown}
        onPointerDown={handleViewerPointerDown}
      >
        {/* Three.js Canvas */}
        <Canvas
          camera={{
            fov: currentRoom.default_hfov || 75,
            position: [0.01, 0, 0],
            near: 0.1,
            far: 1100
          }}
          gl={{ antialias: true, alpha: false }}
          style={{ background: '#111' }}
        >
          <Suspense fallback={null}>
            {/* Main panorama sphere */}
            <PanoramaSphere
              imageUrl={panoramaUrl}
              swappableElements={swappableElements}
              materialSelections={materialSelections}
              onElementClick={handleElementClick}
              onBackgroundClick={handleCloseMaterialPanel}
              apiUrl={API_URL}
            />

            {/* 3D Hotspots - duplicated as buttons in the list below */}
            <ShowroomHotspots3D
              hotspots={hotspots}
              onHotspotClick={handleHotspotClick}
              language={currentLanguage}
            />
          </Suspense>

          {/* Camera controls for panorama navigation */}
          <PanoramaControls
            initialYaw={currentRoom.default_yaw || 0}
            initialPitch={currentRoom.default_pitch || 0}
            sensitivity={showroomData?.settings?.mouse_sensitivity || 1.0}
            autoRotate={autoRotateEnabled && !rotationPaused}
            autoRotateSpeed={showroomData?.settings?.auto_rotate_speed || 0.5}
            controlsRef={controlsApiRef}
            viewerRef={viewerRef}
          />

          {/* Ambient light for visibility */}
          <ambientLight intensity={1} />
        </Canvas>
      </div>
      <p id={keyboardHintId} className="sr-only">{t('showroom.keyboardHint')}</p>

      {/* Loading overlay */}
      <div id="loading-overlay" aria-hidden="true" className="absolute inset-0 bg-gray-900 flex items-center justify-center pointer-events-none opacity-0 transition-opacity duration-300">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-white">{t('showroom.loading')}</p>
        </div>
      </div>

      {/* Top Bar - Room Info and Navigation */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h2 className="text-white text-xl font-semibold">{roomName}</h2>
            {roomDescription && (
              <p className="text-gray-300 text-sm">{roomDescription}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Room Navigation */}
            {showroomData?.rooms?.length > 1 && (
              <ShowroomNavigation
                rooms={showroomData.rooms}
                currentRoom={currentRoom}
                onRoomChange={onRoomChange}
                style={showroomData?.settings?.navigation_style || 'dropdown'}
              />
            )}

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-colors"
              title={fullscreenLabel}
              aria-label={fullscreenLabel}
            >
              {isFullscreen ? (
                <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                </svg>
              ) : (
                <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Material Swap Panel */}
      {showMaterialPanel && selectedElement && (
        <MaterialSwapPanel
          id={materialPanelId}
          element={selectedElement}
          currentMaterialId={materialSelections[selectedElement.id]}
          onMaterialSelect={(materialId) => handleMaterialSelect(selectedElement.id, materialId)}
          onClose={handleCloseMaterialPanel}
          autoFocus={focusMaterialPanel}
          apiUrl={API_URL}
        />
      )}

      {/* Bottom Controls Hint */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-60 text-white text-sm px-4 py-2 rounded-lg z-10">
        {t('showroom.controlsHintKeyboard')}
      </div>

      {/* Points of interest and swappable elements, as real buttons */}
      {(hotspots.length > 0 || swappableElements.length > 0) && (
        <div className="absolute bottom-16 left-4 z-10 flex flex-col items-start gap-2">
          {hotspots.length > 0 && (
            <div className="bg-black bg-opacity-70 text-white text-sm px-4 py-3 rounded-xl shadow-lg">
              <p id={hotspotsHeadingId} className="font-semibold mb-2">{t('showroom.hotspots')}</p>
              <ul aria-labelledby={hotspotsHeadingId} className="space-y-1 max-h-40 overflow-y-auto">
                {hotspots.map((hotspot) => (
                  <li key={hotspot.id}>
                    <button
                      type="button"
                      onClick={() => handleHotspotClick(hotspot)}
                      className="flex items-center gap-2 w-full text-left px-2 py-1 rounded transition-colors hover:bg-white hover:bg-opacity-10"
                    >
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1">{getHotspotLabel(hotspot)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Swappable Elements Legend - opens the material panel */}
          {swappableElements.length > 0 && (
            <div className="bg-black bg-opacity-70 text-white text-sm px-4 py-3 rounded-xl shadow-lg">
              <p id={materialsHeadingId} className="font-semibold mb-2 flex items-center gap-2">
                <svg aria-hidden="true" focusable="false" className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                {t('showroom.customizeMaterials')}
              </p>
              <ul aria-labelledby={materialsHeadingId} className="space-y-1">
                {swappableElements.map(el => {
                  const isSelected = selectedElement?.id === el.id && showMaterialPanel;
                  return (
                    <li key={el.id}>
                      <button
                        type="button"
                        ref={(node) => { legendButtonRefs.current[el.id] = node; }}
                        onClick={() => handleElementClick(el, true)}
                        aria-expanded={isSelected}
                        aria-controls={isSelected ? materialPanelId : undefined}
                        className={`flex items-center gap-2 w-full text-left px-2 py-1 rounded transition-colors ${
                          isSelected ? 'bg-amber-500/30 ring-1 ring-amber-400' : 'hover:bg-white/10'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`w-3 h-3 rounded-full flex-shrink-0 ${isSelected ? 'ring-2 ring-white' : 'border border-white/50'}`}
                          style={{ backgroundColor: el.highlight_color || '#f59e0b' }}
                        />
                        <span className="flex-1">{currentLanguage === 'es' ? el.element_name_es : el.element_name_en}</span>
                        {isSelected ? (
                          <svg aria-hidden="true" focusable="false" className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg aria-hidden="true" focusable="false" className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-gray-400 mt-2">{t('showroom.selectAgainToClose')}</p>
            </div>
          )}
        </div>
      )}

      {/* On-screen look / zoom / rotation controls (no dragging required) */}
      <div
        role="group"
        aria-label={t('showroom.viewControls')}
        className={`showroom-view-controls absolute bottom-16 right-4 z-10 flex items-end gap-2${showMaterialPanel ? ' is-shifted' : ''}`}
      >
        <div className="grid grid-cols-3 gap-1">
          <span />
          <button
            type="button"
            className={CONTROL_BUTTON_CLASS}
            onClick={() => look(0, LOOK_STEP)}
            title={t('showroom.lookUp')}
            aria-label={t('showroom.lookUp')}
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <span />
          <button
            type="button"
            className={CONTROL_BUTTON_CLASS}
            onClick={() => look(LOOK_STEP, 0)}
            title={t('showroom.lookLeft')}
            aria-label={t('showroom.lookLeft')}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span />
          <button
            type="button"
            className={CONTROL_BUTTON_CLASS}
            onClick={() => look(-LOOK_STEP, 0)}
            title={t('showroom.lookRight')}
            aria-label={t('showroom.lookRight')}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <span />
          <button
            type="button"
            className={CONTROL_BUTTON_CLASS}
            onClick={() => look(0, -LOOK_STEP)}
            title={t('showroom.lookDown')}
            aria-label={t('showroom.lookDown')}
          >
            <ChevronDown className="w-5 h-5" />
          </button>
          <span />
        </div>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            className={CONTROL_BUTTON_CLASS}
            onClick={() => zoom(-ZOOM_STEP)}
            title={t('showroom.zoomIn')}
            aria-label={t('showroom.zoomIn')}
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            type="button"
            className={CONTROL_BUTTON_CLASS}
            onClick={() => zoom(ZOOM_STEP)}
            title={t('showroom.zoomOut')}
            aria-label={t('showroom.zoomOut')}
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          {autoRotateEnabled && (
            <button
              type="button"
              className={CONTROL_BUTTON_CLASS}
              onClick={() => setRotationPaused(paused => !paused)}
              title={rotationPaused ? t('showroom.resumeRotation') : t('showroom.pauseRotation')}
              aria-label={rotationPaused ? t('showroom.resumeRotation') : t('showroom.pauseRotation')}
            >
              {rotationPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      <style>{`
        /* Keyboard focus only: pointer users see the viewer exactly as before */
        .showroom-viewer:focus:not(:focus-visible) { outline: none; }
        .showroom-viewer:focus-visible { outline: none; }
        .showroom-viewer:focus-visible::after {
          content: '';
          position: absolute;
          top: 0; right: 0; bottom: 0; left: 0;
          border: 3px solid #fbbf24;
          box-shadow: inset 0 0 0 2px #000;
          pointer-events: none;
          z-index: 1;
        }
        .showroom-ui :focus:not(:focus-visible) { outline: none; }
        .showroom-ui :focus-visible {
          outline: 2px solid #fff;
          outline-offset: 2px;
          box-shadow: 0 0 0 4px #000;
        }
        .showroom-ui .showroom-viewer:focus-visible { outline: none; box-shadow: none; }
        /* Keep the view controls clear of the material panel */
        .showroom-view-controls.is-shifted { right: 21rem; }
        @media (max-width: 40rem) {
          .showroom-view-controls.is-shifted { display: none; }
        }
      `}</style>
    </div>
  );
};

export default ThreeShowroomViewer;
