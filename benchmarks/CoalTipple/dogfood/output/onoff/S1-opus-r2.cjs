const crypto = require('crypto');

function hmacVerify(secretKey, message, tagHex) {
  const expected = crypto.createHmac('sha256', secretKey).update(message).digest();
  let provided;
  try {
    provided = Buffer.from(tagHex, 'hex');
  } catch {
    return false;
  }
  // Guard length: timingSafeEqual throws on unequal lengths. Bail early — a
  // wrong-length tag can never match anyway, and the true tag length is public.
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}

if (require.main === module) {
  const assert = require('assert');
  const key = 'topsecret';
  const msg = 'payload={"id":42}';
  const good = crypto.createHmac('sha256', key).update(msg).digest('hex');

  assert.strictEqual(hmacVerify(key, msg, good), true, 'valid tag accepts');
  assert.strictEqual(hmacVerify(key, msg, good.toUpperCase()), true, 'hex case-insensitive');
  assert.strictEqual(hmacVerify('wrongkey', msg, good), false, 'wrong key rejects');
  assert.strictEqual(hmacVerify(key, msg + 'x', good), false, 'tampered message rejects');
  assert.strictEqual(hmacVerify(key, msg, good.slice(0, -2) + '00'), false, 'wrong tag rejects');
  assert.strictEqual(hmacVerify(key, msg, 'deadbeef'), false, 'short tag rejects');
  assert.strictEqual(hmacVerify(key, msg, 'zz'), false, 'non-hex rejects');
  assert.strictEqual(hmacVerify(key, msg, ''), false, 'empty tag rejects');

  console.log('all tests passed');
}

module.exports = { hmacVerify };
