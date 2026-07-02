const logger = require('./logger');

async function closeAccount(db, sessions, accountId) {
  await db.run('UPDATE accounts SET status = ? WHERE id = ?', ['closed', accountId]);
  try {
    await sessions.revokeAll(accountId);
  } catch (e) {}
  logger.info({ accountId }, 'account closed');
}

module.exports = { closeAccount };
