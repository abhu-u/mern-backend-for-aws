const jwt = require("jsonwebtoken");
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ 
      success: false,
      message: "User authentication required. Please login to create tables." 
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id; // attach userId to req
    next();
  } catch (err) {
    return res.status(401).json({ 
      success: false,
      message: "Invalid token. Please login again." 
    });
  }
};

module.exports = authMiddleware;