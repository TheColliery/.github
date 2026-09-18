const logger = require('./logger');

async function checkout(req, res, payments, orders) {
  const cart = await orders.loadCart(req.user.id);
  try {
    const charge = await payments.capture(cart.total, req.body.paymentToken);
    await orders.markPaid(cart.id, charge.id);
    logger.info({ cartId: cart.id, chargeId: charge.id }, 'checkout complete');
    res.json({ orderId: cart.id });
  } catch (e) {
    logger.error({ err: e, cartId: cart.id }, 'checkout failed');
    res.status(502).json({ error: 'payment failed' });
  }
}

module.exports = { checkout };
