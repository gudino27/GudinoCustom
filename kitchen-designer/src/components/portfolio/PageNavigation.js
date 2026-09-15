import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

// PageNavigation Component
// Pagination controls for the 3D carousel view
const PageNavigation = ({
  totalPages,
  currentPage,
  changePage,
  resetToBeginning,
  savedPositions,
  currentCategory,
  allCategoryPhotos,
  isTransitioning,
  PHOTOS_PER_PAGE
}) => {
  const { t } = useLanguage();

  if (totalPages <= 1 || !currentCategory) return null;

  // The shortcut is styled separately, so the hint is split around its placeholder
  const [hintBefore, hintAfter] = String(t('portfolio.pageKeysHint')).split('{shortcut}');

  return (
    <div className="page-navigation enhanced">
      <div className="page-header">
        <div className="page-info">
          <span className="current-range">
            {t('portfolio.photosRange', {
              start: currentPage * PHOTOS_PER_PAGE + 1,
              end: Math.min((currentPage + 1) * PHOTOS_PER_PAGE, allCategoryPhotos.length),
              total: allCategoryPhotos.length
            })}
          </span>
          {savedPositions[currentCategory] > 0 && (
            <span className="saved-indicator" title={t('portfolio.positionSaved')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              <span className="sr-only">{t('portfolio.positionSaved')}</span>
            </span>
          )}
        </div>
        {currentPage > 0 && (
          <button
            type="button"
            onClick={resetToBeginning}
            className="reset-button"
            title={t('portfolio.startOverHint')}
            disabled={isTransitioning}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            {t('portfolio.startOver')}
          </button>
        )}
      </div>
      <div className="page-controls">
        <button
          type="button"
          onClick={() => changePage(currentPage - 1)}
          disabled={currentPage === 0 || isTransitioning}
          className="page-nav-button"
          aria-label={t('portfolio.prevSet')}
          title={t('portfolio.prevSet')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="page-dots">
          {[...Array(totalPages)].map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => changePage(index)}
              className={`page-dot ${index === currentPage ? "active" : ""}`}
              aria-label={savedPositions[currentCategory] === index
                ? t('portfolio.savedPage', { n: index + 1 })
                : t('portfolio.pageN', { n: index + 1 })}
              aria-current={index === currentPage ? 'page' : undefined}
              title={savedPositions[currentCategory] === index
                ? t('portfolio.savedPage', { n: index + 1 })
                : t('portfolio.pageN', { n: index + 1 })}
              disabled={isTransitioning}
            >
              <span className="page-number">{index + 1}</span>
              {savedPositions[currentCategory] === index && index !== currentPage && (
                <span className="saved-dot"></span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => changePage(currentPage + 1)}
          disabled={currentPage === totalPages - 1 || isTransitioning}
          className="page-nav-button"
          aria-label={t('portfolio.nextSet')}
          title={t('portfolio.nextSet')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
      <div className="keyboard-hint">
        {hintBefore}
        {hintAfter !== undefined && (
          <>
            <span className="keyboard-shortcut">{t('portfolio.resetShortcut')}</span>
            {hintAfter}
          </>
        )}
      </div>
    </div>
  );
};

export default PageNavigation;
