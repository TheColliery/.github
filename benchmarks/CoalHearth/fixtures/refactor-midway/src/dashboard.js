const { fetchUserProfile } = require('./user-repo'); // DONE (step 2)
function renderDashboard(uid) { return view(fetchUserProfile(uid)); }
module.exports = { renderDashboard };
