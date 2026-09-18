const { fetchUserProfile } = require('./user-repo'); // DONE (step 4)
function settings(uid) { const u = fetchUserProfile(uid); return u.prefs; }
module.exports = { settings };
