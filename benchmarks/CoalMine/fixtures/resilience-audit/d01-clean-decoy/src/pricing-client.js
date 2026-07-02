const BASE = process.env.PRICING_API || 'https://pricing.internal';

async function fetchPrice(sku) {
  const res = await fetch(`${BASE}/price/${encodeURIComponent(sku)}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`pricing API ${res.status} for ${sku}`);
  }
  return (await res.json()).amount;
}

module.exports = { fetchPrice };
