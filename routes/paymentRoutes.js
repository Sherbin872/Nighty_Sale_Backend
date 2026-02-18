const express = require('express');
const { checkout, paymentVerification } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/checkout', protect, checkout);
router.post('/verification', protect, paymentVerification);

// Also add a route to send the Key ID to frontend (so you don't hardcode it in React)
router.get('/key', (req, res) => {
    res.status(200).json({ key: process.env.RAZORPAY_KEY_ID });
});

module.exports = router;