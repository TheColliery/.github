const crypto = require('crypto');

function hmacVerify(secretKey, message, tagHex) {
  const computed = crypto.createHmac('sha256', secretKey).update(message).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(computed, 'hex'),
    Buffer.from(tagHex, 'hex')
  );
}

module.exports = hmacVerify;

if (require.main === module) {
  const assert = require('assert');

  const key = 'secret';
  const msg = 'hello world';
  const tag = crypto.createHmac('sha256', key).update(msg).digest('hex');

  assert.strictEqual(hmacVerify(key, msg, tag), true, 'valid tag');
  assert.strictEqual(hmacVerify(key, msg, 'deadbeef'), false, 'invalid tag');
  assert.strictEqual(hmacVerify(key, 'wrong', tag), false, 'wrong message');
  assert.strictEqual(hmacVerify('wrong', msg, tag), false, 'wrong key');

  console.log('All tests passed');
}
