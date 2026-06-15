// Returns the PUBLIC PayPal config the checkout page needs (no secrets).
const PRODUCTS = require('./_products');

module.exports = async (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const configured = Boolean(clientId && process.env.PAYPAL_SECRET);
  const env = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase();
  const currency = process.env.PAYPAL_CURRENCY || 'USD';

  // expose only display-safe product fields
  const products = {};
  for (const key of Object.keys(PRODUCTS)) {
    const p = PRODUCTS[key];
    products[key] = { name: p.name, price: p.price, currency: p.currency, desc: p.desc, egp: p.egp };
  }

  res.status(200).json({ configured, clientId, env, currency, products });
};
