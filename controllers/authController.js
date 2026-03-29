const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const Otp = require('../models/Otp'); // Import the new OTP model
const nodemailer = require('nodemailer');



// 1. Setup Email Transporter (Use Gmail App Password)
// 1. Setup Email Transporter (Updated for Render Production)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // use SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS  
  },
  // THE MAGIC FIX FOR CLOUD HOSTING:
  tls: {
    // Do not fail on invalid certs in cloud environments
    rejectUnauthorized: false
  }
});





// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = async (req, res) => {
  try {
    // 1. Ensure request body exists
    if (!req.body) {
      return res.status(400).json({ message: "Request body is missing" });
    }

    // THE FIX: Destructure the new address fields from the frontend
    const { name, email, password, phone, address, city, state, pinCode } = req.body;

    // 2. Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    // 3. Check if user already exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 4. Create user with nested address mapping (THE FIX)
    const user = await User.create({
      name,
      email,
      password,
      phone,
      address: {
        street: address,     // React 'address' -> Mongoose 'street'
        city: city,          // React 'city' -> Mongoose 'city'
        state: state,        // React 'state' -> Mongoose 'state'
        postalCode: pinCode  // React 'pinCode' -> Mongoose 'postalCode'
      }
    });

    // 5. Respond with token
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

    // 6. Fallback (should not reach here)
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
    // Explicitly select password because we set select:false in model
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

    // Optional but recommended: Check if email is already registered
  const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ 
        message: 'An account with this email already exists. Please sign in instead.' 
      });
    }

    // Generate a random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save to database (Upsert: Update if exists, otherwise create new)
    await Otp.findOneAndUpdate(
      { email },
      { otp, createdAt: Date.now() },
      { upsert: true, new: true }
    );

    // Send the email
    const mailOptions = {
      from: `"Manavaatti Store" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify your Manavaatti account',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h2>Welcome to Manavaatti!</h2>
          <p>Hi ${name || 'there'},</p>
          <p>Your email verification code is:</p>
          <h1 style="font-size: 40px; letter-spacing: 5px; color: #10b981;">${otp}</h1>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'OTP sent successfully to email' });
  } catch (error) {
    console.error('Send Email OTP Error:', error);
    res.status(500).json({ message: 'Failed to send OTP email. Please try again.' });
  }
};

// @desc    Verify Email OTP
// @route   POST /api/auth/verify-email-otp
// @access  Public
const verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find the OTP in the database
    const otpRecord = await Otp.findOne({ email });

    if (!otpRecord) {
      return res.status(400).json({ message: 'OTP has expired or does not exist. Please request a new one.' });
    }

    // Check if OTP matches
    if (otpRecord.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP. Please check the code and try again.' });
    }

    // If successful, delete the OTP from database so it can't be used again
    await Otp.deleteOne({ email });

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify Email OTP Error:', error);
    res.status(500).json({ message: 'Failed to verify email OTP' });
  }
};




module.exports = { registerUser, authUser, sendEmailOtp, verifyEmailOtp };