import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getMediaTitle } from '../portfolio/mediaTitle';

const API_BASE = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';

/**
 * BeforeAfterSlider - Interactive comparison slider for before/after photos
 *
 * Features:
 * - Press or tap anywhere to move the divider, or drag it
 * - Touch/swipe support for mobile
 * - Keyboard navigation on the handle (arrows, Home/End)
 * - Responsive design
 */
const BeforeAfterSlider = ({ beforePhoto, afterPhoto, className = '' }) => {
  const { t } = useLanguage();
  const [sliderPosition, setSliderPosition] = useState(50); // Percentage
  const [isDragging, setIsDragging] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const containerRef = useRef(null);

  // Handle mouse/touch move
  const handleMove = (clientX) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;

    // Clamp between 0 and 100
    const clampedPercentage = Math.min(Math.max(percentage, 0), 100);
    setSliderPosition(clampedPercentage);
  };

  // A press on the handle itself only starts a drag; a press anywhere else moves
  // the divider there, so comparing never requires dragging (WCAG 2.5.7)
  const startedOnHandle = (e) =>
    !!(e.target && e.target.closest && e.target.closest('[role="slider"]'));

  // Mouse event handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    if (startedOnHandle(e)) return;
    handleMove(e.clientX);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch event handlers
  const handleTouchStart = (e) => {
    setIsDragging(true);
    handleMove(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => setIsDragging(false);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    const steps = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5 };
    let next;

    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 100;
    else if (steps[e.key] !== undefined) next = sliderPosition + steps[e.key];
    else return;

    e.preventDefault();
    // Keep the keys we handle from also reaching anything around the slider
    e.stopPropagation();
    setSliderPosition(Math.min(Math.max(next, 0), 100));
  };

  // Global mouse/touch listeners when dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, sliderPosition]);

  // Prevent text selection while dragging
  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.userSelect = '';
    }
  }, [isDragging]);

  const position = Math.round(sliderPosition);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-96 overflow-hidden rounded-lg cursor-ew-resize select-none ${className}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* After image (full) */}
      <div className="absolute inset-0">
        <img
          src={`${API_BASE}${afterPhoto.url}`}
          alt={getMediaTitle(afterPhoto) || t('compare.after')}
          className="w-full h-full object-cover"
          draggable={false}
        />
        <div className="absolute bottom-4 right-4 bg-green-700 text-white px-3 py-1 rounded-full text-sm font-semibold">
          {t('compare.after')}
        </div>
      </div>

      {/* Before image (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img
          src={`${API_BASE}${beforePhoto.url}`}
          alt={getMediaTitle(beforePhoto) || t('compare.before')}
          className="w-full h-full object-cover"
          draggable={false}
        />
        <div className="absolute bottom-4 left-4 bg-gray-700 text-white px-3 py-1 rounded-full text-sm font-semibold">
          {t('compare.before')}
        </div>
      </div>

      {/* Slider handle */}
      <div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
      >
        {/* Handle button - carries the slider role so the photos themselves stay
            readable by screen readers */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full w-12 h-12 shadow-xl flex items-center justify-center cursor-ew-resize hover:scale-110 transition-transform focus:ring-4 focus:ring-blue-700"
          role="slider"
          tabIndex={0}
          aria-label={t('compare.label')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={position}
          aria-valuetext={t('compare.valueText', { pct: position })}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowHint(true)}
          onBlur={() => setShowHint(false)}
        >
          <ChevronLeft className="absolute left-1 text-gray-700" size={16} />
          <ChevronRight className="absolute right-1 text-gray-700" size={16} />
        </div>
      </div>

      {/* Keyboard hint (appears while the handle has focus) */}
      <div
        className={`absolute top-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-70 text-white text-xs px-3 py-1 rounded transition-opacity pointer-events-none ${showHint ? 'opacity-100' : 'opacity-0'}`}
      >
        {t('compare.hint')}
      </div>
    </div>
  );
};

export default BeforeAfterSlider;
