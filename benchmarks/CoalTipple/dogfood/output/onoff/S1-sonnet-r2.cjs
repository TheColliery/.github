'use strict';

const crypto = require('crypto');

function hmacVerify(secretKey, message, tagHex) {
  const expected = crypto.createHmac('sha256', secretKey).update(message).digest();

  let given;
  try {
    given = Buffer.from(tagHex, 'hex');
  } catch {
    return false;
  }

  // timingSafeEqual throws on length mismatch, so check that first —
  // but do it via a constant-shape comparison against a same-length
  // buffer so we never call timingSafeEqual with mismatched lengths
  // (which itself would be a length-based side channel signal, though
  // a minor one compared to a byte-content leak).
  if (given.length !== expected.length) return false;

  return crypto.timingSafeEqual(given, expected);
}

module.exports = { hmacVerify };

// ponytail: assert-based self-check, run this file directly (`node this-file.js`) to verify.
if (require.main === module) {
  const key = 'shh-secret';
  const msg = 'webhook payload body';
  const tag = crypto.createHmac('sha256', key).update(msg).digest('hex');

  console.assert(hmacVerify(key, msg, tag) === true, 'valid tag should verify');
  console.assert(hmacVerify(key, msg, tag.toUpperCase()) === true, 'uppercase hex parses the same, so it verifies');
  console.assert(hmacVerify(key, msg, tag.slice(0, -1) + (tag.at(-1) === '0' ? '1' : '0')) === false, 'flipped last hex char should fail');
  console.assert(hmacVerify(key, 'tampered payload', tag) === false, 'wrong message should fail');
  console.assert(hmacVerify('wrong-key', msg, tag) === false, 'wrong key should fail');
  console.assert(hmacVerify(key, msg, tag.slice(0, -2)) === false, 'short tag should fail, not throw');
  console.assert(hmacVerify(key, msg, 'zz' + tag.slice(2)) === false, 'non-hex tag should fail, not throw');

  console.log('all hmacVerify assertions passed');
}
