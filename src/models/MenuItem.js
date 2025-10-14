const mongoose = require("mongoose");

const addonSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 50 },
  price: { type: Number, required: true, min: 0, default: 0 }
}, { _id: false });

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, required: true, maxlength: 500 },
  price: { type: Number, required: true, min: 0.01 },
  isVeg: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  image: { type: String },
  addons: [addonSchema], // Now structured with name and price
  
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model("MenuItem", menuItemSchema);