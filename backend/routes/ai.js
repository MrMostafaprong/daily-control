const express = require('express');
const c = require('../controllers');

const router = express.Router();

router.post('/chat', c.aiChat);
router.post('/fallback', c.aiFallback);
router.post('/parallel', c.aiParallel);
router.get('/sessions', c.listSessions);
router.get('/sessions/:id', c.getSession);
router.post('/sessions', c.createSession);
router.put('/sessions/:id', c.updateSession);
router.delete('/sessions/:id', c.removeSession);

module.exports = router;
