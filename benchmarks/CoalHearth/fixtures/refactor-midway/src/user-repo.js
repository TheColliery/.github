// DONE (step 1): definition renamed
/** Fetch a user's profile row by id. */
function fetchUserProfile(id) {
  if (!id) throw new TypeError('id required');
  return db.get('users', id);
}
module.exports = { fetchUserProfile };
