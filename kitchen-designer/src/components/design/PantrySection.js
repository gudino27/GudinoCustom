import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatFeetInches } from './plan/planStyle';

// Sidebar: "Add pantry" with its three shapes, and the pantries already in
// the room (select one to edit it, or remove it).

// Little plan pictures of each shape: the room outline grey, the pantry's
// partitions dark, a gap for the opening
const ShapeIcon = ({ shape }) => {
  const room = <rect x="1" y="1" width="30" height="22" fill="none" stroke="#9ca3af" strokeWidth="1.5" />;
  const wall = { stroke: '#1f2937', strokeWidth: 2.5, strokeLinecap: 'butt' };
  let walls;
  if (shape === 'L') {
    walls = (
      <>
        <line x1="17" y1="13" x2="23" y2="13" {...wall} />
        <line x1="29" y1="13" x2="31" y2="13" {...wall} />
        <line x1="17" y1="1" x2="17" y2="13" {...wall} />
      </>
    );
  } else if (shape === 'U') {
    walls = (
      <>
        <line x1="10" y1="1" x2="10" y2="13" {...wall} />
        <line x1="22" y1="1" x2="22" y2="13" {...wall} />
        <line x1="10" y1="13" x2="13" y2="13" {...wall} />
        <line x1="19" y1="13" x2="22" y2="13" {...wall} />
      </>
    );
  } else {
    walls = (
      <>
        <line x1="1" y1="9" x2="12" y2="9" {...wall} />
        <line x1="20" y1="9" x2="31" y2="9" {...wall} />
      </>
    );
  }
  return (
    <svg width="32" height="24" viewBox="0 0 32 24" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="30" height="22" fill="#f9fafb" />
      {room}
      {walls}
    </svg>
  );
};

const PantrySection = ({ pantries = [], scale, onAdd, onSelect, onRemove, selectedId, labelFor }) => {
  const { t } = useLanguage();
  return (
    <div className="mb-6 border-t pt-4" role="group" aria-labelledby="kd-pantry-heading">
      <h3 id="kd-pantry-heading" className="block text-sm font-semibold mb-1">
        {t('designer.pantry.add')}
      </h3>
      <p className="text-xs text-gray-700 mb-2">{t('designer.pantry.intro')}</p>
      <div className="grid grid-cols-1 gap-2">
        {['L', 'U', 'straight'].map((shape) => (
          <button
            key={shape}
            type="button"
            onClick={() => onAdd(shape)}
            className="w-full p-2 min-h-11 bg-white border rounded hover:bg-gray-50 text-sm flex items-center gap-3 text-left"
          >
            <ShapeIcon shape={shape} />
            <span>
              <span className="block font-medium">{t(`designer.pantry.shape.${shape}`)}</span>
              <span className="block text-xs text-gray-600">{t(`designer.pantry.shapeHint.${shape}`)}</span>
            </span>
          </button>
        ))}
      </div>
      {pantries.length > 0 && (
        <ul className="mt-3 space-y-2">
          {pantries.map((p) => {
            const name = labelFor(p);
            return (
              <li key={p.id} className="p-2 bg-gray-50 rounded border flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => onSelect(p.id, e.currentTarget)}
                  aria-pressed={selectedId === p.id}
                  className={`flex-1 text-left text-xs p-2 min-h-10 rounded ${selectedId === p.id ? 'bg-blue-700 text-white' : 'hover:bg-gray-200'}`}
                >
                  <span className="font-semibold">{name}</span>{' '}
                  {formatFeetInches(p.width / scale / 12)} × {formatFeetInches(p.depth / scale / 12)}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  className="text-xs px-3 py-2 min-h-10 rounded bg-red-700 text-white hover:bg-red-800"
                  aria-label={`${t('designer.pantry.remove')}: ${name}`}
                >
                  {t('common.remove')}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default PantrySection;
