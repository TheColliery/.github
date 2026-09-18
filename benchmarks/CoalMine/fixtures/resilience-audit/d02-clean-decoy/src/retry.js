const { setTimeout: sleep } = require('node:timers/promises');

async function withRetry(fn, attempts = 4, baseMs = 200) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await sleep(baseMs * 2 ** i);
    }
  }
  throw lastErr;
}

module.exports = { withRetry };
