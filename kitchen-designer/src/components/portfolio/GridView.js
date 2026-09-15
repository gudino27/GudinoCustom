import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { announce } from '../ui/LiveRegion';
import { getMediaTitle } from './mediaTitle';

const API_BASE = process.env.REACT_APP_API_URL || "https://api.gudinocustom.com";

// GridView Component
// Grid layout for displaying portfolio photos with pagination
const GridView = ({ photos, openModal, categoryName = '', itemsPerPage = 10 }) => {
  const { t } = useLanguage();
  const [currentPage, setCurrentPage] = useState(1);
  // Calculate total pages
  const totalPages = useMemo(() => Math.ceil(photos.length / itemsPerPage), [photos.length, itemsPerPage]);
  // Reset to page 1 when photos change (category switch)
  useEffect(() => {
    setCurrentPage(1);
  }, [photos]);
  // Get current page photos
  const currentPhotos = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return photos.slice(startIndex, endIndex);
  }, [photos, currentPage, itemsPerPage]);
  // Range currently on screen
  const rangeStart = ((currentPage - 1) * itemsPerPage) + 1;
  const rangeEnd = Math.min(currentPage * itemsPerPage, photos.length);
  // Handle page change
  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    // Scroll to the photo count text
    const countElement = document.getElementById('portfolio-photo-count');
    if (countElement) {
      countElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // The grid swaps without moving focus, so tell screen readers what is shown now
    announce(t('portfolio.showing', {
      start: ((page - 1) * itemsPerPage) + 1,
      end: Math.min(page * itemsPerPage, photos.length),
      total: photos.length
    }));
  };
  // Generate page numbers with ellipsis for large page counts
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      if (currentPage > 3) {
        pages.push('...');
      }
      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      // Always show last page
      pages.push(totalPages);
    }
    return pages;
  };
  // Pagination button styles (white on a dark chip / a darker gold, both >= 4.5:1)
  const inactiveBackground = 'rgba(0, 0, 0, 0.25)';
  const hoverBackground = 'rgba(138, 106, 58, 0.6)';
  const buttonStyle = {
    padding: '8px 14px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    minWidth: '40px'
  };
  const activeButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#8a6a3a',
    color: '#fff'
  };
  const inactiveButtonStyle = {
    ...buttonStyle,
    backgroundColor: inactiveBackground,
    color: '#fff',
    backdropFilter: 'blur(10px)'
  };
  const disabledButtonStyle = {
    ...buttonStyle,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#6b7280',
    cursor: 'not-allowed'
  };
  return (
    <div className="portfolio-grid" style={{
      maxWidth: '1200px',
      margin: '3rem auto',
      padding: '0 1rem'
    }}>
      {/* Photo count indicator */}
      <div
        id="portfolio-photo-count"
        style={{
          textAlign: 'center',
          marginBottom: '1.5rem',
          color: '#f3f4f6',
          fontSize: '14px',
          scrollMarginTop: '450px' // Account for fixed navigation
        }}>
        {t('portfolio.showing', { start: rangeStart, end: rangeEnd, total: photos.length })}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))',
        gap: '2rem'
      }}>
        {currentPhotos.map((photo, index) => {
          const imgSrc = `${API_BASE}${photo.thumbnail || photo.url}`;
          const fullSrc = `${API_BASE}${photo.url}`;
          const isVideo = photo.mime_type && photo.mime_type.startsWith('video/');
          const title = getMediaTitle(photo);
          const label = title || t(isVideo ? 'portfolio.videoFallback' : 'portfolio.photoFallback', {
            category: categoryName,
            n: rangeStart + index
          });
          return (
            <button
              key={photo.id || index}
              type="button"
              className="portfolio-tile"
              aria-haspopup="dialog"
              style={{
                display: 'block',
                width: '100%',
                padding: 0,
                border: 'none',
                background: 'none',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                position: 'relative'
              }}
              onClick={() => openModal(fullSrc, label, isVideo)}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <img
                src={imgSrc}
                alt={label}
                style={{
                  width: '100%',
                  height: '250px',
                  objectFit: 'cover'
                }}
                loading="lazy"/>
              {isVideo && (
                <>
                  <span style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '60px',
                    height: '60px',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none'
                  }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="white" aria-hidden="true" focusable="false">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </span>
                  {title && <span className="sr-only">{t('portfolio.video')}</span>}
                </>
              )}
            </button>
          );
        })}
      </div>
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <nav
          aria-label={t('portfolio.pagination')}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            marginTop: '3rem',
            flexWrap: 'wrap'
          }}>
          {/* Previous Button */}
          <button
            type="button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            style={currentPage === 1 ? disabledButtonStyle : inactiveButtonStyle}
            onMouseEnter={(e) => {
              if (currentPage !== 1) {
                e.currentTarget.style.backgroundColor = hoverBackground;
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage !== 1) {
                e.currentTarget.style.backgroundColor = inactiveBackground;
              }
            }}>
            <span aria-hidden="true">←</span> {t('portfolio.prevPage')}
          </button>
          {/* Page Numbers */}
          {getPageNumbers().map((page, index) => (
            page === '...' ? (
              <span key={`ellipsis-${index}`} style={{ color: '#f3f4f6', padding: '0 4px' }}>...</span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => handlePageChange(page)}
                aria-label={t('portfolio.pageN', { n: page })}
                aria-current={page === currentPage ? 'page' : undefined}
                style={page === currentPage ? activeButtonStyle : inactiveButtonStyle}
                onMouseEnter={(e) => {
                  if (page !== currentPage) {
                    e.currentTarget.style.backgroundColor = hoverBackground;
                  }
                }}
                onMouseLeave={(e) => {
                  if (page !== currentPage) {
                    e.currentTarget.style.backgroundColor = inactiveBackground;
                  }
                }}>
                {page}
              </button>
            )
          ))}
          {/* Next Button */}
          <button
            type="button"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={currentPage === totalPages ? disabledButtonStyle : inactiveButtonStyle}
            onMouseEnter={(e) => {
              if (currentPage !== totalPages) {
                e.currentTarget.style.backgroundColor = hoverBackground;
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage !== totalPages) {
                e.currentTarget.style.backgroundColor = inactiveBackground;
              }
            }}
          >
            {t('portfolio.nextPage')} <span aria-hidden="true">→</span>
          </button>
        </nav>
      )}
    </div>
  );
};
export default GridView;
