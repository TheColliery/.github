const { formatMoney } = require('./money');

function invoiceLine(item) {
  return item.name + ': ' + formatMoney(item.priceCents, item.currency);
}

module.exports = { invoiceLine };
