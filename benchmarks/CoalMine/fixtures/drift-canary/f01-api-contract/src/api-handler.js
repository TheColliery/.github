// POST /orders - the handler DEFINES the request contract.
function handleCreateOrder(req, res) {
  const sku = req.body.sku;
  const quantity = req.body.quantity;
  if (!sku || !Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: 'sku and quantity required' });
  }
  return res.status(201).json({ ok: true, sku: sku, quantity: quantity });
}

module.exports = { handleCreateOrder };
