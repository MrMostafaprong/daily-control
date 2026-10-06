const express = require('express');
const c = require('../controllers');

const router = express.Router();

router.post('/chat', c.aiChat);
router.post('/fallback', c.aiFallback);
router.post('/parallel', c.aiParallel);

module.exports = router;