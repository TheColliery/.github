const db = require('./db');

// Admin user list including each row's most recent login.
async function listUsersWithLastLogin() {
  const users = await db.query('SELECT id, email FROM users');
  return Promise.all(users.map(async (user) => {
    const rows = await db.query('SELECT MAX(ts) AS ts FROM logins WHERE user_id = ?', [user.id]);
    return { id: user.id, email: user.email, lastLogin: rows[0].ts };
  }));
}

module.exports = { listUsersWithLastLogin };
