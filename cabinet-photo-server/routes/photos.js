// This file contains all photo-related API endpoints
// REQUIRED IMPORTS
const express = require("express");
const router = express.Router();
const sharp = require("sharp");
const path = require("path");
const fs = require("fs").promises;
const { photoDb } = require("../db-helpers");
const { authenticateUser, requireRole } = require("../middleware/auth");
const { upload, uploadMedia, getVideoDuration, convertVideoToMultiQuality, generateVideoThumbnail } = require("../middleware/upload");

async function getImageDimensions(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();
    return { width: metadata.width, height: metadata.height };
  } catch (error) {
    console.error("Error getting image dimensions:", error);
    return { width: null, height: null };
  }
}

// Gets all photos
router.get("/", async (req, res) => {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");

  try {
    const photos = await photoDb.getAllPhotos();
    // Sort by display_order first, then by uploaded_at
    const sortedPhotos = photos.sort((a, b) => {
      if (a.category === b.category) {
        return (a.display_order || 999) - (b.display_order || 999);
      }
      return a.category.localeCompare(b.category);
    });
    const formattedPhotos = sortedPhotos.map((photo) => {
      const filePath = photo.file_path.replace(/\\/g, "/");
      const thumbnailPath = photo.thumbnail_path
        ? `thumbnails/${photo.thumbnail_path.split("/").pop()}`
        : null;
      return {
        ...photo,
        full: `/${filePath}`,
        thumbnail: thumbnailPath ? `/photos/${thumbnailPath}` : null,
        url: `/photos/${filePath}`,
        featured: photo.featured === 1,
      };
    });
    res.json(formattedPhotos);
  } catch (error) {
    console.error("Error fetching photos:", error);
    res.status(500).json({ error: "Failed to fetch photos" });
  }
});
// Upload media (photo or video)
router.post("/", authenticateUser, requireRole(["admin", "super_admin"]), uploadMedia.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const category = req.file.uploadCategory || req.body.category || "showcase";
    const isVideo = req.file.mimetype.startsWith('video/');

    console.log("[UPLOAD] Final category:", category);
    console.log("[UPLOAD] File type:", isVideo ? 'video' : 'image');
    console.log("[UPLOAD] File saved to:", req.file.path);
    console.log("[UPLOAD] Filename:", req.file.filename);

    let relativePath = `${category}/${req.file.filename}`; // Will be updated for videos after conversion
    let thumbnailPath = null;
    let dimensions = { width: null, height: null };

    if (isVideo) {
      // For videos: convert to multiple qualities and generate thumbnail
      console.log("[VIDEO] Processing uploaded video file (iPhone HEVC/MOV supported)");

      try {
        // Base filename without extension
        const baseFilename = req.file.filename.replace(/\.[^/.]+$/, "");
        const webmBasePath = path.join(__dirname, "..", "uploads", category, `${baseFilename}.webm`);

        // Convert to multiple qualities (720p, 480p, 360p)
        const qualityFiles = await convertVideoToMultiQuality(req.file.path, webmBasePath);

        // Use 720p as the default/primary file
        const mainQualityFile = qualityFiles['720p'];
        if (!mainQualityFile) {
          throw new Error("720p conversion failed");
        }

        // Update file references to use 720p WebM as primary
        const webmFilename = path.basename(mainQualityFile);
        req.file.filename = webmFilename;
        req.file.mimetype = 'video/webm';
        const stats = await fs.stat(mainQualityFile);
        req.file.size = stats.size;

        // Update relativePath to use WebM filename
        relativePath = `${category}/${webmFilename}`;
        console.log("[VIDEO] Updated file path to:", relativePath);

        // Delete original video file to save space (only keep WebM versions)
        await fs.unlink(req.file.path);
        console.log("[VIDEO] Deleted original video file, keeping only WebM versions");

        // Generate video thumbnail from 720p version
        const thumbnailDir = path.join(__dirname, "..", "uploads", "thumbnails");
        await fs.mkdir(thumbnailDir, { recursive: true });
        const thumbnailFilename = `thumb_${baseFilename}.jpg`;
        thumbnailPath = `thumbnails/${thumbnailFilename}`;
        const thumbnailFullPath = path.join(__dirname, "..", "uploads", thumbnailPath);

        await generateVideoThumbnail(mainQualityFile, thumbnailFullPath, '00:00:01');

        // Get video duration
        const duration = await getVideoDuration(mainQualityFile);
        if (duration) {
          console.log(`[VIDEO] Duration: ${duration}s`);
        }

        // Store quality URLs in label field as JSON
        // Format: {"720p": "filename_720p.webm", "480p": "filename_480p.webm", "360p": "filename_360p.webm"}
        const qualityUrls = {};
        Object.keys(qualityFiles).forEach(quality => {
          qualityUrls[quality] = path.basename(qualityFiles[quality]);
        });

        // Store in a custom field for quality options
        req.body.video_qualities = JSON.stringify(qualityUrls);

        // Videos get 720p dimensions (from conversion)
        dimensions = { width: 1280, height: 720 };
      } catch (error) {
        console.error("[VIDEO] Processing error:", error);
        // If video processing fails, still save the original file
        console.log("[VIDEO] Falling back to original file");
        dimensions = { width: 1920, height: 1080 };
      }
    } else {
      // For images: generate thumbnails with improved quality and aspect ratio handling
      const thumbnailDir = path.join(__dirname, "..", "uploads", "thumbnails");
      await fs.mkdir(thumbnailDir, { recursive: true });
      const thumbnailFilename = `thumb_${req.file.filename}`;
      thumbnailPath = `thumbnails/${thumbnailFilename}`;
      const thumbnailFullPath = path.join(
        __dirname,
        "..",
        "uploads",
        thumbnailPath
      );

      try {
        // First rotate to buffer to get ACTUAL dimensions after rotation
        const rotatedBuffer = await sharp(req.file.path)
          .rotate() // Apply EXIF rotation
          .toBuffer();

        // Now check the actual rotated dimensions
        const rotatedMetadata = await sharp(rotatedBuffer).metadata();
        const isVertical = rotatedMetadata.height > rotatedMetadata.width;

        // Smart sizing: vertical photos get different dimensions than horizontal
        const thumbnailWidth = isVertical ? 600 : 800;
        const thumbnailHeight = isVertical ? 800 : 600;

        console.log(`[THUMBNAIL] Actual rotated dimensions: ${rotatedMetadata.width}x${rotatedMetadata.height}, isVertical: ${isVertical}, target: ${thumbnailWidth}x${thumbnailHeight}`);

        // Now resize the rotated image
        await sharp(rotatedBuffer)
          .resize(thumbnailWidth, thumbnailHeight, {
            fit: "inside",
            withoutEnlargement: true
          })
          .jpeg({ quality: 95, progressive: true })
          .toFile(thumbnailFullPath);
        console.log("[THUMBNAIL] Created:", thumbnailFullPath, `(${isVertical ? 'vertical' : 'horizontal'} ${thumbnailWidth}x${thumbnailHeight})`);
      } catch (err) {
        console.error("[THUMBNAIL] Error:", err);
      }

      dimensions = await getImageDimensions(req.file.path);
    }

    // For videos, store quality URLs in label field (unused for photos)
    const title = req.body.title || req.file.originalname.split(".")[0];
    const photoData = {
      title: title,
      filename: req.file.filename,
      original_name: req.file.originalname,
      category: category,
      file_path: relativePath,
      thumbnail_path: thumbnailPath,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      width: dimensions.width,
      height: dimensions.height,
      featured: req.body.featured === "true",
    };

    // If video qualities exist, store them in label field as JSON
    if (req.body.video_qualities) {
      photoData.label = req.body.video_qualities;
    }

    const photoId = await photoDb.createPhoto(photoData);

    console.log("[DATABASE] Saved with ID:", photoId);

    const photo = await photoDb.getPhoto(photoId);

    // Parse video qualities if they exist
    let videoQualities = null;
    if (isVideo && photo.label) {
      try {
        const qualityUrls = JSON.parse(photo.label);
        videoQualities = {};
        Object.keys(qualityUrls).forEach(quality => {
          videoQualities[quality] = `/photos/${category}/${qualityUrls[quality]}`;
        });
      } catch (e) {
        console.warn("[VIDEO] Could not parse quality URLs:", e.message);
      }
    }

    res.json({
      success: true,
      photo: {
        ...photo,
        full: `/${relativePath}`,
        thumbnail: thumbnailPath ? `photos/thumbnails/${thumbnailPath}` : null,
        url: `/photos/${relativePath}`,
        featured: photo.featured === 1,
        isVideo: isVideo,
        videoQualities: videoQualities, // Include quality URLs for frontend
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to upload media: " + error.message });
  }
});
router.put("/reorder", authenticateUser, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const { photoIds } = req.body;

    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({ error: "Invalid photo IDs array" });
    }

    console.log("[REORDER] Updating order for photos:", photoIds);

    await photoDb.updatePhotoOrder(photoIds);

    res.json({ success: true, message: "Photo order updated successfully" });
  } catch (error) {
    console.error("[REORDER] Error:", error);
    res
      .status(500)
      .json({ error: "Failed to update photo order: " + error.message });
  }
});
// Updates the photo
router.put("/:id", authenticateUser, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const photoId = parseInt(req.params.id);
    const updates = {};

    // Only update allowed fields (includes before/after photo fields)
    const allowedFields = ["title", "category", "featured", "display_order", "photo_type", "comparison_pair_id"];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
        // Convert boolean featured to integer
        if (field === "featured") {
          updates[field] = req.body[field] ? 1 : 0;
        }
      }
    });
    // Handle category change file moving logic
    if (updates.category) {
      const photo = await photoDb.getPhoto(photoId);
      if (photo && photo.category !== updates.category) {
        const oldPath = path.join(
          __dirname,
          "..",
          "uploads",
          photo.category,
          photo.filename
        );
        console.log("[MOVE] Old path:", oldPath);
        console.log("[MOVE] New category:", updates.category);
        console.log("[MOVE] Filename:", photo.filename);
        const newPath = path.join(
          __dirname,
          "..",
          "uploads",
          updates.category,
          photo.filename
        );
        await fs.mkdir(
          path.join(__dirname, "..", "uploads", updates.category),
          {
            recursive: true,
          }
        );

        try {
          await fs.rename(oldPath, newPath);
          console.log(`[MOVE] Moved file from ${oldPath} to ${newPath}`);
          updates.file_path = `${updates.category}/${photo.filename}`;
          console.log("[MOVE] Updated file_path to:", updates.file_path);
        } catch (error) {
          console.error("[MOVE] Error moving file:", error);
        }
      }
    }

    const success = await photoDb.updatePhoto(photoId, updates);

    if (success) {
      const photo = await photoDb.getPhoto(photoId);
      const filePath = photo.file_path.replace(/\\/g, "/");
      const thumbnailPath = photo.thumbnail_path
        ? photo.thumbnail_path.replace(/\\/g, "/")
        : null;

      res.json({
        success: true,
        photo: {
          ...photo,
          full: `/photos/${filePath}`,
          thumbnail: thumbnailPath ? `/photos/${thumbnailPath}` : null,
          url: `/photos/${filePath}`,
          featured: photo.featured === 1,
        },
      });
    } else {
      res.status(404).json({ error: "Photo not found" });
    }
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ error: "Failed to update photo" });
  }
});
// Delete photo
router.delete("/:id", authenticateUser, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const photoId = parseInt(req.params.id);

    const photo = await photoDb.getPhoto(photoId);
    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }
    console.log("[DELETE] Photo info:", photo);
    // Delete files from filesystem (existing logic)
    try {
      const mainFilePath = path.join(
        __dirname,
        "..",
        "uploads",
        photo.file_path.replace(/\\/g, "/")
      );
      console.log("[DELETE] Attempting to delete:", mainFilePath);

      try {
        await fs.unlink(mainFilePath);
        console.log("[DELETE] Successfully deleted main file");
      } catch (err) {
        const altPath = path.join(
          __dirname,
          "..",
          "uploads",
          photo.category,
          photo.filename
        );
        console.log("[DELETE] First attempt failed, trying:", altPath);
        await fs.unlink(altPath);
        console.log("[DELETE] Successfully deleted main file (alt path)");
      }

      if (photo.thumbnail_path) {
        const thumbnailFilePath = path.join(
          __dirname,
          "..",
          "uploads",
          photo.thumbnail_path.replace(/\\/g, "/")
        );
        try {
          await fs.unlink(thumbnailFilePath);
          console.log("[DELETE] Successfully deleted thumbnail");
        } catch (err) {
          console.warn("[DELETE] Could not delete thumbnail:", err.message);
        }
      }
    } catch (fileError) {
      console.warn("[DELETE] Error deleting files:", fileError.message);
    }

    const success = await photoDb.deletePhoto(photoId);

    if (success) {
      res.json({ success: true, message: "Photo deleted successfully" });
    } else {
      res.status(404).json({ error: "Photo not found in database" });
    }
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});
// Get a single photo
router.get("/:id", async (req, res) => {
  try {
    const photoId = parseInt(req.params.id);
    const photo = await photoDb.getPhoto(photoId);

    if (photo) {
      const filePath = photo.file_path.replace(/\\/g, "/");
      const thumbnailPath = photo.thumbnail_path
        ? photo.thumbnail_path.replace(/\\/g, "/")
        : null;

      res.json({
        ...photo,
        full: `/photos/${filePath}`,
        thumbnail: thumbnailPath ? `/photos/${thumbnailPath}` : null,
        url: `/photos/${filePath}`,
        featured: photo.featured === 1,
      });
    } else {
      res.status(404).json({ error: "Photo not found" });
    }
  } catch (error) {
    console.error("Error fetching photo:", error);
    res.status(500).json({ error: "Failed to fetch photo" });
  }
});

// One-time thumbnail regeneration endpoint (admin only)
router.post("/regenerate-thumbnails", authenticateUser, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    console.log("[REGENERATE] Starting thumbnail regeneration...");

    const allPhotos = await photoDb.getAllPhotos();
    let regeneratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const photo of allPhotos) {
      try {
        if (!photo.thumbnail_path) {
          skippedCount++;
          continue;
        }

        const thumbnailPath = path.join(
          __dirname,
          "..",
          "uploads",
          photo.thumbnail_path.replace(/\\/g, "/")
        );
        const originalPath = path.join(
          __dirname,
          "..",
          "uploads",
          photo.file_path.replace(/\\/g, "/")
        );

        // Check if files exist
        try {
          await fs.access(thumbnailPath);
          await fs.access(originalPath);
        } catch (err) {
          console.log(`[REGENERATE] Skipping photo ${photo.id}: file not found`);
          skippedCount++;
          continue;
        }

        // Check existing thumbnail size
        const thumbnailMetadata = await sharp(thumbnailPath).metadata();

        // FORCE regenerate ALL thumbnails to apply new rotation-detection logic
        // (Normally would check: thumbnailMetadata.width < 600 || thumbnailMetadata.height < 600)
        console.log(`[REGENERATE] Photo ${photo.id}: ${thumbnailMetadata.width}x${thumbnailMetadata.height} -> regenerating`);

        // Delete old thumbnail
        await fs.unlink(thumbnailPath);

        // First rotate to buffer to get ACTUAL dimensions after rotation
        const rotatedBuffer = await sharp(originalPath)
          .rotate() // Apply EXIF rotation
          .toBuffer();

        // Now check the actual rotated dimensions
        const originalMetadata = await sharp(rotatedBuffer).metadata();
        const isVertical = originalMetadata.height > originalMetadata.width;

        // Generate new thumbnail with updated settings
        const thumbnailWidth = isVertical ? 600 : 800;
        const thumbnailHeight = isVertical ? 800 : 600;

        console.log(`[REGENERATE] Photo ${photo.id}: Actual rotated dimensions ${originalMetadata.width}x${originalMetadata.height}, isVertical: ${isVertical}, target: ${thumbnailWidth}x${thumbnailHeight}`);

        // Resize the rotated buffer
        await sharp(rotatedBuffer)
          .resize(thumbnailWidth, thumbnailHeight, {
            fit: "inside",
            withoutEnlargement: true
          })
          .jpeg({ quality: 95, progressive: true })
          .toFile(thumbnailPath);

        regeneratedCount++;
        console.log(`[REGENERATE] Photo ${photo.id}: regenerated successfully`);
      } catch (photoError) {
        errorCount++;
        errors.push({ photoId: photo.id, error: photoError.message });
        console.error(`[REGENERATE] Error processing photo ${photo.id}:`, photoError);
      }
    }

    console.log(`[REGENERATE] Complete: ${regeneratedCount} regenerated, ${skippedCount} skipped, ${errorCount} errors`);

    res.json({
      success: true,
      regeneratedCount,
      skippedCount,
      errorCount,
      total: allPhotos.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("[REGENERATE] Fatal error:", error);
    res.status(500).json({ error: "Failed to regenerate thumbnails: " + error.message });
  }
});

// EXPORT
module.exports = router;
