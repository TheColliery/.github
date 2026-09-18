const db = require('./db');

// Totals column for the customer order dashboard.
async function orderTotals(customerId) {
  const orders = await db.query('SELECT id FROM orders WHERE customer_id = ?', [customerId]);
  const totals = [];
  for (const order of orders) {
    const lines = await db.query('SELECT price FROM order_lines WHERE order_id = ?', [order.id]);
    totals.push(lines.reduce((sum, l) => sum + l.price, 0));
  }
  return totals;
}

module.exports = { orderTotals };
