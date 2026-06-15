// Shared enrollment helpers: issue a login token, persist the buyer, and email
// them their one-click magic login link (Brevo). Used by the PayPal and Instapay flows.
const crypto = require('crypto');

const SITE = process.env.SITE_URL || 'https://gcourses.site';
const LOGO_URL = SITE + '/gcourses-logo.png';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function signLoginToken(email, secret, days) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    email,
    exp: Date.now() + days * 24 * 60 * 60 * 1000
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

// Persist the enrolled email to Vercel KV (Upstash REST) if configured.
async function kvEnroll(email) {
  const url = process.env.KV_REST_API_URL;
  const tok = process.env.KV_REST_API_TOKEN;
  if (!url || !tok) return;
  try {
    await fetch(`${url}/sadd/enrolled/${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${tok}` }
    });
  } catch (_) { /* non-fatal */ }
}

function accessEmailHtml(name, link, productName) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3e7f3;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3e7f3;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fdfafd;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px rgba(160,80,159,0.15);">
        <tr><td style="background:linear-gradient(135deg,#a0509f,#6b3569);padding:28px 32px;text-align:center;">
          <img src="${LOGO_URL}" alt="Gcourses" height="42" style="height:42px;display:inline-block;" />
          <div style="color:#f3e7f3;font-size:13px;letter-spacing:0.08em;margin-top:8px;">PAYMENT CONFIRMED · YOU'RE ENROLLED</div>
        </td></tr>
        <tr><td style="padding:32px 32px 10px;">
          <p style="margin:0 0 16px;font-size:16px;color:#2e1a2e;">Hi${name ? ' ' + esc(name) : ''},</p>
          <p style="margin:0 0 22px;font-size:15px;color:#6b3569;line-height:1.6;">Your payment for <strong>${esc(productName)}</strong> has been confirmed and your access is ready. Click below to log in:</p>
          <a href="${link}" style="display:inline-block;background:#a0509f;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 30px;border-radius:100px;">Open my course →</a>
          <p style="margin:20px 0 0;font-size:12px;color:#8a6a88;">If the button doesn't work, copy this link:<br/><a href="${link}" style="color:#a0509f;word-break:break-all;">${link}</a></p>
        </td></tr>
        <tr><td style="background:#3b1a3a;padding:16px 32px;text-align:center;">
          <a href="${SITE}" style="color:#dab5d5;font-size:12px;text-decoration:none;">gcourses.site</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;
}

// Enrolls a buyer and emails them their magic login link. Returns the login URL.
async function enrollAndEmail({ email, name, productName, jwtSecret }) {
  const buyerEmail = (email || '').trim().toLowerCase();
  await kvEnroll(buyerEmail);

  const magic = signLoginToken(buyerEmail, jwtSecret, 30);
  const loginUrl = `${SITE}/login.html?token=${encodeURIComponent(magic)}&next=courses.html`;

  const apiKey = process.env.BREVO_API_KEY;
  if (apiKey) {
    const SENDER_EMAIL = process.env.SENDER_EMAIL || 'gigiimofarid@gmail.com';
    const SENDER_NAME = process.env.SENDER_NAME || 'Gcourses · Gigi';
    const OWNER_EMAIL = process.env.OWNER_EMAIL || 'gigiimofarid@gmail.com';
    try {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: SENDER_NAME, email: SENDER_EMAIL },
          to: [{ email: buyerEmail, name: name || undefined }],
          bcc: [{ email: OWNER_EMAIL }],
          replyTo: { email: SENDER_EMAIL, name: SENDER_NAME },
          subject: 'Your Gcourses access — payment confirmed ✓',
          htmlContent: accessEmailHtml(name, loginUrl, productName)
        })
      });
    } catch (_) { /* non-fatal */ }
  }
  return loginUrl;
}

module.exports = { signLoginToken, kvEnroll, enrollAndEmail, esc, SITE, LOGO_URL };
