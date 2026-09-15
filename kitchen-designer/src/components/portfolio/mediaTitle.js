// Title of a portfolio photo/video for use as alt text or a label, or '' when
// there isn't a usable one. Uploads without a typed title get the original
// file name ("IMG_1234") as their title, which isn't a text alternative, so
// those are treated as missing and callers fall back to a translated label.
export const getMediaTitle = (item) => {
  const title = item && typeof item.title === 'string' ? item.title.trim() : '';
  if (!title) return '';
  const fileStem = item.original_name ? String(item.original_name).split('.')[0].trim() : '';
  return title === fileStem ? '' : title;
};

export default getMediaTitle;
