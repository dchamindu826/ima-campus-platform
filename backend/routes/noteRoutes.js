const express = require('express');
const router = express.Router();
const noteController = require('../controllers/noteController');
const verifyToken = require('../middlewares/authMiddleware');

router.get('/', verifyToken, noteController.getNotes);
router.post('/', verifyToken, noteController.createNote);
router.put('/:id', verifyToken, noteController.updateNote);
router.delete('/:id', verifyToken, noteController.deleteNote);

module.exports = router;
