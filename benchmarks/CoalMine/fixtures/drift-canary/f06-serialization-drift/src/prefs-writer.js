// Stored format: { version: 2, prefs: {...} } - the writer owns the file shape.
function savePrefs(store, prefs) {
  const doc = { version: 2, prefs: prefs };
  return store.write('prefs.json', JSON.stringify(doc));
}

module.exports = { savePrefs };
