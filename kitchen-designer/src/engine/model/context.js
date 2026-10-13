import { DEFAULT_CONSTRUCTION, DEFAULT_STANDARDS, DEFAULT_STYLE } from './standards.js'

/**
 * @typedef {Object} Ctx  everything a builder needs to know besides where to draw
 * @property {typeof DEFAULT_STANDARDS} standards
 * @property {typeof DEFAULT_STYLE} style
 * @property {typeof DEFAULT_CONSTRUCTION} construction
 */

const mergeConstruction = (...layers) => {
  const out = { ...DEFAULT_CONSTRUCTION, frame: { ...DEFAULT_CONSTRUCTION.frame } }
  for (const l of layers) {
    if (!l) continue
    const { frame, ...rest } = l
    Object.assign(out, rest)
    if (frame) Object.assign(out.frame, frame)
  }
  return out
}

/** Job-level context. Pass `{}` for the reference kitchen's defaults. */
export function jobCtx(job = {}) {
  return {
    standards: { ...DEFAULT_STANDARDS, ...(job.standards || {}) },
    style: { ...DEFAULT_STYLE, ...(job.style || {}) },
    construction: mergeConstruction(job.construction),
  }
}

/** Context for one cabinet: the job's, with the item's own overrides on top. */
export function itemCtx(ctx, item = {}) {
  if (!item.construction && !item.style && !item.standards) return ctx
  return {
    standards: { ...ctx.standards, ...(item.standards || {}) },
    style: { ...ctx.style, ...(item.style || {}) },
    construction: mergeConstruction(ctx.construction, item.construction),
  }
}
