const { getUserData } = require('./user-repo'); // REMAINING (step 9): test not updated
test('loads user', () => { expect(getUserData('u1')).toBeDefined(); });
