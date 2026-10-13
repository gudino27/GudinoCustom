import React from 'react';
import { PLAN, inkOn, BADGE_H, badgeWidth } from './planStyle';

// Top-down plan symbols, one per kind (planStyle.symbolKind).
//
// Every symbol is drawn in the element's own box, before rotation:
// x 0..w across the front, y 0..d from the back (y = 0, against the wall) to
// the front (y = d, facing into the room), as DraggableCabinet's group and
// utils/designer/housing.js use. Seen from the front, "left" is x = 0.
//
// Kept to plain shapes (no filters, no masks) so a plan with many items
// stays cheap to draw and a drag, which only rewrites the group transform,
// never re-renders these.

const NONE = { pointerEvents: 'none' };

/** Thickness of the door / drawer front band along the front edge. */
const frontBand = (d) => Math.max(2, Math.min(4, d * 0.1));

/** Countertop overhang past the cabinet front (1"). */
const overhang = (scale) => Math.max(1, scale);

/** A dashed swing arc for a cabinet door hinged at hx on the front edge. */
const swing = (hx, d, r, side, key) => {
  // side +1: hinged on the left, opens to the right; -1: the other way
  const sweep = side === 1 ? 0 : 1;
  return (
    <g key={key} style={NONE}>
      <line x1={hx} y1={d} x2={hx} y2={d + r} stroke={PLAN.hairline} strokeWidth="0.6" />
      <path
        d={`M ${hx} ${d + r} A ${r} ${r} 0 0 ${sweep} ${hx + side * r} ${d}`}
        fill="none"
        stroke={PLAN.hairline}
        strokeWidth="0.6"
        strokeDasharray="2 1.5"
      />
    </g>
  );
};

/** A short symbol code (DW, REF, ...) centred at x, y. */
const code = (text, x, y, fill, size = 9, rot = 0) => (
  <text
    x={x}
    y={y}
    transform={rot ? `rotate(${-rot}, ${x}, ${y})` : undefined}
    textAnchor="middle"
    dominantBaseline="central"
    fontSize={size}
    fontWeight="700"
    fontFamily="Arial, Helvetica, sans-serif"
    letterSpacing="0.5"
    fill={inkOn(fill)}
    style={NONE}
  >
    {text}
  </text>
);

/** Door / drawer fronts along the front edge, split into `n` fronts. */
const fronts = (w, d, finish, n, { drawers = false } = {}) => {
  const fb = frontBand(d);
  const y = d - fb;
  const parts = [];
  for (let i = 1; i < n; i++) {
    const x = (w * i) / n;
    parts.push(<line key={`s${i}`} x1={x} y1={y} x2={x} y2={d} stroke={finish.stroke} strokeWidth="0.75" />);
  }
  return (
    <g style={NONE}>
      <rect x={0} y={y} width={w} height={fb} fill={finish.front} stroke={finish.stroke} strokeWidth="0.75" />
      {parts}
      {drawers && Array.from({ length: n }, (_, i) => {
        const cx = (w * (i + 0.5)) / n;
        const half = Math.min(w / n * 0.2, 6);
        return <line key={`p${i}`} x1={cx - half} y1={y - 1.5} x2={cx + half} y2={y - 1.5} stroke={finish.detail} strokeWidth="1" strokeLinecap="round" />;
      })}
    </g>
  );
};

/** Doors on a base / tall cabinet: count from its width, arcs on the hinge side. */
const doorSwings = (w, d, widthIn, hinge, keyPrefix = 'sw') => {
  const n = widthIn > 24 ? 2 : 1;
  const doorW = w / n;
  // A hint of the swing, not the full leaf: full-size arcs crowd the plan
  const r = Math.min(doorW, d) * 0.45;
  if (n === 1) {
    return hinge === 'right' ? swing(w, d, r, -1, `${keyPrefix}0`) : swing(0, d, r, 1, `${keyPrefix}0`);
  }
  return [swing(0, d, r, 1, `${keyPrefix}0`), swing(w, d, r, -1, `${keyPrefix}1`)];
};

/** A basin with a drain, centred in (x, y, bw, bh). */
const basin = (x, y, bw, bh, key, { oval = false } = {}) => {
  if (bw <= 2 || bh <= 2) return null;
  const drain = Math.max(1, Math.min(bw, bh) * 0.08);
  return (
    <g key={key} style={NONE}>
      {oval ? (
        <ellipse cx={x + bw / 2} cy={y + bh / 2} rx={bw / 2} ry={bh / 2} fill={PLAN.water} stroke={PLAN.steelEdge} strokeWidth="0.9" />
      ) : (
        <rect x={x} y={y} width={bw} height={bh} rx={Math.min(3, bw / 4, bh / 4)} fill={PLAN.water} stroke={PLAN.steelEdge} strokeWidth="0.9" />
      )}
      <circle cx={x + bw / 2} cy={y + bh / 2} r={drain} fill="none" stroke={PLAN.steelEdge} strokeWidth="0.75" />
    </g>
  );
};

/** Faucet dot at the back of a basin, with a short spout toward it. */
const faucet = (cx, y, reach, key) => (
  <g key={key} style={NONE}>
    <line x1={cx} y1={y} x2={cx} y2={y + reach} stroke={PLAN.ink} strokeWidth="1" strokeLinecap="round" />
    <circle cx={cx} cy={y} r={1.8} fill={PLAN.ink} />
  </g>
);

/** Box body with the finish. */
const body = (w, d, finish, extra = {}) => (
  <rect x={0} y={0} width={w} height={d} fill={finish.fill} stroke={finish.stroke} strokeWidth="1" {...extra} />
);

/** Grain overlay for stained wood (pattern defined once in the plan's <defs>). */
const grain = (w, d, finish) => (finish.grain
  ? <rect x={0} y={0} width={w} height={d} fill="url(#woodGrain)" stroke="none" style={NONE} />
  : null);

/** Countertop outline: the cabinet box plus the overhang past its front. */
const counterOutline = (w, d, scale) => (
  <rect
    x={-0.5}
    y={-0.5}
    width={w + 1}
    height={d + overhang(scale) + 0.5}
    fill="none"
    stroke={PLAN.counterEdge}
    strokeWidth="0.75"
    style={NONE}
  />
);

/** The L-shaped corner cabinet path (same geometry the plan always used). */
export const cornerPath = (size, hinge) => (hinge === 'left'
  ? `M 0 0 L ${size} 0 L ${size} ${size * 0.6} L ${size * 0.6} ${size * 0.6} L ${size * 0.6} ${size} L 0 ${size} Z`
  : `M 0 0 L ${size} 0 L ${size} ${size} L ${size * 0.4} ${size} L ${size * 0.4} ${size * 0.6} L 0 ${size * 0.6} Z`);

const cornerSymbol = ({ element, w, finish, overhead }) => {
  const s = w;
  const left = element.hingeDirection === 'left';
  const path = cornerPath(s, element.hingeDirection);
  // The inner (front) faces of the L
  const frontPath = left
    ? `M ${s} ${s * 0.6} L ${s * 0.6} ${s * 0.6} L ${s * 0.6} ${s}`
    : `M ${s * 0.4} ${s} L ${s * 0.4} ${s * 0.6} L 0 ${s * 0.6}`;
  const c = left ? { x: s * 0.3, y: s * 0.3 } : { x: s * 0.7, y: s * 0.3 };
  return (
    <>
      <path
        d={path}
        fill={finish.fill}
        fillOpacity={overhead ? 0.6 : 1}
        stroke={finish.stroke}
        strokeWidth="1"
        strokeDasharray={overhead ? '4 2.5' : undefined}
      />
      {finish.grain && <path d={path} fill="url(#woodGrain)" stroke="none" style={NONE} />}
      <path d={frontPath} fill="none" stroke={finish.stroke} strokeWidth={overhead ? 1 : 2.5} strokeLinejoin="round" style={NONE} />
      {/* Lazy susan: a quarter-round tray in the corner */}
      <circle
        cx={c.x}
        cy={c.y}
        r={s * 0.22}
        fill="none"
        stroke={finish.detail}
        strokeWidth="0.75"
        strokeDasharray={overhead ? '3 2' : undefined}
        style={NONE}
      />
      <circle cx={c.x} cy={c.y} r={1.2} fill={finish.detail} style={NONE} />
    </>
  );
};

const applianceBody = (w, d, finish, extra = {}) => (
  <rect x={0} y={0} width={w} height={d} rx={Math.min(1.5, w / 10)} fill={finish.fill} stroke={finish.stroke} strokeWidth="1" {...extra} />
);

/**
 * The plan symbol of one element: body plus its per-kind detail, in the
 * element's own box (see the note at the top).
 *
 * @param {Object} p
 * @param {Object} p.element  the placed element (width / depth in inches)
 * @param {string} p.kind     planStyle.symbolKind
 * @param {number} p.w        width in plan px
 * @param {number} p.d        depth in plan px
 * @param {number} p.scale    plan px per inch
 * @param {Object} p.finish   planStyle.finishOf
 * @param {number} [p.rot]   the item's rotation, to keep symbol codes upright
 */
export const renderPlanSymbol = ({ element, kind, w, d, scale, finish, rot = 0 }) => {
  const widthIn = Number(element.width) || 0;
  const hinge = element.hingeDirection === 'right' ? 'right' : 'left';
  const fb = frontBand(d);

  switch (kind) {
    case 'corner':
    case 'corner-wall':
      return cornerSymbol({ element, w, finish, overhead: kind === 'corner-wall' });

    case 'drawer':
      return (
        <>
          {counterOutline(w, d, scale)}
          {body(w, d, finish)}
          {grain(w, d, finish)}
          {fronts(w, d, finish, widthIn > 24 ? 2 : 1, { drawers: true })}
        </>
      );

    case 'sink': {
      const doubleBowl = widthIn >= 36;
      const top = d * 0.2;
      const bh = Math.max(0, d - fb - top - d * 0.1);
      const inset = w * 0.14;
      const span = w - 2 * inset;
      const gap = Math.max(2, w * 0.04);
      const bw = doubleBowl ? (span - gap) / 2 : span;
      return (
        <>
          {counterOutline(w, d, scale)}
          {body(w, d, finish)}
          {grain(w, d, finish)}
          {fronts(w, d, finish, widthIn > 24 ? 2 : 1)}
          {/* Stone deck around the bowl(s) */}
          <rect x={inset - 2} y={top - 2} width={span + 4} height={bh + 4} rx="2" fill={PLAN.counter} stroke={PLAN.counterEdge} strokeWidth="0.75" style={NONE} />
          {basin(inset, top, bw, bh, 'b0')}
          {doubleBowl && basin(inset + bw + gap, top, bw, bh, 'b1')}
          {faucet(w / 2, Math.max(2, top * 0.45), Math.max(0, top * 0.45), 'f')}
          {doorSwings(w, d, widthIn, hinge)}
        </>
      );
    }

    case 'vanity':
      return (
        <>
          {counterOutline(w, d, scale)}
          {body(w, d, finish)}
          {grain(w, d, finish)}
          {fronts(w, d, finish, widthIn > 24 ? 2 : 1)}
          {doorSwings(w, d, widthIn, hinge)}
        </>
      );

    case 'vanity-sink':
    case 'double-vanity': {
      const bowls = kind === 'double-vanity' ? 2 : 1;
      const floating = element.type === 'floating-vanity';
      const top = d * 0.18;
      const bh = Math.max(0, d - fb - top - d * 0.1);
      const bw = Math.min(w / bowls * 0.62, bh * 1.5);
      return (
        <>
          {counterOutline(w, d, scale)}
          {body(w, d, finish, floating ? { strokeDasharray: '5 2' } : {})}
          {grain(w, d, finish)}
          {fronts(w, d, finish, bowls === 2 ? 4 : (widthIn > 24 ? 2 : 1))}
          {Array.from({ length: bowls }, (_, i) => {
            const cx = (w * (i + 0.5)) / bowls;
            return (
              <g key={`v${i}`}>
                {basin(cx - bw / 2, top, bw, bh, `vb${i}`, { oval: true })}
                {faucet(cx, Math.max(2, top * 0.45), Math.max(0, top * 0.45), `vf${i}`)}
              </g>
            );
          })}
        </>
      );
    }

    case 'island': {
      // Seating overhang on the back (the side away from the working front)
      const ov = Math.min(12 * scale, d * 0.33);
      const seats = Math.max(1, Math.floor(widthIn / 24));
      const r = Math.max(2, Math.min(ov * 0.32, (w / seats) * 0.25));
      return (
        <>
          <rect x={0} y={0} width={w} height={d} fill={PLAN.counter} stroke={PLAN.counterEdge} strokeWidth="1" />
          <rect x={1.5} y={ov} width={Math.max(0, w - 3)} height={Math.max(0, d - ov)} fill={finish.fill} stroke={finish.stroke} strokeWidth="1" />
          {finish.grain && <rect x={1.5} y={ov} width={Math.max(0, w - 3)} height={Math.max(0, d - ov)} fill="url(#woodGrain)" style={NONE} />}
          <line x1={0} y1={ov} x2={w} y2={ov} stroke={PLAN.counterEdge} strokeWidth="0.75" strokeDasharray="3 2" style={NONE} />
          {Array.from({ length: seats }, (_, i) => (
            <circle key={`st${i}`} cx={(w * (i + 0.5)) / seats} cy={ov / 2} r={r} fill="none" stroke={PLAN.line} strokeWidth="0.75" style={NONE} />
          ))}
          {fronts(w, d, finish, Math.max(1, Math.round(widthIn / 18)))}
        </>
      );
    }

    case 'tall':
      return (
        <>
          {body(w, d, finish)}
          {grain(w, d, finish)}
          <line x1={0} y1={0} x2={w} y2={d - fb} stroke={finish.detail} strokeWidth="0.6" style={NONE} />
          <line x1={w} y1={0} x2={0} y2={d - fb} stroke={finish.detail} strokeWidth="0.6" style={NONE} />
          {fronts(w, d, finish, widthIn > 24 ? 2 : 1)}
          {doorSwings(w, d, widthIn, hinge)}
        </>
      );

    case 'wall':
    case 'glass-wall':
    case 'open-shelf':
      return (
        <>
          {body(w, d, finish, { fillOpacity: 0.6, strokeDasharray: '4 2.5' })}
          {kind === 'glass-wall' && (
            <g style={NONE}>
              <line x1={1.5} y1={d - 2.5} x2={w - 1.5} y2={d - 2.5} stroke={PLAN.glassEdge} strokeWidth="0.75" />
              <line x1={1.5} y1={d - 1} x2={w - 1.5} y2={d - 1} stroke={PLAN.glassEdge} strokeWidth="0.75" />
            </g>
          )}
          {kind === 'open-shelf' && (
            <line x1={2} y1={d / 2} x2={w - 2} y2={d / 2} stroke={finish.detail} strokeWidth="0.6" strokeDasharray="1.5 1.5" style={NONE} />
          )}
          {kind === 'wall' && (
            <g style={NONE}>
              <line x1={0} y1={0} x2={w} y2={d} stroke={finish.detail} strokeWidth="0.5" strokeDasharray="3 2" />
              <line x1={w} y1={0} x2={0} y2={d} stroke={finish.detail} strokeWidth="0.5" strokeDasharray="3 2" />
            </g>
          )}
        </>
      );

    case 'medicine': {
      const mirror = element.type === 'medicine-mirror';
      const h = Math.max(d, 6);
      return (
        <>
          <rect x={0} y={0} width={w} height={h} fill={finish.fill} fillOpacity="0.6" stroke={finish.stroke} strokeWidth="1" strokeDasharray="3 2" />
          <rect
            x={w * 0.12}
            y={h - 2}
            width={w * 0.76}
            height={1.5}
            fill={mirror ? PLAN.glass : finish.front}
            stroke={mirror ? PLAN.glassEdge : finish.stroke}
            strokeWidth="0.5"
            style={NONE}
          />
        </>
      );
    }

    case 'fridge': {
      const split = widthIn >= 30;
      const band = Math.max(2.5, Math.min(5, d * 0.14));
      const hy = d - band;
      const handleLen = Math.min(10, w * 0.25);
      return (
        <>
          {applianceBody(w, d, finish)}
          {/* Door leaves along the front */}
          <rect x={0.5} y={hy} width={w - 1} height={band - 0.5} fill={finish.front} stroke={finish.stroke} strokeWidth="0.75" style={NONE} />
          {split && <line x1={w / 2} y1={hy} x2={w / 2} y2={d} stroke={finish.stroke} strokeWidth="1" style={NONE} />}
          {/* Handles */}
          {split ? (
            <g style={NONE}>
              <line x1={w / 2 - 2.5 - handleLen} y1={hy - 1.5} x2={w / 2 - 2.5} y2={hy - 1.5} stroke={PLAN.ink} strokeWidth="1.2" strokeLinecap="round" />
              <line x1={w / 2 + 2.5} y1={hy - 1.5} x2={w / 2 + 2.5 + handleLen} y2={hy - 1.5} stroke={PLAN.ink} strokeWidth="1.2" strokeLinecap="round" />
            </g>
          ) : (
            <line x1={w - 3 - handleLen} y1={hy - 1.5} x2={w - 3} y2={hy - 1.5} stroke={PLAN.ink} strokeWidth="1.2" strokeLinecap="round" style={NONE} />
          )}
          {code('REF', w / 2, (d - band) / 2, finish.fill, 9, rot)}
        </>
      );
    }

    case 'range':
    case 'cooktop': {
      const controls = kind === 'range' ? Math.max(2, Math.min(4, d * 0.13)) : 0;
      const top = 1.5;
      const areaH = d - controls - top - 1.5;
      const five = widthIn >= 36;
      const cols = [0.27, 0.73];
      const rows = [0.28, 0.72];
      const rr = Math.max(2, Math.min(w, areaH) * 0.15);
      const burner = (cx, cy, r, key) => (
        <g key={key} style={NONE}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={PLAN.ink} strokeWidth="0.9" />
          <circle cx={cx} cy={cy} r={r * 0.45} fill="none" stroke={PLAN.line} strokeWidth="0.6" />
          <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={PLAN.line} strokeWidth="0.5" />
          <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke={PLAN.line} strokeWidth="0.5" />
        </g>
      );
      const grates = [];
      rows.forEach((ry, i) => cols.forEach((cx, j) => {
        grates.push(burner(w * (five ? (j === 0 ? 0.2 : 0.8) : cx), top + areaH * ry, rr, `b${i}${j}`));
      }));
      if (five) grates.push(burner(w / 2, top + areaH / 2, rr * 1.15, 'bc'));
      const knobs = kind === 'range' ? Math.max(4, five ? 5 : 4) : 0;
      return (
        <>
          {applianceBody(w, d, finish)}
          {/* Cast iron grate field */}
          <rect x={1.5} y={top} width={Math.max(0, w - 3)} height={Math.max(0, areaH)} rx="1" fill={finish.dark ? finish.front : '#c7ccd2'} stroke={finish.stroke} strokeWidth="0.6" style={NONE} />
          {grates}
          {kind === 'range' && (
            <g style={NONE}>
              <rect x={0.5} y={d - controls} width={w - 1} height={controls - 0.5} fill={finish.front} stroke={finish.stroke} strokeWidth="0.6" />
              {Array.from({ length: knobs }, (_, i) => (
                <circle key={`k${i}`} cx={(w * (i + 1)) / (knobs + 1)} cy={d - controls / 2} r={Math.max(0.8, controls * 0.28)} fill={PLAN.ink} />
              ))}
            </g>
          )}
        </>
      );
    }

    case 'dishwasher':
      return (
        <>
          {applianceBody(w, d, finish)}
          <rect x={0.5} y={d - fb} width={w - 1} height={fb - 0.5} fill={finish.front} stroke={finish.stroke} strokeWidth="0.75" style={NONE} />
          <line x1={w * 0.3} y1={d - fb - 1.5} x2={w * 0.7} y2={d - fb - 1.5} stroke={PLAN.ink} strokeWidth="1.1" strokeLinecap="round" style={NONE} />
          {code('DW', w / 2, (d - fb) / 2, finish.fill, 9, rot)}
        </>
      );

    case 'microwave':
      return (
        <>
          {applianceBody(w, d, finish, { fillOpacity: 0.7, strokeDasharray: '4 2.5' })}
          {code('MW', w / 2, d / 2, finish.fill, 9, rot)}
        </>
      );

    case 'hood': {
      const ix = w * 0.3;
      const iy = d * 0.25;
      return (
        <>
          {applianceBody(w, d, finish, { fillOpacity: 0.55, strokeDasharray: '4 2.5' })}
          <g style={NONE}>
            <rect x={ix} y={iy} width={w - 2 * ix} height={d * 0.4} fill="none" stroke={finish.stroke} strokeWidth="0.6" strokeDasharray="2 1.5" />
            <line x1={0} y1={0} x2={ix} y2={iy} stroke={finish.stroke} strokeWidth="0.5" />
            <line x1={w} y1={0} x2={w - ix} y2={iy} stroke={finish.stroke} strokeWidth="0.5" />
            <line x1={0} y1={d} x2={ix} y2={iy + d * 0.4} stroke={finish.stroke} strokeWidth="0.5" />
            <line x1={w} y1={d} x2={w - ix} y2={iy + d * 0.4} stroke={finish.stroke} strokeWidth="0.5" />
          </g>
        </>
      );
    }

    case 'wine':
      return (
        <>
          {applianceBody(w, d, finish)}
          <rect x={1} y={d - fb} width={w - 2} height={fb - 0.5} fill={PLAN.glass} stroke={PLAN.glassEdge} strokeWidth="0.75" style={NONE} />
          {code('WINE', w / 2, (d - fb) / 2, finish.fill, 8, rot)}
        </>
      );

    case 'oven':
      return (
        <>
          {applianceBody(w, d, finish)}
          <rect x={0.5} y={d - fb} width={w - 1} height={fb - 0.5} fill={finish.front} stroke={finish.stroke} strokeWidth="0.75" style={NONE} />
          <line x1={0} y1={0} x2={w} y2={d - fb} stroke={finish.detail} strokeWidth="0.5" style={NONE} />
          <line x1={w} y1={0} x2={0} y2={d - fb} stroke={finish.detail} strokeWidth="0.5" style={NONE} />
          {code('OVEN', w / 2, (d - fb) / 2, finish.fill, 8, rot)}
        </>
      );

    case 'toilet': {
      const tankD = d * 0.28;
      const bowlTop = tankD * 0.85;
      const bowlH = d - bowlTop;
      return (
        <>
          {/* Clear hit area for the whole footprint */}
          <rect x={0} y={0} width={w} height={d} fill={PLAN.paper} fillOpacity="0.01" stroke="none" />
          <rect x={w * 0.05} y={0} width={w * 0.9} height={tankD} rx="2" fill={PLAN.porcelain} stroke={PLAN.porcelainEdge} strokeWidth="1" />
          <ellipse cx={w / 2} cy={bowlTop + bowlH / 2} rx={w * 0.4} ry={bowlH / 2} fill={PLAN.porcelain} stroke={PLAN.porcelainEdge} strokeWidth="1" />
          <ellipse cx={w / 2} cy={bowlTop + bowlH * 0.55} rx={w * 0.26} ry={bowlH * 0.32} fill={PLAN.water} stroke={PLAN.porcelainEdge} strokeWidth="0.6" style={NONE} />
        </>
      );
    }

    case 'tub': {
      const rim = Math.max(2, Math.min(3 * scale, Math.min(w, d) * 0.12));
      const drainAtLeft = hinge !== 'right';
      return (
        <>
          <rect x={0} y={0} width={w} height={d} rx="1.5" fill={PLAN.porcelain} stroke={PLAN.porcelainEdge} strokeWidth="1" />
          <rect x={rim} y={rim} width={Math.max(0, w - 2 * rim)} height={Math.max(0, d - 2 * rim)} rx={Math.min(d, w) * 0.25} fill={PLAN.water} stroke={PLAN.porcelainEdge} strokeWidth="0.75" style={NONE} />
          <circle cx={drainAtLeft ? rim + d * 0.18 : w - rim - d * 0.18} cy={d / 2} r={Math.max(1, d * 0.04)} fill="none" stroke={PLAN.porcelainEdge} strokeWidth="0.75" style={NONE} />
        </>
      );
    }

    case 'shower':
      return (
        <>
          <rect x={0} y={0} width={w} height={d} fill={PLAN.water} stroke={PLAN.porcelainEdge} strokeWidth="1" />
          <g style={NONE}>
            <line x1={0} y1={0} x2={w} y2={d} stroke={PLAN.hairline} strokeWidth="0.5" />
            <line x1={w} y1={0} x2={0} y2={d} stroke={PLAN.hairline} strokeWidth="0.5" />
            <circle cx={w / 2} cy={d / 2} r={Math.max(1.5, Math.min(w, d) * 0.06)} fill={PLAN.porcelain} stroke={PLAN.porcelainEdge} strokeWidth="0.75" />
            {/* Glass along the front */}
            <line x1={0} y1={d - 1.5} x2={w} y2={d - 1.5} stroke={PLAN.glassEdge} strokeWidth="0.75" />
            <line x1={0} y1={d} x2={w} y2={d} stroke={PLAN.glassEdge} strokeWidth="0.75" />
          </g>
        </>
      );

    case 'appliance':
      return applianceBody(w, d, finish);

    case 'base':
    default:
      return (
        <>
          {counterOutline(w, d, scale)}
          {body(w, d, finish)}
          {grain(w, d, finish)}
          {fronts(w, d, finish, widthIn > 24 ? 2 : 1)}
          {doorSwings(w, d, widthIn, hinge)}
        </>
      );
  }
};

/**
 * An item number badge: a small pill centred at (cx, cy). `rotate` turns it
 * back upright inside a rotated item group.
 */
export const PlanBadge = ({ n, cx, cy, rotate = 0, emphasis = false }) => {
  const bw = badgeWidth(n);
  const t = rotate ? `rotate(${rotate}, ${cx}, ${cy})` : undefined;
  return (
    <g transform={t}>
      <rect
        x={cx - bw / 2}
        y={cy - BADGE_H / 2}
        width={bw}
        height={BADGE_H}
        rx={BADGE_H / 2}
        fill={emphasis ? PLAN.accent : PLAN.paper}
        stroke={emphasis ? PLAN.accentInk : PLAN.ink}
        strokeWidth="1"
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="10"
        fontWeight="700"
        fontFamily="Arial, Helvetica, sans-serif"
        fill={emphasis ? '#ffffff' : PLAN.ink}
      >
        {n}
      </text>
    </g>
  );
};
