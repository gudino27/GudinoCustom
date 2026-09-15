import React, { useEffect, useId, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

// ShowroomHotspot Component
// Displays info popup for hotspots in the virtual showroom
const ShowroomHotspot = ({ hotspot, onClose, onNavigate }) => {
  const { t, currentLanguage } = useLanguage();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const titleId = useId();

  // Move focus into the popup and hand it back to whatever opened it
  useEffect(() => {
    const opener = document.activeElement;
    closeButtonRef.current?.focus();

    return () => {
      if (opener && opener.isConnected && typeof opener.focus === 'function') {
        opener.focus({ preventScroll: true });
      }
    };
  }, []);

  if (!hotspot) return null;

  // Get localized content
  const title = currentLanguage === 'es' ? hotspot.title_es : hotspot.title_en;
  const content = currentLanguage === 'es' ? hotspot.content_es : hotspot.content_en;

  // Escape closes; Tab stays inside the popup while it is open
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;

    const focusable = dialogRef.current.querySelectorAll(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // Get action button based on hotspot type
  const getActionButton = () => {
    switch (hotspot.hotspot_type) {
      case 'link_designer':
        return (
          <button
            type="button"
            onClick={() => onNavigate(hotspot.link_url || `/designer${hotspot.cabinet_type ? `?cabinet=${hotspot.cabinet_type}` : ''}`)}
            className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {t('showroom.openDesigner')}
          </button>
        );
      case 'link_material':
        return (
          <button
            type="button"
            onClick={() => onNavigate(hotspot.link_url || '/designer')}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            {t('showroom.viewMaterial')}
          </button>
        );
      default:
        return null;
    }
  };

  // Get icon based on hotspot type
  const getIcon = () => {
    switch (hotspot.hotspot_type) {
      case 'info':
        return (
          <div aria-hidden="true" className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-white text-xl font-bold italic">
            i
          </div>
        );
      case 'link_designer':
        return (
          <div aria-hidden="true" className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        );
      case 'link_material':
        return (
          <div aria-hidden="true" className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </div>
        );
      default:
        return (
          <div aria-hidden="true" className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-white text-xl font-bold italic">
            i
          </div>
        );
    }
  };

  const API_URL = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';
  const imageUrl = hotspot.image_url
    ? (hotspot.image_url.startsWith('http') ? hotspot.image_url : `${API_URL}${hotspot.image_url}`)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Popup Card */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        className="relative bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden animate-fadeIn"
      >
        {/* Close Button */}
        <button
          type="button"
          ref={closeButtonRef}
          onClick={onClose}
          title={t('a11y.close')}
          aria-label={t('a11y.close')}
          className="absolute top-3 right-3 z-10 bg-white/80 hover:bg-white rounded-full p-1.5 shadow-md transition-colors"
        >
          <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Image (if available) */}
        {imageUrl && (
          <div className="relative h-48 overflow-hidden">
            <img
              src={imageUrl}
              alt={title || ''}
              className="w-full h-full object-cover"
            />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        )}

        {/* Content */}
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            {getIcon()}
            <div className="flex-1 min-w-0">
              <h2 id={titleId} className="text-xl font-semibold text-gray-900 truncate">
                {title || t('showroom.hotspotInfo')}
              </h2>
              {hotspot.cabinet_type && (
                <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {hotspot.cabinet_type}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          {content && (
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              {content}
            </p>
          )}

          {/* Action Button */}
          {getActionButton()}

          {/* Close hint */}
          <p className="text-center text-gray-400 text-xs mt-4">
            {t('showroom.clickOutsideToClose')}
          </p>
        </div>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-fadeIn { animation: none; }
        }
      `}</style>
    </div>
  );
};

export default ShowroomHotspot;
