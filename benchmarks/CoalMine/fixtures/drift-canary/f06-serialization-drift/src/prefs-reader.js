const { savePrefs } = require('./prefs-writer');

function loadPrefs(store) {
  const raw = store.read('prefs.json');
  const doc = JSON.parse(raw);
  const prefs = doc.preferences || {};
  savePrefs(store, prefs);
  return prefs;
}

module.exports = { loadPrefs };
