const express = require('express');
const c = require('../controllers');

const router = express.Router();

router.get('/', c.listModels);
router.post('/refresh', c.refreshModels);
router.get('/:providerId/:modelId', c.getModel);

module.exports = router;