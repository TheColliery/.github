function insertUser(db, user) {
  const sql = 'INSERT INTO users (name, email_address) VALUES (?, ?)';
  return db.run(sql, [user.name, user.email]);
}

function findById(db, id) {
  return db.get('SELECT id, name, contact_email FROM users WHERE id = ?', [id]);
}

module.exports = { insertUser, findById };
