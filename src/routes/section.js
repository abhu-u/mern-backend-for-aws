const express = require("express");
const Section = require("../models/Section");
const MenuItem = require("../models/MenuItem");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// ==== CREATE Section ====
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    
    console.log('Create section request:', {
      body: req.body,
      userId: req.userId,
      userFromAuth: req.user ? req.user._id : 'No user object'
    });
    
    if (!name) {
      return res.status(400).json({ 
        success: false,
        message: "Section name is required" 
      });
    }

    // Check if userId is available from auth middleware
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed - no user ID found"
      });
    }

    // Check if section name already exists for this restaurant
    const existingSection = await Section.findOne({
      restaurantId: req.userId,
      name: name.trim(),
      isActive: true
    });

    if (existingSection) {
      return res.status(400).json({
        success: false,
        message: 'Section with this name already exists'
      });
    }

    // Create section with restaurantId from authenticated user
    const section = new Section({ 
      name: name.trim(),
      restaurantId: req.userId
    });
    
    await section.save();
    
    res.status(201).json({
      success: true,
      message: 'Section created successfully',
      data: section
    });
  } catch (err) {
    console.error('Create section error:', err);
    res.status(500).json({ 
      success: false,
      message: "Server error while creating section",
      error: err.message
    });
  }
});

// ==== READ All Sections ====
router.get("/", async (req, res) => {
  try {
    // Only get sections for this restaurant
    const sections = await Section.find({
      restaurantId: req.userId,
      isActive: true
    }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: sections,
      count: sections.length
    });
  } catch (err) {
    console.error('Get sections error:', err);
    res.status(500).json({ 
      success: false,
      message: "Server error while fetching sections",
      error: err.message
    });
  }
});

// ==== UPDATE Section ====
router.put("/:id", async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const { id } = req.params;
    
    if (name && name.trim() === '') {
      return res.status(400).json({ 
        success: false,
        message: "Section name cannot be empty" 
      });
    }

    // Find section and verify ownership
    const section = await Section.findOne({
      _id: id,
      restaurantId: req.userId
    });

    if (!section) {
      return res.status(404).json({ 
        success: false,
        message: "Section not found or you don't have permission to edit it" 
      });
    }

    // Check if new name already exists (excluding current section)
    if (name && name.trim() !== section.name) {
      const existingSection = await Section.findOne({
        restaurantId: req.userId,
        name: name.trim(),
        isActive: true,
        _id: { $ne: id }
      });

      if (existingSection) {
        return res.status(400).json({
          success: false,
          message: 'Section with this name already exists'
        });
      }
    }

    // Update fields
    if (name) section.name = name.trim();
    if (typeof isActive === 'boolean') section.isActive = isActive;

    await section.save();

    res.json({
      success: true,
      message: 'Section updated successfully',
      data: section
    });
  } catch (err) {
    console.error('Update section error:', err);
    res.status(500).json({ 
      success: false,
      message: "Server error while updating section",
      error: err.message
    });
  }
});

// ==== DELETE Section (hard delete with safety check) ====
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Find section and verify ownership
    const section = await Section.findOne({
      _id: id,
      restaurantId: req.userId,
      isActive: true
    });

    if (!section) {
      return res.status(404).json({ 
        success: false,
        message: "Section not found or you don't have permission to delete it" 
      });
    }

    // Check if section has menu items (including inactive ones to prevent orphans)
    const menuItemCount = await MenuItem.countDocuments({
      sectionId: id,
      isActive: true
    });

    if (menuItemCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete section. It contains ${menuItemCount} menu item(s). Please delete or move the items first.`
      });
    }

    // Hard delete - permanently remove from database
    await Section.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Section deleted successfully'
    });
  } catch (err) {
    console.error('Delete section error:', err);
    res.status(500).json({ 
      success: false,
      message: "Server error while deleting section",
      error: err.message
    });
  }
});

module.exports = router;