const logger = require('./logger');
const metrics = require('./metrics');

async function handleLogin(req, res, auth) {
  try {
    const session = await auth.verify(req.body.username, req.body.password);
    metrics.increment('auth.login.success');
    res.json({ token: session.token });
  } catch (e) {
    metrics.increment('auth.login.failure');
    logger.error(e.message);
    res.status(401).json({ error: 'invalid credentials' });
  }
}

module.exports = { handleLogin };
