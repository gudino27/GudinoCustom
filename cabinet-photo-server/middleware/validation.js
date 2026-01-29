/**
 * Input Validation Middleware
 *
 * Provides validation middleware for user inputs to prevent invalid data
 * from entering the database and causing corruption or security issues.
 */

/**
 * Validates pricing data to ensure all values are positive numbers
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function validatePricing(req, res, next) {
  const prices = req.body;

  if (!prices || typeof prices !== 'object') {
    return res.status(400).json({
      error: 'Invalid request body: expected an object'
    });
  }

  for (const [key, value] of Object.entries(prices)) {
    // Check if value is a number
    if (typeof value !== 'number' || isNaN(value)) {
      return res.status(400).json({
        error: `Invalid price value for "${key}": must be a number`
      });
    }

    // Check if value is positive
    if (value < 0) {
      return res.status(400).json({
        error: `Invalid price value for "${key}": must be a positive number`
      });
    }

    // Check for reasonable maximum (prevent accidents)
    if (value > 1000000) {
      return res.status(400).json({
        error: `Invalid price value for "${key}": exceeds maximum allowed value`
      });
    }
  }

  next();
}

/**
 * Validates material data (array of materials with names and multipliers)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function validateMaterials(req, res, next) {
  const materials = req.body;

  if (!Array.isArray(materials)) {
    return res.status(400).json({
      error: 'Invalid request body: expected an array of materials'
    });
  }

  for (let i = 0; i < materials.length; i++) {
    const material = materials[i];

    // Validate nameEn
    if (!material.nameEn || typeof material.nameEn !== 'string' || material.nameEn.trim() === '') {
      return res.status(400).json({
        error: `Material at index ${i}: nameEn is required and must be a non-empty string`
      });
    }

    // Validate nameEs
    if (!material.nameEs || typeof material.nameEs !== 'string' || material.nameEs.trim() === '') {
      return res.status(400).json({
        error: `Material at index ${i}: nameEs is required and must be a non-empty string`
      });
    }

    // Validate multiplier
    if (typeof material.multiplier !== 'number' || isNaN(material.multiplier)) {
      return res.status(400).json({
        error: `Material at index ${i}: multiplier must be a number`
      });
    }

    if (material.multiplier <= 0) {
      return res.status(400).json({
        error: `Material at index ${i}: multiplier must be greater than 0`
      });
    }

    if (material.multiplier > 100) {
      return res.status(400).json({
        error: `Material at index ${i}: multiplier exceeds maximum allowed value (100)`
      });
    }
  }

  next();
}

/**
 * Sanitizes query string parameter to prevent type confusion attacks
 * Rejects arrays/objects, validates string length
 * @param {*} value - Query parameter value to sanitize
 * @param {Object} options - Validation options
 * @param {number} options.minLength - Minimum string length (default: 0)
 * @param {number} options.maxLength - Maximum string length (default: 1000)
 * @param {boolean} options.allowEmpty - Allow empty strings (default: false)
 * @returns {string|null} - Sanitized string or null if invalid
 */
function sanitizeQueryString(value, options = {}) {
  const { minLength = 0, maxLength = 1000, allowEmpty = false } = options;

  // Reject arrays and objects (type confusion protection)
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    return null;
  }

  // Convert to string
  const str = value == null ? '' : String(value);

  // Length validation
  if (!allowEmpty && str.length === 0) return null;
  if (str.length < minLength || str.length > maxLength) return null;

  return str.trim();
}

module.exports = {
  validatePricing,
  validateMaterials,
  sanitizeQueryString
};
