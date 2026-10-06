const express = require('express');
const c = require('../controllers');

const router = express.Router();

router.get('/allowed', c.listAllowedCommands);
router.post('/run/:projectId', c.runTerminalCommand);

module.exports = router;