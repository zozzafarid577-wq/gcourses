// Receives a message from the floating "Gigi" chat widget and makes sure it
// reaches the owner: emails it via Brevo (if configured) and also stores it in
// Vercel KV (if configured) as a backup inbox. Succeeds if either path works.
const RECIPIENT = () =>
  process.env.CONTACT_EMAIL || process.env.SENDER_EMAIL || 'gigiimofarid@gmail.com';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function sendEmail({ name, email, message, page }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return false;
  const sender = process.env.SENDER_EMAIL || 'gigiimofarid@gmail.com';
  const senderName = process.env.SENDER_NAME || 'Gcourses · Gigi';
  const html =
    `<div style="font-family:Helvetica,Arial,sans-serif;color:#2e1a2e;">
      <h2 style="color:#a0509f;margin:0 0 12px;">New message from the Gigi chat</h2>
      <p style="margin:4px 0;"><strong>From:</strong> ${esc(name) || '(no name)'} &lt;${esc(email)}&gt;</p>
      <p style="margin:4px 0;"><strong>Page:</strong> ${esc(page) || '-'}</p>
      <hr style="border:none;border-top:1px solid #dab5d5;margin:14px 0;" />
      <p style="white-space:pre-wrap;font-size:15px;line-height:1.6;">${esc(message)}</p>
    </div>`;
  const payload = {
    sender: { name: senderName, email: sender },
    to: [{ email: RECIPIENT() }],
    replyTo: email ? { email: String(email) } : undefined,
    subject: `Gigi chat: message from ${name || email || 'a student'}`,
    htmlContent: html
  };
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    return r.ok;
  } catch (_) { return false; }
}

async function storeKV(entry) {
  const url = process.env.KV_REST_API_URL;
  const tok = process.env.KV_REST_API_TOKEN;
  if (!url || !tok) return false;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['LPUSH', 'buddy:messages', JSON.stringify(entry)])
    });
    return r.ok;
  } catch (_) { return false; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch (_) { body = {}; } }
  const name = (body && body.name || '').toString().slice(0, 120).trim();
  const email = (body && body.email || '').toString().slice(0, 160).trim();
  const message = (body && body.message || '').toString().slice(0, 4000).trim();
  const page = (body && body.page || '').toString().slice(0, 200).trim();

  if (!message) { res.status(400).json({ error: 'Message is empty' }); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: 'Please enter a valid email so I can reply.' }); return; }

  const entry = { name, email, message, page, at: new Date().toISOString() };
  const [emailed, stored] = await Promise.all([sendEmail(entry), storeKV(entry)]);

  if (emailed || stored) { res.status(200).json({ success: true }); return; }
  res.status(503).json({ error: 'Messaging is not set up yet (needs BREVO_API_KEY or Vercel KV).' });
};
