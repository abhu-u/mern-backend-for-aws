const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0.01
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  addons: [{
    type: String
  }],
  specialInstructions: {
    type: String,
    trim: true,
    maxlength: 200,
    default: ''
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  tableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table',
    required: true,
    index: true
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  customerName: {
    type: String,
    trim: true,
    maxlength: 100,
    default: 'Guest'
  },
  items: {
    type: [orderItemSchema],
    required: true,
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: 'Order must contain at least one item'
    }
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0.01
  },
  specialInstructions: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'preparing', 'ready', 'served', 'cancelled'],
    default: 'pending',
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
orderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
orderSchema.index({ tableId: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);