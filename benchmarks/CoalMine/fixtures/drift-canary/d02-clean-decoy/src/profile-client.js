async function updateProfile(fetchImpl, displayName) {
  const res = await fetchImpl('/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: displayName })
  });
  return res.json();
}

module.exports = { updateProfile };
