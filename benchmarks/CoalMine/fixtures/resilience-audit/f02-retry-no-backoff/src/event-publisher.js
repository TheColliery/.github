async function publishEvent(client, event) {
  while (true) {
    try {
      await client.send('events', JSON.stringify(event));
      return true;
    } catch (err) {
      console.error('publish failed, retrying', err.message);
    }
  }
}

module.exports = { publishEvent };
