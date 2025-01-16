const express = require("express");
const router = express.Router();
const { signup, login } = require("../controllers/authController");
const {
  validateSignup,
  validateLogin,
  validate,
} = require("../middleware/authValidation");

// POST /api/auth/signup
router.post("/signup", validateSignup, validate, signup);

// POST /api/auth/login
router.post("/login", validateLogin, validate, login);

module.exports = router;
