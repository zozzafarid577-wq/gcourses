const crypto = require('crypto');

function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, b, s] = parts;
    const expected = crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest('base64url');
    if (s !== expected) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) { res.status(500).json({ error: 'JWT_SECRET not configured' }); return; }

  let body = req.body;
  if (typeof body === 'string') body = JSON.parse(body || '{}');
  const { token } = body || {};
  if (!token) { res.status(400).json({ valid: false, error: 'Missing token' }); return; }

  const payload = verifyToken(token, jwtSecret);
  if (!payload) {
    res.status(200).json({ valid: false });
    return;
  }

  res.status(200).json({ valid: true, email: payload.email });
};
