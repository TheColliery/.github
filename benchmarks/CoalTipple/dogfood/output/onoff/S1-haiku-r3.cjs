const crypto = require('crypto');

function hmacVerify(secretKey, message, tagHex) {
  const computed = crypto.createHmac('sha256', secretKey).update(message).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(tagHex));
}

// Tests
function runTests() {
  const key = 'my-secret-key';
  const msg = 'webhook payload';

  // Test 1: Valid signature
  const validTag = crypto.createHmac('sha256', key).update(msg).digest('hex');
  console.assert(hmacVerify(key, msg, validTag) === true, 'Test 1 failed: valid signature');
  console.log('Test 1 passed: valid signature');

  // Test 2: Invalid signature
  const invalidTag = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  console.assert(hmacVerify(key, msg, invalidTag) === false, 'Test 2 failed: invalid signature');
  console.log('Test 2 passed: invalid signature');

  // Test 3: Different message
  const differentMsg = 'different payload';
  console.assert(hmacVerify(key, differentMsg, validTag) === false, 'Test 3 failed: different message');
  console.log('Test 3 passed: different message');

  // Test 4: Different key
  const differentKey = 'different-key';
  console.assert(hmacVerify(differentKey, msg, validTag) === false, 'Test 4 failed: different key');
  console.log('Test 4 passed: different key');

  // Test 5: Empty message
  const emptyTag = crypto.createHmac('sha256', key).update('').digest('hex');
  console.assert(hmacVerify(key, '', emptyTag) === true, 'Test 5 failed: empty message');
  console.log('Test 5 passed: empty message');

  console.log('\nAll tests passed!');
}

runTests();
module.exports = hmacVerify;
