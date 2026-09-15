import React from 'react';

// CategorySelector Component
// Displays category buttons and view mode toggle for the portfolio
const CategorySelector = ({
  categories,
  currentCategory,
  selectCategory,
  getCategoryName,
  viewMode,
  setViewMode,
  beforeAfterPairs,
  t
}) => {
  return (
    <div className="category-container">
      <h1 className="portfolio-heading">{t("portfolio.heading")}</h1>
      <h2 id="portfolio-category-heading" className="text-white mb-4">{t("portfolio.selectCategory")}</h2>
      <div className="category-buttons" role="group" aria-labelledby="portfolio-category-heading">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`category-button ${cat === currentCategory ? "active" : ""}`}
            aria-pressed={cat === currentCategory}
            onClick={() => selectCategory(cat)}
          >
            {getCategoryName(cat)}
          </button>
        ))}
      </div>

      {/* View Mode Toggle - only show if there are before/after pairs */}
      {currentCategory && beforeAfterPairs.length > 0 && (
        <div className="view-mode-toggle" style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          marginTop: '2rem',
          flexWrap: 'wrap'
        }}>
          <button
            type="button"
            className={`category-button ${viewMode === 'beforeAfter' ? 'active' : ''}`}
            aria-pressed={viewMode === 'beforeAfter'}
            onClick={() => setViewMode('beforeAfter')}
          >
            {t("portfolio.viewBeforeAfter")}
          </button>
          <button
            type="button"
            className={`category-button ${viewMode === 'grid' ? 'active' : ''}`}
            aria-pressed={viewMode === 'grid'}
            onClick={() => setViewMode('grid')}
          >
            {t("portfolio.viewGrid")}
          </button>
        </div>
      )}
    </div>
  );
};

export default CategorySelector;
