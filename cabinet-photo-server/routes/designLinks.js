// Private client design links: ____ uploads a 3D model of a design
// and gets back a private, short-lived link (gudinocustom.com/view/<token>).
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs").promises;
const multer = require("multer");
const { designLinkDb } = require("../db-helpers");
const { authenticateUser, requireRole } = require("../middleware/auth");
const { designLinkPublicLimiter } = require("../middleware/rate-limiters");
const { clientIp } = require("../utils/client-ip");
const { getLocationFromIP } = require("../utils/geolocation");
const { notifyDesignLinkViewed } = require("../utils/push-notifications");

const DESIGN_LINKS_DIR = path.join(__dirname, "..", "uploads", "design-links");
const TOKEN_RE = /^[a-f0-9]{64}$/;
const MANIFEST_MAX_BYTES = 256 * 1024;
const SCENE_MIME_TYPES = new Set(["model/gltf-binary", "application/octet-stream"]);
const PRESET_IDS = ["daylight", "evening", "night"];
const DEFAULT_ACTIVE_MINUTES = 120;

const staffOnly = [authenticateUser, requireRole(["admin", "super_admin"])];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 16 * 1024 * 1024,
    files: 2,
    fields: 10,
    parts: 12,
    fieldSize: 256 * 1024,
  },
}).fields([
  { name: "scene", maxCount: 1 },
  { name: "manifest", maxCount: 1 },
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class ApiError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

function sendError(res, status, code, message) {
  res.set("Cache-Control", "no-store");
  const body = { error: code };
  if (message && message !== code) body.message = message;
  return res.status(status).json(body);
}

function noStore(req, res, next) {
  res.set("Cache-Control", "no-store");
  next();
}

// A link's folder, always built from the row's token (never the URL).
// Returns null (and logs the link id only) when the token or path is not safe.
function linkDir(row) {
  if (!row || typeof row.token !== "string" || !TOKEN_RE.test(row.token)) {
    console.error("Design link folder skipped: bad token on link", row && row.id);
    return null;
  }
  const dir = path.join(DESIGN_LINKS_DIR, row.token);
  if (path.dirname(dir) !== DESIGN_LINKS_DIR) {
    console.error("Design link folder skipped: bad path on link", row.id);
    return null;
  }
  return dir;
}

// CURRENT_TIMESTAMP columns are UTC text with no zone ("YYYY-MM-DD HH:MM:SS")
function isoFromSqlite(v) {
  if (typeof v !== "string" || v === "") return v == null ? null : v;
  return v.endsWith("Z") ? v : v.replace(" ", "T") + "Z";
}

function linkUrl(token) {
  return `${process.env.FRONTEND_URL || "https://gudinocustom.com"}/view/${token}`;
}

function formatLink(row) {
  return {
    id: row.id,
    token: row.token,
    url: linkUrl(row.token),
    title: row.title,
    client_name: row.client_name ?? null,
    studio_job_id: row.studio_job_id ?? null,
    revision: row.revision,
    price_text: row.price_text === "" ? null : row.price_text ?? null,
    is_active: row.is_active === 1 ? 1 : 0,
    is_live: designLinkDb.isLive(row),
    active_until: row.active_until,
    created_at: isoFromSqlite(row.created_at),
    updated_at: isoFromSqlite(row.updated_at),
    scene_bytes: row.scene_bytes,
    view_count: Number(row.view_count) || 0,
    last_viewed_at: isoFromSqlite(row.last_viewed_at),
    last_city: row.last_city ?? null,
  };
}

function parseId(raw) {
  if (!/^[0-9]{1,15}$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

const charCount = (s) => [...s].length;
const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// Runs multer by hand so its errors become JSON (server.js has no error middleware)
function runUpload(req, res) {
  return new Promise((resolve, reject) => {
    if (!req.is("multipart/form-data")) {
      return reject(new ApiError(400, "bad_upload", "multipart/form-data required"));
    }
    upload(req, res, (err) => {
      if (!err) return resolve();
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return reject(new ApiError(413, "file_too_large", "scene is over 16 MiB"));
        }
        if (err.code === "LIMIT_FIELD_VALUE") {
          return reject(new ApiError(400, "bad_manifest", "manifest is over 256 KiB"));
        }
        return reject(new ApiError(400, "bad_upload", err.code));
      }
      // Malformed multipart bodies (no boundary, truncated) are the client's fault
      return reject(new ApiError(400, "bad_upload", "malformed multipart body"));
    });
  });
}

// Text fields per the C2 request rules. Returns only the fields that were sent.
function readFields(body, { isPost }) {
  const raw = body || {};
  const out = {};
  const text = (name) => {
    if (raw[name] === undefined) return undefined;
    if (typeof raw[name] !== "string") throw new ApiError(400, "bad_field", `${name} sent more than once`);
    return raw[name].trim();
  };

  const title = text("title");
  if (title !== undefined) {
    const n = charCount(title);
    if (n < 1 || n > 80) throw new ApiError(400, "bad_field", "title must be 1-80 characters");
    out.title = title;
  } else if (isPost) {
    throw new ApiError(400, "bad_field", "title is required");
  }

  const clientName = text("client_name");
  if (clientName !== undefined) {
    if (charCount(clientName) > 120) throw new ApiError(400, "bad_field", "client_name must be 0-120 characters");
    out.clientName = clientName === "" ? null : clientName;
  }

  const jobId = text("studio_job_id");
  if (jobId !== undefined) {
    if (!/^[A-Za-z0-9_-]{0,64}$/.test(jobId)) {
      throw new ApiError(400, "bad_field", "studio_job_id must be 0-64 of A-Za-z0-9_-");
    }
    out.studioJobId = jobId === "" ? null : jobId;
  }

  const price = text("price_text");
  if (price !== undefined) {
    if (charCount(price) > 40) throw new ApiError(400, "bad_field", "price_text must be 0-40 characters");
    out.priceText = price === "" ? null : price;
  }

  if (!isPost) {
    const isActive = text("is_active");
    if (isActive !== undefined) {
      if (isActive !== "0" && isActive !== "1") throw new ApiError(400, "bad_field", "is_active must be 0 or 1");
      out.isActive = Number(isActive);
    }
  }

  const minutes = text("active_minutes");
  if (minutes !== undefined) {
    const n = /^[0-9]{1,4}$/.test(minutes) ? Number(minutes) : NaN;
    if (!(n >= 1 && n <= 720)) {
      throw new ApiError(400, "bad_field", "active_minutes must be a whole number 1-720");
    }
    out.activeMinutes = n;
  }

  return out;
}

// The manifest as a text field or a file part. Returns the raw text or undefined.
function readManifestText(req) {
  const field = req.body ? req.body.manifest : undefined;
  const files = req.files && req.files.manifest;
  if (field !== undefined && files) throw new ApiError(400, "bad_upload", "manifest sent twice");
  if (files) {
    const buf = files[0].buffer;
    if (buf.length > MANIFEST_MAX_BYTES) throw new ApiError(400, "bad_manifest", "manifest is over 256 KiB");
    return buf.toString("utf8");
  }
  if (field === undefined) return undefined;
  if (typeof field !== "string") throw new ApiError(400, "bad_upload", "manifest sent twice");
  if (Buffer.byteLength(field, "utf8") > MANIFEST_MAX_BYTES) {
    throw new ApiError(400, "bad_manifest", "manifest is over 256 KiB");
  }
  return field;
}

// C6 reject list, nothing more. Returns the parsed object.
function checkManifest(textValue) {
  const bad = (message) => new ApiError(400, "bad_manifest", message);
  let m;
  try {
    m = JSON.parse(textValue.replace(/^﻿/, ""));
  } catch {
    throw bad("manifest is not valid JSON");
  }
  if (!isPlainObject(m)) throw bad("manifest is not a JSON object");
  if (m.version !== 1) throw bad("unsupported version");

  const capped = (value, cap, name) => {
    if (typeof value === "string" && charCount(value) > cap) throw bad(`${name} is over ${cap} characters`);
  };

  if (!Array.isArray(m.rooms) || m.rooms.length === 0 || m.rooms.length > 8) {
    throw bad("rooms must be an array of 1-8 rooms");
  }
  const roomIds = new Set();
  m.rooms.forEach((room, i) => {
    if (!isPlainObject(room)) throw bad(`rooms[${i}] is not an object`);
    if (typeof room.id !== "string") throw bad(`rooms[${i}].id must be a string`);
    if (typeof room.node !== "string") throw bad(`rooms[${i}].node must be a string`);
    if (!isPlainObject(room.bounds)) throw bad(`rooms[${i}].bounds must be an object`);
    if (roomIds.has(room.id)) throw bad(`rooms[${i}].id is repeated`);
    roomIds.add(room.id);
    capped(room.id, 64, `rooms[${i}].id`);
    capped(room.name, 60, `rooms[${i}].name`);
    capped(room.node, 70, `rooms[${i}].node`);
  });

  if (!Array.isArray(m.cameras) || m.cameras.length === 0) throw bad("cameras must be a non-empty array");
  m.cameras.forEach((cam, i) => {
    if (isPlainObject(cam)) capped(cam.name, 40, `cameras[${i}].name`);
  });

  if (!isPlainObject(m.presets)) throw bad("presets must be an object");
  for (const id of PRESET_IDS) {
    if (!isPlainObject(m.presets[id])) throw bad(`presets.${id} must be an object`);
    capped(m.presets[id].label, 24, `presets.${id}.label`);
  }
  if (!PRESET_IDS.includes(m.defaultPreset)) throw bad("defaultPreset must be daylight, evening or night");

  if (m.fixtureGroups !== undefined) {
    if (!Array.isArray(m.fixtureGroups)) throw bad("fixtureGroups must be an array");
    m.fixtureGroups.forEach((g, i) => {
      if (!isPlainObject(g)) return;
      capped(g.id, 24, `fixtureGroups[${i}].id`);
      capped(g.label, 40, `fixtureGroups[${i}].label`);
    });
  }
  if (m.fixtures !== undefined) {
    if (!Array.isArray(m.fixtures)) throw bad("fixtures must be an array");
    if (m.fixtures.length > 24) throw bad("fixtures has more than 24 entries");
  }
  return m;
}

// C4 checks: GLB header, size and no external fetches
function checkScene(file) {
  const bad = (message) => new ApiError(400, "bad_scene", message);
  if (!SCENE_MIME_TYPES.has(file.mimetype)) throw bad("scene must be model/gltf-binary or application/octet-stream");
  const buf = file.buffer;
  if (!buf || buf.length < 20) throw bad("scene is not a GLB");
  if (buf.toString("latin1", 0, 4) !== "glTF") throw bad("scene is not a GLB");
  if (buf.readUInt32LE(4) !== 2) throw bad("scene is not glTF 2.0");
  if (buf.readUInt32LE(8) !== buf.length) throw bad("scene length does not match its header");
  const jsonLength = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a || 20 + jsonLength > buf.length) {
    throw bad("scene has no JSON chunk");
  }
  let gltf;
  try {
    gltf = JSON.parse(buf.toString("utf8", 20, 20 + jsonLength));
  } catch {
    throw bad("scene JSON chunk does not parse");
  }
  if (!isPlainObject(gltf)) throw bad("scene JSON chunk is not an object");
  if (gltf.images !== undefined && !(Array.isArray(gltf.images) && gltf.images.length === 0)) {
    throw bad("scene has images");
  }
  if (Array.isArray(gltf.buffers) && gltf.buffers.some((b) => isPlainObject(b) && b.uri !== undefined)) {
    throw bad("scene has an external buffer uri");
  }
  if (gltf.extensionsRequired !== undefined &&
      !(Array.isArray(gltf.extensionsRequired) && gltf.extensionsRequired.length === 0)) {
    throw bad("scene has extensionsRequired");
  }
  return buf;
}

function handleRouteError(res, error, linkId) {
  if (error instanceof ApiError) return sendError(res, error.status, error.code, error.message);
  console.error("Design link route error", linkId != null ? `(link ${linkId})` : "", error && error.message);
  return sendError(res, 500, "server_error");
}

// ---------------------------------------------------------------------------
// Staff routes
// ---------------------------------------------------------------------------

// First on the path, before auth, so 401 and 403 answers are no-store too
router.use("/admin/design-links", noStore);

router.post("/admin/design-links", ...staffOnly, async (req, res) => {
  let dir = null;
  let created = false;
  try {
    await runUpload(req, res);
    const fields = readFields(req.body, { isPost: true });
    const sceneFile = req.files && req.files.scene && req.files.scene[0];
    if (req.body && req.body.scene !== undefined) throw new ApiError(400, "bad_scene", "scene must be a file part");
    const manifestText = readManifestText(req);
    if (!sceneFile) throw new ApiError(400, "bad_scene", "scene is required");
    if (manifestText === undefined) throw new ApiError(400, "bad_upload", "scene without manifest");
    const manifest = checkManifest(manifestText);
    const sceneBuf = checkScene(sceneFile);

    const token = designLinkDb.newToken();
    dir = linkDir({ id: "new", token });
    if (!dir) throw new Error("token check failed");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "scene.glb"), sceneBuf);

    const minutes = fields.activeMinutes || DEFAULT_ACTIVE_MINUTES;
    const row = await designLinkDb.create({
      token,
      title: fields.title,
      clientName: fields.clientName ?? null,
      studioJobId: fields.studioJobId ?? null,
      priceText: fields.priceText ?? null,
      activeUntil: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
      sceneBytes: sceneBuf.length,
      manifestJson: JSON.stringify(manifest),
      createdBy: req.user && req.user.id ? req.user.id : null,
    });
    created = true;
    const full = await designLinkDb.getById(row.id);
    return res.status(201).json(formatLink(full || row));
  } catch (error) {
    if (dir && !created) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
    return handleRouteError(res, error);
  }
});

router.put("/admin/design-links/:id", ...staffOnly, async (req, res) => {
  const id = parseId(req.params.id);
  try {
    if (!id) throw new ApiError(404, "not_found");
    const existing = await designLinkDb.getById(id);
    if (!existing) throw new ApiError(404, "not_found");

    await runUpload(req, res);
    const fields = readFields(req.body, { isPost: false });
    const sceneFile = req.files && req.files.scene && req.files.scene[0];
    if (req.body && req.body.scene !== undefined) throw new ApiError(400, "bad_scene", "scene must be a file part");
    const manifestText = readManifestText(req);
    if (sceneFile && manifestText === undefined) throw new ApiError(400, "bad_upload", "scene without manifest");
    const manifest = manifestText !== undefined ? checkManifest(manifestText) : undefined;
    const sceneBuf = sceneFile ? checkScene(sceneFile) : undefined;

    const patch = {};
    if (fields.title !== undefined) patch.title = fields.title;
    if (fields.clientName !== undefined) patch.clientName = fields.clientName;
    if (fields.studioJobId !== undefined) patch.studioJobId = fields.studioJobId;
    if (fields.priceText !== undefined) patch.priceText = fields.priceText;
    if (fields.isActive !== undefined) patch.isActive = fields.isActive;
    if (fields.activeMinutes !== undefined) {
      patch.activeUntil = new Date(Date.now() + fields.activeMinutes * 60 * 1000).toISOString();
    }
    if (manifest !== undefined) patch.manifestJson = JSON.stringify(manifest);

    if (sceneBuf) {
      const dir = linkDir(existing);
      if (!dir) throw new Error("token check failed");
      await fs.mkdir(dir, { recursive: true });
      const tmp = path.join(dir, "scene.glb.tmp");
      await fs.writeFile(tmp, sceneBuf);
      await fs.rename(tmp, path.join(dir, "scene.glb"));
      patch.sceneBytes = sceneBuf.length;
    }

    await designLinkDb.update(id, patch);
    const row = await designLinkDb.getById(id);
    if (!row) throw new ApiError(404, "not_found");
    return res.json(formatLink(row));
  } catch (error) {
    return handleRouteError(res, error, id);
  }
});

router.get("/admin/design-links", ...staffOnly, async (req, res) => {
  try {
    const jobId = typeof req.query.studio_job_id === "string" ? req.query.studio_job_id.trim() : "";
    const rows = jobId ? await designLinkDb.listByJob(jobId) : await designLinkDb.listAll();
    return res.json({ links: rows.map(formatLink) });
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.get("/admin/design-links/:id/views", ...staffOnly, async (req, res) => {
  const id = parseId(req.params.id);
  try {
    if (!id) throw new ApiError(404, "not_found");
    const link = await designLinkDb.getById(id);
    if (!link) throw new ApiError(404, "not_found");
    const views = await designLinkDb.views(id);
    return res.json({
      views: views.map((v) => ({
        viewed_at: isoFromSqlite(v.viewed_at),
        revision: v.revision,
        city: v.city ?? null,
        region: v.region ?? null,
        country: v.country ?? null,
        user_agent: v.user_agent ?? null,
      })),
    });
  } catch (error) {
    return handleRouteError(res, error, id);
  }
});

router.delete("/admin/design-links/:id", ...staffOnly, async (req, res) => {
  const id = parseId(req.params.id);
  try {
    if (!id) throw new ApiError(404, "not_found");
    const link = await designLinkDb.getById(id);
    if (!link) throw new ApiError(404, "not_found");
    const removed = await designLinkDb.remove(id);
    if (!removed) throw new ApiError(404, "not_found");
    // A failed rm does not fail the DELETE: the daily cleanup removes folders with no row
    const dir = linkDir(link);
    if (dir) {
      await fs.rm(dir, { recursive: true, force: true }).catch((err) => {
        console.error("Design link folder not removed for link", id, err && err.code);
      });
    }
    return res.json({ ok: true });
  } catch (error) {
    return handleRouteError(res, error, id);
  }
});

// ---------------------------------------------------------------------------
// Public routes
// ---------------------------------------------------------------------------

// Looks up a live link for a public request; sends 404/410 itself and returns null
async function findLiveLink(req, res) {
  const token = req.params.token;
  if (typeof token !== "string" || !TOKEN_RE.test(token)) {
    sendError(res, 404, "not_found");
    return null;
  }
  const link = await designLinkDb.getByToken(token);
  if (!link) {
    sendError(res, 404, "not_found");
    return null;
  }
  if (!designLinkDb.isLive(link)) {
    sendError(res, 410, "ended");
    return null;
  }
  return link;
}

router.get("/design-links/:token", designLinkPublicLimiter, async (req, res) => {
  let link = null;
  try {
    link = await findLiveLink(req, res);
    if (!link) return;

    let manifest;
    try {
      manifest = JSON.parse(link.manifest_json);
    } catch {
      throw new Error("stored manifest does not parse");
    }

    const location = await getLocationFromIP(clientIp(req));
    const { notify } = await designLinkDb.trackView(
      link.id,
      link.revision,
      req.get("user-agent") || null,
      location
    );

    res.set("Cache-Control", "no-store");
    res.json({
      title: link.title,
      revision: link.revision,
      price_text: link.price_text === "" ? null : link.price_text ?? null,
      manifest,
      scene_url: `/api/design-links/${link.token}/scene.glb?r=${link.revision}`,
    });

    if (notify) {
      const linkId = link.id;
      notifyDesignLinkViewed({
        title: link.title,
        city: location && location.city,
        region: location && location.region,
      }).catch(() => {
        console.error("Design link push failed for link", linkId);
      });
    }
  } catch (error) {
    if (!res.headersSent) return handleRouteError(res, error, link && link.id);
  }
});

router.get("/design-links/:token/scene.glb", designLinkPublicLimiter, async (req, res) => {
  let link = null;
  try {
    link = await findLiveLink(req, res);
    if (!link) return;
    const dir = linkDir(link);
    if (!dir) return sendError(res, 404, "not_found");
    res.set("Content-Type", "model/gltf-binary");
    res.set("Cache-Control", "private, max-age=600");
    res.sendFile(path.join(dir, "scene.glb"), { cacheControl: false }, (err) => {
      if (!err || res.headersSent) return;
      res.removeHeader("Content-Type");
      if (err.code === "ENOENT" || err.status === 404) return sendError(res, 404, "not_found");
      console.error("Design link scene not sent for link", link.id, err.code || err.name);
      return sendError(res, 500, "server_error");
    });
  } catch (error) {
    if (!res.headersSent) return handleRouteError(res, error, link && link.id);
  }
});

module.exports = router;
module.exports.DESIGN_LINKS_DIR = DESIGN_LINKS_DIR;
