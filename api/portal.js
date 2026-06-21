// Single portal endpoint (kept as one Serverless Function to stay under
// Vercel's function limit). Dispatches on body.action:
//   data   — return the curriculum + whether the caller is an admin
//   save   — admin-only; persist the whole curriculum to Vercel KV
//   upload — admin-only; optional direct file upload to Vercel Blob
const {
  authFromRequest, isAdminEmail, getCurriculum, saveCurriculum, kvConfigured
} = require('./_portal');

const MAX_UPLOAD = 4 * 1024 * 1024;

async function handleUpload(req, res, payload, body) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) { res.status(503).json({ error: 'Direct upload is not set up yet. Paste a link instead, or add a Vercel Blob store (BLOB_READ_WRITE_TOKEN).' }); return; }
  if (!isAdminEmail(payload.email)) { res.status(403).json({ error: 'Admins only' }); return; }

  const { filename, contentType, dataBase64 } = body || {};
  if (!filename || !dataBase64) { res.status(400).json({ error: 'Missing filename or file data' }); return; }
  let bytes;
  try { bytes = Buffer.from(dataBase64, 'base64'); } catch (_) { res.status(400).json({ error: 'Could not decode file' }); return; }
  if (bytes.length > MAX_UPLOAD) { res.status(413).json({ error: 'File is larger than 4 MB. Please upload it to Drive/YouTube and paste the link instead.' }); return; }

  const safe = String(filename).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80);
  const pathname = `portal/${Date.now()}-${safe}`;
  try {
    const r = await fetch(`https://blob.vercel-storage.com/${pathname}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        'x-api-version': '7',
        'x-content-type': contentType || 'application/octet-stream',
        'x-add-random-suffix': '1',
        'access': 'public'
      },
      body: bytes
    });
    const text = await r.text();
    if (!r.ok) { res.status(502).json({ error: 'Upload failed: ' + text }); return; }
    const data = JSON.parse(text);
    res.status(200).json({ success: true, url: data.url || data.downloadUrl, pathname: data.pathname });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!process.env.JWT_SECRET) { res.status(500).json({ error: 'JWT_SECRET not configured' }); return; }

  const payload = authFromRequest(req);
  if (!payload) { res.status(401).json({ error: 'Not authorised' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch (_) { body = {}; } }
  const action = (body && body.action) || 'data';

  try {
    if (action === 'data') {
      const curriculum = await getCurriculum();
      res.status(200).json({
        curriculum,
        email: payload.email,
        isAdmin: isAdminEmail(payload.email),
        storage: kvConfigured() ? 'kv' : 'none'
      });
      return;
    }

    if (action === 'save') {
      if (!kvConfigured()) { res.status(503).json({ error: 'Storage (Vercel KV) is not configured, so changes cannot be saved.' }); return; }
      if (!isAdminEmail(payload.email)) { res.status(403).json({ error: 'Admins only' }); return; }
      const curriculum = body && body.curriculum;
      if (!curriculum || typeof curriculum !== 'object' || !Array.isArray(curriculum.modules)) {
        res.status(400).json({ error: 'Invalid curriculum payload' }); return;
      }
      if (Buffer.byteLength(JSON.stringify(curriculum)) > 900 * 1024) {
        res.status(413).json({ error: 'Curriculum is too large. Keep large files as links rather than inline text.' }); return;
      }
      const saved = await saveCurriculum(curriculum);
      res.status(200).json({ success: true, updatedAt: saved.updatedAt });
      return;
    }

    if (action === 'upload') { await handleUpload(req, res, payload, body); return; }

    res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
