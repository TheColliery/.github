const crypto = require('crypto');

function hmacVerify(secretKey, message, tagHex) {
  const tag = Buffer.from(tagHex, 'hex');
  const computed = crypto.createHmac('sha256', secretKey).update(message).digest();
  return crypto.timingSafeEqual(computed, tag);
}

module.exports = { hmacVerify };

// Tests
const assert = require('assert');

function test() {
  const secret = 'my-secret-key';
  const msg = 'webhook payload';

  // Generate a valid tag
  const validTag = crypto.createHmac('sha256', secret).update(msg).digest('hex');

  // Test: valid signature
  assert.strictEqual(hmacVerify(secret, msg, validTag), true, 'Valid signature should return true');

  // Test: invalid tag (wrong hex)
  const invalidTag = 'a'.repeat(64);
  assert.strictEqual(hmacVerify(secret, msg, invalidTag), false, 'Invalid signature should return false');

  // Test: altered message
  assert.strictEqual(hmacVerify(secret, 'different message', validTag), false, 'Different message should fail verification');

  // Test: wrong secret
  assert.strictEqual(hmacVerify('wrong-secret', msg, validTag), false, 'Wrong secret should fail verification');

  // Test: uppercase hex (should work)
  const upperTag = validTag.toUpperCase();
  assert.strictEqual(hmacVerify(secret, msg, upperTag), true, 'Uppercase hex should work');

  // Test: buffer inputs
  const bufSecret = Buffer.from(secret);
  const bufMsg = Buffer.from(msg);
  assert.strictEqual(hmacVerify(bufSecret, bufMsg, validTag), true, 'Buffer inputs should work');

  console.log('All tests passed');
}

if (require.main === module) {
  test();
}
