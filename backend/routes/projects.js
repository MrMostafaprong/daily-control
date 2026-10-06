const express = require('express');
const c = require('../controllers');

const router = express.Router();

router.get('/', c.listProjects);
router.get('/discover', c.discoverProjects);
router.get('/:id', c.getProject);
router.post('/', c.createProject);
router.put('/:id', c.updateProject);
router.delete('/:id', c.removeProject);
router.post('/:id/scan', c.scanProject);
router.get('/:id/tree', c.getProjectTree);

module.exports = router;