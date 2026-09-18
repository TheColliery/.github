const { PAGE_SIZE } = require('./constants');

function pageSlice(items, page) {
  const start = page * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

module.exports = { pageSlice };
