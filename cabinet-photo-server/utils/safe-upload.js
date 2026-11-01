const path = require("path");

// Uploaded files that are safe to show in a browser. Anything else, such as HTML
// or SVG, could run scripts on this origin.
const SAFE_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif", ".avif",
  ".mp4", ".webm", ".mov", ".m4v", ".avi", ".hevc",
]);

function isSafeUpload(filename) {
  return SAFE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

// For express.static: anything already on disk that is not safe is downloaded, never rendered
function uploadHeaders(res, filePath) {
  if (!isSafeUpload(filePath)) {
    res.setHeader("Content-Disposition", "attachment");
    res.setHeader("Content-Security-Policy", "sandbox");
  }
}

module.exports = { isSafeUpload, uploadHeaders };
