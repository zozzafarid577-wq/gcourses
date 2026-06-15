// Captures a PayPal order, then auto-enrols the buyer:
//   - persists their email (Vercel KV, if configured)
//   - emails them a one-click magic login link (Brevo)
//   - returns the login link so the checkout page can let them in instantly
// POST { orderID } -> { success, email, loginUrl }
const crypto = require('crypto');
const { baseUrl, getAccessToken } = require('./_paypal');
const PRODUCTS = require('./_products');

const SITE = process.env.SITE_URL || 'https://gcourses.site';
const LOGO_URL = SITE + '/gcourses-logo.png';

function signToken(email, secret, days) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    email,
    exp: Date.now() + days * 24 * 60 * 60 * 1000
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function accessEmail(name, link, productName) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3e7f3;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3e7f3;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fdfafd;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px rgba(160,80,159,0.15);">
        <tr><td style="background:linear-gradient(135deg,#a0509f,#6b3569);padding:28px 32px;text-align:center;">
          <img src="${LOGO_URL}" alt="Gcourses" height="42" style="height:42px;display:inline-block;" />
          <div style="color:#f3e7f3;font-size:13px;letter-spacing:0.08em;margin-top:8px;">PAYMENT RECEIVED · YOU'RE ENROLLED</div>
        </td></tr>
        <tr><td style="padding:32px 32px 10px;">
          <p style="margin:0 0 16px;font-size:16px;color:#2e1a2e;">Hi${name ? ' ' + esc(name) : ''},</p>
          <p style="margin:0 0 22px;font-size:15px;color:#6b3569;line-height:1.6;">Thank you for your purchase of <strong>${esc(productName)}</strong>. Your payment was successful and your access is ready. Click below to log in:</p>
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

async function brevoSend(payload) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return false;
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    return r.ok;
  } catch (_) { return false; }
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

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_SECRET) {
    res.status(500).json({ error: 'PayPal not configured' }); return;
  }
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) { res.status(500).json({ error: 'JWT_SECRET not configured' }); return; }

  let body = req.body;
  if (typeof body === 'string') body = JSON.parse(body || '{}');
  const { orderID } = body || {};
  if (!orderID) { res.status(400).json({ error: 'Missing orderID' }); return; }

  try {
    const token = await getAccessToken();
    const r = await fetch(`${baseUrl()}/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const d = await r.json();
    if (!r.ok) { res.status(502).json({ error: 'Capture failed', detail: d }); return; }
    if (d.status !== 'COMPLETED') { res.status(402).json({ error: 'Payment not completed', status: d.status }); return; }

    const pu = (d.purchase_units && d.purchase_units[0]) || {};
    const custom = pu.custom_id || '';
    const [emailRaw, product, ...nameParts] = custom.split('|');
    const email = (emailRaw || '').trim().toLowerCase();
    const name = nameParts.join('|');
    const prod = PRODUCTS[product] || { name: product || 'your course' };

    if (!email) { res.status(200).json({ success: true, warning: 'Paid, but no email was attached to the order. Please contact support.' }); return; }

    await kvEnroll(email);

    // 30-day login token for purchasers.
    const magic = signToken(email, jwtSecret, 30);
    const loginUrl = `${SITE}/login.html?token=${encodeURIComponent(magic)}&next=courses.html`;

    const SENDER_EMAIL = process.env.SENDER_EMAIL || 'gigiimofarid@gmail.com';
    const SENDER_NAME = process.env.SENDER_NAME || 'Gcourses · Gigi';
    const OWNER_EMAIL = process.env.OWNER_EMAIL || 'gigiimofarid@gmail.com';

    await brevoSend({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email, name: name || undefined }],
      bcc: [{ email: OWNER_EMAIL }],
      replyTo: { email: SENDER_EMAIL, name: SENDER_NAME },
      subject: 'Your Gcourses access — payment received ✓',
      htmlContent: accessEmail(name, loginUrl, prod.name)
    });

    res.status(200).json({ success: true, email, loginUrl });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
