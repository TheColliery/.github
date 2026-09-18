const { applyTax } = require('./tax');

// Rates are stored as fractions (0.07 = 7%) everywhere in checkout.
function orderTotal(subtotal) {
  return applyTax(subtotal, 0.07);
}

module.exports = { orderTotal };
