// Vercel serverless function — sends the mock-test report as a branded HTML email via Brevo.
// Free tier: 300 emails/day. Set BREVO_API_KEY in Vercel → Project → Settings → Environment Variables.
// Optional: SENDER_EMAIL (a verified Brevo sender), SENDER_NAME, OWNER_EMAIL.

const LOGO_URL = 'https://gcourses.vercel.app/gcourses-logo.png';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml(d) {
  const { name, overall, correct, total, weak, okay } = d;
  let focus;
  if (weak.length) {
    focus = `<p style="margin:0 0 10px;font-size:15px;color:#2e1a2e;">What you need to work on most:</p>
      <ul style="margin:0;padding-left:20px;color:#6b3569;font-size:15px;line-height:1.9;">
        ${weak.map(r => `<li><strong>${esc(r.name)}</strong> — ${r.p}%</li>`).join('')}
      </ul>`;
  } else if (okay.length) {
    focus = `<p style="margin:0 0 10px;font-size:15px;color:#2e1a2e;">You did well overall. A couple of areas could use another pass:</p>
      <ul style="margin:0;padding-left:20px;color:#6b3569;font-size:15px;line-height:1.9;">
        ${okay.map(r => `<li><strong>${esc(r.name)}</strong> — ${r.p}%</li>`).join('')}
      </ul>`;
  } else {
    focus = `<p style="margin:0;font-size:15px;color:#3f9d6b;font-weight:600;">Great work — no weak areas stood out. Every chapter scored solidly.</p>`;
  }

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3e7f3;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3e7f3;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fdfafd;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px rgba(160,80,159,0.15);">
        <tr><td style="background:linear-gradient(135deg,#a0509f,#6b3569);padding:28px 32px;text-align:center;">
          <img src="${LOGO_URL}" alt="Gcourses" height="42" style="height:42px;display:inline-block;" />
          <div style="color:#f3e7f3;font-size:13px;letter-spacing:0.08em;margin-top:8px;">ACT BIOLOGY · MOCK TEST RESULTS</div>
        </td></tr>
        <tr><td style="padding:30px 32px 8px;">
          <p style="margin:0 0 16px;font-size:16px;color:#2e1a2e;">Hi ${esc(name)},</p>
          <p style="margin:0 0 22px;font-size:15px;color:#6b3569;line-height:1.6;">Here are your results from the Gcourses ACT Biology mock test.</p>
          <div style="background:#f3e7f3;border-radius:14px;padding:22px;text-align:center;margin-bottom:24px;">
            <div style="font-size:13px;letter-spacing:0.08em;color:#a0509f;text-transform:uppercase;">Your Score</div>
            <div style="font-size:46px;font-weight:700;color:#a0509f;line-height:1.1;margin-top:4px;">${overall}%</div>
            <div style="font-size:14px;color:#8a6a88;">${correct} out of ${total} correct</div>
          </div>
          ${focus}
        </td></tr>
        <tr><td style="padding:24px 32px 30px;">
          <a href="https://gcourses.vercel.app/mock-test.html" style="display:inline-block;background:#a0509f;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 26px;border-radius:100px;">Retake the test →</a>
        </td></tr>
        <tr><td style="background:#3b1a3a;padding:18px 32px;text-align:center;">
          <div style="color:#dab5d5;font-size:12px;">Study with Gigi · Gcourses</div>
          <a href="https://gcourses.vercel.app" style="color:#dab5d5;font-size:12px;text-decoration:none;">gcourses.vercel.app</a>
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

  const SENDER_EMAIL = process.env.SENDER_EMAIL || 'gigiimofarid@gmail.com';
  const SENDER_NAME = process.env.SENDER_NAME || 'Gcourses · Gigi';
  const OWNER_EMAIL = process.env.OWNER_EMAIL || 'gigiimofarid@gmail.com';

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    const { name, email, overall, correct, total, weak = [], okay = [] } = body || {};
    if (!name || !email) { res.status(400).json({ error: 'Missing name or email' }); return; }

    const html = buildHtml({ name, overall, correct, total, weak, okay });

    const payload = {
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email, name }],
      bcc: [{ email: OWNER_EMAIL }],           // owner gets a copy
      replyTo: { email: SENDER_EMAIL, name: SENDER_NAME },
      subject: `Your Gcourses ACT Biology results — ${overall}%`,
      htmlContent: html
    };

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
