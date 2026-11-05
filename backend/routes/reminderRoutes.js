const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/reminderController');

router.post('/create', reminderController.createReminder);
router.get('/my-reminders', reminderController.getMyReminders);
router.post('/mark-done', reminderController.markAsDone);
router.put('/edit', reminderController.editReminder); // Edit Route
router.delete('/delete/:reminderId', reminderController.deleteReminder); // Delete Route

module.exports = router;