// Saves the whole curriculum. Admin only. The front-end sends the entire
// curriculum object (modules + lessons) and we persist it as one JSON blob.
const { authFromRequest, isAdminEmail, saveCurriculum, kvConfigured } = require('./_portal');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (!process.env.JWT_SECRET) { res.status(500).json({ error: 'JWT_SECRET not configured' }); return; }
  if (!kvConfigured()) {
    res.status(503).json({ error: 'Storage (Vercel KV) is not configured, so changes cannot be saved.' });
    return;
  }

  const payload = authFromRequest(req);
  if (!payload) { res.status(401).json({ error: 'Not authorised' }); return; }
  if (!isAdminEmail(payload.email)) { res.status(403).json({ error: 'Admins only' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch (_) { body = {}; } }
  const curriculum = body && body.curriculum;
  if (!curriculum || typeof curriculum !== 'object' || !Array.isArray(curriculum.modules)) {
    res.status(400).json({ error: 'Invalid curriculum payload' });
    return;
  }

  // Guard against runaway payloads (KV value limits / accidental loops).
  const size = Buffer.byteLength(JSON.stringify(curriculum));
  if (size > 900 * 1024) {
    res.status(413).json({ error: 'Curriculum is too large. Keep large files as links rather than inline text.' });
    return;
  }

  try {
    const saved = await saveCurriculum(curriculum);
    res.status(200).json({ success: true, updatedAt: saved.updatedAt });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
