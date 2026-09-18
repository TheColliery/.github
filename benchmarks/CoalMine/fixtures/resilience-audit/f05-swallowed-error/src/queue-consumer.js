async function handleDelivery(channel, msg, db) {
  try {
    const job = JSON.parse(msg.content.toString());
    await db.insert('jobs', job);
  } catch (err) {}
  channel.ack(msg);
}

module.exports = { handleDelivery };
