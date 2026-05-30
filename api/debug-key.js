// Temporary diagnostic — reports shape of BREVO_API_KEY without exposing it.
// Delete after debugging.
module.exports = async (req, res) => {
  const k = process.env.BREVO_API_KEY || '';
  res.status(200).json({
    present: !!k,
    length: k.length,
    prefix: k.slice(0, 8),       // e.g. "xkeysib-"
    startsCorrect: k.startsWith('xkeysib-'),
    hasWhitespace: /\s/.test(k)
  });
};
