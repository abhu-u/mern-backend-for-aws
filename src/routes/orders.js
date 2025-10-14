const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Order = require('../models/Order');
const Table = require('../models/Table');
const MenuItem = require('../models/MenuItem');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/orders/table/:tableId/order - Create a new order (PUBLIC endpoint for customers)
router.post('/table/:tableId/order', async (req, res) => {
  try {
    const { tableId } = req.params;
    const { customerName = 'Guest', items, specialInstructions = '' } = req.body;

    // Validate tableId format
    if (!mongoose.Types.ObjectId.isValid(tableId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid table ID format'
      });
    }

    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item'
      });
    }

    // Validate each item has required fields
    for (const item of items) {
      if (!item.menuItemId || !mongoose.Types.ObjectId.isValid(item.menuItemId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid menu item ID in order'
        });
      }
      if (!item.quantity || item.quantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Each item must have a valid quantity (minimum 1)'
        });
      }
    }

    // Find and validate table
    const table = await Table.findOne({
      _id: tableId,
      isActive: true
    });

    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found or inactive'
      });
    }

    // Extract all menu item IDs from the order
    const menuItemIds = items.map(item => item.menuItemId);

    // Fetch all menu items in one query
    const menuItems = await MenuItem.find({
      _id: { $in: menuItemIds },
      restaurantId: table.restaurantId,
      isActive: true
    });

    // Create a map for quick lookup
    const menuItemMap = {};
    menuItems.forEach(item => {
      menuItemMap[item._id.toString()] = item;
    });

    // Validate all items exist and belong to the restaurant
    const missingItems = [];
    for (const itemId of menuItemIds) {
      if (!menuItemMap[itemId.toString()]) {
        missingItems.push(itemId);
      }
    }

    if (missingItems.length > 0) {
      return res.status(404).json({
        success: false,
        message: 'One or more menu items not found or inactive',
        missingItems
      });
    }

    // Build order items with pricing and calculate total
    let totalPrice = 0;
    const orderItems = items.map(item => {
      const menuItem = menuItemMap[item.menuItemId.toString()];
      const itemTotal = menuItem.price * item.quantity;
      totalPrice += itemTotal;

      return {
        menuItemId: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        addons: item.addons || [],
        specialInstructions: item.specialInstructions || ''
      };
    });

    // Round to 2 decimal places to avoid floating point issues
    totalPrice = Math.round(totalPrice * 100) / 100;

    // Create order
    const order = new Order({
      tableId: table._id,
      restaurantId: table.restaurantId,
      customerName: customerName.trim() || 'Guest',
      items: orderItems,
      totalPrice,
      specialInstructions: specialInstructions.trim(),
      status: 'pending'
    });

    await order.save();

    // Populate references for response
    await order.populate([
      { path: 'tableId', select: 'tableName seats' },
      { path: 'restaurantId', select: 'restaurantName name' }
    ]);

    // EMIT SOCKET EVENT FOR NEW ORDER
    const io = req.app.get('io');
    if (io) {
      const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
      
      io.to(`restaurant-${table.restaurantId}`).emit('new-order', {
        orderId: order._id.toString(),
        tableNumber: order.tableId.tableName,
        customerName: order.customerName,
        items: order.items.map(item => item.name),
        totalPrice: order.totalPrice,
        itemCount: itemCount,
        timestamp: order.createdAt,
        status: order.status
      });

      console.log(`Emitted new-order event to restaurant-${table.restaurantId}`);
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: order
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating order',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/orders/customer/:orderId/status - PUBLIC endpoint for customers to check order status
router.get('/customer/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    const order = await Order.findById(orderId)
      .populate('tableId', 'tableName')
      .populate('restaurantId', 'restaurantName');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: {
        orderId: order._id,
        status: order.status,
        customerName: order.customerName,
        totalPrice: order.totalPrice,
        items: order.items,
        createdAt: order.createdAt,
        tableName: order.tableId?.tableName,
        restaurantName: order.restaurantId?.restaurantName
      }
    });
  } catch (error) {
    console.error('Get order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching order status'
    });
  }
});

// POST /api/orders/table/:tableId/call-waiter - PUBLIC endpoint for customers to call waiter
router.post('/table/:tableId/call-waiter', async (req, res) => {
  try {
    const { tableId } = req.params;
    const { customerName = 'Guest' } = req.body;

    // Validate tableId format
    if (!mongoose.Types.ObjectId.isValid(tableId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid table ID format'
      });
    }

    // Find and validate table
    const table = await Table.findOne({
      _id: tableId,
      isActive: true
    });

    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found or inactive'
      });
    }

    // EMIT SOCKET EVENT FOR WAITER CALL
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant-${table.restaurantId}`).emit('waiter-called', {
        tableId: table._id.toString(),
        tableNumber: table.tableName,
        customerName: customerName || 'Guest',
        timestamp: new Date().toISOString()
      });

      console.log(`Emitted waiter-called event to restaurant-${table.restaurantId}`);
    }

    res.json({
      success: true,
      message: 'Waiter has been notified'
    });
  } catch (error) {
    console.error('Call waiter error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while calling waiter',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// Apply authentication middleware for all routes below
router.use(authMiddleware);

// GET /api/orders/restaurant - Get all orders for the logged-in restaurant
router.get('/restaurant', async (req, res) => {
  try {
    const { status, startDate, endDate, limit = 100 } = req.query;

    // Build query
    const query = {
      restaurantId: req.userId
    };

    // Filter by status if provided
    if (status) {
      const validStatuses = ['pending', 'preparing', 'ready', 'served', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Valid values: ' + validStatuses.join(', ')
        });
      }
      query.status = status;
    }

    // Filter by date range if provided
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const orders = await Order.find(query)
      .populate('tableId', 'tableName seats')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Get restaurant orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching orders',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/orders/table/:tableId - Get all orders for a specific table
router.get('/table/:tableId', async (req, res) => {
  try {
    const { tableId } = req.params;
    const { status, limit = 50 } = req.query;

    // Validate tableId
    if (!mongoose.Types.ObjectId.isValid(tableId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid table ID format'
      });
    }

    // Verify table belongs to this restaurant
    const table = await Table.findOne({
      _id: tableId,
      restaurantId: req.userId
    });

    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found or does not belong to your restaurant'
      });
    }

    // Build query
    const query = {
      tableId: tableId,
      restaurantId: req.userId
    };

    // Filter by status if provided
    if (status) {
      const validStatuses = ['pending', 'preparing', 'ready', 'served', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Valid values: ' + validStatuses.join(', ')
        });
      }
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('tableId', 'tableName seats')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Get table orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching table orders',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/orders/:orderId - Get a specific order by ID
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Validate orderId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      restaurantId: req.userId
    })
      .populate('tableId', 'tableName seats')
      .populate('items.menuItemId', 'name description isVeg');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching order',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// PATCH /api/orders/:orderId/status - Update order status
router.patch('/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Validate orderId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    // Validate status
    const validStatuses = ['pending', 'preparing', 'ready', 'served', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Valid values: ' + validStatuses.join(', ')
      });
    }

    // Find order and verify ownership
    const order = await Order.findOne({
      _id: orderId,
      restaurantId: req.userId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update status
    order.status = status;
    await order.save();

    await order.populate('tableId', 'tableName seats');

    // EMIT SOCKET EVENT FOR STATUS UPDATE TO CUSTOMER
    const io = req.app.get('io');
    if (io) {
      // Emit to restaurant dashboard
      io.to(`restaurant-${req.userId}`).emit('order-status-updated', {
        orderId: order._id.toString(),
        status: order.status,
        tableNumber: order.tableId.tableName,
        timestamp: new Date()
      });

      // Emit to customer (order-specific room)
      io.to(`order-${orderId}`).emit('order-status-changed', {
        orderId: order._id.toString(),
        status: order.status,
        timestamp: new Date()
      });

      console.log(`Emitted order-status-updated event for order ${orderId}`);
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating order status',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// DELETE /api/orders/:orderId - Cancel an order (only if pending)
router.delete('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Validate orderId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    // Find order and verify ownership
    const order = await Order.findOne({
      _id: orderId,
      restaurantId: req.userId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Only allow cancellation of pending orders
    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status '${order.status}'. Only pending orders can be cancelled.`
      });
    }

    // Update status to cancelled
    order.status = 'cancelled';
    await order.save();

    // EMIT SOCKET EVENT FOR CANCELLATION
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant-${req.userId}`).emit('order-cancelled', {
        orderId: order._id.toString(),
        timestamp: new Date()
      });

      console.log(`Emitted order-cancelled event for order ${orderId}`);
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: order
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling order',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

module.exports = router;