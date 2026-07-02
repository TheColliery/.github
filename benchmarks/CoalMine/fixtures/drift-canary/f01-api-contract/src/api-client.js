async function createOrder(fetchImpl, sku, count) {
  const res = await fetchImpl('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sku: sku, qty: count })
  });
  return res.json();
}

module.exports = { createOrder };
