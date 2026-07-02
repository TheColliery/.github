const logger = require('./logger');

async function reserveStock(req, items) {
  const res = await fetch('http://inventory.internal/reserve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    throw new Error('inventory reserve failed: ' + res.status);
  }
  logger.info({ traceId: req.headers.traceparent, count: items.length }, 'stock reserved');
  return res.json();
}

module.exports = { reserveStock };
