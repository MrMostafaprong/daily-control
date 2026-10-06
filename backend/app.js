const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const config = require('./config');
const { requestLogger, rateLimit, requireAccessToken, terminalEnabled, notFound, errorHandler } = require('./middleware');
const routes = require('./routes');

const app = express();

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(
  cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
  })
);

app.use(express.json({ limit: config.json.limit }));
app.use(express.urlencoded({ extended: true, limit: config.json.limit }));

app.use('/api', rateLimit, requireAccessToken, terminalEnabled);
app.use(requestLogger);

app.use('/api', routes);

// تشغيل الواجهة المبنية (frontend/dist) من نفس السيرفر — للتشغيل بضغطة واحدة
const distDir = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
