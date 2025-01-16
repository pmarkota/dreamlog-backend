const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const {
  createDream,
  getDreams,
  getDreamById,
  updateDream,
  deleteDream,
  getDreamsByDate,
} = require("../controllers/dreamController");

// Apply authentication middleware to each route individually
router.post("/", authenticateToken, createDream);
router.get("/", authenticateToken, getDreams);
router.get("/date/:date", authenticateToken, getDreamsByDate);
router.get("/:id", authenticateToken, getDreamById);
router.put("/:id", authenticateToken, updateDream);
router.delete("/:id", authenticateToken, deleteDream);

module.exports = router;
