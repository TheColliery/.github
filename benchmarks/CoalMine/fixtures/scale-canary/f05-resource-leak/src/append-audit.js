const fs = require('fs');

// Appends one line per processed record to the nightly batch job's audit trail.
function appendAudit(entry) {
  const fd = fs.openSync('./audit.log', 'a');
  const line = JSON.stringify({ ts: Date.now(), ...entry }) + '\n';
  fs.writeSync(fd, line);
  return line.length;
}

module.exports = { appendAudit };
