require('dotenv').config();
const path = require('path');

function readEnv(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (!Number.isNaN(Number(raw)) && raw.trim() !== '') return Number(raw);
  return raw;
}

function readString(key, fallback = null) {
  const raw = process.env[key];
  return raw === undefined || raw === '' ? fallback : String(raw);
}

function readCorsOrigin(value) {
  if (!value) return ['http://localhost:5173', 'http://127.0.0.1:5173'];
  if (value === '*') return '*';
  return String(value).split(',').map((origin) => origin.trim()).filter(Boolean);
}

function isLoopback(host) {
  return ['127.0.0.1', 'localhost', '::1'].includes(String(host));
}

const config = {
  env: readEnv('NODE_ENV', 'development'),
  isDev: readEnv('NODE_ENV', 'development') === 'development',
  isProd: readEnv('NODE_ENV', 'development') === 'production',

  server: {
    port: readEnv('PORT', 5000),
    host: readString('HOST', '127.0.0.1'),
  },

  cors: {
    origin: readCorsOrigin(process.env.CORS_ORIGIN),
    credentials: false,
  },

  security: {
    accessToken: readString('APP_ACCESS_TOKEN'),
    requireAuth: readEnv('REQUIRE_AUTH', false) === true,
    isLoopback,
  },

  json: {
    limit: readEnv('JSON_LIMIT', '10mb'),
  },

  paths: {
    root: path.resolve(__dirname, '..'),
    backend: __dirname,
    data: path.resolve(__dirname, 'data'),
  },

  db: {
    driver: 'json',
  },

  crypto: {
    masterKey: readString('MASTER_KEY'),
  },

  terminal: {
    // النسخة الأكثر أمانًا: whitelist إجباري — حتى لو حاول أحد ضبط open يُفرض whitelist.
    mode: 'whitelist',
    commandsFile: readString('TERMINAL_COMMANDS_FILE', null),
    enforceWhitelist: true,
    auditLog: true,
    defaultTimeout: readEnv('TERMINAL_TIMEOUT', 30000),
    maxTimeout: readEnv('TERMINAL_MAX_TIMEOUT', 120000),
    maxArgs: readEnv('TERMINAL_MAX_ARGS', 16),
    maxOutput: readEnv('TERMINAL_MAX_OUTPUT', 512 * 1024),
    enabled: readEnv('ENABLE_TERMINAL', readEnv('NODE_ENV', 'development') === 'development'),
  },

  root: {
    // باسورد الروت في .env على جهاز المالك — مختلف عن MASTER_KEY.
    // في هذه النسخة يُفضَّل HASH إجباريًا (انظر scripts/gen-root-hash.js).
    password: readString('ROOT_PASSWORD'),
    passwordHash: readString('ROOT_PASSWORD_HASH'),
    tokenTtlMs: readEnv('ROOT_TOKEN_TTL_MS', readEnv('ROOT_TOKEN_TTL_MIN', 10) * 60 * 1000),
  },

  github: {
    token: readString('GITHUB_TOKEN'),
  },
};

module.exports = config;
