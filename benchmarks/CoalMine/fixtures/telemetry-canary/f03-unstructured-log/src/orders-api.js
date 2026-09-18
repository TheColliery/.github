const logger = require('./logger');
const metrics = require('./metrics');

async function createOrder(req, res, repo) {
  const order = await repo.insert({ userId: req.user.id, items: req.body.items });
  metrics.increment('orders.created');
  logger.info('user ' + req.user.id + ' created order ' + order.id);
  res.status(201).json({ id: order.id });
}

module.exports = { createOrder };
