const { fetchUserProfile } = require('./user-repo'); // DONE (step 6)
function notify(uid) { return send(fetchUserProfile(uid).email); }
module.exports = { notify };
