const { applyDefaults } = require('./env-defaults');

function loadConfig(env) {
  const merged = applyDefaults(env);
  if (!merged.WEBHOOK_URL) throw new Error('WEBHOOK_URL is required');
  return {
    port: Number(merged.PORT),
    logLevel: merged.LOG_LEVEL,
    webhookUrl: merged.WEBHOOK_URL
  };
}

module.exports = { loadConfig };
