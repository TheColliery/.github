/**
 * Apply sales tax to a subtotal.
 * @param {number} subtotal - amount in dollars
 * @param {number} rate - tax rate as a percentage, 0-100
 * @returns {number} total with tax
 */
function applyTax(subtotal, rate) {
  return subtotal * (1 + rate);
}

module.exports = { applyTax };
