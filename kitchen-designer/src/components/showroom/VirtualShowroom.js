import React, { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import ShowroomHotspot from './ShowroomHotspot';
import Navigation from '../ui/Navigation';
import Footer from '../ui/Footer';
import SEO from '../ui/SEO';

// Lazy load Three.js viewer to reduce initial bundle size
const ThreeShowroomViewer = lazy(() => import('./ThreeShowroomViewer'));

// VirtualShowroom Component
// Uses Three.js for 360 panorama viewing with material swapping
const VirtualShowroom = () => {
  const navigate = useNavigate();
  const { t, currentLanguage } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showroomData, setShowroomData] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [showWelcome, setShowWelcome] = useState(true);

  const mainRef = useRef(null);
  const tourStartedRef = useRef(false);

  const API_URL = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';

  // Check if showroom is enabled - redirect to home if disabled
  useEffect(() => {
    const checkShowroomEnabled = async () => {
      try {
        const response = await fetch(`${API_URL}/api/showroom/public/settings`);
        if (response.ok) {
          const settings = await response.json();
          if (!settings?.showroom_visible) {
            // Showroom is disabled, redirect to home
            navigate('/', { replace: true });
          }
        }
      } catch (error) {
        // If settings can't be fetched, redirect to home as a safety measure
        navigate('/', { replace: true });
      }
    };
    checkShowroomEnabled();
  }, [API_URL, navigate]);

  // Fetch showroom data with materials
  useEffect(() => {
    const fetchShowroomData = async () => {
      try {
        setLoading(true);
        // Always fetch full data with materials for Three.js viewer
        const response = await fetch(`${API_URL}/api/showroom/public/full-with-materials`);
        if (!response.ok) {
          throw new Error('Failed to fetch showroom data');
        }
        const data = await response.json();

        setShowroomData(data);

        // Set the starting room
        if (data.rooms && data.rooms.length > 0) {
          const startRoom = data.rooms.find(r => r.is_starting_room) || data.rooms[0];
          setCurrentRoom(startRoom);
        }

        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchShowroomData();
  }, [API_URL]);

  // Handle hotspot click
  const handleHotspotClick = useCallback((hotspot) => {
    if (hotspot.hotspot_type === 'link_room' && hotspot.link_room_id) {
      // Navigate to another room
      const targetRoom = showroomData?.rooms?.find(r => r.id === hotspot.link_room_id);
      if (targetRoom) {
        setCurrentRoom(targetRoom);
        setActiveHotspot(null);
      }
    } else if (hotspot.hotspot_type === 'link_designer') {
      // Navigate to designer with cabinet pre-selected
      const designerUrl = hotspot.cabinet_type
        ? `/designer?cabinet=${hotspot.cabinet_type}`
        : '/designer';
      window.location.href = designerUrl;
    } else {
      // Show info popup
      setActiveHotspot(hotspot);
    }
  }, [showroomData]);

  // Handle room change from navigation
  const handleRoomChange = (room) => {
    setCurrentRoom(room);
    setActiveHotspot(null);
  };

  // Close welcome message
  const handleStartTour = () => {
    tourStartedRef.current = true;
    setShowWelcome(false);
  };

  // The "Start Tour" button unmounts with the overlay, so keep focus in the page.
  // The viewer grabs focus itself once it has mounted (autoFocus below).
  useEffect(() => {
    if (showWelcome || !tourStartedRef.current) return;
    tourStartedRef.current = false;
    const main = mainRef.current;
    if (main && !main.contains(document.activeElement)) {
      main.focus({ preventScroll: true });
    }
  }, [showWelcome]);

  const seo = (
    <SEO
      title={t('showroom.pageTitle')}
      description={t('showroom.metaDescription')}
      keywords="virtual showroom, 360 tour, custom cabinets, cabinet materials, cabinet finishes"
      canonical="https://gudinocustom.com/showroom"
    />
  );

  // Loading state
  if (loading) {
    return (
      <>
        {seo}
        <Navigation />
        <main id="main-content" tabIndex={-1} className="min-h-screen bg-gray-900 flex items-center justify-center" >
          <div className="text-center">
            <h1 className="sr-only">{t('showroom.pageTitle')}</h1>
            <div aria-hidden="true" className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-amber-500 mx-auto mb-4"></div>
            <p className="text-white text-lg">{t('showroom.loading')}</p>
          </div>
        </main>
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        {seo}
        <Navigation />
        <main id="main-content" tabIndex={-1} className="min-h-screen bg-gray-900 flex items-center justify-center" >
          <div className="text-center max-w-md mx-auto px-4">
            <div aria-hidden="true" className="text-red-500 text-6xl mb-4">!</div>
            <h1 className="text-white text-2xl mb-2">{t('showroom.errorTitle')}</h1>
            <p className="text-gray-400 mb-4">{t('showroom.errorMessage')}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-lg transition-colors"
            >
              {t('showroom.tryAgain')}
            </button>
          </div>
        </main>
      </>
    );
  }

  // No rooms available
  if (!showroomData?.rooms?.length) {
    return (
      <>
        {seo}
        <Navigation />
        <main id="main-content" tabIndex={-1} className="min-h-screen bg-gray-900 flex items-center justify-center" style={{ paddingTop: '80px' }}>
          <div className="text-center max-w-md mx-auto px-4">
            <div aria-hidden="true" className="text-amber-500 text-6xl mb-6">360°</div>
            <h1 className="text-white text-2xl mb-2">{t('showroom.comingSoon')}</h1>
            <p className="text-gray-400">{t('showroom.noRooms')}</p>
          </div>
        </main>
      </>
    );
  }

  const welcomeMessage = currentLanguage === 'es'
    ? showroomData?.settings?.welcome_message_es
    : showroomData?.settings?.welcome_message_en;

  return (
    <>
      {seo}
      <Navigation />
      <main id="main-content" tabIndex={-1} ref={mainRef} className="relative w-full bg-gray-900" style={{ height: 'calc(100vh - 80px)' }}>
        {/* The tour itself carries no visible page heading, so keep one for screen readers */}
        {!showWelcome && <h1 className="sr-only">{t('showroom.pageTitle')}</h1>}

        {/* Welcome Overlay */}
        {showWelcome && (
          <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center">
            <div className="max-w-lg mx-auto text-center px-6">
              <div aria-hidden="true" className="text-amber-500 text-6xl mb-6">360°</div>
              <h1 className="text-white text-3xl font-bold mb-4">
                {welcomeMessage || t('showroom.welcomeTitle')}
              </h1>
              <p className="text-gray-300 mb-8">
                {t('showroom.welcomeDescriptionMaterials')}
              </p>
              <button
                type="button"
                onClick={handleStartTour}
                className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 rounded-lg text-lg font-semibold transition-colors"
              >
                {t('showroom.startTour')}
              </button>
            </div>
          </div>
        )}

        {/* Three.js Viewer with Material Swapping */}
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center">
            <div aria-hidden="true" className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
            <span className="sr-only">{t('a11y.loading')}</span>
          </div>
        }>
          {!showWelcome && currentRoom && (
            <ThreeShowroomViewer
              showroomData={showroomData}
              currentRoom={currentRoom}
              onRoomChange={handleRoomChange}
              onHotspotClick={handleHotspotClick}
              autoFocus
            />
          )}
        </Suspense>

        {/* Hotspot Info Popup */}
        {activeHotspot && (
          <ShowroomHotspot
            hotspot={activeHotspot}
            onClose={() => setActiveHotspot(null)}
            onNavigate={(url) => window.location.href = url}
          />
        )}
      </main>
      <Footer />
    </>
  );
};

export default VirtualShowroom;
