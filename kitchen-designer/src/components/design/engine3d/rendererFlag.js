// Which 3D view the designer shows. The cabinet-engine view (EngineRoom3D) is
// the default; the classic DesignEditor3D stays reachable, and is what the
// engine view falls back to by itself if it fails.
//
// The classic view is used when any of these says so (first one set wins):
//   - the URL has ?renderer=classic          (?renderer=engine forces the engine)
//   - localStorage.designerRenderer === 'classic'   ('engine' forces the engine)
//   - the build was made with REACT_APP_DESIGNER_RENDERER=classic
//
// Plain JS (no React / DOM imports) so it runs under `node --test`.

export const RENDERER_PARAM = 'renderer'
export const RENDERER_STORAGE_KEY = 'designerRenderer'
export const ENGINE_RENDERER = 'engine'
export const CLASSIC_RENDERER = 'classic'

function readSearch() {
  try {
    return typeof window !== 'undefined' ? window.location.search : ''
  } catch {
    return ''
  }
}

function readStorage() {
  try {
    return typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem(RENDERER_STORAGE_KEY)
      : null
  } catch {
    // private mode / blocked storage
    return null
  }
}

// CRA inlines process.env.REACT_APP_* at build time only when written out
// literally like this.
function readEnv() {
  try {
    return process.env.REACT_APP_DESIGNER_RENDERER
  } catch {
    return undefined
  }
}

const known = (v) => (v === ENGINE_RENDERER || v === CLASSIC_RENDERER ? v : null)

/**
 * @param {Object} [sources]  for tests; each defaults to the live value
 * @param {string} [sources.search]   location.search, e.g. '?renderer=classic'
 * @param {string|null} [sources.storage]  localStorage[designerRenderer]
 * @param {string} [sources.env]      REACT_APP_DESIGNER_RENDERER
 * @returns {boolean} true when the cabinet-engine view should be shown
 */
export function engineRendererEnabled(sources = {}) {
  const search = 'search' in sources ? sources.search : readSearch()
  const storage = 'storage' in sources ? sources.storage : readStorage()
  const env = 'env' in sources ? sources.env : readEnv()
  let param = null
  try {
    param = new URLSearchParams(search || '').get(RENDERER_PARAM)
  } catch {
    param = null
  }
  const choice = known(param) || known(storage) || known(env) || ENGINE_RENDERER
  return choice === ENGINE_RENDERER
}
