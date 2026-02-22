require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const helmet = require('helmet');
const cors = require('cors');
// const xss = require('xss-clean');
const hpp = require('hpp');
// const mongoSanitize = require('express-mongo-sanitize');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const orderRoutes = require('./routes/orderRoutes');

// Initialize App
const app = express();

// Connect to Database
connectDB();

// 1. Security Middleware
app.use(helmet()); // Secure HTTP headers
app.use(cors()); // Allow Cross-Origin requests
// app.use(xss()); // Prevent XSS attacks
app.use(hpp()); // Prevent HTTP Parameter Pollution
// app.use(mongoSanitize()); // Prevent NoSQL Injection

// 2. Body Parser
app.use(express.json()); // Parse JSON bodies


// MOUNT ROUTES
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', require('./routes/adminRoutes'));
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));


// 3. Test Route (To verify setup)
app.get('/', (req, res) => {
  res.send('API is running...');
});

// 4. Server Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
