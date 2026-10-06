const crypto = require('crypto');
const config = require('../config');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT = 'daily-control-v1';

function getKey() {
  const master = config.crypto.masterKey;
  if (!master || typeof master !== 'string') {
    const err = new Error('MASTER_KEY is not set in .env');
    err.statusCode = 500;
    throw err;
  }
  return crypto.scryptSync(master, SALT, KEY_LENGTH);
}

function encrypt(plain) {
  if (typeof plain !== 'string') {
    throw new Error('encrypt: plain must be a string');
  }
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };
}

function decrypt(payload) {
  if (!isEncrypted(payload)) {
    throw new Error('decrypt: payload must have { iv, authTag, ciphertext }');
  }
  const key = getKey();
  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

function isEncrypted(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.iv === 'string' &&
    typeof value.authTag === 'string' &&
    typeof value.ciphertext === 'string'
  );
}

module.exports = {
  encrypt,
  decrypt,
  isEncrypted,
};