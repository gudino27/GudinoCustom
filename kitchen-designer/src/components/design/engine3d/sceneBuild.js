// The engine view's scene objects, built off the React render path and
// cached: one room shell (rebuilt only when the room changes) and one group
// per designer element (rebuilt only when its placementKey changes; a move or
// turn only changes the group's matrix).
//
// three.js only, no React: runs under `node --test`. Anything that needs the
// DOM (textures) is passed in.
import { buildJob, buildScene } from '../../../engine/index.js'
import { castsShadow } from '../../three/studio/materialLooks.js'
import { placementKey, roomKey } from './cacheKeys.js'
import { finishLook } from './finishLook.js'
import { deltaMatrix, poseOf } from './pose.js'

/** The designer view looks into the room from above: no ceiling. */
export const SHOW_CEILING = false
/**
 * Do the room's walls cast shadows? The designer's rooms have no windows and
 * (in this view) no ceiling, so a wall that cast would put most of the floor
 * in the low sun's shadow. They still receive shadows; cabinets, appliances
 * and fixtures cast as on the homepage (castsShadow).
 */
export const SHELL_CASTS_SHADOW = false

const SELECT_EMISSIVE = '#4a90e2'
const SELECT_INTENSITY = 0.3

/** Job for the room shell only, without the ceiling unless asked. */
export function shellJob(job, { ceiling = SHOW_CEILING } = {}) {
  const room = ceiling ? job.room : { ...job.room, ceiling: undefined }
  return { ...job, room, runs: [], islands: [], placements: [] }
}

/**
 * The room shell as one THREE.Group ('room'): floor, walls with their door
 * openings, casings and leaves.
 */
export function buildShell(job, { materials, bevel, ceiling } = {}) {
  const { parts, notes } = buildJob(shellJob(job, { ceiling }), { zones: ['room'] })
  // Custom walls (w5, w6, ...: partitions, a pantry) get a group of their own
  // inside the shell, named 'partition:w<n>', so the view can fade one that
  // stands between the camera and what it looks at.
  // The room walls (w1-w4) get one too ('outer:w<n>'), so the overview can
  // fade the ones between the camera outside and the room.
  const own = new Map()
  const outer = new Map()
  const rest = []
  for (const p of parts) {
    const m = /^(w\d+)(?:_|$)/.exec(p.name || '')
    const into = m ? (OUTER_WALLS.has(m[1]) ? outer : own) : null
    if (into) {
      if (!into.has(m[1])) into.set(m[1], [])
      into.get(m[1]).push(p)
    } else rest.push(p)
  }
  const pick = (list) => {
    const scene = buildScene(list, { groupBy: 'cabinet', materials, bevel })
    const g = scene.children.find((c) => c.name === 'room') || scene
    if (g !== scene) scene.remove(g)
    return g
  }
  const group = pick(rest)
  group.name = 'room'
  group.userData = { ...group.userData, shell: true }
  for (const [name, list] of own) {
    const g = pick(list)
    g.name = `partition:${name}`
    g.userData = { ...g.userData, partition: name }
    group.add(g)
  }
  for (const [name, list] of outer) {
    const g = pick(list)
    g.name = `outer:${name}`
    g.userData = { ...g.userData, outerWall: Number(name.slice(1)) }
    group.add(g)
  }
  return { group, notes }
}

const OUTER_WALLS = new Set(['w1', 'w2', 'w3', 'w4'])

/** The shell's partition groups by wall name ('w5' -> Group). */
export function partitionGroups(shellGroup) {
  const out = new Map()
  if (!shellGroup) return out
  for (const c of shellGroup.children) if (c.userData && c.userData.partition) out.set(c.userData.partition, c)
  return out
}

/** The shell's room-wall groups by wall number (1 -> Group). */
export function outerWallGroups(shellGroup) {
  const out = new Map()
  if (!shellGroup) return out
  for (const c of shellGroup.children) if (c.userData && c.userData.outerWall) out.set(c.userData.outerWall, c)
  return out
}

const FADE_OPACITY = 0.14

/**
 * See-through (a dollhouse cutaway) or back to solid: the group's meshes get
 * transparent copies of their materials that write no depth, so what stands
 * behind the wall shows; `false` puts the originals back.
 */
export function setFaded(group, on) {
  if (!group || Boolean(group.userData.faded) === Boolean(on)) return false
  group.traverse((o) => {
    if (!o.isMesh) return
    if (on) {
      const base = o.material
      const m = base.clone()
      m.transparent = true
      m.opacity = FADE_OPACITY
      m.depthWrite = false
      o.userData.solidMaterial = base
      o.material = m
    } else if (o.userData.solidMaterial) {
      const faded = o.material
      o.material = o.userData.solidMaterial
      delete o.userData.solidMaterial
      faded.dispose()
    }
  })
  group.userData.faded = Boolean(on)
  return true
}

/**
 * One designer element as a THREE.Group, geometry baked at its current pose.
 * Named by the element id, userData.cabinet = String(id).
 */
export function buildCabinetGroup(job, placement, { materials, bevel } = {}) {
  const single = { ...job, room: undefined, runs: [], islands: [], placements: [placement] }
  const { parts, notes } = buildJob(single, { zones: ['placed'] })
  const id = String(placement.id)
  const scene = buildScene(parts, { groupBy: 'cabinet', materials, bevel })
  let group = scene.children.find((c) => c.name === id)
  if (!group) {
    // every part is tagged with the placement id; if a builder returned
    // nothing, keep an empty group so the element still has an entry
    group = scene
    group.name = id
  } else {
    scene.remove(group)
  }
  group.userData = { ...group.userData, cabinet: id, ownMaterials: [] }
  return { group, notes }
}

/** castShadow / receiveShadow as on the homepage (castsShadow by material name). */
export function applyShadowFlags(group, { shell = false } = {}) {
  group.traverse((o) => {
    if (!o.isMesh) return
    const mat = Array.isArray(o.material) ? o.material[0] : o.material
    o.receiveShadow = true
    o.castShadow = shell ? SHELL_CASTS_SHADOW && castsShadow(mat?.name) : castsShadow(mat?.name)
  })
}

/**
 * Tint one group's own copies of its paint / appliance materials (the shared
 * ones stay untouched). `tex` is getTextures() (grain for stains), or null.
 */
export function applyFinish(group, finish, { finishes, lookup, tex } = {}) {
  const looks = finishLook(finish, { finishes, lookup })
  if (!looks.length) return group
  const byKey = new Map(looks.map((l) => [l.key, l]))
  const clones = new Map()
  group.traverse((o) => {
    if (!o.isMesh) return
    const key = o.material?.userData?.materialKey
    const look = byKey.get(key)
    if (!look) return
    if (!clones.has(key)) {
      const m = o.material.clone()
      m.color.set(look.color)
      if (look.shade) m.color.multiplyScalar(look.shade)
      if (typeof look.roughness === 'number') m.roughness = look.roughness
      if (typeof look.metalness === 'number') m.metalness = look.metalness
      if (look.grain && tex && tex.oak) {
        // the oak texture is a warm mid tone; lift the colour so the
        // stain does not come out darker than its swatch
        m.map = tex.oak
        m.color.multiplyScalar(1.3)
      }
      m.needsUpdate = true
      clones.set(key, m)
      group.userData.ownMaterials.push(m)
    }
    o.material = clones.get(key)
  })
  return group
}

/**
 * Show a group at `pose` although its geometry was baked at `pose0`.
 * The group's matrix is managed by hand from then on.
 */
export function placeGroup(group, pose, pose0) {
  group.matrixAutoUpdate = false
  deltaMatrix(pose, pose0, group.matrix)
  group.matrixWorldNeedsUpdate = true
}

/** Blue emissive tint on this group only (its meshes get their own copies). */
export function setHighlight(group, on) {
  group.traverse((o) => {
    if (!o.isMesh) return
    if (on && !o.userData.baseMaterial) {
      const base = o.material
      const m = base.clone()
      if (m.emissive) {
        m.emissive.set(SELECT_EMISSIVE)
        m.emissiveIntensity = SELECT_INTENSITY
      }
      o.userData.baseMaterial = base
      o.material = m
    } else if (!on && o.userData.baseMaterial) {
      const hl = o.material
      o.material = o.userData.baseMaterial
      delete o.userData.baseMaterial
      hl.dispose()
    }
  })
}

/**
 * Hand the scene environment to the shiny finishes (adoptEnvironment's job),
 * including materials parked behind a selection highlight.
 */
export function adoptEnvironmentDeep(group, env) {
  if (!env) return false
  group.traverse((o) => {
    if (!o.isMesh) return
    for (const m of [o.material, o.userData.baseMaterial]) {
      if (m && m.userData?.ownEnv && !m.envMap) {
        m.envMap = env
        m.needsUpdate = true
      }
    }
  })
  return true
}

/** Free a group's geometry and the materials it owns (never the shared set). */
export function disposeGroup(group) {
  if (!group) return
  setHighlight(group, false)
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose()
  })
  for (const m of group.userData.ownMaterials || []) m.dispose()
  group.userData.ownMaterials = []
  if (group.parent) group.parent.remove(group)
}

/**
 * Free a group's GPU resources but keep it usable (three re-uploads on the
 * next render). For unmounts, which React's StrictMode follows with a remount
 * that reuses the same objects.
 */
export function releaseGroup(group) {
  if (!group) return
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose()
  })
  for (const m of group.userData.ownMaterials || []) m.dispose()
}

/**
 * Bring the cached scene in line with a new job.
 *
 * @param {{ shell?: Object, cabinets?: Map }} prev  the previous result (or {})
 * @param {Object} job  designerToJob output
 * @param {Object} opts { materials, bevel, prepare(group, placement|null) }
 *   `prepare` styles a freshly built group (shadow flags, tint); it is not
 *   called for reused groups.
 * @returns {{ shell, cabinets: Map<string, Entry>, built: string[], reused: string[],
 *   dropped: Entry[], droppedShell: Object|null, notes: string[] }}
 *   Entry = { id, key, group, pose0, pose, placement }. `dropped` / `droppedShell`
 *   are for the caller to dispose once the new scene is committed.
 */
export function syncScene(prev = {}, job, { materials, bevel, prepare } = {}) {
  const notes = []
  const built = []
  const reused = []

  // room shell
  const rk = roomKey(job)
  let shell = prev.shell
  let droppedShell = null
  if (!shell || shell.key !== rk) {
    const s = buildShell(job, { materials, bevel })
    notes.push(...s.notes)
    if (prepare) prepare(s.group, null)
    droppedShell = shell ? shell.group : null
    shell = { key: rk, group: s.group }
  }

  // cabinets
  const old = prev.cabinets || new Map()
  const cabinets = new Map()
  for (const placement of job.placements || []) {
    const id = String(placement.id)
    if (cabinets.has(id)) {
      notes.push(`element ${id} appears twice; the second copy is not shown`)
      continue
    }
    const key = placementKey(placement, job)
    const pose = poseOf(placement)
    const was = old.get(id)
    if (was && was.key === key) {
      placeGroup(was.group, pose, was.pose0)
      cabinets.set(id, { ...was, pose, placement })
      reused.push(id)
      continue
    }
    const { group, notes: n } = buildCabinetGroup(job, placement, { materials, bevel })
    notes.push(...n)
    if (prepare) prepare(group, placement)
    placeGroup(group, pose, pose)
    cabinets.set(id, { id, key, group, pose0: pose, pose, placement })
    built.push(id)
  }
  const dropped = []
  for (const [id, entry] of old) {
    const now = cabinets.get(id)
    if (!now || now.group !== entry.group) dropped.push(entry)
  }
  return { shell, cabinets, built, reused, dropped, droppedShell, notes }
}
