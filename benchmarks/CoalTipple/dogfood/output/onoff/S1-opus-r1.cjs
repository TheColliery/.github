const crypto = require('crypto');

function hmacVerify(secretKey, message, tagHex) {
  const expected = crypto.createHmac('sha256', secretKey).update(message).digest();
  let provided;
  try {
    provided = Buffer.from(tagHex, 'hex');
  } catch {
    return false;
  }
  // Length check first: timingSafeEqual throws on length mismatch, and an
  // early bail here leaks nothing an attacker can't already measure (tag length).
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}

module.exports = { hmacVerify };

// ponytail: self-check only runs when invoked directly
if (require.main === module) {
  const assert = require('assert');
  const key = 'topsecret';
  const msg = 'payload={"id":42}';
  const good = crypto.createHmac('sha256', key).update(msg).digest('hex');

  assert.strictEqual(hmacVerify(key, msg, good), true, 'valid tag should verify');
  assert.strictEqual(hmacVerify(key, msg, good.toUpperCase()), true, 'hex case-insensitive');
  assert.strictEqual(hmacVerify(key, msg, good.replace(/.$/, c => (c === '0' ? '1' : '0'))), false, 'tampered tag rejected');
  assert.strictEqual(hmacVerify('wrongkey', msg, good), false, 'wrong key rejected');
  assert.strictEqual(hmacVerify(key, 'tampered body', good), false, 'tampered message rejected');
  assert.strictEqual(hmacVerify(key, msg, 'abc'), false, 'short/malformed hex rejected');
  assert.strictEqual(hmacVerify(key, msg, 'zz'), false, 'non-hex rejected');
  console.log('all tests passed');
}
