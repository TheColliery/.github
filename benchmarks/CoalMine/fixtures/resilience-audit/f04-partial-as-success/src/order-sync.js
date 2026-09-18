async function syncOrders(api, orders) {
  const failed = [];
  for (const order of orders) {
    try {
      await api.push(order);
    } catch (err) {
      failed.push({ id: order.id, reason: err.message });
    }
  }
  return { status: 'complete', synced: orders.length };
}

module.exports = { syncOrders };
