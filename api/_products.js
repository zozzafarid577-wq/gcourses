// Product catalogue (server-authoritative prices). PayPal does not support EGP,
// so the `price`/`currency` (USD) fields are only used by the parked PayPal flow.
// The live Instapay flow shows the `egp` amount.
// Override prices with Vercel env vars: PRICE_EBOOK, PRICE_PRINTED, PRICE_SESSION, PAYPAL_CURRENCY
const CURRENCY = process.env.PAYPAL_CURRENCY || 'USD';

module.exports = {
  ebook: {
    name: 'The Complete eBook (digital)',
    price: process.env.PRICE_EBOOK || '15.00',
    currency: CURRENCY,
    desc: 'Digital · lifetime access',
    egp: '750 EGP',
    physical: false
  },
  printed: {
    name: 'The Complete eBook — Printed Copy',
    price: process.env.PRICE_PRINTED || '18.00',
    currency: CURRENCY,
    desc: 'Printed book · delivered inside Egypt (delivery included)',
    egp: '899 EGP',
    physical: true
  },
  session: {
    name: 'Private 1-on-1 Session with Gigi',
    price: process.env.PRICE_SESSION || '8.00',
    currency: CURRENCY,
    desc: 'One live online session',
    egp: '400 EGP',
    physical: false
  }
};
