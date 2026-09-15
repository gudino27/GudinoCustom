import React, { useState, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

// ShowroomNavigation Component
// Provides navigation between different rooms in the virtual showroom
const ShowroomNavigation = ({ rooms, currentRoom, onRoomChange, style = 'dropdown' }) => {
  const { t, currentLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);

  // Get localized room name
  const getRoomName = (room) => {
    return currentLanguage === 'es' ? room.room_name_es : room.room_name_en;
  };

  // Get category label
  const getCategoryLabel = (category) => {
    const labels = {
      showroom: t('showroom.roomCategory.showroom'),
      workshop: t('showroom.roomCategory.workshop'),
      gallery: t('showroom.roomCategory.gallery')
    };
    return labels[category] || category;
  };

  // Group rooms by category
  const groupedRooms = rooms.reduce((acc, room) => {
    const cat = room.category || 'showroom';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(room);
    return acc;
  }, {});

  // Close the room list with Escape, without losing the keyboard position
  const handleDropdownKeyDown = (event) => {
    if (event.key === 'Escape' && isOpen) {
      event.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  // Dropdown Navigation Style
  if (style === 'dropdown') {
    return (
      <div className="relative" onKeyDown={handleDropdownKeyDown}>
        <button
          type="button"
          ref={triggerRef}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors min-w-[160px]"
        >
          <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="sr-only">{t('showroom.selectRoom')}: </span>
          <span className="truncate">{getRoomName(currentRoom)}</span>
          <svg aria-hidden="true" focusable="false" className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              aria-hidden="true"
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown Menu */}
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <span className="text-xs text-gray-500 uppercase tracking-wider">
                  {t('showroom.selectRoom')}
                </span>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {Object.entries(groupedRooms).map(([category, categoryRooms]) => (
                  <div key={category}>
                    {Object.keys(groupedRooms).length > 1 && (
                      <div className="px-3 py-1.5 bg-gray-50 text-xs text-gray-500 font-medium">
                        {getCategoryLabel(category)}
                      </div>
                    )}
                    {categoryRooms.map((room) => (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => {
                          onRoomChange(room);
                          setIsOpen(false);
                        }}
                        aria-current={room.id === currentRoom?.id ? 'true' : undefined}
                        className={`w-full px-3 py-2.5 text-left flex items-center gap-3 transition-colors ${
                          room.id === currentRoom?.id
                            ? 'bg-amber-50 text-amber-700'
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {room.thumbnail_url ? (
                          <img
                            src={`${process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com'}${room.thumbnail_url}`}
                            alt=""
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
                            <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{getRoomName(room)}</div>
                          {room.id === currentRoom?.id && (
                            <div className="text-xs text-amber-600">{t('showroom.currentRoom')}</div>
                          )}
                        </div>
                        {room.id === currentRoom?.id && (
                          <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Arrows Navigation Style
  if (style === 'arrows') {
    const currentIndex = rooms.findIndex(r => r.id === currentRoom?.id);
    const prevRoom = currentIndex > 0 ? rooms[currentIndex - 1] : null;
    const nextRoom = currentIndex < rooms.length - 1 ? rooms[currentIndex + 1] : null;

    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => prevRoom && onRoomChange(prevRoom)}
          disabled={!prevRoom}
          className={`p-2 rounded-lg transition-colors ${
            prevRoom
              ? 'bg-white/20 hover:bg-white/30 text-white'
              : 'bg-white/10 text-white/50 cursor-not-allowed'
          }`}
          title={prevRoom ? getRoomName(prevRoom) : undefined}
          aria-label={t('showroom.previousRoom')}
        >
          <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="bg-white/20 px-4 py-2 rounded-lg text-white min-w-[140px] text-center">
          <span className="text-sm">{getRoomName(currentRoom)}</span>
          <span className="text-xs text-white/70 ml-2">
            ({currentIndex + 1}/{rooms.length})
          </span>
        </div>

        <button
          type="button"
          onClick={() => nextRoom && onRoomChange(nextRoom)}
          disabled={!nextRoom}
          className={`p-2 rounded-lg transition-colors ${
            nextRoom
              ? 'bg-white/20 hover:bg-white/30 text-white'
              : 'bg-white/10 text-white/50 cursor-not-allowed'
          }`}
          title={nextRoom ? getRoomName(nextRoom) : undefined}
          aria-label={t('showroom.nextRoom')}
        >
          <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  // Minimap Navigation Style (thumbnails)
  if (style === 'minimap') {
    return (
      <div className="flex items-center gap-1.5">
        {rooms.slice(0, 5).map((room) => (
          <button
            key={room.id}
            type="button"
            onClick={() => onRoomChange(room)}
            aria-current={room.id === currentRoom?.id ? 'true' : undefined}
            className={`relative w-12 h-12 rounded-lg overflow-hidden transition-all ${
              room.id === currentRoom?.id
                ? 'ring-2 ring-amber-500 ring-offset-1'
                : 'hover:ring-2 hover:ring-white/50'
            }`}
            title={getRoomName(room)}
            aria-label={getRoomName(room)}
          >
            {room.thumbnail_url ? (
              <img
                src={`${process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com'}${room.thumbnail_url}`}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            {room.id === currentRoom?.id && (
              <div aria-hidden="true" className="absolute inset-0 bg-amber-500/30" />
            )}
          </button>
        ))}
        {rooms.length > 5 && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={t('showroom.moreRooms', { count: rooms.length - 5 })}
            className="w-12 h-12 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center"
          >
            +{rooms.length - 5}
          </button>
        )}
      </div>
    );
  }

  // Default to dropdown if unknown style
  return null;
};

export default ShowroomNavigation;
