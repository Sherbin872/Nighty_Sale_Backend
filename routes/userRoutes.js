const express = require('express');
const router = express.Router();
const { registerUser, authUser } = require('../controllers/authController');

router.post('/', registerUser);
router.post('/login', authUser);

module.exports = router;