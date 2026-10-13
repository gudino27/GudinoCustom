// The bathroom materials live in core/materials.js with the rest. This view of
// them is kept for callers that want only the fixtures' keys.
import { MATERIALS } from '../core/materials.js'

export const FIXTURE_MATERIALS = {
  porcelain: MATERIALS.porcelain,
  chrome: MATERIALS.chrome,
  shower_glass: MATERIALS.shower_glass,
  tile: MATERIALS.tile,
}
