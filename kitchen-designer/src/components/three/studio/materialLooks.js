// ---------------------------------------------------------------------------
// Give each material its finish, by NAME PREFIX (the homepage's names are set
// in scripts/build_kitchen.py; any scene that names its materials the same
// way — granite*, oak*, paint*, stainless*, glass_window* ... — gets the same
// look). `tex` is getTextures().
// ---------------------------------------------------------------------------
export function applyMaterialLook(m, tex) {
  if (!m || m.userData.__styled) return
  m.userData.__styled = true
  const name = (m.name || '').toLowerCase()

  // envMapIntensity only counts when a material carries its own envMap —
  // otherwise three uses scene.environmentIntensity. The shiny finishes are
  // flagged here and handed the environment once it exists (adoptEnvironment).
  if (/^(granite|stainless|metal|glass|cast_iron|porcelain|wall_tile)/.test(name)) m.userData.ownEnv = true

  if (name.startsWith('granite')) {
    m.map = tex.granite
    m.color.setRGB(1, 1, 1)
    m.roughness = 0.22
    m.metalness = 0.0
    m.envMapIntensity = 0.65
  } else if (name.startsWith('oak')) {
    m.map = tex.oak
    // honey oak — at full white the texture read as a pale yellow sheet
    m.color.setRGB(0.8, 0.74, 0.66)
    m.roughness = 0.62
    m.envMapIntensity = 0.22
  } else if (name.startsWith('can_lens')) {
    // the lit diffuser of each recessed can
    m.emissive.set('#fff3e2')
    m.emissiveIntensity = 1.4
  } else if (name.startsWith('beam')) {
    m.map = tex.beam
    m.color.setRGB(0.8, 0.78, 0.76)
    m.roughness = 0.72
    m.envMapIntensity = 0.4
  } else if (name.startsWith('paint') || name.startsWith('cabinterior')) {
    // painted white cabinetry: a touch of sheen, no texture
    m.roughness = 0.5
    m.roughnessMap = tex.sheen
    m.metalness = 0.0
    m.envMapIntensity = 0.32
    // no shadow pass, so the inset panels need colour separation to read
    if (name.startsWith('paint_white_panel')) m.color.multiplyScalar(0.9)
  } else if (name.startsWith('glass_oven')) {
    m.transparent = true
    m.opacity = 0.86
    m.roughness = 0.12
    m.metalness = 0.35
    m.color.set('#23272a')
  } else if (name.startsWith('glass_shower')) {
    // clear tempered glass: you see the shower through it, with a reflection
    m.transparent = true
    m.opacity = 0.18
    m.roughness = 0.04
    m.metalness = 0.0
    m.envMapIntensity = 1.4
  } else if (name.startsWith('glass_window')) {
    // clear window glass: the view outside, with a faint reflection
    m.transparent = true
    m.opacity = 0.1
    m.roughness = 0.04
    m.metalness = 0.0
    m.envMapIntensity = 1.0
  } else if (name.startsWith('glass')) {
    // frosted cabinet glass — you should read the shelves through it, softly
    m.transparent = true
    m.opacity = 0.34
    m.roughness = 0.22
    m.metalness = 0.0
    m.color.set('#e2eaee')
    m.envMapIntensity = 1.6
  } else if (name.startsWith('stainless_dark')) {
    // graphite appliance panels. Metalness kills the diffuse term and there is
    // no real environment behind these, so a metallic setting renders black —
    // keep it mostly diffuse and let the env map supply the sheen.
    m.color.multiplyScalar(1.35)
    m.roughness = 0.40
    m.metalness = 0.18
    m.envMapIntensity = 1.4
  } else if (name.startsWith('stainless')) {
    m.roughness = 0.28
    m.metalness = 0.8
    m.envMapIntensity = 1.8
  } else if (name.startsWith('cast_iron')) {
    // matte cast-iron grates: almost no sheen, so they read as mass
    m.roughness = 0.82
    m.metalness = 0.15
    m.envMapIntensity = 0.5
  } else if (name.startsWith('metal_black')) {
    m.roughness = 0.32
    m.metalness = 0.85
    m.envMapIntensity = 1.2
  } else if (name.startsWith('porcelain')) {
    // glazed china: glossy, but diffuse white underneath
    m.roughness = 0.16
    m.metalness = 0.0
    m.envMapIntensity = 0.9
  } else if (name.startsWith('wall_tile')) {
    m.roughness = 0.3
    m.metalness = 0.0
    m.envMapIntensity = 0.6
  } else if (name.startsWith('wall') || name.startsWith('ceiling')) {
    m.roughness = 0.95
    m.metalness = 0.0
    m.envMapIntensity = 0.18
  } else if (name.startsWith('toe')) {
    m.roughness = 0.7
  }
  m.needsUpdate = true
}

// Everything receives. Everything solid casts — walls and ceiling too,
// so daylight only gets in through the window openings. Glass does
// not (a frosted pane throwing a hard shadow is what made the window
// light read backwards), and nothing sits under the floor.
export function castsShadow(materialName) {
  const name = (materialName || '').toLowerCase()
  return !(name.startsWith('oak_floor') || name.startsWith('glass') || name.startsWith('can_lens'))
}

// The shiny finishes get the environment as their own envMap, so their
// envMapIntensity applies instead of the scene's (deliberately low) one.
// Call once scene.environment exists (StudioEnvironment sets it in an effect,
// so from a useFrame, or after mount). Returns false if it is not there yet.
export function adoptEnvironment(root, scene) {
  const env = scene && scene.environment
  if (!root || !env) return false
  root.traverse((o) => {
    if (!o.isMesh) return
    const list = Array.isArray(o.material) ? o.material : [o.material]
    list.forEach((m) => {
      if (m.userData.ownEnv && !m.envMap) {
        m.envMap = env
        m.needsUpdate = true
      }
    })
  })
  return true
}
