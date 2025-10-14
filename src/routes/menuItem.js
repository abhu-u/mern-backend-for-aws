const express = require("express");
const MenuItem = require("../models/MenuItem");
const Section = require("../models/Section");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// ==== CREATE Menu Item ====
router.post("/", upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, isVeg = false, sectionId, addons = [] } = req.body;
    
    // Validation
    if (!name || name.trim() === '') {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        success: false,
        message: "Item name is required" 
      });
    }

    if (!description || description.trim() === '') {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        success: false,
        message: "Description is required" 
      });
    }

    if (!price || price <= 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        success: false,
        message: "Valid price is required" 
      });
    }

    if (!sectionId) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        success: false,
        message: "Section is required" 
      });
    }

    // Parse addons if it's a JSON string (from FormData)
    let parsedAddons = [];
    if (addons) {
      try {
        parsedAddons = typeof addons === 'string' ? JSON.parse(addons) : addons;
      } catch (e) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: "Invalid addons format"
        });
      }
    }

    // Validate addons structure
    if (parsedAddons && Array.isArray(parsedAddons)) {
      for (const addon of parsedAddons) {
        if (!addon.name || typeof addon.name !== 'string') {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({
            success: false,
            message: "Each addon must have a valid name"
          });
        }
        if (typeof addon.price !== 'number' || addon.price < 0) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({
            success: false,
            message: "Each addon must have a valid price (0 or greater)"
          });
        }
      }
    }

    // Verify that the section belongs to this restaurant
    const section = await Section.findOne({
      _id: sectionId,
      restaurantId: req.userId,
      isActive: true
    });

    if (!section) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Section not found or does not belong to your restaurant'
      });
    }

    // Check if menu item name already exists in this restaurant
    const existingItem = await MenuItem.findOne({
      restaurantId: req.userId,
      name: name.trim(),
      isActive: true
    });

    if (existingItem) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Menu item with this name already exists'
      });
    }

    const menuItemData = { 
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      isVeg: Boolean(isVeg),
      sectionId,
      restaurantId: req.userId,
      addons: parsedAddons
    };

    // Add image path if uploaded
    if (req.file) {
      menuItemData.image = `/src/uploads/${req.file.filename}`;
    }

    const menuItem = new MenuItem(menuItemData);
    await menuItem.save();
    await menuItem.populate('sectionId', 'name');
    
    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      data: menuItem
    });
  } catch (err) {
    console.error('Create menu item error:', err);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ 
      success: false,
      message: "Server error while creating menu item",
      error: err.message
    });
  }
});

// ==== READ All Menu Items ====
router.get("/", async (req, res) => {
  try {
    const menuItems = await MenuItem.find({
      restaurantId: req.userId,
      isActive: true
    })
    .populate('sectionId', 'name')
    .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: menuItems,
      count: menuItems.length
    });
  } catch (err) {
    console.error('Get menu items error:', err);
    res.status(500).json({ 
      success: false,
      message: "Server error while fetching menu items",
      error: err.message
    });
  }
});

// ==== UPDATE Menu Item ====
router.put("/:id", upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, isVeg, sectionId, addons, isActive } = req.body;
    const { id } = req.params;
    
    // Validation
    if (name && name.trim() === '') {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        success: false,
        message: "Item name cannot be empty" 
      });
    }

    if (description && description.trim() === '') {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        success: false,
        message: "Description cannot be empty" 
      });
    }

    if (price && price <= 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        success: false,
        message: "Price must be greater than 0" 
      });
    }

    // Parse addons if it's a JSON string (from FormData)
    let parsedAddons = addons;
    if (addons && typeof addons === 'string') {
      try {
        parsedAddons = JSON.parse(addons);
      } catch (e) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: "Invalid addons format"
        });
      }
    }

    // Validate addons structure if provided
    if (parsedAddons && Array.isArray(parsedAddons)) {
      for (const addon of parsedAddons) {
        if (!addon.name || typeof addon.name !== 'string') {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({
            success: false,
            message: "Each addon must have a valid name"
          });
        }
        if (typeof addon.price !== 'number' || addon.price < 0) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({
            success: false,
            message: "Each addon must have a valid price (0 or greater)"
          });
        }
      }
    }

    // Find menu item and verify ownership
    const menuItem = await MenuItem.findOne({
      _id: id,
      restaurantId: req.userId
    });

    if (!menuItem) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ 
        success: false,
        message: "Menu item not found" 
      });
    }

    // If changing section, verify the new section belongs to this restaurant
    if (sectionId && sectionId !== menuItem.sectionId.toString()) {
      const section = await Section.findOne({
        _id: sectionId,
        restaurantId: req.userId,
        isActive: true
      });

      if (!section) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          message: 'Section not found or does not belong to your restaurant'
        });
      }
    }

    // Check if new name already exists (excluding current item)
    if (name && name.trim() !== menuItem.name) {
      const existingItem = await MenuItem.findOne({
        restaurantId: req.userId,
        name: name.trim(),
        isActive: true,
        _id: { $ne: id }
      });

      if (existingItem) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Menu item with this name already exists'
        });
      }
    }

    // Handle image update
    if (req.file) {
      // Delete old image if it exists
      if (menuItem.image) {
        const oldImagePath = path.join(__dirname, '..', menuItem.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      menuItem.image = `/src/uploads/${req.file.filename}`;
    }

    // Update fields
    if (name) menuItem.name = name.trim();
    if (description) menuItem.description = description.trim();
    if (price) menuItem.price = parseFloat(price);
    if (typeof isVeg === 'boolean') menuItem.isVeg = isVeg;
    if (sectionId) menuItem.sectionId = sectionId;
    if (Array.isArray(parsedAddons)) menuItem.addons = parsedAddons;
    if (typeof isActive === 'boolean') menuItem.isActive = isActive;

    await menuItem.save();
    await menuItem.populate('sectionId', 'name');

    res.json({
      success: true,
      message: 'Menu item updated successfully',
      data: menuItem
    });
  } catch (err) {
    console.error('Update menu item error:', err);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ 
      success: false,
      message: "Server error while updating menu item",
      error: err.message
    });
  }
});

// ==== DELETE Menu Item (hard delete) ====
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Find menu item and verify ownership
    const menuItem = await MenuItem.findOne({
      _id: id,
      restaurantId: req.userId,
      isActive: true
    });

    if (!menuItem) {
      return res.status(404).json({ 
        success: false,
        message: "Menu item not found" 
      });
    }

    // Delete associated image if exists
    if (menuItem.image) {
      const imagePath = path.join(__dirname, '..', menuItem.image);
      if (fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
        } catch (err) {
          console.error('Error deleting image:', err);
          // Continue with deletion even if image deletion fails
        }
      }
    }

    // Hard delete - permanently remove from database
    await MenuItem.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Menu item deleted successfully'
    });
  } catch (err) {
    console.error('Delete menu item error:', err);
    res.status(500).json({ 
      success: false,
      message: "Server error while deleting menu item",
      error: err.message
    });
  }
});

module.exports = router;