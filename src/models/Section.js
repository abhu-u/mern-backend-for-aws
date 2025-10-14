const mongoose = require("mongoose");

const sectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// Compound index for efficient queries by restaurant
sectionSchema.index({ restaurantId: 1, isActive: 1 });

module.exports = mongoose.model("Section", sectionSchema);