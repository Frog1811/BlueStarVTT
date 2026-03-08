require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const sizeOf = require("image-size");
const {
  dbConfig,
  openDatabase,
  ensureSchema,
  get,
  run
} = require("../database/connection");

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let db;

// Resolve project root and provide cross-environment paths for maps and tokens.
// We need to support two layouts:
// - Local dev: <project-root>/backend/src -> maps is at <project-root>/maps (two levels up)
// - Docker: /app/src -> maps is at /app/maps (one level up)
function resolveProjectRoot() {
  // Allow explicit override
  if (process.env.PROJECT_ROOT) {
    const provided = process.env.PROJECT_ROOT;
    return path.isAbsolute(provided) ? provided : path.resolve(__dirname, provided);
  }

  // Candidate: two levels up (works for repo layout where this file is backend/src/index.js)
  const candidateA = path.resolve(__dirname, '..', '..');
  const candidateAMaps = path.join(candidateA, 'maps');

  // Candidate: one level up (works for Docker where code is at /app/src)
  const candidateB = path.resolve(__dirname, '..');
  const candidateBMaps = path.join(candidateB, 'maps');

  // Prefer candidate that contains expected folders (maps)
  try {
    if (fsSync.existsSync(candidateAMaps)) return candidateA;
  } catch (e) {
    // ignore
  }

  try {
    if (fsSync.existsSync(candidateBMaps)) return candidateB;
  } catch (e) {
    // ignore
  }

  // Fallback: prefer candidateA (original behavior)
  return candidateA;
}

const projectRoot = resolveProjectRoot();

// Resolve MAPS_PATH/TOKENS_PATH: accept absolute env paths, or resolve relative to projectRoot
function resolveEnvPath(envVar, defaultPath) {
  if (process.env[envVar]) {
    const p = process.env[envVar];
    return path.isAbsolute(p) ? p : path.resolve(projectRoot, p);
  }
  return defaultPath;
}

const MAPS_PATH = resolveEnvPath('MAPS_PATH', path.resolve(projectRoot, 'maps'));
const TOKENS_PATH = resolveEnvPath('TOKENS_PATH', path.resolve(projectRoot, 'tokens'));

// Helper to resolve stored token image_path values (like 'tokens/{campaignId}/{folder}/{filename}')
function resolveTokenPhysicalPath(imagePath) {
  if (!imagePath) return null;
  // Leave base asset paths to be handled by frontend (/assets/...)
  if (imagePath.startsWith('/assets/')) return null;

  // Normalize leading slash
  let p = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;

  // If path starts with 'tokens/', resolve under TOKENS_PATH
  if (p.startsWith('tokens/')) {
    return path.join(TOKENS_PATH, p.slice('tokens/'.length));
  }

  // If it already refers to maps/ or other paths, resolve relative to project root
  return path.join(projectRoot, p);
}

// Ensure maps & tokens directories exist on startup (non-blocking)
(async () => {
  try {
    await fs.mkdir(MAPS_PATH, { recursive: true });
    await fs.mkdir(TOKENS_PATH, { recursive: true });
    console.log('[Startup] projectRoot:', projectRoot);
    console.log('[Startup] Ensured MAPS_PATH:', MAPS_PATH, 'TOKENS_PATH:', TOKENS_PATH);
  } catch (err) {
    console.error('[Startup] Failed to create maps/tokens directories:', err);
  }
})();

// Configure multer for file uploads - simplified to not use db in storage config
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const campaignId = req.body.campaignId || req.params.campaignId;
      // Use MAPS_PATH so the location is consistent between local and Docker
      let uploadPath = path.join(MAPS_PATH, campaignId);

      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      console.error("Multer destination error:", error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept any image type
    const mimetype = file.mimetype.startsWith('image/');

    if (mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Configure multer for token uploads
const tokenStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // Get campaignId from URL params (available during multer phase) or body/query as fallback
      let campaignId = req.params?.campaignId || req.body?.campaignId || req.query?.campaignId;

      // For PATCH requests (token updates), we need to look up the campaign from the token
      if (!campaignId && req.params?.tokenId && db) {
        console.log('[Multer Destination] Looking up campaign ID for token:', req.params.tokenId);
        try {
          const token = await get(db, "SELECT campaign_id FROM tokens WHERE id = ?", [req.params.tokenId]);
          if (token) {
            campaignId = token.campaign_id;
            console.log('[Multer Destination] Found campaign ID from token:', campaignId);
          }
        } catch (err) {
          console.error('[Multer Destination] Failed to look up token campaign:', err.message);
        }
      }

      if (!campaignId) {
        console.error('[Multer Destination] No campaign ID available - params:', req.params, 'tokenId:', req.params?.tokenId);
        return cb(new Error('Campaign ID not found'));
      }

      // Get folder name from query params (FormData body not available to multer yet)
      const folderName = req.query.tokenFolderName || 'root';

      console.log('[Multer Destination] campaignId:', campaignId, 'folderName:', folderName);
      // Use TOKENS_PATH so the location is consistent between local and Docker
      let uploadPath = path.join(TOKENS_PATH, campaignId, folderName);

      await fs.mkdir(uploadPath, { recursive: true });
      console.log('[Multer Destination] Created uploadPath:', uploadPath);
      cb(null, uploadPath);
    } catch (error) {
      console.error('[Multer Destination] Error:', error.message);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Use UUID-based filename to preserve extension
    const ext = path.extname(file.originalname);
    const filename = uuidv4() + ext;
    console.log('[Multer Filename] Generated filename:', filename);
    cb(null, filename);
  }
});

const uploadToken = multer({
  storage: tokenStorage,
  fileFilter: (req, file, cb) => {
    const mimetype = file.mimetype.startsWith('image/');
    if (mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Serve static map files and token files from cross-environment paths
app.use('/maps', express.static(MAPS_PATH));
// Serve static token files
app.use('/tokens', express.static(TOKENS_PATH));

const PRESENCE_TIMEOUT_MS = 30000;
const PRESENCE_SWEEP_MS = 10000;
const presenceBySession = new Map();
const presenceStreams = new Map();

function isMissing(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

async function initDatabase() {
  db = await openDatabase();
  await ensureSchema(db);
  await fixTokenPaths(); // Fix existing tokens with wrong paths
  await populateBaseTokens(); // Populate base tokens so they work like custom tokens
}

async function populateBaseTokens() {
  try {
    console.log('[Database Migration] Populating base tokens...');

    // Resolve frontend asset paths relative to the project root so this works
    // whether the backend is run from the repo root, built into a container, or from a different cwd.
    // Use the same projectRoot computed above (do not shadow it)
    const iconsPath = path.resolve(projectRoot, 'frontend', 'src', 'assets', 'Icons');
    const jocatPath = path.resolve(projectRoot, 'frontend', 'src', 'assets', 'JOCAT');

    // Check for existence and handle gracefully if missing (avoid ENOENT)
    let iconsExist = true;
    try {
      await fs.access(iconsPath);
    } catch (e) {
      iconsExist = false;
      console.warn('[Database Migration] Icons folder not found at', iconsPath);
    }
    let jocatExist = true;
    try {
      await fs.access(jocatPath);
    } catch (e) {
      jocatExist = false;
      console.warn('[Database Migration] JOCAT folder not found at', jocatPath);
    }

    let totalCreated = 0;

    // Process Icons folder
    try {
      if (!iconsExist) {
        console.log('[Database Migration] Skipping Icons processing because folder is missing');
      } else {
        const iconFiles = await fs.readdir(iconsPath);
        for (const file of iconFiles) {
          if (/\.(png|jpg|jpeg|gif)$/i.test(file)) {
            const tokenId = path.parse(file).name; // e.g., "Aberration"
            const tokenName = path.parse(file).name;
            const imagePath = `/assets/Icons/${file}`;

            // Check if exists
            const exists = await get(db, "SELECT id FROM tokens WHERE id = ?", [tokenId]);
            if (!exists) {
              await run(
                db,
                "INSERT INTO tokens (id, campaign_id, token_folder_id, name, image_path, is_base_token) VALUES (?, NULL, NULL, ?, ?, 1)",
                [tokenId, tokenName, imagePath]
              );
              totalCreated++;
            }
          }
        }
        console.log(`[Database Migration] Created ${totalCreated} Icon base tokens`);
      }
    } catch (error) {
      console.error('[Database Migration] Failed to process Icons:', error.message);
    }

    // Process JOCAT folder
    try {
      if (!jocatExist) {
        console.log('[Database Migration] Skipping JOCAT processing because folder is missing');
      } else {
        const jocatFiles = await fs.readdir(jocatPath);
        let jocatCreated = 0;
        for (const file of jocatFiles) {
          if (/\.(png|jpg|jpeg|gif)$/i.test(file)) {
            const tokenId = `jocat-${file}`; // e.g., "jocat-Aracockra.png"
            const tokenName = path.parse(file).name.replace(/[-_]+/g, ' ').trim();
            const imagePath = `/assets/JOCAT/${file}`;

            // Check if exists
            const exists = await get(db, "SELECT id FROM tokens WHERE id = ?", [tokenId]);
            if (!exists) {
              await run(
                db,
                "INSERT INTO tokens (id, campaign_id, token_folder_id, name, image_path, is_base_token) VALUES (?, NULL, NULL, ?, ?, 1)",
                [tokenId, tokenName, imagePath]
              );
              jocatCreated++;
              totalCreated++;
            }
          }
        }
        console.log(`[Database Migration] Created ${jocatCreated} JOCAT base tokens`);
      }
    } catch (error) {
      console.error('[Database Migration] Failed to process JOCAT:', error.message);
    }

    console.log(`[Database Migration] Base tokens populated: ${totalCreated} total`);
  } catch (error) {
    console.error('[Database Migration] Failed to populate base tokens:', error);
  }
}

async function fixTokenPaths() {
  try {
    console.log('[Database Migration] Fixing token paths...');

    // Get all tokens with token_folder_id
    const [tokens] = await db.execute(
      "SELECT t.id, t.campaign_id, t.token_folder_id, t.image_path, tf.name FROM tokens t " +
      "LEFT JOIN token_folders tf ON t.token_folder_id = tf.id " +
      "WHERE t.is_base_token = FALSE AND t.image_path LIKE 'tokens/%' AND t.token_folder_id IS NOT NULL",
      []
    );

    console.log('[Database Migration] Found', tokens.length, 'tokens to potentially fix');

    for (const token of tokens) {
      // Check if path is wrong (contains folder ID instead of folder name)
      const pathParts = token.image_path.split('/');
      if (pathParts.length >= 3) {
        const pathFolderPart = pathParts[2]; // tokens/{campaignId}/{folderPart}/{filename}

        // If the folder part looks like a UUID (has dashes), it's wrong
        if (pathFolderPart && pathFolderPart.includes('-')) {
          // This is a UUID, needs to be replaced with folder name
          if (token.name) {
            console.log('[Database Migration] Fixing token', token.id, 'path from', token.image_path);
            const filename = pathParts[3]; // Get the filename
            const newPath = `tokens/${token.campaign_id}/${token.name}/${filename}`;

            await run(db, "UPDATE tokens SET image_path = ? WHERE id = ?", [newPath, token.id]);
            console.log('[Database Migration] Fixed to:', newPath);
          }
        }
      }
    }

    console.log('[Database Migration] Token paths fixed');
  } catch (error) {
    console.error('[Database Migration] Error fixing token paths:', error);
  }
}

function getSessionMap(sessionId) {
  if (!presenceBySession.has(sessionId)) {
    presenceBySession.set(sessionId, new Map());
  }
  return presenceBySession.get(sessionId);
}

function getStreamSet(sessionId) {
  if (!presenceStreams.has(sessionId)) {
    presenceStreams.set(sessionId, new Set());
  }
  return presenceStreams.get(sessionId);
}

function buildPresencePayload(sessionId) {
  const sessionMap = getSessionMap(sessionId);
  const payload = {
    sessionId,
    users: Array.from(sessionMap.values()),
    serverTime: Date.now()
  };
  console.log('[Presence] Building payload for session', sessionId, ':', payload);
  return payload;
}

function broadcastPresence(sessionId) {
  const payload = buildPresencePayload(sessionId);
  const streams = getStreamSet(sessionId);
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  console.log('[Presence] Broadcasting to', streams.size, 'clients for session', sessionId);
  streams.forEach((res) => {
    res.write(data);
  });
}

// Map campaigns to their SSE streams
const campaignStreams = new Map();

function registerCampaignStream(campaignId, res) {
  if (!campaignStreams.has(campaignId)) {
    campaignStreams.set(campaignId, new Set());
  }
  campaignStreams.get(campaignId).add(res);
}

function unregisterCampaignStream(campaignId, res) {
  if (campaignStreams.has(campaignId)) {
    campaignStreams.get(campaignId).delete(res);
  }
}

function broadcastTokenUpdate(campaignId, update) {
  if (!campaignStreams.has(campaignId)) {
    return;
  }
  const streams = campaignStreams.get(campaignId);
  const data = `data: ${JSON.stringify(update)}\n\n`;
  console.log('[TokenUpdate] Broadcasting to', streams.size, 'clients for campaign', campaignId, 'update:', update);
  streams.forEach((res) => {
    try {
      res.write(data);
    } catch (error) {
      console.error('[TokenUpdate] Error writing to stream:', error);
    }
  });
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Debug endpoint to check maps in database
app.get("/api/debug/maps/:campaignId", async (req, res) => {
  try {
    const { campaignId } = req.params;
    const [rows] = await db.execute("SELECT * FROM maps WHERE campaign_id = ?", [campaignId]);
    res.json({ count: rows.length, maps: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/presence/stream", (req, res) => {
  const sessionId = String(req.query.sessionId || "").trim();
  const userId = String(req.query.userId || "").trim();
  const name = String(req.query.name || "").trim();
  const role = String(req.query.role || "").trim();
  const campaignId = String(req.query.campaignId || "").trim();

  if (!sessionId) {
    console.log('[Presence] Stream request rejected: no sessionId');
    return res.status(400).json({ message: "sessionId is required" });
  }

  if (!name || !role) {
    console.log('[Presence] Stream request rejected: missing name or role');
    return res.status(400).json({ message: "name and role are required" });
  }

  console.log('[Presence] New SSE connection for session:', sessionId, 'user:', name, 'role:', role, 'campaign:', campaignId);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Add user to session immediately when they connect
  const key = userId ? `id:${userId}` : `name:${name}|role:${role}`;
  const sessionMap = getSessionMap(sessionId);
  const user = {
    id: key,
    name: name,
    role,
    lastSeen: Date.now()
  };
  sessionMap.set(key, user);
  console.log('[Presence] User joined session', sessionId, ':', user);

  const streams = getStreamSet(sessionId);
  streams.add(res);

  // Register for campaign token updates if campaignId provided
  if (campaignId) {
    registerCampaignStream(campaignId, res);
    console.log('[Presence] Registered stream for campaign updates:', campaignId);
  }

  console.log('[Presence] Active connections for session', sessionId, ':', streams.size);

  // Broadcast updated presence to all clients
  broadcastPresence(sessionId);

  req.on("close", () => {
    streams.delete(res);

    // Unregister from campaign updates
    if (campaignId) {
      unregisterCampaignStream(campaignId, res);
      console.log('[Presence] Unregistered stream for campaign updates:', campaignId);
    }

    // Remove user from session immediately when they disconnect
    sessionMap.delete(key);
    console.log('[Presence] User left session', sessionId, ':', name, ', remaining users:', sessionMap.size);

    // Broadcast updated presence to remaining clients
    broadcastPresence(sessionId);
  });
});

// Presence ping endpoint removed - presence is now tracked via SSE connections

app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    if (isMissing(username) || isMissing(email) || isMissing(password)) {
      return res.status(400).json({ message: "username, email, and password are required" });
    }

    const existing = await get(db, "SELECT id FROM users WHERE email = ?", [email]);
    if (existing) {
      return res.status(409).json({ message: "email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();

    await run(
      db,
      "INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)",
      [id, username, email, passwordHash]
    );

    return res.status(201).json({ id, username, email, role: "user" });
  } catch (error) {
    console.error("Register failed:", error);
    return res.status(500).json({ message: "registration failed" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (isMissing(email) || isMissing(password)) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const user = await get(
      db,
      "SELECT id, username, email, password_hash, role FROM users WHERE email = ?",
      [email]
    );

    if (!user) {
      return res.status(401).json({ message: "invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "invalid credentials" });
    }

    return res.json({ id: user.id, username: user.username, email: user.email, role: user.role || "user" });
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({ message: "login failed" });
  }
});

app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params || {};
    if (!userId) return res.status(400).json({ message: 'userId required' });

    const user = await get(db, 'SELECT id, username, email, role FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'user not found' });
    }

    return res.json({ id: user.id, username: user.username, email: user.email, role: user.role || 'user' });
  } catch (error) {
    console.error('Fetch user failed:', error);
    return res.status(500).json({ message: 'failed to fetch user' });
  }
});

app.post("/api/campaigns", async (req, res) => {
  try {
    const { name, dungeonMasterId } = req.body || {};

    if (isMissing(name) || isMissing(dungeonMasterId)) {
      return res.status(400).json({ message: "name and dungeonMasterId are required" });
    }

    const user = await get(db, "SELECT id FROM users WHERE id = ?", [dungeonMasterId]);
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    const id = uuidv4();

    await run(
      db,
      "INSERT INTO campaigns (id, name, DungeonMaster) VALUES (?, ?, ?)",
      [id, name, dungeonMasterId]
    );

    return res.status(201).json({ id, name, DungeonMaster: dungeonMasterId });
  } catch (error) {
    console.error("Create campaign failed:", error);
    return res.status(500).json({ message: "campaign creation failed" });
  }
});

app.get("/api/users/:userId/campaigns", async (req, res) => {
  try {
    const { userId } = req.params;
    const [rows] = await db.execute(
      "SELECT id, name, DungeonMaster FROM campaigns WHERE DungeonMaster = ? ORDER BY created_at DESC",
      [userId]
    );

    return res.json(rows);
  } catch (error) {
    console.error("Fetch campaigns failed:", error);
    return res.status(500).json({ message: "failed to fetch campaigns" });
  }
});

app.get("/api/campaigns/:campaignId", async (req, res) => {
  try {
    const { campaignId } = req.params;
    console.log('Fetching campaign with ID:', campaignId);
    const campaign = await get(
      db,
      "SELECT id, name, DungeonMaster FROM campaigns WHERE id = ?",
      [campaignId]
    );

    if (!campaign) {
      console.log('Campaign not found:', campaignId);
      return res.status(404).json({ message: "campaign not found" });
    }

    console.log('Campaign found:', campaign);
    return res.json(campaign);
  } catch (error) {
    console.error("Fetch campaign failed:", error);
    return res.status(500).json({ message: "failed to fetch campaign" });
  }
});

app.patch("/api/campaigns/:campaignId", async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { name } = req.body || {};

    if (isMissing(name)) {
      return res.status(400).json({ message: "name is required" });
    }

    const campaign = await get(db, "SELECT id FROM campaigns WHERE id = ?", [campaignId]);
    if (!campaign) {
      return res.status(404).json({ message: "campaign not found" });
    }

    await run(
      db,
      "UPDATE campaigns SET name = ? WHERE id = ?",
      [name, campaignId]
    );

    const updated = await get(
      db,
      "SELECT id, name, DungeonMaster FROM campaigns WHERE id = ?",
      [campaignId]
    );

    return res.json(updated);
  } catch (error) {
    console.error("Update campaign failed:", error);
    return res.status(500).json({ message: "campaign update failed" });
  }
});

app.delete("/api/campaigns/:campaignId", async (req, res) => {
  try {
    const { campaignId } = req.params;

    const campaign = await get(db, "SELECT id FROM campaigns WHERE id = ?", [campaignId]);
    if (!campaign) {
      return res.status(404).json({ message: "campaign not found" });
    }

    // Delete campaign (will cascade to related tables per foreign key constraints)
    await run(db, "DELETE FROM campaigns WHERE id = ?", [campaignId]);

    return res.status(204).send();
  } catch (error) {
    console.error("Delete campaign failed:", error);
    return res.status(500).json({ message: "campaign deletion failed" });
  }
});

// Helper function to build folder path
async function buildFolderPath(folderId) {
  let folderPath = [];
  let currentId = folderId;

  while (currentId) {
    const folder = await get(db, "SELECT name, parent_folder_id FROM map_folders WHERE id = ?", [currentId]);
    if (!folder) break;
    folderPath.unshift(folder.name);
    currentId = folder.parent_folder_id;
  }

  return folderPath.join('/');
}

// Helper function to build token folder path
async function buildTokenFolderPath(folderId) {
  let folderPath = [];
  let currentId = folderId;

  while (currentId) {
    const folder = await get(db, "SELECT name, parent_folder_id FROM token_folders WHERE id = ?", [currentId]);
    if (!folder) break;
    folderPath.unshift(folder.name);
    currentId = folder.parent_folder_id;
  }

  return folderPath.join('/');
}

// Folder endpoints
app.post("/api/campaigns/:campaignId/folders", async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { name, parentFolderId, color } = req.body || {};

    if (isMissing(name)) {
      return res.status(400).json({ message: "folder name is required" });
    }

    const campaign = await get(db, "SELECT id FROM campaigns WHERE id = ?", [campaignId]);
    if (!campaign) {
      return res.status(404).json({ message: "campaign not found" });
    }

    const id = uuidv4();

    await run(
      db,
      "INSERT INTO map_folders (id, campaign_id, name, parent_folder_id, color) VALUES (?, ?, ?, ?, ?)",
      [id, campaignId, name, parentFolderId || null, color || '#3b82f6']
    );

    // Create physical folder
    const folderPath = await buildFolderPath(id);
    const physicalPath = path.join(MAPS_PATH, campaignId, folderPath);
    await fs.mkdir(physicalPath, { recursive: true });

    return res.status(201).json({ id, campaign_id: campaignId, name, parent_folder_id: parentFolderId || null, color: color || '#3b82f6' });
  } catch (error) {
    console.error("Create folder failed:", error);
    return res.status(500).json({ message: "folder creation failed" });
  }
});

app.get("/api/campaigns/:campaignId/folders", async (req, res) => {
  try {
    const { campaignId } = req.params;
    const [rows] = await db.execute(
      "SELECT id, campaign_id, name, parent_folder_id, color, created_at FROM map_folders WHERE campaign_id = ? ORDER BY name",
      [campaignId]
    );

    return res.json(rows);
  } catch (error) {
    console.error("Fetch folders failed:", error);
    return res.status(500).json({ message: "failed to fetch folders" });
  }
});

app.patch("/api/folders/:folderId", async (req, res) => {
  try {
    const { folderId } = req.params;
    const { name, color } = req.body || {};

    const folder = await get(db, "SELECT * FROM map_folders WHERE id = ?", [folderId]);
    if (!folder) {
      return res.status(404).json({ message: "folder not found" });
    }

    const updates = [];
    const values = [];

    if (name && !isMissing(name)) {
      updates.push("name = ?");
      values.push(name);

      // Rename physical folder
      const oldPath = await buildFolderPath(folderId);
      const oldPhysicalPath = path.join(MAPS_PATH, folder.campaign_id, oldPath);

      // Update in database first
      await run(db, `UPDATE map_folders SET name = ? WHERE id = ?`, [name, folderId]);

      const newPath = await buildFolderPath(folderId);
      const newPhysicalPath = path.join(MAPS_PATH, folder.campaign_id, newPath);

      try {
        await fs.rename(oldPhysicalPath, newPhysicalPath);
      } catch (err) {
        console.error("Failed to rename folder:", err);
      }
    }

    if (color && !isMissing(color)) {
      updates.push("color = ?");
      values.push(color);
    }

    if (updates.length > 0) {
      values.push(folderId);
      await run(db, `UPDATE map_folders SET ${updates.join(", ")} WHERE id = ?`, values);
    }

    const updated = await get(db, "SELECT * FROM map_folders WHERE id = ?", [folderId]);
    return res.json(updated);
  } catch (error) {
    console.error("Update folder failed:", error);
    return res.status(500).json({ message: "folder update failed" });
  }
});

app.delete("/api/folders/:folderId", async (req, res) => {
  try {
    const { folderId } = req.params;

    const folder = await get(db, "SELECT * FROM map_folders WHERE id = ?", [folderId]);
    if (!folder) {
      return res.status(404).json({ message: "folder not found" });
    }

    console.log('[Delete Folder] Deleting folder:', folder.name, 'ID:', folderId);

    // Get all maps in this folder and subfolders recursively
    const [allMaps] = await db.execute(
      `WITH RECURSIVE folder_tree AS (
        SELECT id FROM map_folders WHERE id = ?
        UNION ALL
        SELECT mf.id FROM map_folders mf
        INNER JOIN folder_tree ft ON mf.parent_folder_id = ft.id
      )
      SELECT m.* FROM maps m
      WHERE m.folder_id IN (SELECT id FROM folder_tree)`,
      [folderId]
    );

    // Delete physical files for all maps
    for (const map of allMaps) {
      const physicalPath = path.join(MAPS_PATH, map.filepath);
      try {
        await fs.unlink(physicalPath);
        console.log('[Delete Folder] Deleted map file:', map.name);
      } catch (err) {
        console.error('[Delete Folder] Failed to delete map file:', map.name, err);
      }
    }

    // Remove any of these maps from active state
    if (allMaps.length > 0) {
      const mapIds = allMaps.map(m => m.id);
      await run(db, `UPDATE campaign_state SET active_map_id = NULL WHERE active_map_id IN (${mapIds.map(() => '?').join(',')})`, mapIds);
    }

    // Delete physical folder and all its contents
    const folderPath = await buildFolderPath(folderId);
    const physicalPath = path.join(MAPS_PATH, folder.campaign_id, folderPath);

    try {
      await fs.rm(physicalPath, { recursive: true, force: true });
      console.log('[Delete Folder] Deleted physical folder:', physicalPath);
    } catch (err) {
      console.error("[Delete Folder] Failed to delete folder:", err);
    }

    // Database cascade will handle deletion of subfolders and maps
    await run(db, "DELETE FROM map_folders WHERE id = ?", [folderId]);
    console.log('[Delete Folder] Folder deleted from database');

    return res.json({ message: "folder deleted" });
  } catch (error) {
    console.error("Delete folder failed:", error);
    return res.status(500).json({ message: "folder deletion failed" });
  }
});

// Map endpoints
app.post("/api/campaigns/:campaignId/maps", upload.single('map'), async (req, res) => {
  try {
    console.log('[Upload] Request received for campaign:', req.params.campaignId);
    console.log('[Upload] File:', req.file ? req.file.originalname : 'NO FILE');
    console.log('[Upload] Body:', req.body);

    const { campaignId } = req.params;
    const { folderId } = req.body;

    if (!req.file) {
      console.error('[Upload] No file in request');
      return res.status(400).json({ message: "map file is required" });
    }

    const campaign = await get(db, "SELECT id FROM campaigns WHERE id = ?", [campaignId]);
    if (!campaign) {
      console.error('[Upload] Campaign not found:', campaignId);
      return res.status(404).json({ message: "campaign not found" });
    }

    console.log('[Upload] Getting image dimensions for:', req.file.path);

    // Get image dimensions with fallback
    let dimensions = { width: 1920, height: 1080 }; // Default fallback
    try {
      dimensions = sizeOf(req.file.path);
      console.log('[Upload] Dimensions:', dimensions);
    } catch (dimError) {
      console.warn('[Upload] Could not get dimensions, using defaults:', dimError.message);
    }

    const id = uuidv4();
    const relativePath = path.relative(MAPS_PATH, req.file.path).replace(/\\/g, '/');

    console.log('[Upload] Saving to database with ID:', id);
    console.log('[Upload] Relative path:', relativePath);

    await run(
      db,
      "INSERT INTO maps (id, campaign_id, folder_id, name, filename, filepath, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, campaignId, folderId || null, req.file.originalname, req.file.filename, relativePath, dimensions.width || 1920, dimensions.height || 1080]
    );

    console.log('[Upload] Upload successful!');

    return res.status(201).json({
      id,
      campaign_id: campaignId,
      folder_id: folderId || null,
      name: req.file.originalname,
      filename: req.file.filename,
      filepath: relativePath,
      width: dimensions.width,
      height: dimensions.height
    });
  } catch (error) {
    console.error("[Upload] Upload map failed:", error);
    console.error("[Upload] Error stack:", error.stack);
    return res.status(500).json({ message: "map upload failed", error: error.message });
  }
});

app.get("/api/campaigns/:campaignId/maps", async (req, res) => {
  try {
    const { campaignId } = req.params;
    const [rows] = await db.execute(
      "SELECT id, campaign_id, folder_id, name, filename, filepath, width, height, grid_enabled, grid_cols, grid_rows, grid_color, grid_opacity, created_at FROM maps WHERE campaign_id = ? ORDER BY created_at DESC",
      [campaignId]
    );

    // Convert TINYINT(1) to proper boolean for grid_enabled
    const mapsWithBooleans = rows.map(row => ({
      ...row,
      grid_enabled: Boolean(row.grid_enabled)
    }));

    return res.json(mapsWithBooleans);
  } catch (error) {
    console.error("Fetch maps failed:", error);
    return res.status(500).json({ message: "failed to fetch maps" });
  }
});

app.delete("/api/maps/:mapId", async (req, res) => {
  try {
    const { mapId } = req.params;

    const map = await get(db, "SELECT * FROM maps WHERE id = ?", [mapId]);
    if (!map) {
      return res.status(404).json({ message: "map not found" });
    }

    console.log('[Delete] Deleting map:', map.name, 'ID:', mapId);

    // Delete physical file
    const physicalPath = path.join(MAPS_PATH, map.filepath);
    console.log('[Delete] Physical path:', physicalPath);

    try {
      await fs.unlink(physicalPath);
      console.log('[Delete] Physical file deleted successfully');
    } catch (err) {
      console.error("[Delete] Failed to delete map file:", err);
      // Continue with database deletion even if file delete fails
    }

    // Remove from active map if it's currently displayed
    await run(db, "UPDATE campaign_state SET active_map_id = NULL WHERE active_map_id = ?", [mapId]);

    // Delete from database
    await run(db, "DELETE FROM maps WHERE id = ?", [mapId]);
    console.log('[Delete] Map deleted from database');

    return res.json({ message: "map deleted" });
  } catch (error) {
    console.error("Delete map failed:", error);
    return res.status(500).json({ message: "map deletion failed" });
  }
});

app.patch("/api/maps/:mapId", async (req, res) => {
  try {
    const { mapId } = req.params;
    const { name, folder_id, grid_enabled, grid_cols, grid_rows, grid_color, grid_opacity } = req.body || {};

    console.log(`[Map Update] Updating map ${mapId}, folder_id: ${folder_id}, name: ${name}, grid_enabled: ${grid_enabled}`);

    const map = await get(db, "SELECT * FROM maps WHERE id = ?", [mapId]);
    if (!map) {
      return res.status(404).json({ message: "map not found" });
    }

    const updates = [];
    const values = [];

    if (name && !isMissing(name)) {
      updates.push("name = ?");
      values.push(name);
    }

    if (grid_enabled !== undefined) {
      updates.push("grid_enabled = ?");
      values.push(grid_enabled ? 1 : 0);
    }

    if (grid_cols !== undefined) {
      updates.push("grid_cols = ?");
      values.push(grid_cols);
    }

    if (grid_rows !== undefined) {
      updates.push("grid_rows = ?");
      values.push(grid_rows);
    }

    if (grid_color !== undefined && grid_color !== null) {
      updates.push("grid_color = ?");
      values.push(grid_color);
    }

    if (grid_opacity !== undefined) {
      updates.push("grid_opacity = ?");
      values.push(grid_opacity);
    }

    // Check if folder_id is being changed (it could be string, null, or undefined)
    if (folder_id !== undefined && String(map.folder_id) !== String(folder_id)) {
      console.log(`[Map Move] Moving map from folder ${map.folder_id} to ${folder_id}`);
      updates.push("folder_id = ?");
      values.push(folder_id);

      // Handle physical file movement
      const oldFilePath = path.join(MAPS_PATH, map.filepath);

      try {
        // Build new file path
        let newRelativePath;
        if (folder_id) {
          const newFolderPath = await buildFolderPath(folder_id);
          newRelativePath = path.relative(
            MAPS_PATH,
            path.join(MAPS_PATH, map.campaign_id, newFolderPath, path.basename(map.filepath))
          ).replace(/\\/g, '/');
        } else {
          // Moving to root
          newRelativePath = path.relative(
            MAPS_PATH,
            path.join(MAPS_PATH, map.campaign_id, path.basename(map.filepath))
          ).replace(/\\/g, '/');
        }

        const newFilePath = path.join(MAPS_PATH, newRelativePath);
        console.log(`[Map Move] Old path: ${oldFilePath}`);
        console.log(`[Map Move] New path: ${newFilePath}`);

        // Ensure destination folder exists
        const destDir = path.dirname(newFilePath);
        await fs.mkdir(destDir, { recursive: true });

        // Move the file if paths are different
        if (oldFilePath !== newFilePath) {
          await fs.rename(oldFilePath, newFilePath);
          console.log(`[Map Move] Successfully moved file`);

          // Update filepath in database
          updates.push("filepath = ?");
          values.push(newRelativePath);
        }
      } catch (fileError) {
        console.error(`[Map Move] File operation error: ${fileError.message}`);
        // Continue with database update even if file move fails
      }
    }

    if (updates.length > 0) {
      values.push(mapId);
      const query = `UPDATE maps SET ${updates.join(", ")} WHERE id = ?`;
      console.log(`[Map Update] Executing query: ${query}`, values);
      await run(db, query, values);
    }

    const updated = await get(db, "SELECT * FROM maps WHERE id = ?", [mapId]);
    console.log(`[Map Update] Updated map:`, updated);
    // Convert TINYINT(1) to proper boolean for grid_enabled
    if (updated) {
      updated.grid_enabled = Boolean(updated.grid_enabled);
    }
    return res.json(updated);
  } catch (error) {
    console.error("Update map failed:", error);
    return res.status(500).json({ message: "map update failed" });
  }
});

// Token Folder Endpoints
app.post("/api/campaigns/:campaignId/token-folders", async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { name, parentFolderId } = req.body || {};

    console.log('[Create Token Folder] Received request:', { campaignId, name, parentFolderId });

    if (isMissing(name)) {
      return res.status(400).json({ message: "folder name is required" });
    }

    const campaign = await get(db, "SELECT id FROM campaigns WHERE id = ?", [campaignId]);
    if (!campaign) {
      return res.status(404).json({ message: "campaign not found" });
    }

    const id = uuidv4();
    const finalParentId = parentFolderId || null;

    console.log('[Create Token Folder] About to insert:', {
      id,
      campaignId,
      name,
      parent_folder_id: finalParentId
    });

    // Insert into database
    await run(
      db,
      "INSERT INTO token_folders (id, campaign_id, name, parent_folder_id) VALUES (?, ?, ?, ?)",
      [id, campaignId, name, finalParentId]
    );

    // Create physical folder using the full hierarchy path
    const folderPath = await buildTokenFolderPath(id);
    const physicalPath = path.join(TOKENS_PATH, campaignId, folderPath);
    try {
      await fs.mkdir(physicalPath, { recursive: true });
      console.log('[Create Token Folder] Physical folder created:', physicalPath);
    } catch (err) {
      console.error('[Create Token Folder] Failed to create physical folder:', err.message);
    }

    console.log('[Create Token Folder] Folder created:', id, 'name:', name, 'parent:', finalParentId);
    const responseData = {
      id,
      campaign_id: campaignId,
      name,
      parent_folder_id: finalParentId,
      created_at: new Date().toISOString()
    };
    console.log('[Create Token Folder] Returning response:', responseData);
    return res.status(201).json(responseData);
  } catch (error) {
    console.error("Create token folder failed:", error);
    return res.status(500).json({ message: "folder creation failed" });
  }
});

app.get("/api/campaigns/:campaignId/token-folders", async (req, res) => {
  try {
    const { campaignId } = req.params;
    const [rows] = await db.execute(
      "SELECT id, campaign_id, name, parent_folder_id, created_at FROM token_folders WHERE campaign_id = ? ORDER BY name",
      [campaignId]
    );

    return res.json(rows);
  } catch (error) {
    console.error("Fetch token folders failed:", error);
    return res.status(500).json({ message: "failed to fetch token folders" });
  }
});

app.patch("/api/token-folders/:folderId", async (req, res) => {
  try {
    const { folderId } = req.params;
    const { name } = req.body || {};

    const folder = await get(db, "SELECT * FROM token_folders WHERE id = ?", [folderId]);
    if (!folder) {
      return res.status(404).json({ message: "folder not found" });
    }

    if (name && !isMissing(name)) {
      const oldName = folder.name;
      const newName = name;

      // If the name changed, update file paths in database and rename physical folder
      if (oldName !== newName) {
        console.log('[Token Folder Update] Renaming folder from', oldName, 'to', newName);

        // Check if physical folder exists and rename it
        const oldPhysicalPath = path.join(TOKENS_PATH, folder.campaign_id, oldName);
        const newPhysicalPath = path.join(TOKENS_PATH, folder.campaign_id, newName);

        try {
          // Check if old folder exists
          await fs.access(oldPhysicalPath);
          // Rename physical folder
          await fs.rename(oldPhysicalPath, newPhysicalPath);
          console.log('[Token Folder Update] Physical folder renamed from', oldPhysicalPath, 'to', newPhysicalPath);
        } catch (err) {
          // Folder might not exist yet (no tokens uploaded), that's okay
          console.log('[Token Folder Update] Physical folder does not exist or rename failed:', err.message);
        }

        // Get all tokens in this folder
        const [tokens] = await db.execute(
          "SELECT * FROM tokens WHERE token_folder_id = ? AND is_base_token = FALSE",
          [folderId]
        );

        // Update token paths for all tokens in this folder
        for (const token of tokens) {
          try {
            const filename = path.basename(token.image_path);
            const newImagePath = `tokens/${token.campaign_id}/${newName}/${filename}`;

            // Update database with new image path
            await run(db, "UPDATE tokens SET image_path = ? WHERE id = ?", [newImagePath, token.id]);
            console.log('[Token Folder Update] Updated token path for:', token.name);
          } catch (err) {
            console.error('[Token Folder Update] Failed to update token path:', token.name, err);
          }
        }
      }

      await run(db, "UPDATE token_folders SET name = ? WHERE id = ?", [name, folderId]);
    }

    const updated = await get(db, "SELECT * FROM token_folders WHERE id = ?", [folderId]);
    return res.json(updated);
  } catch (error) {
    console.error("Update token folder failed:", error);
    return res.status(500).json({ message: "folder update failed" });
  }
});

app.delete("/api/token-folders/:folderId", async (req, res) => {
  try {
    const { folderId } = req.params;

    const folder = await get(db, "SELECT * FROM token_folders WHERE id = ?", [folderId]);
    if (!folder) {
      return res.status(404).json({ message: "folder not found" });
    }

    console.log('[Delete Token Folder] Deleting folder:', folder.name, 'ID:', folderId);

    // Get all tokens in this folder and subfolders recursively
    const [allTokens] = await db.execute(
      `WITH RECURSIVE folder_tree AS (
        SELECT id FROM token_folders WHERE id = ?
        UNION ALL
        SELECT tf.id FROM token_folders tf
        INNER JOIN folder_tree ft ON tf.parent_folder_id = ft.id
      )
      SELECT t.* FROM tokens t
      WHERE t.token_folder_id IN (SELECT id FROM folder_tree)`,
      [folderId]
    );

    // Delete physical files for all tokens
    for (const token of allTokens) {
      const physicalPath = resolveTokenPhysicalPath(token.image_path) || path.join(TOKENS_PATH, token.image_path);
      try {
        await fs.unlink(physicalPath);
        console.log('[Delete Token Folder] Deleted token file:', token.name);
      } catch (err) {
        console.error('[Delete Token Folder] Failed to delete token file:', token.name, err);
      }
    }

    // Delete from database (cascade will handle tokens)
    await run(db, "DELETE FROM token_folders WHERE id = ?", [folderId]);
    console.log('[Delete Token Folder] Folder deleted from database');

    // Delete physical folder
    const physicalFolderPath = path.join(TOKENS_PATH, folder.campaign_id, folder.name);
    try {
      // Check if folder exists before trying to delete
      await fs.access(physicalFolderPath);
      await fs.rm(physicalFolderPath, { recursive: true, force: true });
      console.log('[Delete Token Folder] Physical folder deleted:', physicalFolderPath);
    } catch (err) {
      // Folder might not exist (no tokens were ever uploaded), that's okay
      console.log('[Delete Token Folder] Physical folder does not exist or delete failed:', err.message);
    }

    return res.json({ message: "token folder deleted" });
  } catch (error) {
    console.error("Delete token folder failed:", error);
    return res.status(500).json({ message: "token folder deletion failed" });
  }
});

// Token Endpoints
app.post("/api/campaigns/:campaignId/tokens", uploadToken.single('file'), async (req, res) => {
  try {
    console.log('[Token Upload] Request received for campaign:', req.params.campaignId);
    console.log('[Token Upload] File:', req.file ? req.file.originalname : 'NO FILE');
    console.log('[Token Upload] Body:', req.body);

    const { campaignId } = req.params;
    const { name, tokenFolderId } = req.body;

    if (!req.file) {
      console.error('[Token Upload] No file in request');
      return res.status(400).json({ message: "token file is required" });
    }

    if (isMissing(name)) {
      return res.status(400).json({ message: "token name is required" });
    }

    const campaign = await get(db, "SELECT id FROM campaigns WHERE id = ?", [campaignId]);
    if (!campaign) {
      return res.status(404).json({ message: "campaign not found" });
    }

    const id = uuidv4();
    // The filename is already set by multer to: {uuid}.{ext}
    // Save tokens in folder structure: tokens/{campaignId}/folderName/{filename}
    const folderName = req.query.tokenFolderName || 'root';
    const imagePath = `tokens/${campaignId}/${folderName}/${req.file.filename}`;

    console.log('[Token Upload] Creating token - folderName:', folderName, 'imagePath:', imagePath);

    await run(
      db,
      "INSERT INTO tokens (id, campaign_id, token_folder_id, name, image_path, is_base_token) VALUES (?, ?, ?, ?, ?, ?)",
      [id, campaignId, tokenFolderId || null, name, imagePath, false]
    );

    console.log('[Token Upload] Token created:', id);
    return res.status(201).json({
      id,
      campaign_id: campaignId,
      token_folder_id: tokenFolderId || null,
      name,
      image_path: imagePath,
      is_base_token: false,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error("Token upload failed:", error);
    return res.status(500).json({ message: "token upload failed" });
  }
});

app.post("/api/campaigns/:campaignId/tokens/from-base", async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { name, imagePath, tokenFolderId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "token name is required" });
    }

    if (!imagePath) {
      return res.status(400).json({ message: "image path is required" });
    }

    const campaign = await get(db, "SELECT id FROM campaigns WHERE id = ?", [campaignId]);
    if (!campaign) {
      return res.status(404).json({ message: "campaign not found" });
    }

    const id = uuidv4();

    await run(
      db,
      "INSERT INTO tokens (id, campaign_id, token_folder_id, name, image_path, is_base_token) VALUES (?, ?, ?, ?, ?, ?)",
      [id, campaignId, tokenFolderId || null, name, imagePath, false]
    );

    console.log('[Token FromBase] Token created:', id);
    return res.status(201).json({
      id,
      campaign_id: campaignId,
      token_folder_id: tokenFolderId || null,
      name,
      image_path: imagePath,
      is_base_token: false,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error("Create token from base failed:", error);
    return res.status(500).json({ message: "create token from base failed" });
  }
});

app.get("/api/campaigns/:campaignId/tokens", async (req, res) => {
  try {
    const { campaignId } = req.params;
    const [rows] = await db.execute(
      "SELECT id, campaign_id, token_folder_id, name, image_path, is_base_token, created_at FROM tokens WHERE campaign_id = ? AND is_base_token = FALSE ORDER BY created_at DESC",
      [campaignId]
    );

    return res.json(rows);
  } catch (error) {
    console.error("Fetch tokens failed:", error);
    return res.status(500).json({ message: "failed to fetch tokens" });
  }
});

app.get("/api/base-tokens", async (req, res) => {
  try {
    // Resolve frontend assets relative to project root (robust to different cwd/runtime locations)
    // Use the top-level projectRoot computed at startup
    const iconsPath = path.resolve(projectRoot, 'frontend', 'src', 'assets', 'Icons');

    // If folder doesn't exist, return empty list instead of throwing ENOENT
    try {
      await fs.access(iconsPath);
    } catch (e) {
      console.warn('[Base Tokens] Icons folder not found at', iconsPath, '- returning empty list');
      return res.json([]);
    }

    const files = await fs.readdir(iconsPath);

    const baseTokens = files
      .filter(file => /\.(png|jpg|jpeg|gif)$/i.test(file))
      .map(file => ({
        id: path.parse(file).name,
        name: path.parse(file).name,
        imagePath: `/assets/Icons/${file}`
      }));

    console.log('[Base Tokens] Found', baseTokens.length, 'base tokens');
    return res.json(baseTokens);
  } catch (error) {
    console.error("Fetch base tokens failed:", error);
    return res.status(500).json({ message: "failed to fetch base tokens" });
  }
});
// Conditional multer middleware for PATCH /api/tokens/:tokenId
// This middleware must run BEFORE express.json() for multipart/form-data
const conditionalUploadToken = (req, res, next) => {
  // Only apply multer if content-type is multipart/form-data
  const contentType = req.headers['content-type'] || '';
  console.log('[Conditional Middleware] PATCH /api/tokens/:tokenId - Content-Type:', contentType);

  if (contentType.includes('multipart/form-data')) {
    console.log('[Conditional Middleware] Detected multipart/form-data, applying multer');
    uploadToken.single('file')(req, res, (err) => {
      if (err) {
        console.error('[Conditional Middleware] Multer error:', err.message, err.code);
        return res.status(400).json({ message: "File upload error: " + err.message });
      }
      console.log('[Conditional Middleware] Multer completed successfully, file:', req.file ? req.file.filename : 'none');
      next();
    });
  } else {
    console.log('[Conditional Middleware] Not multipart, skipping multer');
    next();
  }
};

app.patch("/api/tokens/:tokenId", conditionalUploadToken, async (req, res) => {
  try {
    const { tokenId } = req.params;
    // Handle both JSON body (application/json) and FormData
    // After multer processes FormData, fields are in req.body as strings
    // After express.json() processes JSON, fields are in req.body as strings/objects
    const name = (req.body?.name || '').toString().trim();
    const imagePath = (req.body?.imagePath || '').toString().trim();

    console.log('[Token Update] Request received - tokenId:', tokenId);
    console.log('[Token Update] Content-Type:', req.headers['content-type']);
    console.log('[Token Update] Request body:', { name, imagePath, hasFile: !!req.file, bodyKeys: Object.keys(req.body || {}) });

    const token = await get(db, "SELECT * FROM tokens WHERE id = ?", [tokenId]);
    if (!token) {
      return res.status(404).json({ message: "token not found" });
    }

    // Prevent editing base tokens
    if (token.is_base_token) {
      return res.status(403).json({ message: "cannot edit base tokens" });
    }

    const updates = [];
    const values = [];

    // Update name if provided
    if (name && name.length > 0) {
      console.log('[Token Update] Updating name to:', name);
      updates.push("name = ?");
      values.push(name);
    }

    // Update image path if file was uploaded
    if (req.file) {
      console.log('[Token Update] New file uploaded:', req.file.filename);
      console.log('[Token Update] File details:', { path: req.file.path, filename: req.file.filename, size: req.file.size });

      // Delete old file - but only if it's not a Base token path
      if (!token.image_path.startsWith('/assets/')) {
        const oldPath = resolveTokenPhysicalPath(token.image_path) || path.join(projectRoot, token.image_path);
        try {
          await fs.unlink(oldPath);
          console.log('[Token Update] Deleted old token file:', token.name);
        } catch (err) {
          console.error('[Token Update] Failed to delete old token file:', err.message);
        }
      }

      // Use folder structure: tokens/{campaignId}/folderName/{filename}
      let folderName = 'root';
      if (token.token_folder_id) {
        const folder = await get(db, "SELECT name FROM token_folders WHERE id = ?", [token.token_folder_id]);
        if (folder) {
          folderName = folder.name;
        }
      }

      try {
        // The file should already be saved to the correct folder by multer (via query param)
        // But if tokenFolderName wasn't passed, it goes to _temp and needs to be moved
        const currentPath = req.file.path;
        const correctPath = path.join(TOKENS_PATH, token.campaign_id, folderName);
        const correctFilePath = path.join(correctPath, req.file.filename);

        console.log('[Token Update] Current file path:', currentPath);
        console.log('[Token Update] Target file path:', correctFilePath);

        // Only move if file is not already in correct location
        if (currentPath !== correctFilePath) {
          console.log('[Token Update] File not in target location, moving...');
          await fs.mkdir(correctPath, { recursive: true });

          try {
            // Check if file exists at current location
            await fs.access(currentPath);
            await fs.rename(currentPath, correctFilePath);
            console.log('[Token Update] File moved successfully');
          } catch (err) {
            console.error('[Token Update] Failed to move file:', err.message);
            // Try to verify file exists in target location
            try {
              await fs.access(correctFilePath);
              console.log('[Token Update] File already in correct location');
            } catch {
              throw new Error('File not found at current or target location');
            }
          }
        } else {
          console.log('[Token Update] File already in correct location');
        }

        const newImagePath = `tokens/${token.campaign_id}/${folderName}/${req.file.filename}`;
        updates.push("image_path = ?");
        values.push(newImagePath);
        console.log('[Token Update] Updated image path to:', newImagePath);
      } catch (fileErr) {
        console.error('[Token Update] File handling error:', fileErr.message);
        throw fileErr;
      }
    } else if (imagePath && imagePath.length > 0) {
      // Update with Base token path
      console.log('[Token Update] Switching to Base token:', imagePath);
      // Delete old file if it was a custom file
      if (!token.image_path.startsWith('/assets/')) {
        const oldPath = resolveTokenPhysicalPath(token.image_path) || path.join(projectRoot, token.image_path);
        try {
          await fs.unlink(oldPath);
          console.log('[Token Update] Deleted old token file when switching to Base:', token.name);
        } catch (err) {
          console.error('[Token Update] Failed to delete old token file:', err);
        }
      }

      updates.push("image_path = ?");
      values.push(imagePath);
    }

    // Execute update if there are changes
    if (updates.length > 0) {
      values.push(tokenId);
      const updateSQL = `UPDATE tokens SET ${updates.join(", ")} WHERE id = ?`;
      console.log('[Token Update] Executing SQL:', updateSQL, 'with values:', values);
      await run(db, updateSQL, values);
      console.log('[Token Update] Token updated successfully:', tokenId);
    } else {
      console.log('[Token Update] No updates to apply');
    }

    const updated = await get(db, "SELECT * FROM tokens WHERE id = ?", [tokenId]);
    console.log('[Token Update] Returning updated token:', updated);
    return res.json(updated);
  } catch (error) {
    console.error("Update token failed:", error);
    return res.status(500).json({ message: "token update failed", error: error.message });
  }
});


app.patch("/api/tokens/:tokenId/move", async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { tokenFolderId } = req.body;

    const token = await get(db, "SELECT * FROM tokens WHERE id = ?", [tokenId]);
    if (!token) {
      return res.status(404).json({ message: "token not found" });
    }

    // Prevent moving base tokens
    if (token.is_base_token) {
      return res.status(403).json({ message: "cannot move base tokens" });
    }

    // If moving a custom token (not base token), also move the file on disk
    if (!token.image_path.startsWith('/assets/')) {
      try {
        // Get filename from current path
        const filename = path.basename(token.image_path);

        // Build old and new paths
        const oldPath = resolveTokenPhysicalPath(token.image_path) || path.join(projectRoot, token.image_path);

        // Get the folder name for the destination
        let newFolderName = 'root';
        if (tokenFolderId) {
          const folder = await get(db, "SELECT name FROM token_folders WHERE id = ?", [tokenFolderId]);
          if (folder) {
            newFolderName = folder.name;
          }
        }

        const newImagePath = `tokens/${token.campaign_id}/${newFolderName}/${filename}`;
        const newPath = resolveTokenPhysicalPath(newImagePath) || path.join(projectRoot, newImagePath);

        // Ensure destination folder exists
        await fs.mkdir(path.dirname(newPath), { recursive: true });

        // Move file on disk
        await fs.rename(oldPath, newPath);
        console.log('[Token Move] File moved from', oldPath, 'to', newPath);

        // Update database with new folder ID and new image path
        await run(db, "UPDATE tokens SET token_folder_id = ?, image_path = ? WHERE id = ?",
          [tokenFolderId || null, newImagePath, tokenId]);
        console.log('[Token Move] Token moved:', tokenId, 'to folder:', tokenFolderId, 'with new path:', newImagePath);
      } catch (err) {
        console.error('[Token Move] Failed to move file:', err);
        return res.status(500).json({ message: "failed to move token file", error: err.message });
      }
    } else {
      // For base tokens, just update the database
      await run(db, "UPDATE tokens SET token_folder_id = ? WHERE id = ?", [tokenFolderId || null, tokenId]);
      console.log('[Token Move] Base token folder updated:', tokenId, 'to folder:', tokenFolderId);
    }

    const updated = await get(db, "SELECT * FROM tokens WHERE id = ?", [tokenId]);
    return res.json(updated);
  } catch (error) {
    console.error("Move token failed:", error);
    return res.status(500).json({ message: "move token failed", error: error.message });
  }
});

app.delete("/api/tokens/:tokenId", async (req, res) => {
  try {
    const { tokenId } = req.params;

    const token = await get(db, "SELECT * FROM tokens WHERE id = ?", [tokenId]);
    if (!token) {
      return res.status(404).json({ message: "token not found" });
    }

    // Prevent deleting base tokens
    if (token.is_base_token) {
      return res.status(403).json({ message: "cannot delete base tokens" });
    }

    // Check if token is used on any maps
    const [mapTokens] = await db.execute("SELECT COUNT(*) as count FROM map_tokens WHERE token_id = ?", [tokenId]);
    const usageCount = mapTokens[0]?.count || 0;

    if (usageCount > 0) {
      return res.status(409).json({
        message: "token in use",
        usageCount,
        confirmDelete: true
      });
    }

    // Delete physical file
    const physicalPath = resolveTokenPhysicalPath(token.image_path) || path.join(projectRoot, token.image_path);
    try {
      await fs.unlink(physicalPath);
      console.log('[Delete Token] Deleted token file:', token.name);
    } catch (err) {
      console.error('[Delete Token] Failed to delete token file:', err);
    }

    // Delete from database (CASCADE will delete from map_tokens)
    await run(db, "DELETE FROM tokens WHERE id = ?", [tokenId]);
    console.log('[Delete Token] Token deleted from database');

    return res.json({ message: "token deleted" });
  } catch (error) {
    console.error("Delete token failed:", error);
    return res.status(500).json({ message: "token deletion failed" });
  }
});

// Force delete token (when user confirms)
app.delete("/api/tokens/:tokenId/force", async (req, res) => {
  try {
    const { tokenId } = req.params;

    const token = await get(db, "SELECT * FROM tokens WHERE id = ?", [tokenId]);
    if (!token) {
      return res.status(404).json({ message: "token not found" });
    }

    // Prevent deleting base tokens
    if (token.is_base_token) {
      return res.status(403).json({ message: "cannot delete base tokens" });
    }

    // Delete physical file
    const physicalPath = resolveTokenPhysicalPath(token.image_path) || path.join(projectRoot, token.image_path);
    try {
      await fs.unlink(physicalPath);
      console.log('[Force Delete Token] Deleted token file:', token.name);
    } catch (err) {
      console.error('[Force Delete Token] Failed to delete token file:', err);
    }

    // Delete from database (CASCADE will delete from map_tokens)
    await run(db, "DELETE FROM tokens WHERE id = ?", [tokenId]);
    console.log('[Force Delete Token] Token and all placements deleted');

    return res.json({ message: "token deleted" });
  } catch (error) {
    console.error("Force delete token failed:", error);
    return res.status(500).json({ message: "token deletion failed" });
  }
});

// Map Token Endpoints

// Add token to map
app.post("/api/maps/:mapId/tokens", async (req, res) => {
  try {
    const { mapId } = req.params;
    const { tokenId, x, y, size } = req.body || {};

    console.log('[Add map token] Request:', { mapId, tokenId, x, y, size });

    if (!tokenId || x === undefined || y === undefined) {
      return res.status(400).json({ message: "tokenId, x, and y are required" });
    }

    // Verify map exists
    const map = await get(db, "SELECT * FROM maps WHERE id = ?", [mapId]);
    if (!map) {
      console.log('[Add map token] Map not found:', mapId);
      return res.status(404).json({ message: "map not found" });
    }

    // Verify token exists (base tokens are now pre-populated, so they should exist)
    const token = await get(db, "SELECT * FROM tokens WHERE id = ?", [tokenId]);
    if (!token) {
      console.log('[Add map token] Token not found:', tokenId);
      return res.status(404).json({ message: "token not found" });
    }

    const id = uuidv4();
    const tokenSize = size || 1;

    console.log('[Add map token] Inserting map_token:', { id, mapId, tokenId, x, y, tokenSize });

    await run(
      db,
      "INSERT INTO map_tokens (id, map_id, token_id, x, y, size) VALUES (?, ?, ?, ?, ?, ?)",
      [id, mapId, tokenId, x, y, tokenSize]
    );

    const mapToken = await get(db, "SELECT * FROM map_tokens WHERE id = ?", [id]);
    console.log('[Add map token] Success:', mapToken);

    return res.json(mapToken);
  } catch (error) {
    console.error("Add map token failed:", error);
    return res.status(500).json({ message: "failed to add token to map" });
  }
});

// Get tokens on map
app.get("/api/maps/:mapId/tokens", async (req, res) => {
  try {
    const { mapId } = req.params;

    const [mapTokens] = await db.execute(
      `SELECT mt.*, t.name, t.image_path, t.is_base_token 
       FROM map_tokens mt 
       JOIN tokens t ON mt.token_id = t.id 
       WHERE mt.map_id = ?`,
      [mapId]
    );

    return res.json(mapTokens);
  } catch (error) {
    console.error("Get map tokens failed:", error);
    return res.status(500).json({ message: "failed to get map tokens" });
  }
});

// Update token on map (position, size, visibility, transparency, name, border color)
app.patch("/api/map-tokens/:mapTokenId", async (req, res) => {
  try {
    const { mapTokenId } = req.params;
    const { x, y, size, is_visible_to_players, transparency, token_instance_name, border_color, player_moveable, conditions } = req.body || {};

    const mapToken = await get(db, "SELECT * FROM map_tokens WHERE id = ?", [mapTokenId]);
    if (!mapToken) {
      return res.status(404).json({ message: "map token not found" });
    }

    const updates = [];
    const values = [];

    if (x !== undefined) {
      updates.push("x = ?");
      values.push(x);
    }

    if (y !== undefined) {
      updates.push("y = ?");
      values.push(y);
    }

    if (size !== undefined) {
      updates.push("size = ?");
      values.push(size);
    }

    if (is_visible_to_players !== undefined) {
      updates.push("is_visible_to_players = ?");
      values.push(is_visible_to_players ? 1 : 0);
    }

    if (transparency !== undefined) {
      updates.push("transparency = ?");
      values.push(transparency);
    }

    if (token_instance_name !== undefined) {
      updates.push("token_instance_name = ?");
      values.push(token_instance_name || null);
    }

    if (border_color !== undefined) {
      updates.push("border_color = ?");
      values.push(border_color || null);
    }

    if (player_moveable !== undefined) {
      updates.push("player_moveable = ?");
      values.push(player_moveable ? 1 : 0);
    }

    if (conditions !== undefined) {
      updates.push("conditions = ?");
      values.push(conditions || null);
    }

    if (updates.length > 0) {
      values.push(mapTokenId);
      await run(db, `UPDATE map_tokens SET ${updates.join(", ")} WHERE id = ?`, values);
    }

    // Get the FULL token data including image_path from the tokens table
    const [updatedTokens] = await db.execute(
      `SELECT mt.*, t.name, t.image_path, t.is_base_token 
       FROM map_tokens mt 
       JOIN tokens t ON mt.token_id = t.id 
       WHERE mt.id = ?`,
      [mapTokenId]
    );
    const updated = updatedTokens[0];

    // Get the map to find the campaign ID for broadcasting
    const map = await get(db, "SELECT campaign_id FROM maps WHERE id = ?", [mapToken.map_id]);
    if (map) {
      // Broadcast token update to all clients of this campaign
      broadcastTokenUpdate(map.campaign_id, {
        type: 'token_update',
        mapId: mapToken.map_id,
        mapToken: updated,
        timestamp: Date.now()
      });
    }

    return res.json(updated);
  } catch (error) {
    console.error("Update map token failed:", error);
    return res.status(500).json({ message: "failed to update map token" });
  }
});

// Remove token from map
app.delete("/api/map-tokens/:mapTokenId", async (req, res) => {
  try {
    const { mapTokenId } = req.params;

    const mapToken = await get(db, "SELECT * FROM map_tokens WHERE id = ?", [mapTokenId]);
    if (!mapToken) {
      return res.status(404).json({ message: "map token not found" });
    }

    await run(db, "DELETE FROM map_tokens WHERE id = ?", [mapTokenId]);

    return res.json({ message: "token removed from map" });
  } catch (error) {
    console.error("Remove map token failed:", error);
    return res.status(500).json({ message: "failed to remove token from map" });
  }
});

// Active map endpoints
app.post("/api/campaigns/:campaignId/active-map", async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { mapId } = req.body || {};

    // Verify campaign exists
    const campaign = await get(db, "SELECT id FROM campaigns WHERE id = ?", [campaignId]);
    if (!campaign) {
      return res.status(404).json({ message: "campaign not found" });
    }

    // If mapId provided, verify it exists
    if (mapId) {
      const map = await get(db, "SELECT id FROM maps WHERE id = ? AND campaign_id = ?", [mapId, campaignId]);
      if (!map) {
        return res.status(404).json({ message: "map not found" });
      }
    }

    // Insert or update campaign state
    await run(
      db,
      "INSERT INTO campaign_state (campaign_id, active_map_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE active_map_id = ?",
      [campaignId, mapId || null, mapId || null]
    );

    return res.json({ campaign_id: campaignId, active_map_id: mapId || null });
  } catch (error) {
    console.error("Set active map failed:", error);
    return res.status(500).json({ message: "failed to set active map" });
  }
});

app.get("/api/campaigns/:campaignId/active-map", async (req, res) => {
  try {
    const { campaignId } = req.params;

    const state = await get(db, "SELECT active_map_id FROM campaign_state WHERE campaign_id = ?", [campaignId]);

    if (!state || !state.active_map_id) {
      return res.json({ campaign_id: campaignId, active_map_id: null, map: null });
    }

    // Get the full map details
    const map = await get(
      db,
      "SELECT id, campaign_id, folder_id, name, filename, filepath, width, height, grid_enabled, grid_cols, grid_rows, grid_color, grid_opacity, created_at FROM maps WHERE id = ?",
      [state.active_map_id]
    );

    // Convert TINYINT(1) to proper boolean for grid_enabled
    if (map) {
      map.grid_enabled = Boolean(map.grid_enabled);
    }

    return res.json({ campaign_id: campaignId, active_map_id: state.active_map_id, map: map || null });
  } catch (error) {
    console.error("Get active map failed:", error);
    return res.status(500).json({ message: "failed to get active map" });
  }
});

// ===== PLAYER STATS ENDPOINTS =====

// Get player stats for a campaign
app.get("/api/campaigns/:campaignId/player-stats", async (req, res) => {
  try {
    const { campaignId } = req.params;
    const [stats] = await db.execute(
      `SELECT id, user_id,
       COALESCE(player_name, (SELECT username FROM users WHERE id = player_stats.user_id)) as username,
       current_hp, max_hp, armor_class
       FROM player_stats
       WHERE campaign_id = ?
       ORDER BY username ASC`,
      [campaignId]
    );
    res.json(stats);
  } catch (error) {
    console.error("Get player stats failed:", error);
    res.status(500).json({ message: "failed to get player stats" });
  }
});

// Update/Create player stats (HP and AC)
app.post("/api/campaigns/:campaignId/player-stats", async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { userId, statId, playerName, currentHp, maxHp, armorClass } = req.body;

    if (playerName && !userId) {
      // Creating new DM-controlled player tracker with player_name
      const id = uuidv4();

      await run(
        db,
        `INSERT INTO player_stats (id, campaign_id, user_id, player_name, current_hp, max_hp, armor_class)
         VALUES (?, ?, NULL, ?, ?, ?, ?)`,
        [id, campaignId, playerName, currentHp || 0, maxHp || 0, armorClass || null]
      );

      res.json({ success: true, id });
    } else if (statId) {
      // Updating DM-created player tracker by stat ID
      await run(
        db,
        `UPDATE player_stats SET current_hp = ?, max_hp = ?, armor_class = ?
         WHERE id = ? AND campaign_id = ?`,
        [currentHp, maxHp, armorClass, statId, campaignId]
      );
      res.json({ success: true });
    } else if (userId) {
      // Updating existing tracker by user_id
      await run(
        db,
        `UPDATE player_stats SET current_hp = ?, max_hp = ?, armor_class = ?
         WHERE campaign_id = ? AND user_id = ?`,
        [currentHp, maxHp, armorClass, campaignId, userId]
      );
      res.json({ success: true });
    }
  } catch (error) {
    console.error("Update player stats failed:", error);
    res.status(500).json({ message: "failed to update player stats" });
  }
});

// Delete player stats
app.delete("/api/player-stats/:statId", async (req, res) => {
  try {
    const { statId } = req.params;
    await run(
      db,
      `DELETE FROM player_stats WHERE id = ?`,
      [statId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Delete player stats failed:", error);
    res.status(500).json({ message: "failed to delete player stats" });
  }
});

// Update player stats name
app.patch("/api/player-stats/:statId", async (req, res) => {
  try {
    const { statId } = req.params;
    const { playerName } = req.body;

    await run(
      db,
      `UPDATE player_stats SET player_name = ? WHERE id = ?`,
      [playerName, statId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Update player stats name failed:", error);
    res.status(500).json({ message: "failed to update player stats name" });
  }
});

// ===== ENCOUNTER NPC ENDPOINTS =====

// Get encounter NPCs for a map
app.get("/api/maps/:mapId/encounter-npcs", async (req, res) => {
  try {
    const { mapId } = req.params;
    const [npcs] = await db.execute(
      `SELECT id, name, current_hp, max_hp, armor_class FROM encounter_npcs
       WHERE map_id = ?
       ORDER BY name ASC`,
      [mapId]
    );
    res.json(npcs);
  } catch (error) {
    console.error("Get encounter NPCs failed:", error);
    res.status(500).json({ message: "failed to get encounter NPCs" });
  }
});

// Create new encounter NPC
app.post("/api/campaigns/:campaignId/maps/:mapId/encounter-npcs", async (req, res) => {
  try {
    const { campaignId, mapId } = req.params;
    const { name, currentHp = 0, maxHp = 0, armorClass } = req.body;

    const id = uuidv4();
    await run(
      db,
      `INSERT INTO encounter_npcs (id, campaign_id, map_id, name, current_hp, max_hp, armor_class)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, campaignId, mapId, name, currentHp, maxHp, armorClass]
    );

    res.json({ id, name, current_hp: currentHp, max_hp: maxHp, armor_class: armorClass });
  } catch (error) {
    console.error("Create encounter NPC failed:", error);
    res.status(500).json({ message: "failed to create encounter NPC" });
  }
});

// Update encounter NPC
app.patch("/api/encounter-npcs/:npcId", async (req, res) => {
  try {
    const { npcId } = req.params;
    const { name, currentHp, maxHp, armorClass } = req.body;

    await run(
      db,
      `UPDATE encounter_npcs SET name = ?, current_hp = ?, max_hp = ?, armor_class = ? WHERE id = ?`,
      [name, currentHp, maxHp, armorClass, npcId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Update encounter NPC failed:", error);
    res.status(500).json({ message: "failed to update encounter NPC" });
  }
});

// Delete encounter NPC
app.delete("/api/encounter-npcs/:npcId", async (req, res) => {
  try {
    const { npcId } = req.params;
    await run(db, "DELETE FROM encounter_npcs WHERE id = ?", [npcId]);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete encounter NPC failed:", error);
    res.status(500).json({ message: "failed to delete encounter NPC" });
  }
});

// ===== INITIATIVE TRACKER ENDPOINTS =====

// Get initiative entries for a specific map
app.get("/api/maps/:mapId/initiative", async (req, res) => {
  try {
    const { mapId } = req.params;
    const initiatives = await db.query(
      `SELECT 
        it.id,
        it.map_id,
        it.map_token_id,
        it.initiative_value,
        it.sort_order,
        COALESCE(mt.token_instance_name, t.name) as token_name,
        t.image_path as token_image,
        t.is_base_token as is_base_token,
        mt.border_color as token_border_color
       FROM initiative_tracker it
       JOIN map_tokens mt ON it.map_token_id = mt.id
       JOIN tokens t ON mt.token_id = t.id
       WHERE it.map_id = ?
       ORDER BY it.initiative_value DESC, it.sort_order ASC`,
      [mapId]
    );
    res.json(initiatives[0] || []);
  } catch (error) {
    console.error("Get initiative failed:", error);
    res.status(500).json({ message: "failed to get initiative" });
  }
});

// Add token to initiative
app.post("/api/maps/:mapId/initiative", async (req, res) => {
  try {
    const { mapId } = req.params;
    const { mapTokenId, initiativeValue } = req.body;

    // Validate initiative value
    if (initiativeValue < 1 || initiativeValue > 40) {
      return res.status(400).json({ message: "Initiative value must be between 1 and 40" });
    }

    // Check if token already in initiative
    const existing = await get(
      db,
      "SELECT id FROM initiative_tracker WHERE map_id = ? AND map_token_id = ?",
      [mapId, mapTokenId]
    );

    if (existing) {
      return res.status(400).json({ message: "Token already in initiative tracker" });
    }

    // Get the highest sort_order for this initiative value
    const maxSort = await get(
      db,
      "SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM initiative_tracker WHERE map_id = ? AND initiative_value = ?",
      [mapId, initiativeValue]
    );

    const id = uuidv4();
    const sortOrder = (maxSort?.max_sort || 0) + 1;

    await run(
      db,
      `INSERT INTO initiative_tracker (id, map_id, map_token_id, initiative_value, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [id, mapId, mapTokenId, initiativeValue, sortOrder]
    );

    // Fetch the newly created entry with token details
    const initiatives = await db.query(
      `SELECT 
        it.id,
        it.map_id,
        it.map_token_id,
        it.initiative_value,
        it.sort_order,
        COALESCE(mt.token_instance_name, t.name) as token_name,
        t.image_path as token_image,
        t.is_base_token as is_base_token,
        mt.border_color as token_border_color
       FROM initiative_tracker it
       JOIN map_tokens mt ON it.map_token_id = mt.id
       JOIN tokens t ON mt.token_id = t.id
       WHERE it.id = ?`,
      [id]
    );

    res.json(initiatives[0][0]);
  } catch (error) {
    console.error("Add to initiative failed:", error);
    res.status(500).json({ message: "failed to add to initiative" });
  }
});

// Update initiative value
app.patch("/api/initiative/:initiativeId", async (req, res) => {
  try {
    const { initiativeId } = req.params;
    const { initiativeValue } = req.body;

    // Validate initiative value
    if (initiativeValue < 1 || initiativeValue > 40) {
      return res.status(400).json({ message: "Initiative value must be between 1 and 40" });
    }

    // Get current entry
    const current = await get(
      db,
      "SELECT map_id, initiative_value FROM initiative_tracker WHERE id = ?",
      [initiativeId]
    );

    if (!current) {
      return res.status(404).json({ message: "Initiative entry not found" });
    }

    // If changing initiative value, reset sort_order
    if (current.initiative_value !== initiativeValue) {
      const maxSort = await get(
        db,
        "SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM initiative_tracker WHERE map_id = ? AND initiative_value = ?",
        [current.map_id, initiativeValue]
      );
      const sortOrder = (maxSort?.max_sort || 0) + 1;

      await run(
        db,
        "UPDATE initiative_tracker SET initiative_value = ?, sort_order = ? WHERE id = ?",
        [initiativeValue, sortOrder, initiativeId]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Update initiative failed:", error);
    res.status(500).json({ message: "failed to update initiative" });
  }
});

// Remove from initiative
app.delete("/api/initiative/:initiativeId", async (req, res) => {
  try {
    const { initiativeId } = req.params;
    await run(db, "DELETE FROM initiative_tracker WHERE id = ?", [initiativeId]);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete initiative failed:", error);
    res.status(500).json({ message: "failed to delete initiative" });
  }
});

// Clear all initiative for a map
app.delete("/api/maps/:mapId/initiative", async (req, res) => {
  try {
    const { mapId } = req.params;
    await run(db, "DELETE FROM initiative_tracker WHERE map_id = ?", [mapId]);
    res.json({ success: true });
  } catch (error) {
    console.error("Clear initiative failed:", error);
    res.status(500).json({ message: "failed to clear initiative" });
  }
});

// ===== MAP NOTES ENDPOINTS =====

// Get map notes for a specific map
app.get("/api/campaigns/:campaignId/maps/:mapId/notes", async (req, res) => {
  try {
    const { campaignId, mapId } = req.params;
    const notes = await get(
      db,
      `SELECT id, content FROM map_notes WHERE campaign_id = ? AND map_id = ?`,
      [campaignId, mapId]
    );
    res.json(notes || { id: null, content: "" });
  } catch (error) {
    console.error("Get map notes failed:", error);
    res.status(500).json({ message: "failed to get map notes" });
  }
});

// Save/Update map notes
app.post("/api/campaigns/:campaignId/maps/:mapId/notes", async (req, res) => {
  try {
    const { campaignId, mapId } = req.params;
    const { content } = req.body;

    const existingNotes = await get(
      db,
      "SELECT id FROM map_notes WHERE campaign_id = ? AND map_id = ?",
      [campaignId, mapId]
    );

    if (existingNotes) {
      await run(
        db,
        "UPDATE map_notes SET content = ? WHERE campaign_id = ? AND map_id = ?",
        [content, campaignId, mapId]
      );
    } else {
      const id = uuidv4();
      await run(
        db,
        "INSERT INTO map_notes (id, campaign_id, map_id, content) VALUES (?, ?, ?, ?)",
        [id, campaignId, mapId, content]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Save map notes failed:", error);
    res.status(500).json({ message: "failed to save map notes" });
  }
});

// ===== TOKEN GROUPS ENDPOINTS =====

// Create a new token group
app.post("/api/campaigns/:campaignId/token-groups", async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { name } = req.body || {};

    if (isMissing(name)) {
      return res.status(400).json({ message: "group name is required" });
    }

    const campaign = await get(db, "SELECT id FROM campaigns WHERE id = ?", [campaignId]);
    if (!campaign) {
      return res.status(404).json({ message: "campaign not found" });
    }

    const id = uuidv4();

    await run(
      db,
      "INSERT INTO token_groups (id, campaign_id, name) VALUES (?, ?, ?)",
      [id, campaignId, name]
    );

    res.status(201).json({ id, campaign_id: campaignId, name, members: [] });
  } catch (error) {
    console.error("Create token group failed:", error);
    res.status(500).json({ message: "failed to create token group" });
  }
});

// Get all token groups for a campaign with their members
app.get("/api/campaigns/:campaignId/token-groups", async (req, res) => {
  try {
    const { campaignId } = req.params;

    const [groups] = await db.execute(
      "SELECT id, campaign_id, name, created_at FROM token_groups WHERE campaign_id = ? ORDER BY name",
      [campaignId]
    );

    // For each group, fetch its members
    const groupsWithMembers = await Promise.all(
      groups.map(async (group) => {
        const [members] = await db.execute(
          `SELECT mt.id, mt.is_visible_to_players 
           FROM token_group_members tgm
           JOIN map_tokens mt ON tgm.map_token_id = mt.id
           WHERE tgm.group_id = ?`,
          [group.id]
        );

        return {
          ...group,
          members: members.map(m => ({
            map_token_id: m.id,
            is_visible_to_players: Boolean(m.is_visible_to_players)
          }))
        };
      })
    );

    res.json(groupsWithMembers);
  } catch (error) {
    console.error("Get token groups failed:", error);
    res.status(500).json({ message: "failed to get token groups" });
  }
});

// Update token group name
app.patch("/api/token-groups/:groupId", async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name } = req.body || {};

    if (isMissing(name)) {
      return res.status(400).json({ message: "group name is required" });
    }

    const group = await get(db, "SELECT id FROM token_groups WHERE id = ?", [groupId]);
    if (!group) {
      return res.status(404).json({ message: "token group not found" });
    }

    await run(
      db,
      "UPDATE token_groups SET name = ? WHERE id = ?",
      [name, groupId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Update token group failed:", error);
    res.status(500).json({ message: "failed to update token group" });
  }
});

// Delete token group
app.delete("/api/token-groups/:groupId", async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await get(db, "SELECT id FROM token_groups WHERE id = ?", [groupId]);
    if (!group) {
      return res.status(404).json({ message: "token group not found" });
    }

    // Members will be automatically deleted due to CASCADE constraint
    await run(db, "DELETE FROM token_groups WHERE id = ?", [groupId]);

    res.json({ success: true });
  } catch (error) {
    console.error("Delete token group failed:", error);
    res.status(500).json({ message: "failed to delete token group" });
  }
});

// Add token to group
app.post("/api/token-groups/:groupId/members", async (req, res) => {
  try {
    const { groupId } = req.params;
    const { mapTokenId } = req.body || {};

    if (isMissing(mapTokenId)) {
      return res.status(400).json({ message: "mapTokenId is required" });
    }

    // Verify group exists
    const group = await get(db, "SELECT id FROM token_groups WHERE id = ?", [groupId]);
    if (!group) {
      return res.status(404).json({ message: "token group not found" });
    }

    // Verify map token exists
    const mapToken = await get(db, "SELECT id FROM map_tokens WHERE id = ?", [mapTokenId]);
    if (!mapToken) {
      return res.status(404).json({ message: "map token not found" });
    }

    // Check if already member
    const existing = await get(
      db,
      "SELECT id FROM token_group_members WHERE group_id = ? AND map_token_id = ?",
      [groupId, mapTokenId]
    );

    if (existing) {
      return res.status(409).json({ message: "token is already in this group" });
    }

    const memberId = uuidv4();

    await run(
      db,
      "INSERT INTO token_group_members (id, group_id, map_token_id) VALUES (?, ?, ?)",
      [memberId, groupId, mapTokenId]
    );

    res.status(201).json({ success: true, memberId });
  } catch (error) {
    console.error("Add token to group failed:", error);
    res.status(500).json({ message: "failed to add token to group" });
  }
});

// Remove token from group
app.delete("/api/token-groups/:groupId/members/:mapTokenId", async (req, res) => {
  try {
    const { groupId, mapTokenId } = req.params;

    const membership = await get(
      db,
      "SELECT id FROM token_group_members WHERE group_id = ? AND map_token_id = ?",
      [groupId, mapTokenId]
    );

    if (!membership) {
      return res.status(404).json({ message: "token not in this group" });
    }

    await run(
      db,
      "DELETE FROM token_group_members WHERE group_id = ? AND map_token_id = ?",
      [groupId, mapTokenId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Remove token from group failed:", error);
    res.status(500).json({ message: "failed to remove token from group" });
  }
});

// Toggle visibility for all tokens in a group
app.patch("/api/token-groups/:groupId/visibility", async (req, res) => {
  try {
    const { groupId } = req.params;
    const { visible } = req.body;

    if (typeof visible !== 'boolean') {
      return res.status(400).json({ message: "visible boolean is required" });
    }

    // Verify group exists
    const group = await get(db, "SELECT id FROM token_groups WHERE id = ?", [groupId]);
    if (!group) {
      return res.status(404).json({ message: "token group not found" });
    }

    // Get all member tokens
    const [members] = await db.execute(
      "SELECT map_token_id FROM token_group_members WHERE group_id = ?",
      [groupId]
    );

    if (members.length === 0) {
      return res.json({ success: true, updated: 0 });
    }

    // Update all member tokens
    const transparency = visible ? 1.0 : 0.25;
    const placeholders = members.map(() => "?").join(",");
    const tokenIds = members.map(m => m.map_token_id);

    await run(
      db,
      `UPDATE map_tokens SET is_visible_to_players = ?, transparency = ? WHERE id IN (${placeholders})`,
      [visible ? 1 : 0, transparency, ...tokenIds]
    );

    res.json({ success: true, updated: members.length });
  } catch (error) {
    console.error("Toggle group visibility failed:", error);
    res.status(500).json({ message: "failed to toggle group visibility" });
  }
});

// ===== BUG REPORTS ENDPOINTS =====

// Get all bug reports
app.get("/api/bug-reports", async (req, res) => {
  try {
    const [reports] = await db.execute(
      "SELECT id, user_id, username, content, created_at FROM bug_reports ORDER BY created_at DESC"
    );

    res.json(reports || []);
  } catch (error) {
    console.error("Get bug reports failed:", error);
    res.status(500).json({ message: "failed to fetch bug reports" });
  }
});

// Create a new bug report
app.post("/api/bug-reports", async (req, res) => {
  try {
    const { userId, username, content } = req.body;

    if (!userId || !username || !content) {
      return res.status(400).json({ message: "userId, username, and content are required" });
    }

    const id = uuidv4();
    await run(
      db,
      "INSERT INTO bug_reports (id, user_id, username, content) VALUES (?, ?, ?, ?)",
      [id, userId, username, content]
    );

    // Return the created report
    const [report] = await db.execute(
      "SELECT id, user_id, username, content, created_at FROM bug_reports WHERE id = ?",
      [id]
    );

    res.json(report[0]);
  } catch (error) {
    console.error("Create bug report failed:", error);
    res.status(500).json({ message: "failed to create bug report" });
  }
});

// Delete a bug report (admin only - for now just the user who created it)
app.delete("/api/bug-reports/:reportId", async (req, res) => {
  try {
    const { reportId } = req.params;
    const { userId } = req.body;

    if (isMissing(userId)) {
      return res.status(400).json({ message: "userId is required" });
    }

    const user = await get(
      db,
      "SELECT id, role FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    const report = await get(
      db,
      "SELECT user_id FROM bug_reports WHERE id = ?",
      [reportId]
    );

    if (!report) {
      return res.status(404).json({ message: "bug report not found" });
    }

    const isAdmin = String(user.role || "user").toLowerCase() === "admin";
    const isOwner = report.user_id === userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "you can only delete your own bug reports" });
    }

    await run(
      db,
      "DELETE FROM bug_reports WHERE id = ?",
      [reportId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Delete bug report failed:", error);
    res.status(500).json({ message: "failed to delete bug report" });
  }
});

async function runDbCheck() {
  const checkDb = await openDatabase();
  try {
    await ensureSchema(checkDb);
    const row = await get(
      checkDb,
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'metadata'"
    );

    console.log(`MySQL ready at ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    console.log(`Table metadata exists: ${Boolean(row)}`);
  } finally {
    await checkDb.end();
  }
}

async function main() {
  if (process.argv.includes("--check")) {
    try {
      await runDbCheck();
      return;
    } catch (error) {
      console.error("DB check failed:", error);
      process.exitCode = 1;
      return;
    }
  }

  try {
    await initDatabase();
    // Presence is now tracked via SSE connections - no need for sweep interval

    app.listen(port, () => {
      console.log(`API running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Server init failed:", error);
    process.exitCode = 1;
  }
}

main();
