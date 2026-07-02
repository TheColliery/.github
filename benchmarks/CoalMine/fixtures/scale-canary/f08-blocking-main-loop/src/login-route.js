const crypto = require('crypto');

// POST /login — verifies a password against the stored derived key.
function registerLoginRoute(app, users) {
  app.post('/login', (req, res) => {
    const user = users.get(req.body.email);
    if (!user) return res.status(401).end();
    const hash = crypto.pbkdf2Sync(req.body.password, user.salt, 310000, 32, 'sha256');
    res.json({ ok: crypto.timingSafeEqual(hash, user.hash) });
  });
}

module.exports = { registerLoginRoute };
