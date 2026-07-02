const logger = require('./logger');

async function refreshIndex(search, productId) {
  try {
    await search.reindex('products', productId);
  } catch (err) {
    logger.error({ err, productId }, 'product reindex failed');
    throw err;
  }
  logger.info({ productId }, 'product reindexed');
}

module.exports = { refreshIndex };
