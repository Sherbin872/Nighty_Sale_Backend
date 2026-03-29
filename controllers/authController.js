const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const Otp = require('../models/Otp');
const { Resend } = require('resend'); // Import Resend

// Initialize Resend with your API Key
const resend = new Resend(process.env.RESEND_API_KEY);

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: "Request body is missing" });
    }

    const { name, email, password, phone, address, city, state, pinCode } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      name,
      email,
      password,
      phone,
      address: {
        street: address,     
        city: city,          
        state: state,        
        postalCode: pinCode  
      }
    });

    if (user) {
      return res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,    
        address: user.address,
        token: generateToken(user._id),
      });
    }

    return res.status(400).json({ message: "Invalid user data" });

  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const authUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+password');

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        address: user.address,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Send Email OTP
// @route   POST /api/auth/send-email-otp
// @access  Public
const sendEmailOtp = async (req, res) => {
  try {
    const { email, name } = req.body;
    console.log(`\n========== STARTING RESEND OTP PROCESS FOR: ${email} ==========`);

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ 
        message: 'An account with this email already exists. Please sign in instead.' 
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save to database
    await Otp.findOneAndUpdate(
      { email },
      { otp, createdAt: Date.now() },
      { upsert: true, new: true }
    );
    console.log(`[Step 1] OTP Saved to Database.`);

    // Send the email via Resend API
   // Send the email via Resend API
    console.log(`[Step 2] Firing Resend API...`);
    const { data, error } = await resend.emails.send({
      // 👇 CHANGE THIS LINE 
      from: 'Manavaatti Store <support@manavaatti.com>', 
      to: email,
      subject: 'Verify your Manavaatti account',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h2>Welcome to Manavaatti!</h2>
          <p>Hi ${name || 'there'},</p>
          <p>Your email verification code is:</p>
          <h1 style="font-size: 40px; letter-spacing: 5px; color: #550000;">${otp}</h1>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `
    });

    if (error) {
      console.error("❌ Resend API Error:", error);
      return res.status(400).json({ message: error.message });
    }

    console.log(`[Step 3] ✅ SUCCESS! Email sent via Resend API. ID: ${data.id}`);
    console.log(`========== OTP PROCESS COMPLETE ==========\n`);

    res.status(200).json({ message: 'OTP sent successfully to email' });
    
  } catch (error) {
    console.error(`\n❌ [CRITICAL ERROR] Resend Catch Block:`, error);
    res.status(500).json({ 
      message: 'Failed to send OTP email. Please try again.',
      exactError: error.message
    });
  }
};

// @desc    Verify Email OTP
// @route   POST /api/auth/verify-email-otp
// @access  Public
const verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const otpRecord = await Otp.findOne({ email });

    if (!otpRecord) {
      return res.status(400).json({ message: 'OTP has expired or does not exist. Please request a new one.' });
    }

    if (otpRecord.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP. Please check the code and try again.' });
    }

    await Otp.deleteOne({ email });

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify Email OTP Error:', error);
    res.status(500).json({ message: 'Failed to verify email OTP' });
  }
};

module.exports = { registerUser, authUser, sendEmailOtp, verifyEmailOtp };