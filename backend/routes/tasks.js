const express = require('express');
const c = require('../controllers');

const router = express.Router();

router.get('/', c.listTasks);
router.get('/stats', c.taskStats);
router.get('/:id', c.getTask);
router.post('/', c.createTask);
router.put('/:id', c.updateTask);
router.delete('/:id', c.removeTask);
router.post('/:id/complete', c.completeTask);

module.exports = router;