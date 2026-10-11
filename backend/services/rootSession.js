const crypto = require('crypto');

/**
 * نظام صلاحيتين:
 * - user: كل العمليات العادية (مشاريع، مهام، ترمينال عادي...).
 * - root: عمليات حساسة (أوامر privileged، تعديل قاعدة الأوامر، shutdown...).
 * تفعيل الروت = باسورد يضعه المالك في .env (ROOT_PASSWORD أو ROOT_PASSWORD_HASH)
 * وهو مختلف تمامًا عن MASTER_KEY الخاص بالتشفير.
 */

const sessions = new Map(); // token -> expiresAt

function getConfig() {
  return require('../config').root;
}

function parseHash(stored) {
  // صيغة: saltHex:hashHex (scrypt 64B)
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return null;
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return null;
  try {
    return { salt: Buffer.from(saltHex, 'hex'), hash: Buffer.from(hashHex, 'hex') };
  } catch { return null; }
}

function verifyPassword(input) {
  const cfg = getConfig();
  if (typeof input !== 'string' || !input) return false;
  // 1) HASH له الأولوية (أأمن)
  const parsed = parseHash(cfg.passwordHash);
  if (parsed) {
    try {
      const derived = crypto.scryptSync(input, parsed.salt, parsed.hash.length || 64);
      if (derived.length !== parsed.hash.length) return false;
      return crypto.timingSafeEqual(derived, parsed.hash);
    } catch { return false; }
  }
  // 2) باسورد نصي من .env (مقبول محليًا — الجهاز جهازك)
  if (cfg.password) {
    const a = Buffer.from(String(input));
    const b = Buffer.from(String(cfg.password));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  return false;
}

function isEnabled() {
  const cfg = getConfig();
  return Boolean(cfg.password || cfg.passwordHash);
}

function prune() {
  const now = Date.now();
  for (const [t, exp] of sessions) if (exp <= now) sessions.delete(t);
}

function unlock(password) {
  if (!isEnabled()) {
    throw Object.assign(new Error('الروت غير مفعّل — ضع ROOT_PASSWORD في ملف .env على جهازك'), { statusCode: 503 });
  }
  if (!verifyPassword(password)) {
    // تأخير صغير ضد التخمين
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400);
    throw Object.assign(new Error('باسورد الروت غير صحيح'), { statusCode: 401 });
  }
  prune();
  const cfg = getConfig();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + cfg.tokenTtlMs;
  sessions.set(token, expiresAt);
  return { token, expiresAt: new Date(expiresAt).toISOString(), ttlMs: cfg.tokenTtlMs };
}

function isValid(token) {
  if (!token || typeof token !== 'string') return false;
  prune();
  const exp = sessions.get(token);
  return typeof exp === 'number' && exp > Date.now();
}

function lock(token) {
  if (token) sessions.delete(token);
  return true;
}

function extractToken(req) {
  if (!req) return null;
  const header = req.get ? (req.get('x-root-token') || '') : (req.headers?.['x-root-token'] || '');
  if (header) return String(header).trim();
  if (req.body && typeof req.body.rootToken === 'string') return req.body.rootToken.trim();
  if (req.query && typeof req.query.rootToken === 'string') return req.query.rootToken.trim();
  return null;
}

function status() {
  prune();
  return { enabled: isEnabled(), activeSessions: sessions.size, hashMode: Boolean(getConfig().passwordHash) };
}

module.exports = { verifyPassword, isEnabled, unlock, isValid, lock, extractToken, status };
