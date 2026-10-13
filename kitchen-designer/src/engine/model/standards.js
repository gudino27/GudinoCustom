// Heights, depths and clearances, in inches. These are the reference
// kitchen's numbers (scripts/build_kitchen.py); a job overrides any of them.
export const DEFAULT_STANDARDS = {
  ceiling: 120,
  baseHeight: 36, // floor to top of the base carcass
  counterThickness: 1.5,
  counterOverhang: 1.1, // counter past the door face
  toeHeight: 4.5,
  toeRecess: 3.0,
  baseDepth: 24,
  upperBottom: 59.5, // counter 37.5 + 21 backsplash + 1 light rail
  upperTop: 117.5,
  upperDepth: 12,
  tallDepth: 24,
  frontThickness: 0.75,
  stile: 2.25, // width of a door's stiles and rails
  reveal: 0.16, // half the gap between neighbouring frameless fronts
  doorSplitWidth: 24.5, // wider openings get a pair of doors
}

export const DEFAULT_STYLE = {
  door: 'raised-panel', // raised-panel | shaker | slab
  finish: 'paint', // material key for frames and carcasses
  panelFinish: 'paint_panel', // material key for the panel field
  pull: 'bar-black',
  counter: 'granite',
  crown: '3-step',
}

// How the fronts meet the box. Chosen per job, overridable per cabinet.
export const DEFAULT_CONSTRUCTION = {
  system: 'frameless', // frameless | face-frame
  fit: 'full-overlay', // full-overlay | partial-overlay | inset
  frame: { stile: 1.5, rail: 1.5, midRail: 1.5, thickness: 0.75, bead: false },
  overlay: null, // inches a door laps onto the frame; null = the fit's default
  gap: 0.09375, // inset: clearance around each front (3/32")
  sheet: 0.75,
  back: 0.25,
  shelf: 0.75,
}
