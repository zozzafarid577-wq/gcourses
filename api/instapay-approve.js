// Owner clicks the "Approve" link from the Instapay notification email.
// Verifies the signed token, enrolls the buyer, and emails them their login link.
// GET /api/instapay-approve?token=...
const crypto = require('crypto');
const PRODUCTS = require('./_products');
const { enrollAndEmail } = require('./_enroll');

function verify(token, secret) {
  try {
    const parts = String(token).split('.');
    if (parts.length !== 3) return null;
    const [h, b, s] = parts;
    const expected = crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest('base64url');
    if (s !== expected) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

function page(title, body, ok) {
  const icon = ok ? '✓' : '';
  const color = ok ? '#3f9d6b' : '#c0506a';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title} — Gcourses</title>
  <style>body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f3e7f3;color:#2e1a2e;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1.5rem;}
  .card{background:#fdfafd;border-radius:20px;padding:2.6rem 2.2rem;max-width:440px;width:100%;text-align:center;box-shadow:0 12px 48px rgba(160,80,159,0.14);}
  .ic{width:66px;height:66px;border-radius:50%;background:${color}22;color:${color};font-size:2rem;display:flex;align-items:center;justify-content:center;margin:0 auto 1.1rem;}
  h1{font-size:1.5rem;margin:0 0 0.6rem;color:#3b1a3a;}p{color:#6b3569;font-size:0.97rem;line-height:1.6;margin:0;}</style></head>
  <body><div class="card"><div class="ic">${icon}</div><h1>${title}</h1><p>${body}</p></div></body></html>`;
}

module.exports = async (req, res) => {
  const jwtSecret = process.env.JWT_SECRET;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!jwtSecret) { res.status(500).send(page('Not configured', 'JWT_SECRET is missing on the server.', false)); return; }

  const token = (req.query && req.query.token) ||
    new URLSearchParams((req.url.split('?')[1] || '')).get('token');

  const data = verify(token, jwtSecret);
  if (!data) {
    res.status(200).send(page('Link expired or invalid', 'This approval link is no longer valid (it may have expired or already been used long ago). Ask the buyer to submit again, or add their email manually.', false));
    return;
  }

  const prod = PRODUCTS[data.p] || { name: data.p || 'your course' };
  try {
    await enrollAndEmail({ email: data.e, name: data.n || '', productName: prod.name, jwtSecret });
    res.status(200).send(page('Approved — student enrolled ✓',
      `<strong>${data.e}</strong> has been enrolled in <strong>${prod.name}</strong> and emailed their one-click login link.`, true));
  } catch (e) {
    res.status(500).send(page('Something went wrong', 'We could not complete the enrollment. Please try the link again in a moment.', false));
  }
};
