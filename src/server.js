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
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://main.d3f39s5iljebpo.amplifyapp.com';

// Dynamic CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow trycloudflare.com subdomains
    if (origin.endsWith('.trycloudflare.com')) {
      return callback(null, true);
    }
    
    // Allow configured frontend URL
    if (origin === FRONTEND_URL) {
      return callback(null, true);
    }
    
    // Allow localhost in development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    callback(null, true); // Allow all for now
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
};

// Socket.io setup with dynamic CORS
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (origin.endsWith('.trycloudflare.com')) return callback(null, true);
      if (origin === FRONTEND_URL) return callback(null, true);
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) return callback(null, true);
      callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Make io accessible in routes
app.set('io', io);

// Middlewares
app.use(cors(corsOptions));
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
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://uditanshubhatt_db_user:umd8M51rOT4qetrn@qrmenu.c8xezrr.mongodb.net/?retryWrites=true&w=majority&appName=qrmenu";
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
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

// Serve static files from build folder (build is in parent directory)
app.use(express.static(path.join(__dirname, '../build')));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

// Catch-all route for React app (must be last)
app.use((req, res, next) => {
  // Skip catch-all for API routes
  if (req.path.startsWith('/api') || req.path.startsWith('/src/uploads')) {
    return res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  }
  
  // Serve React app for all other routes
  res.sendFile(path.join(__dirname, '../build', 'index.html'), (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).json({
        success: false,
        message: 'Error loading application'
      });
    }
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS enabled for: ${FRONTEND_URL} and *.trycloudflare.com`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Serving static files from: ${path.join(__dirname, '../build')}`);
});
