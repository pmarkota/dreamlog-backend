const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { supabaseAdmin } = require("../config/supabase");

const signup = async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user
    const { data: newUser, error } = await supabaseAdmin
      .from("users")
      .insert([
        {
          email,
          password_hash,
          full_name,
          is_premium: false,
          preferences: {},
        },
      ])
      .select("id, email, full_name, is_premium, created_at")
      .single();

    if (error) {
      console.error("Signup error:", error);
      return res.status(500).json({ message: "Error creating user" });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        user_id: newUser.id,
        email: newUser.email,
        is_premium: newUser.is_premium,
      },
      process.env.JWT_SECRET
    );

    res.status(201).json({
      message: "User created successfully",
      user: newUser,
      token,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Get user
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id, email, full_name, password_hash, is_premium")
      .eq("email", email)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Update last login
    await supabaseAdmin
      .from("users")
      .update({ last_login: new Date().toISOString() })
      .eq("id", user.id);

    // Generate JWT
    const token = jwt.sign(
      {
        user_id: user.id,
        email: user.email,
        is_premium: user.is_premium,
      },
      process.env.JWT_SECRET
    );

    // Remove password_hash from response
    delete user.password_hash;

    res.json({
      message: "Login successful",
      user,
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  signup,
  login,
};
