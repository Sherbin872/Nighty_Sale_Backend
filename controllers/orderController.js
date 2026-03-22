const Order = require('../models/Order');
const Product = require('../models/Product');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const isDev = 'true';

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
  try {
    console.log("========== STARTING CREATE ORDER ==========");
    
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
      console.log("❌ ERROR: No order items received from frontend.");
      return res.status(400).json({ message: 'No order items' });
    }

    // 1. Save the Order to DB
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
    console.log(`✅ Order saved successfully with ID: ${createdOrder._id}`);

    // ==========================================
    // DECREMENT INVENTORY LOGIC (WITH LOGS)
    // ==========================================
    console.log("--- Starting Inventory Decrement ---");
    
    for (const item of orderItems) {
      const productIdToFind = item.product || item.productId;
      const itemQty = Number(item.qty || item.quantity || 1); // Safely handle naming mismatch
      
      console.log(`\n📦 Processing Item: "${item.name}" | Size: ${item.size} | Qty to Deduct: ${itemQty}`);
      
      if (productIdToFind) {
        const product = await Product.findById(productIdToFind);

        if (product) {
          console.log(`Found product in DB! Current Total Stock: ${product.countInStock}`);

          // 1. Update Specific Size Stock
          if (product.sizes && Array.isArray(product.sizes) && item.size) {
            const sizeIndex = product.sizes.findIndex(s => s.size === item.size);

            if (sizeIndex !== -1) {
              console.log(`Found Size '${item.size}'. Old size stock: ${product.sizes[sizeIndex].stock}`);
              
              product.sizes[sizeIndex].stock -= itemQty;
              
              // Failsafe
              if (product.sizes[sizeIndex].stock < 0) {
                 console.log("⚠️ Warning: Size stock dropped below 0. Resetting to 0.");
                 product.sizes[sizeIndex].stock = 0;
              }
              console.log(`New size stock: ${product.sizes[sizeIndex].stock}`);
            } else {
              console.log(`❌ ERROR: Size '${item.size}' not found in product schema!`);
            }
          } else {
             console.log(`❌ ERROR: Product missing sizes array or item missing size property.`);
          }

          // 2. Update Total countInStock
          let currentStock = product.countInStock || 0; 
          product.countInStock = currentStock - itemQty;
          
          if (product.countInStock < 0) {
             console.log("⚠️ Warning: Total stock dropped below 0. Resetting to 0.");
             product.countInStock = 0;
          }
          console.log(`New Total Stock: ${product.countInStock}`);

          // 3. Save the updated product
          await product.save();
          console.log(`✅ Inventory saved to DB for "${product.name}"`);
        } else {
          console.log(`❌ ERROR: Product ID ${productIdToFind} not found in database!`);
        }
      }
    }
    console.log("========== INVENTORY DECREMENT COMPLETE ==========\n");
    // ==========================================

    res.status(201).json(createdOrder);
  } catch (error) {
    console.error('❌ Create Order Crash Error:', error);
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
    console.log(`\n========== STARTING DELETE & RESTOCK FOR ORDER: ${req.params.id} ==========`);
    
    const order = await Order.findById(req.params.id);

    if (!order) {
      console.log("❌ ERROR: Order not found for deletion.");
      return res.status(404).json({ message: 'Order not found' });
    }

    const isAdmin = req.user.role === 'admin';
    const isOrderOwner = order.user.toString() === req.user._id.toString();

    if (!isAdmin && !isOrderOwner) {
      console.log("❌ ERROR: User unauthorized to delete this order.");
      return res.status(403).json({ message: 'Not authorized to delete this order' });
    }

    if (order.isPaid) {
      console.log("❌ ERROR: Attempted to delete a PAID order. Aborting.");
      return res.status(400).json({ message: 'Cannot delete an order that has already been paid' });
    }

    // ==========================================
    // RESTOCK INVENTORY LOGIC (WITH LOGS)
    // ==========================================
    console.log("--- Restocking items from cancelled order ---");
    
    for (const item of order.orderItems) {
      const productIdToFind = item.product || item.productId; 
      const itemQty = Number(item.qty || item.quantity || 1);
      
      console.log(`\n🔄 Restocking Item: "${item.name}" | Size: ${item.size} | Qty to Add: ${itemQty}`);

      if (productIdToFind) {
        const product = await Product.findById(productIdToFind);

        if (product) {
          console.log(`Current Total Stock: ${product.countInStock}`);

          // 1. Add back to Specific Size Stock
          if (product.sizes && Array.isArray(product.sizes) && item.size) {
            const sizeIndex = product.sizes.findIndex(s => s.size === item.size);
            if (sizeIndex !== -1) {
              console.log(`Old size stock: ${product.sizes[sizeIndex].stock}`);
              product.sizes[sizeIndex].stock += itemQty;
              console.log(`Restored size stock to: ${product.sizes[sizeIndex].stock}`);
            }
          }

          // 2. Add back to Total countInStock
          let currentStock = product.countInStock || 0; 
          product.countInStock = currentStock + itemQty;
          console.log(`Restored Total Stock to: ${product.countInStock}`);

          await product.save();
          console.log(`✅ Successfully restocked "${product.name}"`);
        } else {
          console.log(`❌ ERROR: Product ID ${productIdToFind} not found during restock!`);
        }
      }
    }
    
    // Finally, delete the ghost order
    await order.deleteOne();
    console.log("✅ Ghost order deleted from database.");
    console.log("========== RESTOCK COMPLETE ==========\n");

    res.json({ message: 'Unpaid order removed and stock restored successfully' });
  } catch (error) {
    console.error('❌ Delete Order Crash Error:', error);
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
