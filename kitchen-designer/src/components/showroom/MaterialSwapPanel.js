// MaterialSwapPanel - UI panel for selecting materials when swapping elements
// Shows available materials for the selected element with thumbnails
import React, { useState, useEffect, useId, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const MaterialSwapPanel = ({
  id,
  element,
  currentMaterialId,
  onMaterialSelect,
  onClose,
  autoFocus = false,
  apiUrl
}) => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categories, setCategories] = useState([]);

  const { t, currentLanguage } = useLanguage();
  const headingRef = useRef(null);
  const generatedId = useId();
  const panelId = id || generatedId;
  const headingId = `${panelId}-heading`;

  // Fetch available materials for this element
  useEffect(() => {
    const fetchMaterials = async () => {
      setLoading(true);
      try {
        // First try to use element's available_materials if already loaded
        if (element.available_materials?.length > 0) {
          setMaterials(element.available_materials);
          // Group by category
          const cats = [...new Set(element.available_materials.map(m => m.category_slug))];
          setCategories(cats);
          setLoading(false);
          return;
        }

        // Otherwise fetch from API
        const response = await fetch(`${apiUrl}/api/showroom/public/elements/${element.id}/materials`);
        if (response.ok) {
          const data = await response.json();
          setMaterials(data);
          // Group by category
          const cats = [...new Set(data.map(m => m.category_slug))];
          setCategories(cats);
        }
      } catch (error) {
        console.error('Failed to fetch materials:', error);
      } finally {
        setLoading(false);
      }
    };

    if (element?.id) {
      fetchMaterials();
    }
  }, [element, apiUrl]);

  // When opened from the keyboard-reachable list, move focus into the panel
  useEffect(() => {
    if (autoFocus) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [autoFocus, element?.id]);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };

  // Get element name based on language
  const elementName = currentLanguage === 'es' ? element.element_name_es : element.element_name_en;

  // Filter materials by category if selected
  const filteredMaterials = selectedCategory
    ? materials.filter(m => m.category_slug === selectedCategory)
    : materials;

  // Get material name based on language
  const getMaterialName = (material) => {
    return currentLanguage === 'es' ? material.material_name_es : material.material_name_en;
  };

  // Get category display name
  const getCategoryName = (slug) => {
    const material = materials.find(m => m.category_slug === slug);
    if (material) {
      return currentLanguage === 'es' ? material.category_name_es : material.category_name_en;
    }
    return slug;
  };

  return (
    <div
      id={panelId}
      role="region"
      aria-labelledby={headingId}
      onKeyDown={handleKeyDown}
      className="absolute right-0 top-0 h-full w-80 bg-white/95 backdrop-blur-sm shadow-2xl z-20 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div>
          <h3 id={headingId} ref={headingRef} tabIndex={-1} className="font-semibold text-gray-900">
            {t('showroom.selectMaterial')}
          </h3>
          <p className="text-sm text-gray-500">{elementName}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          title={t('a11y.close')}
          aria-label={t('a11y.close')}
        >
          <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Category tabs */}
      {categories.length > 1 && (
        <div className="flex gap-1 p-2 border-b overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            aria-pressed={!selectedCategory}
            className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
              !selectedCategory
                ? 'bg-amber-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t('showroom.all')}
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              aria-pressed={selectedCategory === cat}
              className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {getCategoryName(cat)}
            </button>
          ))}
        </div>
      )}

      {/* Materials grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div aria-hidden="true" className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
            <span className="sr-only">{t('a11y.loading')}</span>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {t('showroom.noMaterials')}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {/* Original/None option - clears the material selection */}
            <button
              type="button"
              onClick={() => onMaterialSelect(null)}
              aria-pressed={!currentMaterialId}
              className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                !currentMaterialId
                  ? 'border-amber-500 ring-2 ring-amber-200 scale-105'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
              title={t('showroom.original')}
            >
              <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center">
                <svg aria-hidden="true" focusable="false" className="w-6 h-6 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-xs text-gray-500 font-medium">
                  {t('showroom.original')}
                </span>
              </div>
              {!currentMaterialId && (
                <div aria-hidden="true" className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                  <div className="bg-amber-500 rounded-full p-1">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </button>

            {filteredMaterials.map((material) => {
              const isSelected = material.id === currentMaterialId;
              const materialName = getMaterialName(material);
              const thumbnailUrl = material.thumbnail_url
                ? (material.thumbnail_url.startsWith('http')
                    ? material.thumbnail_url
                    : `${apiUrl}${material.thumbnail_url}`)
                : null;

              return (
                <button
                  key={material.id}
                  type="button"
                  onClick={() => onMaterialSelect(material.id)}
                  aria-pressed={isSelected}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                    isSelected
                      ? 'border-amber-500 ring-2 ring-amber-200 scale-105'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                  title={materialName}
                >
                  {/* Thumbnail or color swatch */}
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={materialName}
                      className="w-full h-full object-cover"
                    />
                  ) : material.color_hex ? (
                    <>
                      <div
                        aria-hidden="true"
                        className="w-full h-full"
                        style={{ backgroundColor: material.color_hex }}
                      />
                      <span className="sr-only">{materialName}</span>
                    </>
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span aria-hidden="true" className="text-gray-400 text-xs">?</span>
                      <span className="sr-only">{materialName}</span>
                    </div>
                  )}

                  {/* Selected indicator */}
                  {isSelected && (
                    <div aria-hidden="true" className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                      <div className="bg-amber-500 rounded-full p-1">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Price indicator */}
                  {material.price_indicator && (
                    <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                      {material.price_indicator}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected material info */}
      {currentMaterialId && (
        <div className="border-t p-4 bg-gray-50">
          {(() => {
            const selected = materials.find(m => m.id === currentMaterialId);
            if (!selected) return null;
            return (
              <div className="flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="w-12 h-12 rounded-lg overflow-hidden border flex-shrink-0"
                  style={{
                    backgroundColor: selected.color_hex || '#ccc'
                  }}
                >
                  {selected.thumbnail_url && (
                    <img
                      src={selected.thumbnail_url.startsWith('http')
                        ? selected.thumbnail_url
                        : `${apiUrl}${selected.thumbnail_url}`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {getMaterialName(selected)}
                  </p>
                  {selected.material_code && (
                    <p className="text-xs text-gray-500">{selected.material_code}</p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default MaterialSwapPanel;
