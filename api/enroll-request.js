// Sends an enrollment request notification to Gigi via Brevo.
const LOGO_URL = 'https://gcourses.site/gcourses-logo.png';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildHtml(name, email, message) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3e7f3;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3e7f3;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fdfafd;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px rgba(160,80,159,0.15);">
        <tr><td style="background:linear-gradient(135deg,#a0509f,#6b3569);padding:28px 32px;text-align:center;">
          <img src="${LOGO_URL}" alt="Gcourses" height="42" style="height:42px;display:inline-block;" />
          <div style="color:#f3e7f3;font-size:13px;letter-spacing:0.08em;margin-top:8px;">NEW ENROLLMENT REQUEST</div>
        </td></tr>
        <tr><td style="padding:30px 32px;">
          <p style="margin:0 0 20px;font-size:16px;color:#2e1a2e;">Someone wants access to Gcourses:</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;font-size:14px;color:#8a6a88;width:80px;">Name</td><td style="padding:8px 0;font-size:14px;color:#2e1a2e;font-weight:500;">${esc(name)}</td></tr>
            <tr><td style="padding:8px 0;font-size:14px;color:#8a6a88;">Email</td><td style="padding:8px 0;font-size:14px;color:#a0509f;">${esc(email)}</td></tr>
            ${message ? `<tr><td style="padding:8px 0;font-size:14px;color:#8a6a88;vertical-align:top;">Note</td><td style="padding:8px 0;font-size:14px;color:#2e1a2e;">${esc(message)}</td></tr>` : ''}
          </table>
          <div style="margin-top:24px;padding:16px;background:#f3e7f3;border-radius:10px;font-size:13px;color:#6b3569;line-height:1.7;">
            <strong>To approve:</strong> Add <code style="background:#fff;padding:2px 6px;border-radius:4px;">${esc(email)}</code> to <code style="background:#fff;padding:2px 6px;border-radius:4px;">APPROVED_EMAILS</code> in Vercel → Environment Variables, then redeploy.
          </div>
        </td></tr>
        <tr><td style="background:#3b1a3a;padding:16px 32px;text-align:center;">
          <a href="https://gcourses.site" style="color:#dab5d5;font-size:12px;text-decoration:none;">gcourses.site</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'BREVO_API_KEY not configured' }); return; }

  let body = req.body;
  if (typeof body === 'string') body = JSON.parse(body || '{}');
  const { name, email, message = '' } = body || {};
  if (!name || !email) { res.status(400).json({ error: 'Missing name or email' }); return; }

  const SENDER_EMAIL = process.env.SENDER_EMAIL || 'gigiimofarid@gmail.com';
  const SENDER_NAME = process.env.SENDER_NAME || 'Gcourses · Gigi';
  const OWNER_EMAIL = process.env.OWNER_EMAIL || 'gigiimofarid@gmail.com';

  const payload = {
    sender: { name: SENDER_NAME, email: SENDER_EMAIL },
    to: [{ email: OWNER_EMAIL }],
    replyTo: { email, name },
    subject: `Enrollment request from ${name}`,
    htmlContent: buildHtml(name, email, message)
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
