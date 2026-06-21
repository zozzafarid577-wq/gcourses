// Buyer submits an Instapay payment claim (with optional screenshot).
// We email the owner the details + an "Approve" button that enrolls the buyer.
// POST { name, email, product, screenshot?: { name, content(base64) } }
const crypto = require('crypto');
const PRODUCTS = require('./_products');

const SITE = process.env.SITE_URL || 'https://gcourses.site';
const LOGO_URL = SITE + '/gcourses-logo.png';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function signApproval(obj, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(obj)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

function ownerEmailHtml({ name, email, productName, amount, approveUrl, hasShot, delivery, physical }) {
  const d = delivery || {};
  const deliveryBlock = physical ? `
          <div style="margin-top:16px;padding:14px 16px;background:#f3e7f3;border-radius:10px;">
            <div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#a0509f;font-weight:600;margin-bottom:8px;"> Deliver printed copy to</div>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:4px 0;font-size:13px;color:#8a6a88;width:100px;">Phone</td><td style="padding:4px 0;font-size:13px;color:#2e1a2e;">${esc(d.phone)}</td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#8a6a88;">Governorate</td><td style="padding:4px 0;font-size:13px;color:#2e1a2e;">${esc(d.governorate)}</td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#8a6a88;">City / area</td><td style="padding:4px 0;font-size:13px;color:#2e1a2e;">${esc(d.city)}</td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#8a6a88;vertical-align:top;">Address</td><td style="padding:4px 0;font-size:13px;color:#2e1a2e;">${esc(d.address)}</td></tr>
              ${d.notes ? `<tr><td style="padding:4px 0;font-size:13px;color:#8a6a88;vertical-align:top;">Notes</td><td style="padding:4px 0;font-size:13px;color:#2e1a2e;">${esc(d.notes)}</td></tr>` : ''}
            </table>
          </div>` : '';
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3e7f3;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3e7f3;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#fdfafd;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px rgba(160,80,159,0.15);">
        <tr><td style="background:linear-gradient(135deg,#a0509f,#6b3569);padding:26px 32px;text-align:center;">
          <img src="${LOGO_URL}" alt="Gcourses" height="40" style="height:40px;display:inline-block;" />
          <div style="color:#f3e7f3;font-size:13px;letter-spacing:0.08em;margin-top:8px;">INSTAPAY PAYMENT · NEEDS YOUR APPROVAL</div>
        </td></tr>
        <tr><td style="padding:28px 32px 8px;">
          <p style="margin:0 0 18px;font-size:16px;color:#2e1a2e;">Someone says they paid via Instapay. Check your Instapay${hasShot ? ' / the attached screenshot' : ''}, then approve to enroll them.</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:7px 0;font-size:14px;color:#8a6a88;width:90px;">Name</td><td style="padding:7px 0;font-size:14px;color:#2e1a2e;font-weight:500;">${esc(name)}</td></tr>
            <tr><td style="padding:7px 0;font-size:14px;color:#8a6a88;">Email</td><td style="padding:7px 0;font-size:14px;color:#a0509f;">${esc(email)}</td></tr>
            <tr><td style="padding:7px 0;font-size:14px;color:#8a6a88;">Product</td><td style="padding:7px 0;font-size:14px;color:#2e1a2e;">${esc(productName)}</td></tr>
            <tr><td style="padding:7px 0;font-size:14px;color:#8a6a88;">Amount</td><td style="padding:7px 0;font-size:14px;color:#2e1a2e;font-weight:600;">${esc(amount)}</td></tr>
          </table>
          ${deliveryBlock}
        </td></tr>
        <tr><td style="padding:18px 32px 30px;">
          <a href="${approveUrl}" style="display:inline-block;background:#3f9d6b;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:100px;">✓ Approve &amp; enroll ${esc(name)}</a>
          <p style="margin:16px 0 0;font-size:12px;color:#8a6a88;">Only click after you've confirmed the money arrived. This enrolls them and emails their login link automatically. If they did <em>not</em> pay, just ignore this email.</p>
        </td></tr>
        <tr><td style="background:#3b1a3a;padding:14px 32px;text-align:center;">
          <a href="${SITE}" style="color:#dab5d5;font-size:12px;text-decoration:none;">gcourses.site</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const apiKey = process.env.BREVO_API_KEY;
  const jwtSecret = process.env.JWT_SECRET;
  if (!apiKey) { res.status(500).json({ error: 'BREVO_API_KEY not configured' }); return; }
  if (!jwtSecret) { res.status(500).json({ error: 'JWT_SECRET not configured' }); return; }

  let body = req.body;
  if (typeof body === 'string') body = JSON.parse(body || '{}');
  const { name = '', email = '', product = '', screenshot = null } = body || {};

  if (!name.trim()) { res.status(400).json({ error: 'Missing name' }); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: 'A valid email is required' }); return; }
  const p = PRODUCTS[product];
  if (!p) { res.status(400).json({ error: 'Unknown product' }); return; }

  // Physical products need a delivery address (inside Egypt).
  const delivery = {
    phone: String((body && body.phone) || '').trim().slice(0, 30),
    governorate: String((body && body.governorate) || '').trim().slice(0, 60),
    city: String((body && body.city) || '').trim().slice(0, 80),
    address: String((body && body.address) || '').trim().slice(0, 300),
    notes: String((body && body.notes) || '').trim().slice(0, 300)
  };
  if (p.physical && (!delivery.phone || !delivery.governorate || !delivery.city || !delivery.address)) {
    res.status(400).json({ error: 'Delivery details are required for the printed copy' }); return;
  }

  const emailLower = email.trim().toLowerCase();
  const token = signApproval({
    e: emailLower,
    n: name.trim().slice(0, 60),
    p: product,
    exp: Date.now() + 14 * 24 * 60 * 60 * 1000
  }, jwtSecret);
  const approveUrl = `${SITE}/api/instapay-approve?token=${encodeURIComponent(token)}`;

  const SENDER_EMAIL = process.env.SENDER_EMAIL || 'gigiimofarid@gmail.com';
  const SENDER_NAME = process.env.SENDER_NAME || 'Gcourses · Gigi';
  const OWNER_EMAIL = process.env.OWNER_EMAIL || 'gigiimofarid@gmail.com';

  const payload = {
    sender: { name: SENDER_NAME, email: SENDER_EMAIL },
    to: [{ email: OWNER_EMAIL }],
    replyTo: { email: emailLower, name: name.trim() },
    subject: `Instapay payment from ${name.trim()} — approve to enroll`,
    htmlContent: ownerEmailHtml({
      name: name.trim(), email: emailLower, productName: p.name,
      amount: p.egp || (p.price + ' ' + p.currency), approveUrl, hasShot: Boolean(screenshot && screenshot.content),
      delivery, physical: Boolean(p.physical)
    })
  };

  // Attach the payment screenshot if provided and not too large (~3.5 MB raw).
  if (screenshot && screenshot.content && screenshot.content.length < 4900000) {
    payload.attachment = [{
      name: (screenshot.name || 'payment-proof').replace(/[^\w.\-]/g, '_').slice(0, 60) || 'payment-proof.png',
      content: screenshot.content
    }];
  }

  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    if (r.ok) { res.status(200).json({ success: true }); }
    else { const t = await r.text(); res.status(502).json({ success: false, error: t }); }
  } catch (e) {
    res.status(500).json({ success: false, error: String(e && e.message || e) });
  }
};
