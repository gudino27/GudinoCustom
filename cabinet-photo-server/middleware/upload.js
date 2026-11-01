// ============================================================================
// UPLOAD MIDDLEWARE CONFIGURATIONS
// ============================================================================

// REQUIRED IMPORTS
const multer = require("multer");
const { isSafeUpload } = require("../utils/safe-upload");
const path = require("path");
const fs = require("fs").promises;
const sharp = require("sharp");

// Configure FFmpeg paths for fluent-ffmpeg
try {
  const ffmpeg = require('fluent-ffmpeg');

  // Set FFmpeg binary path (auto-detect in Docker/Linux or Windows)
  // In Docker/Linux: ffmpeg is in /usr/bin/ffmpeg (installed via apk)
  // In Windows: ffmpeg needs to be in PATH or specified manually
  if (process.platform === 'linux') {
    ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
    ffmpeg.setFfprobePath('/usr/bin/ffprobe');
    console.log('[FFMPEG] Configured for Linux/Docker: /usr/bin/ffmpeg');
  } else if (process.platform === 'win32') {
    // On Windows, try to use ffmpeg from PATH
    // If not in PATH, user needs to install it manually
    console.log('[FFMPEG] Using system PATH for Windows');
  }
} catch (error) {
  console.warn('[FFMPEG] Warning: fluent-ffmpeg configuration failed:', error.message);
  console.warn('[FFMPEG] Video processing will not be available');
}

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // This function runs AFTER multer has parsed the multipart form
    // So req.body should have the category currently does not
    const category = req.body.category || "showcase";
    console.log("[MULTER] Upload category from form:", category);

    const uploadPath = path.join(__dirname, "..", "uploads", category);
    await fs.mkdir(uploadPath, { recursive: true });

    // Store the category in the file object for later use
    file.uploadCategory = category;

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/") && isSafeUpload(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Only images allowed"));
    }
  },
});

// Upload configuration for media (images + videos)
const uploadMedia = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for videos
  fileFilter: (req, file, cb) => {
    // Support iPhone formats: HEVC (H.265), MOV, MP4
    // Support Android formats: MP4, WebM
    // Support standard formats: MOV, MP4, WebM, AVI
    const allowedTypes = [
      'image/',
      'video/mp4',
      'video/webm',
      'video/quicktime',     // MOV files (iPhone default)
      'video/x-m4v',         // M4V files (iPhone)
      'video/hevc',          // HEVC/H.265 (iPhone newer models)
      'video/x-msvideo',     // AVI
      'video/avi'
    ];
    const isAllowed = allowedTypes.some(type => file.mimetype.startsWith(type) || file.mimetype === type);

    if (isAllowed && isSafeUpload(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Only images and videos (MP4, WebM, MOV, HEVC, M4V) are allowed"));
    }
  },
});

// Get the image dimensions
async function getImageDimensions(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();
    return { width: metadata.width, height: metadata.height };
  } catch (error) {
    return { width: null, height: null };
  }
}

// Get video duration using ffprobe (requires ffmpeg installed)
async function getVideoDuration(filePath) {
  try {
    const ffmpeg = require('fluent-ffmpeg');
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.warn('[VIDEO] Could not get duration:', err.message);
          resolve(null);
        } else {
          resolve(metadata.format.duration);
        }
      });
    });
  } catch (error) {
    console.warn('[VIDEO] ffprobe not available:', error.message);
    return null;
  }
}

// Convert video to WebM format for web optimization (multi-quality)
async function convertVideoToWebM(inputPath, outputBasePath, quality = '720p') {
  try {
    const ffmpeg = require('fluent-ffmpeg');
    const fs = require('fs').promises;
    const path = require('path');

    // Quality presets (optimized for web streaming)
    const qualitySettings = {
      '720p': {
        scale: 'scale=-2:720',
        crf: 30,
        label: 'HD'
      },
      '480p': {
        scale: 'scale=-2:480',
        crf: 32,
        label: 'SD'
      },
      '360p': {
        scale: 'scale=-2:360',
        crf: 35,
        label: 'Low'
      }
    };

    const settings = qualitySettings[quality];
    if (!settings) {
      throw new Error(`Invalid quality: ${quality}`);
    }

    const outputPath = outputBasePath.replace('.webm', `_${quality}.webm`);

    return new Promise((resolve, reject) => {
      console.log(`[VIDEO] Starting conversion to WebM ${quality} (${settings.label})...`);

      ffmpeg(inputPath)
        .inputOptions([
          '-hwaccel auto'  // Use hardware acceleration if available (especially for HEVC from iPhone)
        ])
        .outputOptions([
          '-c:v libvpx-vp9',           // VP9 codec for better compression
          `-crf ${settings.crf}`,      // Quality level (varies by resolution)
          '-b:v 0',                     // Variable bitrate
          '-row-mt 1',                  // Enable row-based multithreading
          '-threads 4',                 // Use 4 threads for encoding
          '-c:a libopus',               // Opus audio codec
          '-b:a 128k',                  // Audio bitrate
          `-vf ${settings.scale}`,      // Scale to target resolution
          '-deadline good',             // Encoding speed vs quality trade-off
          '-cpu-used 2'                 // Faster encoding (0=slowest/best, 5=fastest/worst)
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log(`[VIDEO] FFmpeg command for ${quality}:`, commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`[VIDEO] ${quality} conversion progress: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', async () => {
          console.log(`[VIDEO] ${quality} conversion completed successfully`);
          // Get file size
          try {
            const stats = await fs.stat(outputPath);
            console.log(`[VIDEO] ${quality} file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
          } catch (err) {
            console.warn(`[VIDEO] Could not get ${quality} file size:`, err.message);
          }
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error(`[VIDEO] ${quality} conversion error:`, err.message);
          reject(err);
        })
        .run();
    });
  } catch (error) {
    console.error('[VIDEO] FFmpeg not available or conversion failed:', error.message);
    throw error;
  }
}

// Convert video to multiple qualities
async function convertVideoToMultiQuality(inputPath, outputBasePath) {
  try {
    console.log('[VIDEO] Starting multi-quality conversion...');

    const qualities = ['720p', '480p', '360p'];
    const results = {};

    // Convert to all qualities sequentially (to avoid overwhelming CPU)
    for (const quality of qualities) {
      try {
        const outputPath = await convertVideoToWebM(inputPath, outputBasePath, quality);
        results[quality] = outputPath;
        console.log(`[VIDEO] ✓ ${quality} completed`);
      } catch (error) {
        console.error(`[VIDEO] ✗ ${quality} failed:`, error.message);
        // Continue with other qualities even if one fails
      }
    }

    console.log('[VIDEO] Multi-quality conversion completed');
    return results;
  } catch (error) {
    console.error('[VIDEO] Multi-quality conversion error:', error.message);
    throw error;
  }
}

// Generate video thumbnail using ffmpeg
async function generateVideoThumbnail(inputPath, outputPath, timeOffset = '00:00:01') {
  try {
    const ffmpeg = require('fluent-ffmpeg');

    return new Promise((resolve, reject) => {
      console.log('[VIDEO] Generating thumbnail...');

      ffmpeg(inputPath)
        .screenshots({
          timestamps: [timeOffset],
          filename: require('path').basename(outputPath),
          folder: require('path').dirname(outputPath),
          size: '800x600'
        })
        .on('end', () => {
          console.log('[VIDEO] Thumbnail generated successfully');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('[VIDEO] Thumbnail generation error:', err.message);
          reject(err);
        });
    });
  } catch (error) {
    console.error('[VIDEO] Could not generate thumbnail:', error.message);
    throw error;
  }
}

// ============================================================================
// EXPORTS (add at the bottom):
module.exports = {
  upload,                      // For photo uploads with disk storage
  uploadMedia,                 // For media uploads (images + videos)
  uploadMemory,                // For in-memory uploads (like PDFs)
  getImageDimensions,          // Helper function for getting image dimensions
  getVideoDuration,            // Helper function for getting video duration
  convertVideoToWebM,          // Convert video to WebM format (single quality)
  convertVideoToMultiQuality,  // Convert video to multiple qualities (720p, 480p, 360p)
  generateVideoThumbnail       // Generate thumbnail from video
};
// ============================================================================
