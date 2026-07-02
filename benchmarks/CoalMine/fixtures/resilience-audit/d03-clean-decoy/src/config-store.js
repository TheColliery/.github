const fs = require('node:fs');
const path = require('node:path');

function saveConfig(file, config) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.tmp`);
  try {
    const fd = fs.openSync(tmp, 'w');
    try {
      fs.writeSync(fd, JSON.stringify(config, null, 2));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, file);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

module.exports = { saveConfig };
