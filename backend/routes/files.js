const express = require('express');
const c = require('../controllers');

const router = express.Router();

router.get('/tree/:projectId', c.getFileTree);
router.get('/read', c.readFile);
router.post('/write', c.writeFile);
router.get('/models', c.detectModels);

module.exports = router;