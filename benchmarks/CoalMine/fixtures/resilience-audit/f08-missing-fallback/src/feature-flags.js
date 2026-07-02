const DEFAULT_FLAGS = { checkout: true, betaSearch: false };

async function loadFlags(configClient) {
  try {
    const res = await configClient.fetch('flags/current');
    return res.flags;
  } catch (err) {
    throw new Error('flag service unreachable: ' + err.message);
  }
}

module.exports = { loadFlags, DEFAULT_FLAGS };
