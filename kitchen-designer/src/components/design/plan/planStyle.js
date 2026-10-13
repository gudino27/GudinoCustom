// Look of the 2D floor plan: palette, finish colours, which plan symbol each
// element type draws with, and small formatting helpers.
//
// No React: runs under `node --test` (tests/designer/planStyle.test.js).
// Every colour is a plain hex attribute (no CSS variables) so the plan still
// looks the same when pdfService serialises the SVG into the quote PDF.

import { getMaterialById, MATERIAL_TYPES } from '../../../constants/materials.js';
import { formatFeetInchesFromInches, formatInchesFraction } from '../../../utils/designer/planUnits.js';

export const PLAN = {
  ink: '#1f2937',          // primary text and linework (14.7:1 on white)
  inkSoft: '#4b5563',      // labels (7.6:1 on white)
  line: '#6b7280',         // secondary linework
  hairline: '#9ca3af',
  paper: '#ffffff',
  gridMinor: '#eef0f3',
  gridMajor: '#dfe3e8',
  wall: '#374151',         // wall poche
  wallHatch: '#4b5563',
  counter: '#e9e6e0',      // stone / quartz tone
  counterEdge: '#a8a29e',
  steel: '#d7dbe0',        // stainless
  steelEdge: '#6b7280',
  porcelain: '#fbfbfa',
  porcelainEdge: '#8b9097',
  glass: '#dbeafe',
  glassEdge: '#60a5fa',
  water: '#eef4f8',
  accent: '#2563eb',       // selection
  accentInk: '#1e40af',    // selection text (8.7:1 on white)
  cabinetDefault: '#ece5d8' // unfinished maple-ish when no finish is chosen
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export const hexToRgb = (hex) => {
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

/** Blend `a` toward `b` by `t` (0 = a, 1 = b). */
export const mix = (a, b, t) => {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return a;
  const k = clamp01(t);
  return toHex(ra.map((v, i) => v + (rb[i] - v) * k));
};

/** Darken toward black by `t`. */
export const shade = (hex, t) => mix(hex, '#000000', t);

/** WCAG relative luminance. */
export const luminance = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrastRatio = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/**
 * Text colour for `fill`: the plan ink when it reads at 4.5:1, else black
 * or white, whichever reads better (mid-tone stains and greens).
 */
export const inkOn = (fill) => {
  if (contrastRatio(PLAN.ink, fill) >= 4.5) return PLAN.ink;
  return contrastRatio('#000000', fill) >= contrastRatio('#ffffff', fill) ? '#000000' : '#ffffff';
};

/**
 * The plan colours of an element from its chosen finish (element.materialId):
 * { fill, stroke, front, grain, dark }. Cabinets take the paint / stain
 * colour, softened a little so the linework stays readable; appliances and
 * fixtures are stainless unless an appliance finish is chosen.
 */
export const finishOf = (element, category = element && element.category) => {
  const m = element && element.materialId ? getMaterialById(element.materialId) : null;
  const isAppliance = category === 'appliance';
  let base;
  if (isAppliance) {
    base = m && m.type === MATERIAL_TYPES.APPLIANCE ? m.hex : PLAN.steel;
  } else {
    base = m && m.type !== MATERIAL_TYPES.APPLIANCE ? m.hex : PLAN.cabinetDefault;
  }
  const dark = luminance(base) < 0.18;
  // Subtle: light finishes as they are, dark ones lifted a touch so the
  // symbol linework on top still shows
  const fill = dark ? mix(base, '#ffffff', 0.12) : base;
  const stroke = dark ? shade(base, 0.55) : shade(base, 0.5);
  const front = dark ? mix(base, '#ffffff', 0.3) : shade(base, 0.18);
  return {
    fill,
    stroke,
    front,
    dark,
    grain: !!m && m.type === MATERIAL_TYPES.STAIN,
    detail: dark ? mix(base, '#ffffff', 0.55) : shade(base, 0.42)
  };
};

/**
 * Which plan symbol a type draws with. Unknown types fall back on their
 * category (cabinet -> plain base box, appliance -> steel box).
 */
const KINDS = {
  'base': 'base',
  'drawer-base': 'drawer',
  'double-drawer-base': 'drawer',
  'sink-base': 'sink',
  'wall': 'wall',
  'glass-wall': 'glass-wall',
  'open-shelf': 'open-shelf',
  'corner-wall': 'corner-wall',
  'tall': 'tall',
  'pantry': 'tall',
  'linen': 'tall',
  'linen-tower': 'tall',
  'vanity-tower': 'tall',
  'corner': 'corner',
  'island-base': 'island',
  'peninsula-base': 'island',
  'refrigerator-cabinet': 'fridge-cabinet',
  'vanity': 'vanity',
  'vanity-sink': 'vanity-sink',
  'floating-vanity': 'vanity-sink',
  'corner-vanity': 'vanity-sink',
  'double-vanity': 'double-vanity',
  'medicine': 'medicine',
  'medicine-mirror': 'medicine',
  'refrigerator': 'fridge',
  'stove': 'range',
  'cooktop': 'cooktop',
  'dishwasher': 'dishwasher',
  'microwave': 'microwave',
  'range-hood': 'hood',
  'wine-cooler': 'wine',
  'double-oven': 'oven',
  'toilet': 'toilet',
  'bathtub': 'tub',
  'shower': 'shower'
};

export const symbolKind = (type, spec = {}) => {
  if (KINDS[type]) return KINDS[type];
  if (spec.houses) return 'fridge-cabinet';
  if (spec.category === 'appliance') return 'appliance';
  if (spec.mountHeight) return 'wall';
  return 'base';
};

/** Symbols drawn dashed: they hang above the counter / floor. */
export const OVERHEAD_KINDS = new Set(['wall', 'glass-wall', 'open-shelf', 'corner-wall', 'medicine', 'microwave', 'hood']);

/** 12.5 -> 12' 6"; whole feet -> 12' 0"; 2.5104 -> 2' 6 1/8" (to 1/16"). */
export const formatFeetInches = (feet) => {
  const f = Number(feet);
  if (!Number.isFinite(f)) return `${feet}'`;
  return formatFeetInchesFromInches(f * 12);
};

/** 24 -> 24"; 24.5 -> 24 1/2"; 25.999999999999996 -> 26" (to 1/16"). */
export const formatInches = (inches) => formatInchesFraction(inches);

/** Pill width for an item number badge (height is BADGE_H). */
export const BADGE_H = 14;
export const badgeWidth = (n) => Math.max(BADGE_H, String(n).length * 6.5 + 7);

/** Width of a text knockout behind a label of `text` at `fontSize`. */
export const labelWidth = (text, fontSize = 10) => String(text).length * fontSize * 0.58 + 6;
