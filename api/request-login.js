// Sends a magic login link to an enrolled student via Brevo.
// Checks APPROVED_EMAILS env var (comma-separated) for authorization.
const crypto = require('crypto');
const { isAdminEmail } = require('./_portal');

const SITE = 'https://gcourses.site';
const LOGO_URL = SITE + '/gcourses-logo.png';

function signToken(email, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    email,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

function buildMagicLinkEmail(name, link) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3e7f3;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3e7f3;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fdfafd;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px rgba(160,80,159,0.15);">
        <tr><td style="background:linear-gradient(135deg,#a0509f,#6b3569);padding:28px 32px;text-align:center;">
          <img src="${LOGO_URL}" alt="Gcourses" height="42" style="height:42px;display:inline-block;" />
          <div style="color:#f3e7f3;font-size:13px;letter-spacing:0.08em;margin-top:8px;">STUDY PORTAL · MAGIC LOGIN LINK</div>
        </td></tr>
        <tr><td style="padding:32px 32px 10px;">
          <p style="margin:0 0 16px;font-size:16px;color:#2e1a2e;">Hi${name ? ' ' + name : ''},</p>
          <p style="margin:0 0 24px;font-size:15px;color:#6b3569;line-height:1.6;">Click the button below to log in to Gcourses. This link is valid for <strong>24 hours</strong> and can only be used once.</p>
          <a href="${link}" style="display:inline-block;background:#a0509f;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 30px;border-radius:100px;">Log in to Gcourses →</a>
          <p style="margin:20px 0 0;font-size:12px;color:#8a6a88;">If the button doesn't work, copy this link:<br/><a href="${link}" style="color:#a0509f;word-break:break-all;">${link}</a></p>
        </td></tr>
        <tr><td style="padding:18px 32px 28px;">
          <p style="margin:0;font-size:12px;color:#8a6a88;">If you didn't request this, you can safely ignore this email.</p>
        </td></tr>
        <tr><td style="background:#3b1a3a;padding:16px 32px;text-align:center;">
          <a href="${SITE}" style="color:#dab5d5;font-size:12px;text-decoration:none;">gcourses.site</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;
}

// Checks the Vercel KV "enrolled" set (paid buyers). Returns false if KV is not configured.
async function kvIsEnrolled(email) {
  const url = process.env.KV_REST_API_URL;
  const tok = process.env.KV_REST_API_TOKEN;
  if (!url || !tok) return false;
  try {
    const r = await fetch(`${url}/sismember/enrolled/${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${tok}` }
    });
    if (!r.ok) return false;
    const d = await r.json();
    return d && (d.result === 1 || d.result === '1');
  } catch (_) { return false; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const apiKey = process.env.BREVO_API_KEY;
  const jwtSecret = process.env.JWT_SECRET;
  if (!apiKey) { res.status(500).json({ error: 'BREVO_API_KEY not configured' }); return; }
  if (!jwtSecret) { res.status(500).json({ error: 'JWT_SECRET not configured' }); return; }

  let body = req.body;
  if (typeof body === 'string') body = JSON.parse(body || '{}');
  const { email } = body || {};
  if (!email) { res.status(400).json({ error: 'Missing email' }); return; }

  const approved = (process.env.APPROVED_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  const emailLower = email.trim().toLowerCase();

  // Approved if manually whitelisted, a portal admin, OR auto-enrolled (KV).
  let allowed = approved.includes(emailLower);
  if (!allowed) allowed = isAdminEmail(emailLower);
  if (!allowed) allowed = await kvIsEnrolled(emailLower);

  // Always return success to prevent email enumeration
  if (!allowed) {
    // Silently do nothing but return success
    res.status(200).json({ success: true });
    return;
  }

  const token = signToken(emailLower, jwtSecret);
  const link = `${SITE}/login.html?token=${encodeURIComponent(token)}`;

  const SENDER_EMAIL = process.env.SENDER_EMAIL || 'gigiimofarid@gmail.com';
  const SENDER_NAME = process.env.SENDER_NAME || 'Gcourses · Gigi';

  const payload = {
    sender: { name: SENDER_NAME, email: SENDER_EMAIL },
    to: [{ email: emailLower }],
    replyTo: { email: SENDER_EMAIL, name: SENDER_NAME },
    subject: 'Your Gcourses login link',
    htmlContent: buildMagicLinkEmail('', link)
  };

  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (r.ok) { res.status(200).json({ success: true }); }
    else { const t = await r.text(); res.status(502).json({ success: false, error: t }); }
  } catch (e) {
    res.status(500).json({ success: false, error: String(e && e.message || e) });
  }
};
