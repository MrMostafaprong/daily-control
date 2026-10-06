const express = require('express');
const c = require('../controllers');

const router = express.Router();

router.post('/daily', c.generatePlan);
router.post('/breakdown/:taskId', c.breakdownTask);
router.post('/priorities', c.suggestPriorities);

module.exports = router;