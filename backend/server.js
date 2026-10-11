require('dotenv').config();

const app = require('./app');
const config = require('./config');
const db = require('./db');

const { port, host } = config.server;

db.init();

// قاعدة الأوامر الخارجية: تحميل + مراقبة حية (تحديث بدون إيقاف النظام)
try {
  const commandRegistry = require('./services/commandRegistry');
  commandRegistry.reload();
  commandRegistry.watch();
  console.log(`[commands] file: ${commandRegistry.resolveFile()} (whitelist إجباري)`);
} catch (e) {
  console.error('[commands] init failed:', e.message);
}
try {
  const rootSession = require('./services/rootSession');
  console.log(`[roles] root ${rootSession.status().enabled ? 'enabled' : 'disabled (ضع ROOT_PASSWORD_HASH في .env)'} — نسخة مشددة`);
} catch { /* ignore */ }

const server = app.listen(port, host, () => {
  console.log(`Daily Control backend running at http://${host}:${port}`);
  console.log(`Health: http://${host}:${port}/api/health`);
});

function shutdown(signal) {
  console.log(`\n${signal} received, shutting down...`);
  if (server.closeIdleConnections) server.closeIdleConnections();
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Forced shutdown.');
    process.exit(1);
  }, 10000);
}

app.locals.shutdown = shutdown;

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
