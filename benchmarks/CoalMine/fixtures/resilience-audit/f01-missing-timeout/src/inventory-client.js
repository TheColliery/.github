const BASE = process.env.INVENTORY_API || 'https://inventory.internal';

async function fetchStockLevel(sku) {
  const res = await fetch(`${BASE}/stock/${encodeURIComponent(sku)}`);
  if (!res.ok) {
    throw new Error(`inventory API ${res.status} for ${sku}`);
  }
  const body = await res.json();
  return body.available;
}

module.exports = { fetchStockLevel };
