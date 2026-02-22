const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

// @desc    Get dashboard statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
  try {
    // 1. Total Orders
    const totalOrders = await Order.countDocuments();

    // 2. Total Products
    const totalProducts = await Product.countDocuments();

    // 3. Total Users (excluding admins, optional)
    const totalUsers = await User.countDocuments({ role: 'user' });

    // 4. Total Revenue (Only count paid orders)
    const revenueCalc = await Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' } } }
    ]);

    // If there are no paid orders yet, revenueCalc is empty
    const totalRevenue = revenueCalc.length > 0 ? revenueCalc[0].totalRevenue : 0;

    res.json({
      totalOrders,
      totalProducts,
      totalUsers,
      totalRevenue
    });

  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({ message: 'Error fetching dashboard statistics' });
  }
};

module.exports = { getDashboardStats };