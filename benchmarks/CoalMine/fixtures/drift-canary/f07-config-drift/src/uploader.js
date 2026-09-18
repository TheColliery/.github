function validateUpload(file) {
  const maxMb = 25;
  if (file.sizeMb > maxMb) {
    return { ok: false, reason: 'file exceeds ' + maxMb + ' MB limit' };
  }
  return { ok: true };
}

module.exports = { validateUpload };
