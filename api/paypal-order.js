// Creates a PayPal order server-side (authoritative amount) for a product.
// POST { product, name, email } -> { id }
const PRODUCTS = require('./_products');
const { baseUrl, getAccessToken } = require('./_paypal');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_SECRET) {
    res.status(500).json({ error: 'PayPal not configured' }); return;
  }

  let body = req.body;
  if (typeof body === 'string') body = JSON.parse(body || '{}');
  const { product, name = '', email } = body || {};

  const p = PRODUCTS[product];
  if (!p) { res.status(400).json({ error: 'Unknown product' }); return; }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    res.status(400).json({ error: 'A valid email is required' }); return;
  }

  // Pack who-to-enrol into the order (custom_id max 127 chars).
  const cleanName = String(name).replace(/\|/g, ' ').slice(0, 40);
  const custom = `${email.trim().toLowerCase()}|${product}|${cleanName}`.slice(0, 127);

  try {
    const token = await getAccessToken();
    const r = await fetch(`${baseUrl()}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: p.currency, value: p.price },
          description: `Gcourses — ${p.name}`,
          custom_id: custom
        }],
        application_context: {
          brand_name: 'Gcourses',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW'
        }
      })
    });
    const d = await r.json();
    if (!r.ok) { res.status(502).json({ error: 'Could not create order', detail: d }); return; }
    res.status(200).json({ id: d.id });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
