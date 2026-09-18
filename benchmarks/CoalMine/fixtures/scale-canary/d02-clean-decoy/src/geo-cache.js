// Memoizes geocoding lookups with a hard size cap.
const MAX_ENTRIES = 500;
const cache = new Map();

function memoGeocode(address, lookup) {
  if (cache.has(address)) return cache.get(address);
  if (cache.size >= MAX_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
  const result = lookup(address);
  cache.set(address, result);
  return result;
}

module.exports = { memoGeocode };
