const db = require('./db');

// Dashboard totals: one batched query covers every visible order.
async function orderTotalsBatch(orderIds) {
  if (orderIds.length === 0) return new Map();
  const rows = await db.query(
    'SELECT order_id, SUM(price) AS total FROM order_lines WHERE order_id IN (?) GROUP BY order_id',
    [orderIds]
  );
  return new Map(rows.map((row) => [row.order_id, row.total]));
}

module.exports = { orderTotalsBatch };
