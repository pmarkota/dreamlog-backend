const { supabaseClient } = require("../config/supabase");
const jwt = require("jsonwebtoken");

// Get user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log("Fetching profile for user:", userId);

    const { data: user, error } = await supabaseClient
      .from("users")
      .select(
        "id, email, full_name, profile_picture_url, preferences, created_at, is_premium"
      )
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching user profile:", error);
      throw error;
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Ensure preferences is an object
    user.preferences = user.preferences || {
      age: null,
      bedtime: "22:00",
      wake_time: "07:00",
      dream_reminders: true,
      notifications: true,
      dark_theme: false,
    };

    res.json(user);
  } catch (error) {
    console.error("Error in getProfile:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch profile", error: error.message });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { full_name, profile_picture_url, preferences } = req.body;
    console.log("Updating profile for user:", userId, "with data:", req.body);

    // Validate preferences if provided
    if (preferences) {
      const {
        bedtime,
        wake_time,
        age,
        dream_reminders,
        notifications,
        dark_theme,
      } = preferences;

      // Validate time format (HH:mm)
      if (bedtime && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(bedtime)) {
        return res
          .status(400)
          .json({ message: "Invalid bedtime format. Use HH:mm" });
      }
      if (wake_time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(wake_time)) {
        return res
          .status(400)
          .json({ message: "Invalid wake time format. Use HH:mm" });
      }

      // Validate age
      if (age && (typeof age !== "number" || age < 13 || age > 120)) {
        return res
          .status(400)
          .json({ message: "Invalid age. Must be between 13 and 120" });
      }

      // Validate boolean fields
      if (
        dream_reminders !== undefined &&
        typeof dream_reminders !== "boolean"
      ) {
        return res
          .status(400)
          .json({ message: "dream_reminders must be a boolean" });
      }
      if (notifications !== undefined && typeof notifications !== "boolean") {
        return res
          .status(400)
          .json({ message: "notifications must be a boolean" });
      }
      if (dark_theme !== undefined && typeof dark_theme !== "boolean") {
        return res
          .status(400)
          .json({ message: "dark_theme must be a boolean" });
      }
    }

    const { data: user, error } = await supabaseClient
      .from("users")
      .update({
        full_name: full_name,
        profile_picture_url: profile_picture_url,
        preferences: preferences,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select(
        "id, email, full_name, profile_picture_url, preferences, created_at, is_premium"
      )
      .single();

    if (error) {
      console.error("Error updating user profile:", error);
      throw error;
    }

    console.log("Profile updated successfully:", user);
    res.json(user);
  } catch (error) {
    console.error("Error in updateProfile:", error);
    res
      .status(500)
      .json({ message: "Failed to update profile", error: error.message });
  }
};

// Update premium status
const updatePremiumStatus = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { is_premium } = req.body;

    if (typeof is_premium !== "boolean") {
      return res.status(400).json({ message: "is_premium must be a boolean" });
    }

    console.log("Updating premium status for user:", userId, "to:", is_premium);

    const { data: user, error } = await supabaseClient
      .from("users")
      .update({
        is_premium: is_premium,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("id, email, full_name, is_premium")
      .single();

    if (error) {
      console.error("Error updating premium status:", error);
      throw error;
    }

    // Generate new JWT with updated premium status
    const token = jwt.sign(
      {
        user_id: user.id,
        email: user.email,
        is_premium: user.is_premium,
      },
      process.env.JWT_SECRET
    );

    console.log("Premium status updated successfully:", user);
    res.json({ user, token });
  } catch (error) {
    console.error("Error in updatePremiumStatus:", error);
    res.status(500).json({
      message: "Failed to update premium status",
      error: error.message,
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updatePremiumStatus,
};
