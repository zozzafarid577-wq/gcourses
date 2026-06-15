// Product catalogue (server-authoritative prices). PayPal does not support EGP,
// so prices are charged in USD by default. Override any value with Vercel env vars:
//   PRICE_EBOOK, PRICE_SESSION, PAYPAL_CURRENCY
const CURRENCY = process.env.PAYPAL_CURRENCY || 'USD';

module.exports = {
  ebook: {
    name: 'The Complete eBook',
    price: process.env.PRICE_EBOOK || '15.00',
    currency: CURRENCY,
    desc: 'Lifetime access · study at your own pace',
    egp: '750 EGP'
  },
  session: {
    name: 'Private 1-on-1 Session with Gigi',
    price: process.env.PRICE_SESSION || '8.00',
    currency: CURRENCY,
    desc: 'One live online session',
    egp: '400 EGP'
  }
};
