const logger = require('./logger');

function startConsumer(queue, thumbnails) {
  queue.subscribe('uploads', async (msg) => {
    const { uploadId, requestId } = JSON.parse(msg.body);
    await thumbnails.generate(uploadId);
    logger.info({ uploadId }, 'upload processed');
  });
}

module.exports = { startConsumer };
