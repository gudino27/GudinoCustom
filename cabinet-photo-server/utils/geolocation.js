
// GEOLOCATION UTILITIES

// This file contains IP-based geolocation lookup functionality using MaxMind GeoLite2
// SELF-HOSTED - No third-party data sharing, privacy-compliant
//
// SETUP INSTRUCTIONS:
// 1. Create a free MaxMind account at https://www.maxmind.com/en/geolite2/signup
// 2. Download GeoLite2-City.mmdb from https://www.maxmind.com/en/accounts/current/geoip/downloads
// 3. Place the database file in: ./data/geolite2/GeoLite2-City.mmdb
// 4. The directory will be created automatically if it doesn't exist
// 5. Update database monthly (MaxMind releases updates on first Tuesday)

const path = require('path');
const fs = require('fs');
const config = require('../config');

// Lazy-load MaxMind reader (only loaded if database exists)
let Reader;
let cityReader;

// Database path from config (supports environment variable override)
const DB_PATH = config.geoLite2.path;

/**
 * Initialize MaxMind reader if database exists
 * @returns {Promise<boolean>} True if reader was initialized successfully
 */
async function initializeReader() {
  if (cityReader) return true; // Already initialized

  if (!fs.existsSync(DB_PATH)) {
    console.warn('MaxMind GeoLite2 database not found at:', DB_PATH);
    console.warn('Geolocation will return "Unknown" for all lookups.');
    console.warn('See setup instructions in utils/geolocation.js');
    return false;
  }

  try {
    // Lazy-load the Reader class
    Reader = require('@maxmind/geoip2-node').Reader;
    cityReader = await Reader.open(DB_PATH);
    console.log('MaxMind GeoLite2 database loaded successfully');
    return true;
  } catch (error) {
    console.error('Error initializing MaxMind reader:', error);
    return false;
  }
}

/**
 * Get city-level geolocation from IP address
 * Privacy-compliant: Returns only city, region, country (NO lat/long)
 * Self-hosted: No third-party API calls
 *
 * @param {string} ip - IP address to lookup
 * @returns {Object} Location object with city, region, country, country_code
 */
async function getLocationFromIP(ip) {
  // Check if geolocation is disabled
  if (!config.geoLite2.enabled) {
    return {
      country: 'Unknown',
      country_code: null,
      region: 'Unknown',
      city: 'Unknown'
    };
  }

  // Handle localhost/private IPs
  if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return {
      country: 'Localhost',
      country_code: 'LOCAL',
      region: 'Local',
      city: 'Local'
    };
  }

  // Initialize reader if not already done
  if (!cityReader && !(await initializeReader())) {
    // Database not available, return unknown
    return {
      country: 'Unknown',
      country_code: null,
      region: 'Unknown',
      city: 'Unknown'
    };
  }

  try {
    // Perform MaxMind lookup
    const response = cityReader.city(ip);

    return {
      country: response.country?.names?.en || 'Unknown',
      country_code: response.country?.isoCode || null,
      region: response.subdivisions?.[0]?.names?.en || response.mostSpecificSubdivision?.names?.en || 'Unknown',
      city: response.city?.names?.en || 'Unknown'
      // NOTE: latitude and longitude intentionally removed for privacy compliance
      // We only collect city-level data for fraud prevention, not precise location
    };
  } catch (error) {
    // Log the error name only: MaxMind's message contains the IP address.
    console.error('Error looking up IP in MaxMind database:', error && error.name);

    // Return unknown for any lookup errors
    return {
      country: 'Unknown',
      country_code: null,
      region: 'Unknown',
      city: 'Unknown'
    };
  }
}

// EXPORTS
module.exports = {
  getLocationFromIP
};

