const jwt = require("jsonwebtoken");
const { supabaseClient } = require("../config/supabase");

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Verify premium status from database
    const { data: user, error: userError } = await supabaseClient
      .from("users")
      .select("is_premium")
      .eq("id", decoded.user_id)
      .single();

    if (userError) {
      console.error("Error fetching user premium status:", userError);
      throw userError;
    }

    // Update premium status from database
    req.user.is_premium = user.is_premium;

    next();
  } catch (error) {
    console.error("Error authenticating token:", error);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

const isPremium = (req, res, next) => {
  if (!req.user.is_premium) {
    return res.status(403).json({ message: "Premium subscription required" });
  }
  next();
};

module.exports = {
  authenticateToken,
  isPremium,
};
