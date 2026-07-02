const https = require('node:https');

function notifyPartner(url, payload, done) {
  const req = https.request(url, { method: 'POST' }, (res) => {
    res.resume();
    done(null, res.statusCode);
  });
  req.on('error', done);
  req.end(JSON.stringify(payload));
}

module.exports = { notifyPartner };
