import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import BeforeAfterSlider from './BeforeAfterSlider';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * BeforeAfterCarousel - Auto-rotating carousel for before/after photo pairs
 *
 * Features:
 * - Auto-rotation with pause/play controls
 * - Manual navigation with arrows
 * - Touch/swipe support
 * - Pagination indicators
 * - Keyboard navigation through the buttons
 */
const BeforeAfterCarousel = ({ photoPairs, autoPlayInterval = 5000, className = '' }) => {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // Auto-rotation
  useEffect(() => {
    if (!isPlaying || photoPairs.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photoPairs.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [isPlaying, photoPairs.length, autoPlayInterval]);

  // Navigation functions
  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + photoPairs.length) % photoPairs.length);
    setIsPlaying(false); // Stop auto-play when manually navigating
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % photoPairs.length);
    setIsPlaying(false);
  };

  const goToSlide = (index) => {
    setCurrentIndex(index);
    setIsPlaying(false);
  };

  // Touch handlers for swipe
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrevious();
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  if (!photoPairs || photoPairs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-white">{t('carousel.empty')}</p>
      </div>
    );
  }

  const currentPair = photoPairs[currentIndex];

  return (
    <div
      className={`relative ${className}`}
      role="region"
      aria-roledescription={t('carousel.roleDescription')}
      aria-label={t('carousel.label')}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Main slider */}
      <div className="relative">
        <BeforeAfterSlider
          beforePhoto={currentPair.before}
          afterPhoto={currentPair.after}
        />

        {/* Navigation arrows */}
        {photoPairs.length > 1 && (
          <>
            <button
              type="button"
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-3 shadow-lg transition-all hover:scale-110"
              aria-label={t('carousel.previous')}
            >
              <ChevronLeft className="text-gray-800" size={24} />
            </button>

            <button
              type="button"
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-3 shadow-lg transition-all hover:scale-110"
              aria-label={t('carousel.next')}
            >
              <ChevronRight className="text-gray-800" size={24} />
            </button>
          </>
        )}
      </div>

      {/* Controls and pagination */}
      {photoPairs.length > 1 && (
        <div className="mt-6 flex items-center justify-between">
          {/* Pagination dots - the padding keeps each target at least 24x24px */}
          <div className="flex flex-1 justify-center">
            {photoPairs.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goToSlide(index)}
                className="p-2 group"
                aria-label={t('carousel.goTo', { n: index + 1 })}
                aria-current={index === currentIndex ? 'true' : 'false'}
              >
                <span
                  aria-hidden="true"
                  className={`block h-2 rounded-full transition-all ${
                    index === currentIndex
                      ? 'bg-white w-8 ring-2 ring-gray-900'
                      : 'bg-gray-300 group-hover:bg-gray-400 w-2'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Play/Pause button */}
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="ml-4 flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors"
            aria-label={isPlaying ? t('carousel.pause') : t('carousel.play')}
          >
            {isPlaying ? (
              <>
                <Pause size={16} />
                <span className="text-sm font-medium">{t('carousel.pauseShort')}</span>
              </>
            ) : (
              <>
                <Play size={16} />
                <span className="text-sm font-medium">{t('carousel.playShort')}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Counter - announced only while the slideshow is not rotating on its own */}
      <div
        className="mt-4 text-center text-sm text-white"
        aria-live={isPlaying ? 'off' : 'polite'}
        aria-atomic="true"
      >
        {t('carousel.counter', { n: currentIndex + 1, total: photoPairs.length })}
      </div>
    </div>
  );
};

export default BeforeAfterCarousel;
