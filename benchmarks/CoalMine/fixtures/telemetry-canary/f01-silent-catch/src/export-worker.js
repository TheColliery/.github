async function runExportBatch(db, warehouse) {
  const pending = await db.all('SELECT id, payload FROM orders WHERE exported = 0');
  for (const order of pending) {
    try {
      await warehouse.push(order.payload);
      await db.run('UPDATE orders SET exported = 1 WHERE id = ?', [order.id]);
    } catch (e) {}
  }
}

module.exports = { runExportBatch };
