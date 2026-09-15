import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getElementName } from './elementName';

const ElementList = ({
  currentRoomData,
  viewMode,
  elementTypes,
  scale = 1,
  selectedElement,
  onSelectElement
}) => {
  const { t } = useLanguage();

  if (currentRoomData.elements.length === 0 || viewMode !== 'floor') {
    return null;
  }

  const toInches = (px) => Math.round((px / scale) * 10) / 10;

  return (
    <div className="mt-6 border-t pt-4">
      <h2 className="font-semibold mb-2" id="kd-element-list-heading">{t('designer.elementList')}</h2>
      {/* Each row selects its item and opens the properties panel, so the list
          doubles as the keyboard / single-tap way to reach any item (WCAG 2.1.1, 2.5.7) */}
      <ul className="grid grid-cols-2 gap-2 text-sm" aria-labelledby="kd-element-list-heading">
        {currentRoomData.elements.map((element, index) => (
          <li key={element.id}>
            <button
              type="button"
              onClick={(e) => onSelectElement && onSelectElement(element.id, e.currentTarget)}
              aria-pressed={element.id === selectedElement}
              className={`w-full text-left flex flex-wrap items-center gap-x-2 rounded px-1 hover:bg-gray-100 ${element.id === selectedElement ? 'bg-blue-50' : ''}`}
            >
              {/* Element number */}
              <span className="font-bold">#{index + 1}:</span>
              {/* Element name */}
              <span>{getElementName(t, element.type, elementTypes)}</span>
              {/* Element dimensions */}
              <span className="text-gray-600">
                {element.width}" × {element.depth}"d
                {element.actualHeight && ` × ${element.actualHeight}"h`}
              </span>
              {/* Element position */}
              <span className="text-gray-600">
                {t('designer.positionShort', { x: toInches(element.x), y: toInches(element.y) })}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ElementList;
