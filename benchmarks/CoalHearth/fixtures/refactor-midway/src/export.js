const { getUserData } = require('./user-repo'); // REMAINING (step 8): call site not updated
function exportUser(uid) { return csv(getUserData(uid)); }
module.exports = { exportUser };
