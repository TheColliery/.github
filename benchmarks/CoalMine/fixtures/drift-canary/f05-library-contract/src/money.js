// Public API v2: options object. The v1 positional form (amount, currency)
// was removed in 2.0 with no deprecated wrapper.
function formatMoney(opts) {
  const amount = opts.amount;
  const currency = opts.currency || 'USD';
  return (amount / 100).toFixed(2) + ' ' + currency;
}

module.exports = { formatMoney };
