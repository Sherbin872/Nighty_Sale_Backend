const Order = require('../models/Order');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const isDev = 'true';

const createOrder = async (req, res) => {
  try {
    const {
      orderItems,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
    } = req.body;

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: 'No order items' });
    }

    const order = new Order({
      user: req.user._id,
      orderItems,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
      isPaid: false,
    });

    const createdOrder = await order.save();
    res.status(201).json(createdOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private (User or Admin)
const getOrderById = async (req, res) => {
  try {
    // Populate adds the user's name and email to the order data
    const order = await Order.findById(req.params.id).populate(
      'user',
      'name email'
    );

    if (order) {
      // THE FIX IS HERE: Check for req.user.role === 'admin'
      const isAdmin = req.user.role === 'admin';
      const isOrderOwner = order.user._id.toString() === req.user._id.toString();

      if (isAdmin || isOrderOwner) {
        res.json(order);
      } else {
        res.status(403).json({ message: 'Not authorized to view this order' });
      }
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    console.error('Get Order By Id Error:', error);
    res.status(500).json({ message: 'Server error fetching order details' });
  }
};

// @desc    Get logged-in user's orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update order to paid (Razorpay verification success)
// @route   PUT /api/orders/:id/pay
// @access  Private
const updateOrderToPaid = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.isPaid = true;
    order.paidAt = new Date();

    // Keep status valid according to enum
    order.orderStatus = 'Processing';

    // Schema-compatible payment result
    order.paymentResult = {
      id: req.body.razorpay_payment_id || 'DEV_PAYMENT_ID',
      status: 'success',
      update_time: new Date().toISOString(),
      email_address: req.user?.email || 'dev@example.com',
    };

    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error) {
    console.error('updateOrderToPaid error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.orderStatus = status;

    if (status === 'Delivered') {
      order.isDelivered = true;
      order.deliveredAt = new Date();
    }

    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc    Delete an unpaid order (Payment cancelled/failed)
// @route   DELETE /api/orders/:id
// @access  Private
const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Security Check: Only the order owner or an admin can delete it
    const isAdmin = req.user.role === 'admin';
    const isOrderOwner = order.user.toString() === req.user._id.toString();

    if (!isAdmin && !isOrderOwner) {
      return res.status(403).json({ message: 'Not authorized to delete this order' });
    }

    // Safety Check: Never delete an order that has already been paid
    if (order.isPaid) {
      return res.status(400).json({ message: 'Cannot delete an order that has already been paid' });
    }

    await order.deleteOne();
    res.json({ message: 'Unpaid order removed successfully' });
  } catch (error) {
    console.error('Delete Order Error:', error);
    res.status(500).json({ message: 'Server error deleting order' });
  }
};





module.exports = {
  createOrder,
  getOrderById,
  getMyOrders,
  updateOrderToPaid,
  getAllOrders,
  updateOrderStatus,
  deleteOrder,
};
