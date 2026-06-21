// Returns the portal curriculum for a logged-in student, plus whether the
// caller is an admin (so the front-end can reveal the editor).
const { authFromRequest, isAdminEmail, getCurriculum, kvConfigured } = require('./_portal');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (!process.env.JWT_SECRET) { res.status(500).json({ error: 'JWT_SECRET not configured' }); return; }

  const payload = authFromRequest(req);
  if (!payload) { res.status(401).json({ error: 'Not authorised' }); return; }

  try {
    const curriculum = await getCurriculum();
    res.status(200).json({
      curriculum,
      email: payload.email,
      isAdmin: isAdminEmail(payload.email),
      storage: kvConfigured() ? 'kv' : 'none'
    });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
