const express = require("express");
const Table = require("../models/Table");
const Section = require("../models/Section");
const MenuItem = require("../models/MenuItem");

const router = express.Router();

// ==== GET Menu by Table ID ====
// In your menu route file, update the /table/:tableId endpoint:

router.get("/table/:tableId", async (req, res) => {
  try {
    const { tableId } = req.params;
    
    console.log('Getting menu for table:', tableId);
    
    const table = await Table.findById(tableId).populate('restaurantId', 'restaurantName email');
    if (!table) return res.status(404).json({ success: false, message: 'Table not found' });

    console.log('Found table:', table.tableName, 'Restaurant:', table.restaurantId?.restaurantName);
    
    const sections = await Section.find({ restaurantId: table.restaurantId._id, isActive: true }).sort({ createdAt: 1 });
    const menuItems = await MenuItem.find({ restaurantId: table.restaurantId._id, isActive: true })
                                    .populate('sectionId', 'name')
                                    .sort({ createdAt: 1 });

    const sectionsWithItems = sections.map(section => ({
      ...section.toObject(),
      id: section._id,
      items: menuItems
        .filter(item => {
          const itemSectionId = typeof item.sectionId === 'object' ? item.sectionId._id : item.sectionId;
          return itemSectionId.toString() === section._id.toString();
        })
        .map(item => ({
          ...item.toObject(),
          id: item._id,
          sectionId: typeof item.sectionId === 'object' ? item.sectionId._id : item.sectionId,
          addons: Array.isArray(item.addons) ? item.addons : []
        }))
    }));

    res.json({
      success: true,
      data: {
        restaurant: {
          name: table.restaurantId?.restaurantName || 'Restaurant',
          id: table.restaurantId?._id
        },
        table: {
          id: table._id,
          tableName: table.tableName,
          seats: table.seats,
          restaurantId: table.restaurantId._id
        },
        menu: sectionsWithItems
      }
    });
  } catch (err) {
    console.error('Get menu by table error:', err);
    res.status(500).json({ success: false, message: "Server error while fetching menu", error: err.message });
  }
});

module.exports = router;
