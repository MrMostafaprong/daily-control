const crypto = require('crypto');
const config = require('./config');

const rateBuckets = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 600;

function clientIp(req) {
  return req.socket.remoteAddress || 'unknown';
}

function rateLimit(req, res, next) {
  const now = Date.now();
  if (rateBuckets.size > 500) {
    for (const [ip, b] of rateBuckets) if (now - b.startedAt >= RATE_WINDOW_MS) rateBuckets.delete(ip);
  }
  const key = clientIp(req);
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return next();
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Too many requests' });
  }
  return next();
}

function hasValidToken(provided, expected) {
  if (!provided || !expected || typeof provided !== 'string' || typeof expected !== 'string') return false;
  const actual = Buffer.from(provided);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted);
}

function requireAccessToken(req, res, next) {
  const expected = config.security.accessToken;
  const remote = !config.security.isLoopback(config.server.host);
  const required = config.security.requireAuth || remote || !config.isDev;
  if (!required && !expected) return next();
  if (!expected) return res.status(503).json({ error: 'Server access token is not configured' });

  const header = req.get('authorization') || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!hasValidToken(provided, expected)) return res.status(401).json({ error: 'Unauthorized' });
  return next();
}

function requestLogger(req, res, next) {
  const startedAt = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startedAt;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} - ${duration}ms`
    );
  });
  next();
}

function terminalEnabled(req, res, next) {
  if (!config.terminal.enabled && (req.path.startsWith('/terminal') || req.path.startsWith('/github/push'))) {
    return res.status(403).json({ error: 'This capability is disabled' });
  }
  return next();
}

function notFound(req, res) {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method,
  });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error('[error]', err.message);
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: statusCode >= 500 && !config.isDev ? 'Internal Server Error' : (err.message || 'Request failed'),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function requireRoot(req, res, next) {
  const rootSession = require('./services/rootSession');
  const token = rootSession.extractToken(req);
  if (!rootSession.isValid(token)) {
    const err = new Error('عملية حساسة — مطلوب تفعيل الروت (ROOT_REQUIRED)');
    err.statusCode = 403;
    err.code = 'ROOT_REQUIRED';
    return next(err);
  }
  req.rootToken = token;
  return next();
}

function createError(statusCode, message, meta = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, meta);
  return err;
}

module.exports = {
  requestLogger,
  rateLimit,
  requireAccessToken,
  terminalEnabled,
  requireRoot,
  notFound,
  errorHandler,
  asyncHandler,
  createError,
};
