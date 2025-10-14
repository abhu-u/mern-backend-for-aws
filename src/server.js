const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require("./routes/auth");
const sectionRoutes = require("./routes/section");
const menuItemRoutes = require("./routes/menuItem");
const tableRoutes = require("./routes/tables");
const menuRoutes = require("./routes/menu");

const app = express();
const server = http.createServer(app);

// Get frontend URL from environment variable
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Make io accessible in routes
app.set('io', io);

// Middlewares
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(express.json());

app.use('/src/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/menuitems", menuItemRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", require("./routes/orders"));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'QR Menu API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/qrmenu";
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected to:", MONGODB_URI))
  .catch((err) => console.error("MongoDB connection error:", err));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join restaurant-specific room
  socket.on('join-restaurant', (restaurantId) => {
    socket.join(`restaurant-${restaurantId}`);
    console.log(`Socket ${socket.id} joined restaurant-${restaurantId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS enabled for: ${FRONTEND_URL}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});