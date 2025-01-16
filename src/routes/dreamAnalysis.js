const express = require("express");
const router = express.Router();
const { authenticateToken, isPremium } = require("../middleware/auth");
const {
  getBasicAnalysis,
  getPremiumAnalysis,
  getDailyPrompt,
} = require("../controllers/dreamAnalysisController");

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Basic analysis (free feature)
router.get("/basic/:dreamId", getBasicAnalysis);

// Premium analysis (requires premium subscription)
router.get("/premium/:dreamId", isPremium, getPremiumAnalysis);

// Daily dream prompt (available to all, but premium users get special prompts)
router.get("/prompt/daily", getDailyPrompt);

module.exports = router;
