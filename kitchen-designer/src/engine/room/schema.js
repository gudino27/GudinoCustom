// The room shell as data: what buildRoom (room/index.js) draws.
//
// Everything is in plan inches (x east, y south, z up), like the rest of the
// engine. A wall is a line segment on its ROOM FACE plus a thickness that
// grows away from the room; everything on a wall (openings, casings,
// baseboards, window trim, door leaves) is positioned in the wall's own frame:
//
//   s  distance along the wall from `from` toward `to` (negative inside `extend[0]`)
//   v  distance off the wall line toward its front (the room); the wall body is
//      v in [-thickness, 0] (or [-t/2, t/2] for side 'center')
//   z  up from the floor
//
// `side` says which side of the from -> to line the room is on, as seen on a
// plan drawn with y pointing down the page (the designer's canvas): walking
// east along a north wall, the room (south) is on your right. A room outline
// traced clockwise on the page has the room on the right of every wall.

/**
 * @typedef {[number, number]} Point2
 */

/**
 * @typedef {Object} Room
 * @property {number}   [height]    ceiling height; default ctx.standards.ceiling
 * @property {Slab}     [floor]     top face at z = 0
 * @property {Slab}     [ceiling]   bottom face at z = height
 * @property {Wall[]}   [walls]
 * @property {Beam[]}   [beams]
 * @property {Can[]}    [cans]      recessed lights
 * @property {Sheet[]}  [sheets]    single-sided walls that close the room behind the camera
 * @property {Extra[]}  [extras]    escape hatch: explicit boxes / prisms for one-off pieces
 */

/**
 * A floor or ceiling slab. Give `rect` or `outline`.
 * @typedef {Object} Slab
 * @property {[number, number, number, number]} [rect]   [x0, y0, x1, y1]
 * @property {Point2[]} [outline]    plan polygon (convex or concave)
 * @property {number}   [thickness]  floor 1, ceiling 2
 * @property {string}   [material]   floor 'oak', ceiling 'ceil'
 * @property {string}   [name]       'floor' / 'ceiling'
 */

/**
 * @typedef {Object} Wall
 * @property {string}  name        part name ('w9'); split walls add suffixes (see `split`)
 * @property {Point2}  from        start of the wall line (on the room face)
 * @property {Point2}  to          end of the wall line
 * @property {'right'|'left'|'center'} [side='right']  where the room is, walking from -> to;
 *                                  'center' = free-standing partition, line on its centre, front on the right
 * @property {number}  [thickness=6]
 * @property {number}  [height]     default: the room's height
 * @property {number}  [base=0]     bottom of the wall
 * @property {[number, number]} [extend=[0, 0]]  body carried past `from` / `to` along the line, e.g. to
 *                                  wrap an outside corner; s runs from -extend[0] to length + extend[1]
 * @property {string}  [material='wall']
 * @property {boolean} [split=false]  false: ONE solid part with real openings (holes, and notches
 *                                  where an opening reaches the floor, top or an end).
 *                                  true: boxes around the openings: full-height piers `${name}_a`,
 *                                  `_b`, ... (in order along s), `${name}_head` over an opening and
 *                                  `${name}_below` under one (indexed `_head0`, `_head1` when the wall
 *                                  has more than one of a kind). A solid wall whose openings cut it
 *                                  in two (full-height openings) is named `${name}_a`, `_b` likewise.
 * @property {Opening[]} [openings]
 * @property {Baseboard|Baseboard[]|boolean} [baseboard]  true = default baseboard along the wall
 */

/**
 * An opening in a wall. Position it with `at` (its start, s) or `center` (s of its middle).
 * @typedef {Object} Opening
 * @property {'door'|'window'|'cased-opening'} kind
 * @property {number} [at]          s of the opening's start edge
 * @property {number} [center]      s of the opening's centre (the designer's door position)
 * @property {number} width
 * @property {number} [head]        top of the opening: door 80, window 96, cased-opening 84
 * @property {number} [sill]        window: bottom of the opening (36)
 * @property {string} [name]        door: leaf/knob name prefix (default `${wall}_door`)
 * @property {string} [prefix]      window: name prefix (default 'win'); parts are `${prefix}_glass${index}`
 * @property {number} [index]       window: number in the names; default counts windows across the room
 * @property {[number, number]} [grid]  window: [columns, rows] of lites; [1, 1] = no muntins. Default [3, 3]
 * @property {Object} [glass]       window: { v: [back, front], material }
 * @property {Object} [trim]        window: { width, sillDrop, v: [back, front], material } (sill, head, jambs)
 * @property {Object} [muntin]      window: { width, v: [back, front], material }
 * @property {0|1|2}  [leaves]      door: 0 = open doorway, 1 = single leaf, 2 = a pair (default 1)
 * @property {'left'|'right'} [hinge]  door, single leaf: hinge at s0 ('left', default) or s1
 * @property {DoorLeaf} [leaf]
 * @property {Object|false} [knobs] door: { z, radius, length, proud, at: s[] }; false = none
 * @property {Casing|false} [casing]  door / cased-opening: trim around the opening (default on)
 * @property {Header} [header]      cased-opening: build the header as its own part (the wall is then
 *                                  cut to full height over the opening); otherwise the wall itself
 *                                  spans the opening above `head`
 */

/**
 * A stile-and-rail door leaf with a raised panel (port of panel_door_leaf).
 * @typedef {Object} DoorLeaf
 * @property {number} [bottom=0.5]    undercut above the floor
 * @property {number} [top]           default head - 2.4
 * @property {[number, number]} [v]   [back, front] faces; default [-thickness + 1.6, -thickness + 3.35]
 * @property {number} [stile=5]
 * @property {number} [topRail=5]
 * @property {number} [bottomRail=8]
 * @property {string} [material='trim']
 * @property {string} [panelMaterial='paint_panel']
 */

/**
 * Trim around a door or cased opening: two legs and a head.
 * @typedef {Object} Casing
 * @property {string} [name]         prefix: parts `${name}_l`, `${name}_r`, `${name}_head`
 *                                   (default `${wall}_case`, indexed when a wall has several)
 * @property {{left?: string, right?: string, head?: string}} [names]  full names, override `name`
 * @property {number} [outside=1.5]  how far a leg reaches past the opening's side
 * @property {number} [lap=0]        how far a leg laps into the opening
 * @property {number} [headDown=2]   head casing reaches this far below the opening's head
 * @property {number} [headUp=0.5]   ... and this far above it; legs run from the floor to its top
 * @property {[number, number]} [v]  [back, front]; default [-thickness, 0.8]
 * @property {string} [material='trim']
 */

/**
 * @typedef {Object} Header
 * @property {string} [name]          default `${wall}_header`
 * @property {number} [overhang=0]    header carried past each side of the opening
 * @property {string} [material]      default: the wall's
 */

/**
 * Left = the s0 (start) end, right = the s1 end; seen from the room, with the
 * room on the wall's right, that is the viewer's left and right.
 * @typedef {Object} Baseboard
 * @property {string} [name]          default `${wall}_base`, indexed when broken by openings
 * @property {[number, number]} [s]   stretch along the wall; default the whole wall, broken at
 *                                    openings that reach the floor (and their casings)
 * @property {number} [height=6]
 * @property {number} [thickness=0.9]
 * @property {[number, number]} [v]   [back, front]; default [0, thickness] (on the room face)
 * @property {string} [material='trim']
 */

/**
 * A ceiling beam, hung from the ceiling along a plan line.
 * @typedef {Object} Beam
 * @property {string} [name='beam']
 * @property {Point2} from
 * @property {Point2} to
 * @property {number} width
 * @property {number} depth           drop below the ceiling
 * @property {string} [material='beam']
 */

/**
 * A recessed can light: a housing disc flush with the ceiling and a lens below it.
 * @typedef {Object} Can
 * @property {Point2} at
 * @property {string} [name='can']    lens is `${name}_in`
 * @property {string} [lensName]
 * @property {string} [material='can']
 * @property {string} [lensMaterial='lens']
 * @property {number} [radius=3.4]
 * @property {number} [lensRadius=2.7]
 */

/**
 * A single-sided wall, visible only from the room side, invisible from behind.
 * @typedef {Object} Sheet
 * @property {string} name
 * @property {Point2} from
 * @property {Point2} to
 * @property {'right'|'left'} [side='right']   the side it is seen from (as for walls)
 * @property {number} [z0=0]
 * @property {number} [z1]            default: the room's height
 * @property {string} [material='wall_in']
 */

/**
 * Escape hatch for a one-off piece. Give `box` or `poly` + `z`.
 * @typedef {Object} Extra
 * @property {string} name
 * @property {string} material
 * @property {string} [role='trim']
 * @property {[number, number, number, number, number, number]} [box]  [x0, y0, z0, x1, y1, z1]
 * @property {Point2[]} [poly]
 * @property {[number, number]} [z]
 * @property {boolean} [bevel]
 */

/** Defaults a room falls back on. Heights in inches off the floor. */
export const ROOM_DEFAULTS = {
  wall: { thickness: 6, material: 'wall', side: 'right' },
  door: { head: 80, leaves: 1 },
  window: { sill: 36, head: 96, grid: [3, 3] },
  casedOpening: { head: 84 },
  leaf: { bottom: 0.5, headClear: 2.4, stile: 5, topRail: 5, bottomRail: 8, thickness: 1.75, setback: 1.6 },
  knob: { z: 36, radius: 0.55, length: 1.1, proud: 0.45, fromMeet: 1.5, fromEdge: 2.5 },
  casing: { outside: 1.5, lap: 0, headDown: 2, headUp: 0.5, proud: 0.8 },
  windowTrim: { width: 2.2, sillDrop: 1.8, v: [-1.8, 1.6] },
  windowGlass: { v: [-1.2, 0.2] },
  muntin: { width: 1, v: [-1, 0.5] },
  baseboard: { height: 6, thickness: 0.9 },
  can: { radius: 3.4, height: 1.2, drop: 0.6, lensRadius: 2.7, lensHeight: 1, lensDrop: 1.5 },
  floor: { thickness: 1 },
  ceiling: { thickness: 2 },
}

/**
 * A plain rectangular room: four walls around a width x depth interior whose
 * north-west inside corner is (0, 0), floor and ceiling under and over the
 * walls. Walls are named w1..w4 and run the way the designer draws walls 1-4:
 *   w1 north (0,0)->(W,0), w2 east (W,0)->(W,D), w3 south (0,D)->(W,D), w4 west (0,0)->(0,D)
 * so a designer door at `position` % on wall n sits at center = position/100 * length.
 * North and south walls wrap the corners.
 *
 * @param {number} width   interior, east-west
 * @param {number} depth   interior, north-south
 * @param {Object} [opts]
 * @param {number} [opts.height]     default ctx.standards.ceiling at build time
 * @param {number} [opts.thickness=6]
 * @param {Object<number, Opening[]>} [opts.openings]  by wall number 1-4
 * @param {number[]} [opts.walls=[1,2,3,4]]            which walls exist
 * @returns {Room}
 */
export function rectangularRoom(width, depth, opts = {}) {
  const t = opts.thickness ?? ROOM_DEFAULTS.wall.thickness
  const present = new Set(opts.walls || [1, 2, 3, 4])
  const openings = opts.openings || {}
  const defs = [
    { no: 1, from: [0, 0], to: [width, 0], side: 'right', extend: [t, t] },
    { no: 2, from: [width, 0], to: [width, depth], side: 'right', extend: [0, 0] },
    { no: 3, from: [0, depth], to: [width, depth], side: 'left', extend: [t, t] },
    { no: 4, from: [0, 0], to: [0, depth], side: 'left', extend: [0, 0] },
  ]
  const walls = defs.filter((d) => present.has(d.no)).map((d) => ({
    name: `w${d.no}`,
    from: d.from,
    to: d.to,
    side: d.side,
    thickness: t,
    extend: d.extend,
    openings: openings[d.no] || [],
  }))
  const rect = [-t, -t, width + t, depth + t]
  const room = {
    floor: { rect },
    ceiling: { rect },
    walls,
  }
  if (opts.height !== undefined) room.height = opts.height
  return room
}
