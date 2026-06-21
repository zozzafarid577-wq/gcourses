// Shared helpers for the Gcourses learning / revision portal.
// Auth re-uses the same HMAC-signed magic-link token issued by request-login.js.
// Storage uses the same Vercel KV (Upstash Redis REST) instance as the rest of
// the site. Curriculum lives under a single JSON key so it is easy to back up.
const crypto = require('crypto');

const CURRICULUM_KEY = 'portal:curriculum';

// ---- auth -----------------------------------------------------------------
function verifyToken(token, secret) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const [h, b, s] = parts;
    const expected = crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest('base64url');
    if (s !== expected) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload; // { email, exp }
  } catch (_) {
    return null;
  }
}

// Admins are listed in ADMIN_EMAILS (comma separated). Falls back to the
// the built-in admins below, PLUS anything set in ADMIN_EMAILS / SENDER_EMAIL.
// The env list is additive, so a fresh deployment always has a working admin.
const BUILTIN_ADMINS = ['gigiimofarid@gmail.com', 'gcourrrses@gmail.com'];
function isAdminEmail(email) {
  const env = (process.env.ADMIN_EMAILS || process.env.SENDER_EMAIL || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const list = BUILTIN_ADMINS.concat(env);
  return list.includes(String(email || '').trim().toLowerCase());
}

// Reads the bearer token (body.token or Authorization header) and returns the
// verified payload, or null. Sends no response.
function authFromRequest(req) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch (_) { body = {}; } }
  let token = (body && body.token) || '';
  if (!token && req.headers && req.headers.authorization) {
    token = req.headers.authorization.replace(/^Bearer\s+/i, '');
  }
  return verifyToken(token, secret);
}

// ---- KV (Upstash Redis REST, command-array form) --------------------------
function kvConfigured() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvCommand(cmd) {
  const url = process.env.KV_REST_API_URL;
  const tok = process.env.KV_REST_API_TOKEN;
  if (!url || !tok) throw new Error('KV not configured');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  if (!r.ok) throw new Error('KV error ' + r.status + ' ' + (await r.text()));
  const d = await r.json();
  return d.result;
}

const EMPTY_CURRICULUM = {
  title: 'ACT Biology Portal',
  intro: 'Welcome! Work through the modules below — recordings, notes and PDFs are added here as we go.',
  modules: [],
  updatedAt: 0
};

async function getCurriculum() {
  if (!kvConfigured()) return Object.assign({}, EMPTY_CURRICULUM);
  try {
    const raw = await kvCommand(['GET', CURRICULUM_KEY]);
    if (!raw) return Object.assign({}, EMPTY_CURRICULUM);
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(data.modules)) data.modules = [];
    return data;
  } catch (_) {
    return Object.assign({}, EMPTY_CURRICULUM);
  }
}

async function saveCurriculum(curriculum) {
  curriculum.updatedAt = Date.now();
  await kvCommand(['SET', CURRICULUM_KEY, JSON.stringify(curriculum)]);
  return curriculum;
}

module.exports = {
  CURRICULUM_KEY,
  verifyToken,
  isAdminEmail,
  authFromRequest,
  kvConfigured,
  kvCommand,
  getCurriculum,
  saveCurriculum,
  EMPTY_CURRICULUM
};
