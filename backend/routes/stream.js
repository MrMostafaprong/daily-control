const express = require('express');
const streamController = require('../controllers/streamController');

const router = express.Router();

router.post('/chat', streamController.streamChat);

module.exports = router;