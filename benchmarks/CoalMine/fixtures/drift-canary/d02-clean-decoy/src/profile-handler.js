// PUT /profile - the handler defines the request contract.
function handleUpdateProfile(req, res) {
  const displayName = req.body.displayName;
  if (typeof displayName !== 'string' || displayName.length === 0) {
    return res.status(400).json({ error: 'displayName required' });
  }
  return res.status(200).json({ ok: true, displayName: displayName });
}

module.exports = { handleUpdateProfile };
