// Process-wide session lookup cache.
const cache = new Map();

function getSession(id, loader) {
  if (!cache.has(id)) {
    cache.set(id, loader(id));
  }
  return cache.get(id);
}

module.exports = { getSession };
