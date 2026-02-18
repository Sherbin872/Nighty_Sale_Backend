const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @desc    1. Create Razorpay Order (Initiate Payment)
// @route   POST /api/payment/checkout
// @access  Private
const checkout = async (req, res) => {
  const { amount } = req.body; // Amount should be passed from frontend

  const options = {
    amount: Number(amount * 100), // Razorpay accepts smallest currency unit (paise). 500 INR = 50000 paise
    currency: "INR",
    receipt: `receipt_order_${Date.now()}`,
  };

  try {
    const order = await razorpay.orders.create(options);
    
    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Razorpay Error:", error);
    res.status(500).json({ success: false, message: "Payment initialization failed" });
  }
};

// @desc    2. Verify Payment (Webhook/Callback security check)
// @route   POST /api/payment/verification
// @access  Private
const paymentVerification = async (req, res) => {
  // These come from the frontend after successful payment
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;

  // Generate our own signature to compare
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  const isAuthentic = expectedSignature === razorpay_signature;

  if (isAuthentic) {
    // 1. Find the Order in OUR database
    // (This assumes you created the order in DB *before* payment with status "Not Paid")
    // If you prefer creating the DB order *after* payment, you can do that here.
    
    const order = await Order.findById(orderId);
    
    if(order) {
        order.isPaid = true;
        order.paidAt = Date.now();
        order.paymentResult = {
            id: razorpay_payment_id,
            status: 'success',
            update_time: Date.now(),
            email_address: req.user.email // From auth middleware
        };
        
        await order.save();
    }

    res.status(200).json({
      success: true,
      message: "Payment verified and Order Updated"
    });
  } else {
    res.status(400).json({
      success: false,
      message: "Invalid Signature",
    });
  }
};

module.exports = { checkout, paymentVerification };