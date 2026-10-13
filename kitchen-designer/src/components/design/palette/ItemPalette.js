import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, X } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { announce } from '../../ui/LiveRegion';
import { getElementName } from '../elementName';
import { formatPrice, itemPrice } from '../../../utils/designer/pricing';
import { formatInches, formatInchesPlain } from '../../../utils/designer/planUnits';
import PaletteIcon from './PaletteIcon';
import { paletteDrag } from './paletteDrag';
import './palette.css';

// Touch drags: hold still this long, or move sideways this far, to pick an
// item up. Moving up and down scrolls the list as usual.
const LONG_PRESS_MS = 350;
const MOVE_PX = 10;
export const DRAG_MIME = 'application/x-kd-element';

const heightOf = (spec) => spec.fixedHeight || spec.defaultHeight;

/**
 * The "add items" palette: cards (grid on desktop, compact list on phones)
 * with a drawing, name, size and price. Click / Enter / Space adds the item
 * at a free spot; drag it onto the floor plan to place it (HTML5 drag with a
 * mouse, pointer events on touch). The plan side is usePlanDrop.
 */
const ItemPalette = ({
  elementTypes,
  activeRoom,
  basePrices,
  materialMultipliers,
  onAdd,
  canDrop,
  compact,
  onTouchDragStart,
}) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [ghost, setGhost] = useState(null); // touch drag: { type, x, y }
  const uid = useId();
  const hintId = `${uid}-hint`;
  const searchId = `${uid}-search`;

  const nameOf = (key) => getElementName(t, key, elementTypes);

  // What the item adds to the estimate as placed: cabinets at their default
  // width in the standard finish; appliances and fixtures only if the shop
  // priced them (otherwise "Not in estimate")
  const priceOf = (key, spec) => {
    const price = itemPrice(key, spec, { basePrices, materialMultipliers });
    return price === null ? null : formatPrice(price);
  };

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(elementTypes)
      .filter(([, spec]) => spec.room === activeRoom)
      .filter(([, spec]) => category === 'all' || spec.category === category)
      .filter(([key, spec]) => {
        if (!q) return true;
        const haystack = `${getElementName(t, key, elementTypes)} ${spec.name} ${key}`.toLowerCase();
        return q.split(/\s+/).every((word) => haystack.includes(word));
      });
  }, [elementTypes, activeRoom, category, query, t]);

  const groups = [
    { id: 'cabinet', label: activeRoom === 'kitchen' ? t('designer.kitchenCabinets') : t('designer.bathroomCabinets') },
    { id: 'appliance', label: activeRoom === 'kitchen' ? t('designer.appliances') : t('designer.palette.fixtures') },
  ];

  // Say so when a drag ends without placing anything (Escape, released elsewhere)
  useEffect(() => paletteDrag.subscribe((event) => {
    if (event.phase === 'cancel') announce(t('designer.palette.cancelled'));
    return false;
  }), [t]);

  // ---------- Mouse: HTML5 drag and drop ----------
  const onDragStart = (e, key) => {
    // No native drag while a touch drag runs (Chrome on Android starts one on long press)
    if (!canDrop || session.current) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(DRAG_MIME, key);
    e.dataTransfer.setData('text/plain', nameOf(key));
    const art = e.currentTarget.querySelector('[data-drag-image]');
    if (art && e.dataTransfer.setDragImage) {
      const box = art.getBoundingClientRect();
      e.dataTransfer.setDragImage(art, box.width / 2, box.height / 2);
    }
    paletteDrag.start(key, 'mouse');
  };
  // After a drop the drag is already over; anything else is a cancel
  const onDragEnd = () => paletteDrag.cancel();

  // ---------- Touch / pen: pointer events ----------
  const session = useRef(null);
  const suppressClick = useRef(false);

  const endSession = () => {
    const s = session.current;
    if (!s) return;
    clearTimeout(s.timer);
    s.detach();
    session.current = null;
    setGhost(null);
    // the click a finished long press may still fire is swallowed once
    if (s.active) setTimeout(() => { suppressClick.current = false; }, 400);
  };
  useEffect(() => () => {
    endSession();
    paletteDrag.cancel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = (e, key) => {
    if (e.pointerType === 'mouse' || !canDrop || e.button > 0) return;
    endSession();
    const s = { key, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, active: false };

    const begin = () => {
      if (s.active) return;
      s.active = true;
      clearTimeout(s.timer);
      suppressClick.current = true;
      paletteDrag.start(key, 'touch');
      setGhost({ type: key, x: s.x, y: s.y });
      if (navigator.vibrate) navigator.vibrate(10);
      announce(t('designer.palette.pickedUp', { name: nameOf(key) }));
      // On phones the sidebar covers the plan: get it out of the way
      if (onTouchDragStart) onTouchDragStart();
    };
    const moveTo = (x, y) => {
      s.x = x;
      s.y = y;
      if (!s.active) {
        const dx = x - s.startX;
        const dy = y - s.startY;
        if (Math.hypot(dx, dy) < MOVE_PX) return;
        if (Math.abs(dx) > Math.abs(dy) * 1.2) begin();
        else endSession(); // scrolling the list
        return;
      }
      setGhost({ type: key, x, y });
      paletteDrag.move(x, y);
    };
    const release = () => {
      const wasActive = s.active;
      endSession();
      if (wasActive) paletteDrag.drop(s.x, s.y);
    };
    const cancel = () => {
      endSession();
      paletteDrag.cancel();
    };

    const onMove = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      moveTo(ev.clientX, ev.clientY);
    };
    const onTouchMove = (ev) => {
      if (!s.active) return;
      ev.preventDefault(); // no scrolling while carrying an item
      const touch = ev.touches[0];
      if (touch) moveTo(touch.clientX, touch.clientY);
    };
    const onUp = (ev) => {
      if (ev.pointerId !== undefined && ev.pointerId !== e.pointerId) return;
      release();
    };
    const onPointerCancel = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      // A touch drag keeps going on touch events once the browser gives up
      // the pointer; before it starts, the list is being scrolled
      if (!s.active) endSession();
      else if (ev.pointerType !== 'touch') cancel();
    };
    const onKey = (ev) => {
      if (ev.key === 'Escape' && s.active) {
        ev.preventDefault();
        cancel();
      }
    };
    const opts = { passive: false };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('touchmove', onTouchMove, opts);
    window.addEventListener('touchend', onUp);
    window.addEventListener('keydown', onKey);
    s.detach = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('touchmove', onTouchMove, opts);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('keydown', onKey);
    };
    s.timer = setTimeout(begin, LONG_PRESS_MS);
    session.current = s;
  };

  const onCardClick = (key) => {
    // A long press that picked the item up is not also a click
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onAdd(key);
  };

  const renderCard = ([key, spec]) => {
    const name = nameOf(key);
    const w = spec.defaultWidth;
    const d = spec.defaultDepth;
    const h = heightOf(spec);
    const price = priceOf(key, spec);
    const label = [
      name,
      t('designer.palette.sizeSpoken', { w: formatInchesPlain(w), d: formatInchesPlain(d), h: formatInchesPlain(h) }),
      price || t('designer.palette.notPriced'),
    ].join(', ');
    return (
      <li key={key} className="kd-pal-item">
        <button
          type="button"
          className="kd-pal-card"
          aria-label={label}
          aria-describedby={hintId}
          draggable={canDrop ? 'true' : 'false'}
          onClick={() => onCardClick(key)}
          onDragStart={(e) => onDragStart(e, key)}
          onDragEnd={onDragEnd}
          onPointerDown={(e) => onPointerDown(e, key)}
          onContextMenu={(e) => {
            if (session.current) e.preventDefault();
          }}
        >
          <span className="kd-pal-art" data-drag-image>
            <PaletteIcon type={key} size={compact ? 40 : 56} />
          </span>
          <span className="kd-pal-text">
            <span className="kd-pal-name">{name}</span>
            <span className="kd-pal-size">{formatInches(w)}W × {formatInches(d)}D × {formatInches(h)}H</span>
          </span>
          <span className={`kd-pal-price${price ? '' : ' kd-pal-price--none'}`}>
            {price || t('designer.palette.notPriced')}
          </span>
          <span className="kd-pal-add" aria-hidden="true"><Plus size={14} strokeWidth={2.5} /></span>
        </button>
      </li>
    );
  };

  const visibleGroups = groups
    .map((g) => ({ ...g, items: items.filter(([, spec]) => spec.category === g.id) }))
    .filter((g) => g.items.length > 0);

  const tabs = [
    { id: 'all', label: t('designer.palette.all') },
    ...groups.map((g) => ({ id: g.id, label: g.id === 'cabinet' ? t('designer.palette.cabinets') : g.label })),
  ];

  return (
    <section className={`kd-pal${compact ? ' kd-pal--compact' : ''}`} aria-labelledby={`${uid}-title`}>
      <h3 id={`${uid}-title`} className="kd-pal-title">{t('designer.palette.title')}</h3>
      <p id={hintId} className="kd-pal-hint">
        {canDrop ? t('designer.palette.hint') : t('designer.palette.hintClickOnly')}
      </p>

      <div className="kd-pal-search">
        <label htmlFor={searchId} className="sr-only">{t('designer.palette.search')}</label>
        <Search size={16} aria-hidden="true" className="kd-pal-search-icon" />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && query) {
              e.preventDefault();
              setQuery('');
            }
          }}
          placeholder={t('designer.palette.searchPlaceholder')}
          autoComplete="off"
          spellCheck="false"
        />
        {query && (
          <button type="button" className="kd-pal-clear" onClick={() => setQuery('')} aria-label={t('designer.palette.clearSearch')}>
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="kd-pal-tabs" role="group" aria-label={t('designer.palette.category')}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={category === tab.id}
            className="kd-pal-tab"
            onClick={() => setCategory(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {visibleGroups.length === 0 ? (
        <p className="kd-pal-empty" role="status">{t('designer.palette.noResults', { query: query.trim() })}</p>
      ) : (
        visibleGroups.map((g) => (
          <div key={g.id} className="kd-pal-group">
            {(category === 'all' || visibleGroups.length > 1) && (
              <h4 className="kd-pal-group-title">{g.label}</h4>
            )}
            <ul className="kd-pal-list" aria-label={g.label}>
              {g.items.map(renderCard)}
            </ul>
          </div>
        ))
      )}

      {ghost && createPortal(
        <div
          className="kd-pal-ghost"
          aria-hidden="true"
          style={{ transform: `translate(${ghost.x}px, ${ghost.y}px)` }}
        >
          <PaletteIcon type={ghost.type} size={44} />
          <span>{nameOf(ghost.type)}</span>
        </div>,
        document.body
      )}
    </section>
  );
};

export default ItemPalette;
