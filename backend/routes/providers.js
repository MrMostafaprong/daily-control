const express = require('express');
const c = require('../controllers');

const router = express.Router();

router.get('/', c.listProviders);
router.get('/defaults', c.getProviderDefaults);
router.get('/:id', c.getProvider);
router.post('/', c.createProvider);
router.put('/:id', c.updateProvider);
router.delete('/:id', c.removeProvider);

module.exports = router;