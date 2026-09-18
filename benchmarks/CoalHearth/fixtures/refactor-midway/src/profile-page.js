const { fetchUserProfile } = require('./user-repo'); // DONE (step 3)
function profilePage(uid) { return fetchUserProfile(uid); }
module.exports = { profilePage };
