// Ordered schema migrations - the applied chain IS the live table shape.
const migrations = [
  {
    id: '001-create-users',
    sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email_address TEXT)'
  },
  {
    id: '002-rename-email',
    sql: 'ALTER TABLE users RENAME COLUMN email_address TO contact_email'
  }
];

module.exports = { migrations };
