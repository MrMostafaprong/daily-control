const express = require('express');
const c = require('./controllers');
const { requireRoot } = require('./middleware');
const rootSession = require('./services/rootSession');

const router = express.Router();

// ─── Core ─────────────────────────────────────────────
router.get('/health', c.getHealth);
router.get('/info', c.getAppInfo);
// نسخة مشددة: shutdown يحتاج روت دائمًا لو الروت مفعّل
router.post('/shutdown', (req, res, next) => {
  if (rootSession.isEnabled()) return requireRoot(req, res, next);
  return next();
}, c.shutdown);

// ─── Sub-routers ──────────────────────────────────────
router.use('/projects', require('./routes/projects'));
router.use('/github', require('./routes/github'));
router.use('/files', require('./routes/files'));
router.use('/providers', require('./routes/providers'));
router.use('/models', require('./routes/models'));
router.use('/ai', require('./routes/ai'));
router.use('/terminal', require('./routes/terminal'));
router.use('/auth', require('./routes/auth'));
router.use('/tasks', require('./routes/tasks'));
router.use('/planner', require('./routes/planner'));
router.use('/stream', require('./routes/stream'));

module.exports = router;
