const express = require('express');
const router = express.Router();
const { registerUser, authUser,sendEmailOtp, verifyEmailOtp } = require('../controllers/authController');
const {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
} = require('../controllers/userController');
const { protect, admin } = require('../middleware/authMiddleware');


router.post('/', registerUser);
router.post('/login', authUser);


router.route('/')
  .get(protect, admin, getUsers);

router.route('/:id')
  .get(protect, admin, getUserById)
  .put(protect, admin, updateUser)
  .delete(protect, admin, deleteUser);
  router.post('/send-email-otp', sendEmailOtp);
router.post('/verify-email-otp', verifyEmailOtp);

module.exports = router;