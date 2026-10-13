// Turns a design-link manifest (Contract C5) into values the 3D page can use
// as they are. The server only rejects a manifest that breaks the C6 list, so
// anything else arrives here as sent: numbers that are strings, null or out
// of range, unknown fields, types and group ids. Every number is checked and
// clamped here, never in the scene. Plain JS, no three.js, so node:test can
// run it (tests/designLink/).

export const PRESET_IDS = ['daylight', 'evening', 'night'];
export const MAX_FIXTURES = 24;
export const FIXTURE_TYPES = ['spot', 'strip', 'point'];

// C6 "Page clamps"
export const LIMITS = {
  sun: [0, 40],
  spot: [0, 2000],
  point: [0, 2000],
  strip: [0, 500],
  sky: [0, 4],
  ambient: [0, 4],
  environmentIntensity: [0, 4],
  exposure: [0.1, 6],
  glow: [0, 20],
  fov: [20, 100],
  angle: [0.01, 1.5708],
  penumbra: [0, 1],
  decay: [0, 4],
  distance: [0, Infinity],
  size: [0.01, 10],
};

export const LIGHT_COLOR_FALLBACK = '#ffffff';
export const BACKGROUND_FALLBACK = '#d9d6cf';

// Used only when a field is missing or not a finite number. The light
// numbers are Studio's Daylight rig (C5 example).
const DEFAULTS = {
  fov: 50,
  skyIntensity: 0.12,
  skyGround: '#bfb6a4',
  environmentIntensity: 0.42,
  exposure: 1,
  glow: 1,
  angle: Math.PI / 3, // three.js SpotLight default
  penumbra: 0,
  decay: 2,
  distance: 0,
};

export const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

export function clamp(v, [lo, hi]) {
  return Math.min(hi, Math.max(lo, v));
}

// A finite number clamped to `range`, else `fallback` (which may be null)
export function num(v, range, fallback) {
  if (!isFiniteNumber(v)) return fallback;
  return range ? clamp(v, range) : v;
}

export function color(v, fallback) {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

const str = (v) => (typeof v === 'string' && v.trim() !== '' ? v : null);

// Positions further than this from the origin (metres) are treated as
// invalid: a finite 1e308 would put a camera or light out of any view
export const MAX_COORD = 1000;

export function vec(v, n) {
  if (!Array.isArray(v) || v.length < n) return null;
  const out = v.slice(0, n);
  return out.every((x) => isFiniteNumber(x) && Math.abs(x) <= MAX_COORD) ? out : null;
}

// Unit vector, or null when it is missing, zero or not finite (C5: skip it)
export function unit(v, n) {
  const a = vec(v, n);
  if (!a) return null;
  const len = Math.hypot(...a);
  if (!(len > 1e-9) || !Number.isFinite(len)) return null;
  return a.map((x) => x / len);
}

const sub = (a, b) => a.map((x, i) => x - b[i]);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

function bounds(b) {
  if (!b || typeof b !== 'object') return null;
  const min = vec(b.min, 3);
  const max = vec(b.max, 3);
  if (!min || !max) return null;
  const lo = min.map((x, i) => Math.min(x, max[i]));
  const hi = min.map((x, i) => Math.max(x, max[i]));
  return { min: lo, max: hi };
}

// C5 .center: the plan middle at min(1.143, 0.4 x ceiling)
export function defaultCenter(b) {
  return [
    (b.min[0] + b.max[0]) / 2,
    Math.min(1.143, 0.4 * (b.max[1] - b.min[1])) + b.min[1],
    (b.min[2] + b.max[2]) / 2,
  ];
}

// Half the 3D diagonal of the bounds (C5 sun rule)
export function halfDiagonal(b) {
  return Math.hypot(...sub(b.max, b.min)) / 2;
}

// A view from outside the south-east corner, above the walls, looking at the
// middle: used when Studio sent no usable camera for a room
export function defaultCamera(b, center) {
  const size = sub(b.max, b.min);
  const c = center || defaultCenter(b);
  return {
    name: null,
    position: [b.max[0] + size[0] * 0.5, b.max[1] + Math.max(1, size[1] * 0.4), b.max[2] + size[2] * 0.5],
    target: c,
    fov: DEFAULTS.fov,
  };
}

function normalizeCamera(c) {
  if (!c || typeof c !== 'object') return null;
  const position = vec(c.position, 3);
  const target = vec(c.target, 3);
  if (!position || !target) return null;
  return {
    name: str(c.name),
    room: typeof c.room === 'string' ? c.room : null,
    position,
    target,
    fov: num(c.fov, LIMITS.fov, DEFAULTS.fov),
  };
}

function normalizeWall(w) {
  if (!w || typeof w !== 'object') return null;
  const node = str(w.node);
  const point = vec(w.point, 2);
  const normal = unit(w.normal, 2);
  if (!node || !point || !normal) return null;
  return { node, point, normal };
}

// Fills what depends on the room's box: centre and fallback camera. The scene
// calls it again with the node's bounding box when `bounds` was unusable.
export function completeRoom(room, box) {
  const b = room.bounds || box;
  if (!b) return room;
  const center = room.center || defaultCenter(b);
  const cameras = room.cameras.length ? room.cameras : [defaultCamera(b, center)];
  return { ...room, bounds: b, center, cameras };
}

function normalizePreset(p, id, groupIds) {
  const src = p && typeof p === 'object' ? p : {};
  const sunSrc = src.sun && typeof src.sun === 'object' ? src.sun : {};
  const sunDir = unit(sunSrc.direction, 3);
  const sunIntensity = num(sunSrc.intensity, LIMITS.sun, null);
  const sun = sunSrc.on === true && sunDir && sunIntensity !== null
    ? { on: true, direction: sunDir, color: color(sunSrc.color, LIGHT_COLOR_FALLBACK), intensity: sunIntensity }
    : { on: false, direction: [0, -1, 0], color: LIGHT_COLOR_FALLBACK, intensity: 0 };
  const skySrc = src.sky && typeof src.sky === 'object' ? src.sky : {};
  const ambSrc = src.ambient && typeof src.ambient === 'object' ? src.ambient : null;
  const fixturesOn = Array.isArray(src.fixturesOn)
    ? [...new Set(src.fixturesOn.filter((g) => typeof g === 'string' && groupIds.has(g)))]
    : [];
  return {
    id,
    label: str(src.label) || id.charAt(0).toUpperCase() + id.slice(1),
    sun,
    sky: {
      color: color(skySrc.color, LIGHT_COLOR_FALLBACK),
      ground: color(skySrc.ground, DEFAULTS.skyGround),
      intensity: num(skySrc.intensity, LIMITS.sky, DEFAULTS.skyIntensity),
    },
    // missing = no ambient light (kept at 0 so the light count never changes)
    ambient: {
      color: color(ambSrc?.color, LIGHT_COLOR_FALLBACK),
      intensity: ambSrc ? num(ambSrc.intensity, LIMITS.ambient, 0) : 0,
    },
    environmentIntensity: num(src.environmentIntensity, LIMITS.environmentIntensity, DEFAULTS.environmentIntensity),
    exposure: num(src.exposure, LIMITS.exposure, DEFAULTS.exposure),
    background: color(src.background, BACKGROUND_FALLBACK),
    fixturesOn,
  };
}

// Strip orientation (C5): X = widthAxis, Z = -direction, Y = Z x X. The width
// axis is made exactly perpendicular to the direction first; null when the
// two are parallel or either is unusable.
export function stripBasis(direction, widthAxis) {
  const d = unit(direction, 3);
  const w0 = unit(widthAxis, 3);
  if (!d || !w0) return null;
  const w = unit(sub(w0, d.map((x) => x * dot(w0, d))), 3);
  if (!w) return null;
  const z = d.map((x) => -x);
  const y = cross(z, w);
  return { x: w, y, z };
}

function normalizeFixture(f, groupIds, roomIds) {
  if (!f || typeof f !== 'object') return null;
  if (!FIXTURE_TYPES.includes(f.type)) return null;
  if (typeof f.group !== 'string' || !groupIds.has(f.group)) return null;
  let room;
  if (roomIds.length === 1) room = roomIds[0];
  else if (typeof f.room === 'string' && roomIds.includes(f.room)) room = f.room;
  else return null;
  const position = vec(f.position, 3);
  const intensity = num(f.intensity, LIMITS[f.type], null);
  if (!position || intensity === null) return null;
  const out = {
    type: f.type,
    group: f.group,
    room,
    position,
    color: color(f.color, LIGHT_COLOR_FALLBACK),
    intensity,
  };
  if (f.type === 'spot') {
    const direction = unit(f.direction, 3);
    if (!direction) return null;
    out.direction = direction;
    out.angle = num(f.angle, LIMITS.angle, DEFAULTS.angle);
    out.penumbra = num(f.penumbra, LIMITS.penumbra, DEFAULTS.penumbra);
  }
  if (f.type === 'spot' || f.type === 'point') {
    out.decay = num(f.decay, LIMITS.decay, DEFAULTS.decay);
    out.distance = num(f.distance, LIMITS.distance, DEFAULTS.distance);
  }
  if (f.type === 'strip') {
    const basis = stripBasis(f.direction, f.widthAxis);
    const width = num(f.width, LIMITS.size, null);
    const height = num(f.height, LIMITS.size, null);
    if (!basis || width === null || height === null) return null;
    out.basis = basis;
    out.width = width;
    out.height = height;
  }
  return out;
}

// Returns the cleaned manifest, or null when it cannot be shown at all (no
// usable room). Rooms whose bounds are unusable keep `bounds: null` and are
// completed by the scene from the model (completeRoom).
export function normalizeManifest(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;

  const seen = new Set();
  const rooms = (Array.isArray(m.rooms) ? m.rooms : [])
    .filter((r) => r && typeof r === 'object' && str(r.id) && str(r.node))
    .filter((r) => !seen.has(r.id) && seen.add(r.id))
    .slice(0, 8)
    .map((r) => {
      const b = bounds(r.bounds);
      return {
        id: r.id,
        name: str(r.name),
        node: r.node,
        ceilingNode: str(r.ceilingNode),
        center: vec(r.center, 3),
        bounds: b,
        walls: (Array.isArray(r.walls) ? r.walls : []).map(normalizeWall).filter(Boolean),
        cameras: [],
      };
    });
  if (!rooms.length) return null;

  const roomIds = rooms.map((r) => r.id);
  (Array.isArray(m.cameras) ? m.cameras : []).forEach((raw) => {
    const c = normalizeCamera(raw);
    if (!c) return;
    // one room: every camera is that room's; otherwise an unknown room is skipped
    const room = rooms.length === 1 ? rooms[0] : rooms.find((r) => r.id === c.room);
    if (room) room.cameras.push({ name: c.name, position: c.position, target: c.target, fov: c.fov });
  });

  const groupSeen = new Set();
  const fixtureGroups = (Array.isArray(m.fixtureGroups) ? m.fixtureGroups : [])
    .filter((g) => g && typeof g === 'object' && str(g.id) && !groupSeen.has(g.id) && groupSeen.add(g.id))
    .map((g) => ({ id: g.id, label: str(g.label) || g.id, glow: num(g.glow, LIMITS.glow, DEFAULTS.glow) }));
  const groupIds = new Set(fixtureGroups.map((g) => g.id));

  const fixtures = (Array.isArray(m.fixtures) ? m.fixtures : [])
    .map((f) => normalizeFixture(f, groupIds, roomIds))
    .filter(Boolean)
    .slice(0, MAX_FIXTURES);

  const presets = {};
  PRESET_IDS.forEach((id) => {
    presets[id] = normalizePreset(m.presets?.[id], id, groupIds);
  });
  const defaultPreset = PRESET_IDS.includes(m.defaultPreset) ? m.defaultPreset : 'daylight';

  return {
    rooms: rooms.map((r) => completeRoom(r, null)),
    presets,
    defaultPreset,
    fixtureGroups,
    fixtures,
  };
}

// C5 cameras rule: `fov` is the vertical fov of a 3:2 landscape view. Below
// aspect 1.5 keep the same horizontal view, up to 100 degrees.
export function viewFov(fov, aspect) {
  const f = num(fov, LIMITS.fov, DEFAULTS.fov);
  if (!(aspect > 0) || aspect >= 1.5) return f;
  const v = (2 * Math.atan(Math.tan((f * Math.PI) / 360) * (1.5 / aspect)) * 180) / Math.PI;
  return Math.min(100, v);
}

// C4: outside = x or z outside the bounds, or above the ceiling
export function isOutsideRoom(cam, b) {
  return cam[0] < b.min[0] || cam[0] > b.max[0]
    || cam[2] < b.min[2] || cam[2] > b.max[2]
    || cam[1] > b.max[1];
}

// C4 cut-away: which of the room's nodes to hide for a camera at `cam`
// ([x, y, z]). Inside the room nothing is hidden.
export function cutAway(room, cam) {
  const hidden = new Set();
  if (!room.bounds || !isOutsideRoom(cam, room.bounds)) return hidden;
  if (room.ceilingNode) hidden.add(room.ceilingNode);
  room.walls.forEach((w) => {
    if ((cam[0] - w.point[0]) * w.normal[0] + (cam[2] - w.point[1]) * w.normal[1] < 0) hidden.add(w.node);
  });
  return hidden;
}

// C5 sun: light at center - dir * (R + 1), aimed at center, shadow box
// +/-(R + 0.15), near 0.5, far 2R + 2
export function sunPlacement(center, b, direction) {
  const R = halfDiagonal(b);
  return {
    position: center.map((c, i) => c - direction[i] * (R + 1)),
    target: center,
    extent: R + 0.15,
    near: 0.5,
    far: 2 * R + 2,
  };
}

// A box around every room, for the orbit distance limit
export function allRoomsBox(rooms) {
  const withBounds = rooms.filter((r) => r.bounds);
  if (!withBounds.length) return null;
  const min = [0, 1, 2].map((i) => Math.min(...withBounds.map((r) => r.bounds.min[i])));
  const max = [0, 1, 2].map((i) => Math.max(...withBounds.map((r) => r.bounds.max[i])));
  return { min, max };
}
