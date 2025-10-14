const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  restaurantName: { type: String, required: true },
  name: { type: String, required: true }, // owner name
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);
