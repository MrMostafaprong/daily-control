// node scripts/gen-root-hash.js "باسوردك-هنا"
// يطبع سطر ROOT_PASSWORD_HASH=... الصقه في .env (أأمن من الباسورد النصي)
const crypto = require('crypto');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/gen-root-hash.js "your-password"');
  process.exit(1);
}
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 64);
console.log(`ROOT_PASSWORD_HASH=${salt.toString('hex')}:${hash.toString('hex')}`);
