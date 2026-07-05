const crypto = require('crypto');

function hmacVerify(secretKey, message, tagHex) {
  const expected = crypto.createHmac('sha256', secretKey).update(message).digest();
  let given;
  try {
    given = Buffer.from(tagHex, 'hex');
  } catch {
    return false;
  }
  // crypto.timingSafeEqual throws if lengths differ, so guard first.
  // The length check itself is not secret (tag length is public), so no leak.
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(given, expected);
}

module.exports = { hmacVerify };

if (require.main === module) {
  const assert = require('assert');
  const key = 'topsecret';
  const msg = 'payload-body-123';
  const good = crypto.createHmac('sha256', key).update(msg).digest('hex');

  assert.strictEqual(hmacVerify(key, msg, good), true, 'valid tag must verify');
  assert.strictEqual(hmacVerify(key, msg, good.toUpperCase()), true, 'hex case-insensitive');
  assert.strictEqual(hmacVerify(key, msg, good.replace(/.$/, c => (c === '0' ? '1' : '0'))), false, 'tampered tag rejected');
  assert.strictEqual(hmacVerify('wrongkey', msg, good), false, 'wrong key rejected');
  assert.strictEqual(hmacVerify(key, 'other', good), false, 'wrong message rejected');
  assert.strictEqual(hmacVerify(key, msg, 'abc'), false, 'short/malformed tag rejected');
  assert.strictEqual(hmacVerify(key, msg, 'zz'), false, 'non-hex rejected');
  console.log('ok');
}
