// Boot-time defaults - every key the deploy environment provides.
const defaults = {
  PORT: '8080',
  LOG_LEVEL: 'info',
  RETRY_LIMIT: '3'
};

function applyDefaults(env) {
  return Object.assign({}, defaults, env);
}

module.exports = { applyDefaults, defaults };
