const express = require('express');
const c = require('../controllers');

const router = express.Router();

router.get('/root/status', c.rootStatus);
router.post('/root/unlock', c.rootUnlock);
router.post('/root/lock', c.rootLock);
router.get('/root/verify', c.rootVerify);

module.exports = router;
