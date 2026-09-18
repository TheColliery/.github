let lastGoodRates = null;

async function getRates(client) {
  try {
    lastGoodRates = await client.get('/v1/rates');
    return lastGoodRates;
  } catch (err) {
    throw new Error('rates service unavailable: ' + err.message);
  }
}

module.exports = { getRates };
