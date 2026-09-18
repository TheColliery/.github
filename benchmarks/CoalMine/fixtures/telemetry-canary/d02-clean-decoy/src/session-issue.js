const logger = require('./logger');
const metrics = require('./metrics');

function redactToken(token) {
  return '***' + token.slice(-4);
}

function issueSession(store, user) {
  const session = store.create(user.id);
  metrics.increment('sessions.issued');
  logger.info({ userId: user.id, token: redactToken(session.token) }, 'session issued');
  return session;
}

module.exports = { issueSession };
