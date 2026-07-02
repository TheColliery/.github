const fs = require('fs');

// GET /api/config — hit by every client on page load.
function registerConfigRoute(app) {
  app.get('/api/config', (req, res) => {
    const raw = fs.readFileSync('./config/app.json', 'utf8');
    res.json(JSON.parse(raw));
  });
}

module.exports = { registerConfigRoute };
