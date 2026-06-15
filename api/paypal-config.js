// Returns the PUBLIC checkout config the front-end needs (no secrets).
const PRODUCTS = require('./_products');

module.exports = async (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const paypalConfigured = Boolean(clientId && process.env.PAYPAL_SECRET);
  const env = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase();
  const currency = process.env.PAYPAL_CURRENCY || 'USD';

  // Instapay handle (manual-approve flow). Defaults to Gigi's handle; override with env.
  const instapayHandle = process.env.INSTAPAY_HANDLE || 'gigifarid@instapay';

  const products = {};
  for (const key of Object.keys(PRODUCTS)) {
    const p = PRODUCTS[key];
    products[key] = { name: p.name, price: p.price, currency: p.currency, desc: p.desc, egp: p.egp, physical: Boolean(p.physical) };
  }

  res.status(200).json({
    products,
    instapay: {
      enabled: Boolean(instapayHandle),
      handle: instapayHandle,
      name: process.env.INSTAPAY_NAME || 'Gigi · Gcourses'
    },
    paypal: { configured: paypalConfigured, clientId, env, currency },
    // legacy fields kept for safety
    configured: paypalConfigured, clientId, env, currency
  });
};
