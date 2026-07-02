const fs = require('node:fs');
const path = require('node:path');

const STORE = path.join(process.env.DATA_DIR || '.', 'sessions.json');

function saveSessions(sessions) {
  const payload = JSON.stringify(sessions, null, 2);
  fs.writeFileSync(STORE, payload);
  return STORE;
}

module.exports = { saveSessions };
