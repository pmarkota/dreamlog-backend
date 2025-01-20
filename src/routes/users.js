const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const {
  getProfile,
  updateProfile,
  updatePremiumStatus,
} = require("../controllers/userController");

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Get user profile
router.get("/profile", getProfile);

// Update user profile
router.put("/profile", updateProfile);

// Update premium status
router.put("/premium-status", updatePremiumStatus);

module.exports = router;
