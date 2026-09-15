// Element names in constants/elementTypes.js are English only. Look for a
// translated name (designer.element.<type>) first and fall back to that one.
export const getElementName = (t, type, elementTypes) =>
  t(`designer.element.${type}`, elementTypes?.[type]?.name || String(type));
