const { fetchUserProfile } = require('./user-repo'); // DONE (step 5)
function adminView(uid) { return fetchUserProfile(uid); }
module.exports = { adminView };
