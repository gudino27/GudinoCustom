import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import translations from '../../utils/translations';
import ShowroomHotspot from './ShowroomHotspot';
import Navigation from '../ui/Navigation';
import Footer from '../ui/Footer';

// Lazy load Three.js viewer to reduce initial bundle size
const ThreeShowroomViewer = lazy(() => import('./ThreeShowroomViewer'));

// VirtualShowroom Component
// Uses Three.js for 360 panorama viewing with material swapping
const VirtualShowroom = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = translations[language]?.showroom || translations.en.showroom;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showroomData, setShowroomData] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [showWelcome, setShowWelcome] = useState(true);

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
    setShowWelcome(false);
  };

  // Loading state
  if (loading) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-gray-900 flex items-center justify-center" >
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-amber-500 mx-auto mb-4"></div>
            <p className="text-white text-lg">{t?.loading || 'Loading Virtual Showroom...'}</p>
          </div>
        </div>
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-gray-900 flex items-center justify-center" >
          <div className="text-center max-w-md mx-auto px-4">
            <div className="text-red-500 text-6xl mb-4">!</div>
            <h2 className="text-white text-2xl mb-2">{t?.errorTitle || 'Unable to Load Showroom'}</h2>
            <p className="text-gray-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-lg transition-colors"
            >
              {t?.tryAgain || 'Try Again'}
            </button>
          </div>
        </div>
      </>
    );
  }

  // No rooms available
  if (!showroomData?.rooms?.length) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-gray-900 flex items-center justify-center" style={{ paddingTop: '80px' }}>
          <div className="text-center max-w-md mx-auto px-4">
            <div className="text-amber-500 text-6xl mb-6">360°</div>
            <h2 className="text-white text-2xl mb-2">{t?.comingSoon || 'Coming Soon'}</h2>
            <p className="text-gray-400">{t?.noRooms || 'Our virtual showroom is being set up. Please check back later.'}</p>
          </div>
        </div>
      </>
    );
  }

  const welcomeMessage = language === 'es'
    ? showroomData?.settings?.welcome_message_es
    : showroomData?.settings?.welcome_message_en;

  return (
    <>
      <Navigation />
      <div className="relative w-full bg-gray-900" style={{ height: 'calc(100vh - 80px)' }}>
        {/* Welcome Overlay */}
        {showWelcome && (
          <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center">
            <div className="max-w-lg mx-auto text-center px-6">
              <div className="text-amber-500 text-6xl mb-6">360°</div>
              <h1 className="text-white text-3xl font-bold mb-4">
                {welcomeMessage || t?.welcomeTitle || 'Welcome to Our Virtual Showroom'}
              </h1>
              <p className="text-gray-300 mb-8">
                {t?.welcomeDescriptionMaterials || 'Explore our showroom in 360°. Click and drag to look around, scroll to zoom, and click on surfaces to customize materials and finishes.'}
              </p>
              <button
                onClick={handleStartTour}
                className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 rounded-lg text-lg font-semibold transition-colors"
              >
                {t?.startTour || 'Start Tour'}
              </button>
            </div>
          </div>
        )}

        {/* Three.js Viewer with Material Swapping */}
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
          </div>
        }>
          {!showWelcome && currentRoom && (
            <ThreeShowroomViewer
              showroomData={showroomData}
              currentRoom={currentRoom}
              onRoomChange={handleRoomChange}
              onHotspotClick={handleHotspotClick}
            />
          )}
        </Suspense>

        {/* Hotspot Info Popup */}
        {activeHotspot && (
          <ShowroomHotspot
            hotspot={activeHotspot}
            language={language}
            onClose={() => setActiveHotspot(null)}
            onNavigate={(url) => window.location.href = url}
          />
        )}
      </div>
      <Footer />
    </>
  );
};

export default VirtualShowroom;
