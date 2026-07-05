'use strict';
const crypto = require('crypto');

function hmacVerify(secretKey, message, tagHex) {
  const expected = crypto.createHmac('sha256', secretKey).update(message).digest();
  let actual;
  try {
    actual = Buffer.from(tagHex, 'hex');
  } catch {
    return false;
  }
  // timingSafeEqual throws on length mismatch, so check that first (length isn't secret).
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

module.exports = { hmacVerify };

if (require.main === module) {
  const key = 'secret';
  const msg = 'hello world';
  const goodTag = crypto.createHmac('sha256', key).update(msg).digest('hex');

  console.assert(hmacVerify(key, msg, goodTag) === true, 'valid tag should verify');
  console.assert(hmacVerify(key, msg, goodTag.slice(0, -1) + (goodTag.slice(-1) === '0' ? '1' : '0')) === false, 'tampered tag should fail');
  console.assert(hmacVerify(key, msg + '!', goodTag) === false, 'tampered message should fail');
  console.assert(hmacVerify('wrong', msg, goodTag) === false, 'wrong key should fail');
  console.assert(hmacVerify(key, msg, goodTag + 'ab') === false, 'wrong-length tag should fail');
  console.assert(hmacVerify(key, msg, 'not-hex-zz') === false, 'malformed hex should fail, not throw');

  console.log('all tests passed');
}
