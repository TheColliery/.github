// Single source of truth for upload limits.
const MAX_UPLOAD_MB = 25;

function isWithinLimit(sizeMb) {
  return sizeMb <= MAX_UPLOAD_MB;
}

module.exports = { MAX_UPLOAD_MB, isWithinLimit };
