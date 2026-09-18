const sessions = {};

function track(userId, token) {
  sessions[userId] = { token };
}

function isActive(userId) {
  return Boolean(sessions[userId]);
}

function evict(userId) {
  delete sessions[userId];
}

module.exports = { track, isActive, evict };
