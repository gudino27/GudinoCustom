// Plain JS, no React / three imports, so Node can load it (roomLighting tests).

// Every studio number (light decay, shadow biases, AO radius, fog) is tuned for
// a scene measured in metres. Plan dimensions are in inches.
export const IN = 0.0254

// three.js (x, y, z) = (plan east, height, plan south). `unit` is world units
// per inch: IN for a metre scene, 1 for a scene modelled in inches.
export const planToWorld = (east, south, up, unit = IN) => [east * unit, up * unit, south * unit]
