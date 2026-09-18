'use strict';

const crypto = require('crypto');

/**
 * Verify an HMAC-SHA256 tag in constant time.
 * @param {string|Buffer} secretKey
 * @param {string|Buffer} message
 * @param {string} tagHex - expected digest as a hex string
 * @returns {boolean}
 */
function hmacVerify(secretKey, message, tagHex) {
  const expected = crypto.createHmac('sha256', secretKey).update(message).digest();

  let given;
  try {
    given = Buffer.from(tagHex, 'hex');
  } catch {
    return false;
  }

  // timingSafeEqual throws on length mismatch, and hex parsing of an odd-length
  // or invalid string produces a wrong-length/short buffer anyway.
  if (given.length !== expected.length) return false;

  return crypto.timingSafeEqual(given, expected);
}

module.exports = { hmacVerify };

// ---- tests (node this-file.js) ----
if (require.main === module) {
  const assert = require('assert');

  const key = 'shhh';
  const msg = 'hello world';
  const validTag = crypto.createHmac('sha256', key).update(msg).digest('hex');

  assert.strictEqual(hmacVerify(key, msg, validTag), true, 'valid tag should verify');
  assert.strictEqual(hmacVerify(key, 'tampered', validTag), false, 'wrong message should fail');
  assert.strictEqual(hmacVerify('wrong-key', msg, validTag), false, 'wrong key should fail');
  assert.strictEqual(hmacVerify(key, msg, validTag.slice(0, -2)), false, 'short tag should fail, not throw');
  assert.strictEqual(hmacVerify(key, msg, 'zz' + validTag.slice(2)), false, 'non-hex tag should fail, not throw');
  assert.strictEqual(hmacVerify(key, msg, ''), false, 'empty tag should fail');

  console.log('all hmacVerify tests passed');
}
