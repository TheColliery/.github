const { getUserData } = require('./user-repo'); // REMAINING (step 7): call site not updated
function invoice(uid) { return bill(getUserData(uid)); }
module.exports = { invoice };
