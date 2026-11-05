const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');

router.get('/', teamController.getCallers);
router.post('/', teamController.createCaller);
router.delete('/:id', teamController.deleteCaller);

module.exports = router;