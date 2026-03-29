const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const Otp = require('../models/Otp'); // Import the new OTP model
const nodemailer = require('nodemailer');

console.log("=== INITIALIZING NODEMAILER TRANSPORTER ===");
console.log("Email User configured as:", process.env.EMAIL_USER ? "YES (Hidden for security)" : "❌ UNDEFINED - CHECK RENDER ENV VARS");
console.log("Email Pass configured as:", process.env.EMAIL_PASS ? "YES (Hidden for security)" : "❌ UNDEFINED - CHECK RENDER ENV VARS");

// 1. Setup Email Transporter (Use Gmail App Password)
// 1. Setup Email Transporter (Production Ready)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // false for 587, it will upgrade via STARTTLS
  family: 4,     // Force IPv4
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS  
  },
  tls: {
    rejectUnauthorized: false
  },
  logger: true,  // Turns on console logging
  debug: true    // Dumps all SMTP traffic to the console
});

// Verify connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ TRANSPORTER VERIFICATION FAILED:", error);
  } else {
    console.log("✅ TRANSPORTER VERIFIED: Ready to send emails!");
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
    console.log(`\n========== STARTING OTP PROCESS FOR: ${email} ==========`);

    // 1. Check if email is already registered
    const userExists = await User.findOne({ email });
    if (userExists) {
      console.log(`[Step 1] User already exists. Aborting.`);
      return res.status(400).json({ 
        message: 'An account with this email already exists. Please sign in instead.' 
      });
    }

    // 2. Generate a random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[Step 2] OTP Generated.`);

    // 3. Save to database (Upsert)
    await Otp.findOneAndUpdate(
      { email },
      { otp, createdAt: Date.now() },
      { upsert: true, new: true }
    );
    console.log(`[Step 3] OTP Saved to Database.`);

    // 4. Setup Mail Options
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

    // 5. Send the email
    console.log(`[Step 4] Calling transporter.sendMail()... WAITING FOR GOOGLE...`);
    const info = await transporter.sendMail(mailOptions);

    console.log(`[Step 5] ✅ SUCCESS! Email accepted by Google. Message ID: ${info.messageId}`);
    console.log(`========== OTP PROCESS COMPLETE ==========\n`);

    res.status(200).json({ message: 'OTP sent successfully to email' });
    
  } catch (error) {
    // === CATCHING THE EXACT ERROR ===
    console.error(`\n❌ [CRITICAL ERROR] transporter.sendMail() FAILED!`);
    console.error(`Error Name:`, error.name);
    console.error(`Error Code:`, error.code);
    console.error(`Error Command:`, error.command);
    console.error(`Full Error Message:`, error.message);
    console.log(`========== OTP PROCESS ABORTED ==========\n`);
    
    // Send the exact error to the frontend
    res.status(500).json({ 
      message: 'Failed to send OTP email. Please try again.',
      exactError: error.message,
      code: error.code
    });
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