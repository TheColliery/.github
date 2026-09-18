const logger = require('./logger');

async function importFeed(feed, repo) {
  try {
    const rows = await feed.fetchRows();
    for (const row of rows) {
      await repo.upsert(row);
    }
    logger.info({ job: 'import-feed', rows: rows.length }, 'import complete');
  } catch (err) {
    logger.error({ job: 'import-feed', reason: err.message }, 'import failed');
  }
}

module.exports = { importFeed };
