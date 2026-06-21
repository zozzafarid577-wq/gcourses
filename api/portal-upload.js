// Optional direct file upload (PDFs, small recordings, images) for admins.
// Uploads to Vercel Blob via its REST API so we don't need an npm dependency.
//
// Requires the BLOB_READ_WRITE_TOKEN env var (Vercel → Storage → Blob).
// If it isn't set, the endpoint reports that clearly and the portal UI falls
// back to pasting a link instead. Because requests pass through a serverless
// function, keep uploads small (~4 MB); use a link for large recordings.
const { authFromRequest, isAdminEmail } = require('./_portal');

const MAX_BYTES = 4 * 1024 * 1024; // stay under the serverless body limit

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!process.env.JWT_SECRET) { res.status(500).json({ error: 'JWT_SECRET not configured' }); return; }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    res.status(503).json({ error: 'Direct upload is not set up yet. Paste a link instead, or add a Vercel Blob store (BLOB_READ_WRITE_TOKEN).' });
    return;
  }

  const payload = authFromRequest(req);
  if (!payload) { res.status(401).json({ error: 'Not authorised' }); return; }
  if (!isAdminEmail(payload.email)) { res.status(403).json({ error: 'Admins only' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch (_) { body = {}; } }
  const { filename, contentType, dataBase64 } = body || {};
  if (!filename || !dataBase64) { res.status(400).json({ error: 'Missing filename or file data' }); return; }

  let bytes;
  try { bytes = Buffer.from(dataBase64, 'base64'); }
  catch (_) { res.status(400).json({ error: 'Could not decode file' }); return; }

  if (bytes.length > MAX_BYTES) {
    res.status(413).json({ error: 'File is larger than 4 MB. Please upload it to Drive/YouTube and paste the link instead.' });
    return;
  }

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
};
