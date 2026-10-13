// Numbers the designer stores: plan px (inches times `scale`) and inches.
//
// Inches come out of divisions by the scale (125 / 4.1666 = 29.999999999999996)
// and px out of multiplications by it (30 * 4.1666 = 125.00000000000001), so
// without rounding the saved design, the quote and the plan labels carry
// float noise ("25.999999999999996""). Everything the designer writes goes
// through these: inches to the nearest 1/16", px to the px of that 1/16",
// both cleaned of float noise. Pure functions: runs under `node --test`.

/** Finest length the designer stores, inches. */
export const INCH_STEP = 1 / 16;

/** `value` with float noise removed (6 decimals); non-numbers come back as they are. */
export const cleanNumber = (value, places = 6) => {
  const n = Number(value);
  if (typeof value !== 'number' || !Number.isFinite(n)) return value;
  const f = 10 ** places;
  const r = Math.round(n * f) / f;
  return Object.is(r, -0) ? 0 : r;
};

/** Inches to the nearest `step` (1/16"). */
export const roundInches = (inches, step = INCH_STEP) => {
  if (typeof inches !== 'number' || !Number.isFinite(inches)) return inches;
  return cleanNumber(Math.round(inches / step) * step);
};

/** Plan px (inches times `scale`) to the nearest 1/16" at that scale. */
export const roundPlanPx = (px, scale = 1, step = INCH_STEP) => {
  if (typeof px !== 'number' || !Number.isFinite(px) || !(scale > 0)) return px;
  return cleanNumber(roundInches(px / scale, step) * scale);
};

/** Plan px to inches, rounded to 1/16". */
export const pxToInches = (px, scale = 1) => roundInches(px / (scale || 1));

/** A move / element with its x / y (plan px) rounded; other fields untouched. */
export const roundPosition = (item, scale = 1) => {
  if (!item) return item;
  const out = { ...item };
  if (typeof item.x === 'number') out.x = roundPlanPx(item.x, scale);
  if (typeof item.y === 'number') out.y = roundPlanPx(item.y, scale);
  return out;
};

/** roundPosition over a list of moves ({ id, x?, y?, rotation? }). */
export const roundMoves = (moves = [], scale = 1) => moves.map((m) => roundPosition(m, scale));

/** A plan rectangle { x, y, width, depth } (px) with its edges on the 1/16" grid. */
export const roundPlanRect = (rect, scale = 1) => {
  const x0 = roundPlanPx(rect.x, scale);
  const y0 = roundPlanPx(rect.y, scale);
  const x1 = roundPlanPx(rect.x + rect.width, scale);
  const y1 = roundPlanPx(rect.y + rect.depth, scale);
  return { ...rect, x: x0, y: y0, width: cleanNumber(x1 - x0), depth: cleanNumber(y1 - y0) };
};

const FRACTIONS = 16;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** Whole inches and a reduced fraction of 1/16ths: 25.999999 -> [26, ''], 24.25 -> [24, '1/4']. */
const splitInches = (inches) => {
  const sixteenths = Math.round(Math.abs(inches) * FRACTIONS);
  const whole = Math.floor(sixteenths / FRACTIONS);
  const rest = sixteenths % FRACTIONS;
  const g = rest ? gcd(rest, FRACTIONS) : 1;
  return [whole, rest ? `${rest / g}/${FRACTIONS / g}` : ''];
};

/** 24 -> 24"; 24.25 -> 24 1/4"; 0.5 -> 1/2"; 25.999999999999996 -> 26". */
export const formatInchesFraction = (inches) => {
  const n = Number(inches);
  if (!Number.isFinite(n)) return `${inches}"`;
  const sign = n < 0 && Math.round(Math.abs(n) * FRACTIONS) > 0 ? '-' : '';
  const [whole, frac] = splitInches(n);
  if (!whole && frac) return `${sign}${frac}"`;
  return `${sign}${whole}${frac ? ` ${frac}` : ''}"`;
};

/** Feet-inches from inches: 150 -> 12' 6"; 30.5 -> 2' 6 1/2"; 144 -> 12' 0". */
export const formatFeetInchesFromInches = (inches) => {
  const n = Number(inches);
  if (!Number.isFinite(n)) return `${inches}"`;
  const sixteenths = Math.round(Math.abs(n) * FRACTIONS);
  const feet = Math.floor(sixteenths / (12 * FRACTIONS));
  const rest = (sixteenths - feet * 12 * FRACTIONS) / FRACTIONS;
  const sign = n < 0 && sixteenths > 0 ? '-' : '';
  return `${sign}${feet}' ${formatInchesFraction(rest)}`;
};


/**
 * Any length shown to a person, from inches, to the nearest 1/16":
 * 24.375 -> 24 3/8"; with { feet: true } lengths of a foot or more read as
 * feet-inches (30.5 -> 2' 6 1/2"), shorter ones as plain inches (6 1/2").
 * Empty / non-numeric values come back as '' so a missing size prints nothing.
 */
export const formatInches = (value, { feet = false } = {}) => {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (feet && Math.round(Math.abs(n) * FRACTIONS) >= 12 * FRACTIONS) return formatFeetInchesFromInches(n);
  return formatInchesFraction(n);
};

/** An inch value without the inch mark, for an input box: 24.375 -> "24 3/8". */
export const formatInchesPlain = (value) => formatInches(value).replace(/"$/, '');

/**
 * A room size stored in feet: 12 -> 12'; 12.2917 -> 12' 3 1/2". Whole feet
 * stay short, anything else shows its inches as a fraction.
 */
export const formatFeet = (feet) => {
  if (feet === null || feet === undefined || feet === '') return '';
  const n = Number(feet);
  if (!Number.isFinite(n)) return '';
  const sixteenths = Math.round(Math.abs(n) * 12 * FRACTIONS);
  if (sixteenths % (12 * FRACTIONS) === 0) {
    const sign = n < 0 && sixteenths > 0 ? '-' : '';
    return `${sign}${sixteenths / (12 * FRACTIONS)}'`;
  }
  return formatFeetInchesFromInches(n * 12);
};

// Typed quotes people actually use: straight, curly and prime marks.
const FOOT_MARKS = /[’′‘`]|\s*(?:feet|foot|ft)\.?(?![a-z])/gi;
const INCH_MARKS = /[”″“]|''|\s*(?:inches|inch|in)\.?(?![a-z])/gi;

/** "24", "24.5", "1/2", "24 1/2", "24-1/2" (no marks) as a number, else null. */
const parsePlainInches = (text) => {
  const s = text.trim();
  if (s === '') return 0;
  let m = s.match(/^(\d+(?:\.\d*)?|\.\d+)$/);
  if (m) return Number(m[1]);
  m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : null;
  m = s.match(/^(\d+(?:\.\d+)?)(?:\s+|\s*-\s*)(\d+)\s*\/\s*(\d+)$/);
  if (m) return Number(m[3]) ? Number(m[1]) + Number(m[2]) / Number(m[3]) : null;
  return null;
};

/** A typed length to inches, unrounded, or null (see parseInches). */
const parseRaw = (text) => {
  if (typeof text !== 'string') return null;
  let s = text.trim().replace(FOOT_MARKS, "'").replace(INCH_MARKS, '"').replace(/,/g, '.');
  if (!s) return null;
  let sign = 1;
  if (s.startsWith('-')) {
    sign = -1;
    s = s.slice(1).trim();
  }
  if (!s) return null;
  let inches;
  const footAt = s.indexOf("'");
  if (footAt >= 0) {
    const feetText = s.slice(0, footAt).trim();
    let rest = s.slice(footAt + 1).trim();
    if (!/^\d+(?:\.\d+)?$/.test(feetText)) return null;
    rest = rest.replace(/^-\s*/, '');
    if (rest.endsWith('"')) rest = rest.slice(0, -1).trim();
    if (rest.includes("'") || rest.includes('"')) return null;
    const restInches = parsePlainInches(rest);
    if (restInches === null) return null;
    inches = Number(feetText) * 12 + restInches;
  } else {
    let rest = s;
    if (rest.endsWith('"')) rest = rest.slice(0, -1).trim();
    if (!rest || rest.includes('"')) return null;
    inches = parsePlainInches(rest);
    if (inches === null) return null;
  }
  return Number.isFinite(inches) ? sign * inches : null;
};

/**
 * A typed length to inches, rounded to 1/16", or null when it is not one.
 * Accepts 24 | 24.5 | 24 1/2 | 24-1/2 | 24 1/2" | 1/2 | 2' 6 1/2" | 2'6 |
 * 2' | 2'-6" | 24in | 3 ft 2 in, and a leading minus. Numbers pass through
 * (rounded).
 */
export const parseInches = (text) => {
  const raw = typeof text === 'number' ? text : parseRaw(text);
  if (raw === null || !Number.isFinite(raw)) return null;
  return roundInches(raw) || 0;
};

/**
 * A typed room size to feet, or null. A bare number (or 12 1/2) is feet;
 * anything with a foot / inch mark is read as a length: 12' 6" -> 12.5,
 * 150" -> 12.5. Rounded to the 1/16" underneath.
 */
export const parseFeet = (text) => {
  if (typeof text === 'number') return Number.isFinite(text) ? cleanNumber(roundInches(text * 12) / 12) : null;
  if (typeof text !== 'string' || !text.trim()) return null;
  const marked = /['"’′”″]|\d\s*(ft|feet|foot|in|inch|inches)\b/i.test(text);
  const raw = parseRaw(text);
  if (raw === null) return null;
  // no marks: the number is feet (12, 12.5, 12 1/2)
  const inches = marked ? raw : raw * 12;
  return cleanNumber((roundInches(inches) || 0) / 12);
};
