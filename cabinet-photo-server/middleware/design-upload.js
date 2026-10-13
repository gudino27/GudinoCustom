// Upload middleware for a submitted design (POST /api/designs).
//
// The designer sends one multipart form: the quote PDF as a file and the
// whole design as a JSON text field `designData` (both rooms, pantries,
// drawn walls, the floor plan and every wall view as base64 PNGs). Multer's
// default limit for a text field is 1 MB, so a design with a few wall views
// failed with "Field value too long" (a bare 500) and the customer's quote
// was lost. The field gets its own limit here; it stays under the 20 MB the
// api.gudinocustom.com proxy accepts (nginx-tunnel.conf).
const multer = require("multer");

const DESIGN_LIMITS = {
  fileSize: 10 * 1024 * 1024, // the PDF
  fieldSize: 15 * 1024 * 1024, // designData (JSON with base64 images)
  files: 1,
};

const designMulter = multer({
  storage: multer.memoryStorage(),
  limits: DESIGN_LIMITS,
});

/**
 * `designUpload.single("pdf")` as middleware that answers a size problem with
 * 413 and a JSON error the designer can show, instead of Express's HTML 500.
 */
const designUpload = (field = "pdf") => {
  const inner = designMulter.single(field);
  return (req, res, next) => {
    inner(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const tooLarge = ["LIMIT_FIELD_VALUE", "LIMIT_FILE_SIZE", "LIMIT_PART_COUNT", "LIMIT_FIELD_COUNT"].includes(err.code);
        return res
          .status(tooLarge ? 413 : 400)
          .json({ error: tooLarge ? "Design is too large to send" : "Invalid design upload", code: err.code });
      }
      return next(err);
    });
  };
};

module.exports = { designUpload, DESIGN_LIMITS };
