/** Merge tags into every part (mutates and returns the same array). */
export function tagParts(parts, tags) {
  for (const p of parts) Object.assign(p.tags, tags)
  return parts
}

/** Tags the scroll build and the mesh merge key are made of. */
export const mergeKey = (part) => [
  part.tags.step || 0,
  part.tags.static ? 1 : 0,
  part.tags.group || 'room',
  part.tags.zone || 'room',
  part.material,
].join('|')
