const express = require('express');
const c = require('../controllers');
const { requireRoot } = require('../middleware');

const router = express.Router();

router.get('/allowed', c.listAllowedCommands);
router.post('/run/:projectId', c.runTerminalCommand);
// قاعدة الأوامر الخارجية — قراءة للجميع، كتابة للروت فقط (تحديث حي)
router.get('/commands', c.listAllowedCommands);
router.post('/commands/reload', requireRoot, c.reloadTerminalCommands);
router.post('/commands', requireRoot, c.upsertTerminalCommand);
router.delete('/commands/:name', requireRoot, c.removeTerminalCommand);

module.exports = router;
