// Removes duplicate tags before a post is saved. Tag lists arrive
// from bulk imports and can reach tens of thousands of entries.
function dedupeTags(tags) {
  const unique = [];
  for (const tag of tags) {
    if (!unique.includes(tag)) {
      unique.push(tag);
    }
  }
  return unique;
}

module.exports = { dedupeTags };
