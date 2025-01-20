const express = require("express");
const router = express.Router();
const EmailService = require("../services/emailService");
const { supabaseClient } = require("../config/supabase");

// Helper function to get real IP address
const getClientIp = (req) => {
  // X-Forwarded-For header is typically set by proxies/load balancers
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    // Get the first IP in the list (original client IP)
    return forwardedFor.split(",")[0].trim();
  }
  // Try other headers that might contain the real IP
  return (
    req.headers["x-real-ip"] ||
    req.headers["x-client-ip"] ||
    req.connection.remoteAddress ||
    req.ip
  );
};

router.post("/", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Get useful metadata from request
    const metadata = {
      source: req.headers.referer || "direct",
      userAgent: req.headers["user-agent"],
      timestamp: new Date().toISOString(),
      ipAddress: getClientIp(req),
      language: req.headers["accept-language"],
    };

    // Check if email already exists in waitlist
    const { data: existingSignup, error: checkError } = await supabaseClient
      .from("waitlist")
      .select("id")
      .eq("email", email)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    if (existingSignup) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Store waitlist signup in database with metadata
    const { data: waitlistEntry, error: insertError } = await supabaseClient
      .from("waitlist")
      .insert([
        {
          email,
          status: "active",
          metadata,
        },
      ])
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Try to send welcome email, but don't fail if email service is disabled
    const emailResult = await EmailService.sendWaitlistEmail(email, metadata);

    // Return appropriate response based on email service status
    res.status(200).json({
      message: "Successfully joined waitlist",
      email,
      email_status: EmailService.isEnabled()
        ? emailResult?.success
          ? "sent"
          : "failed"
        : "disabled",
    });
  } catch (error) {
    console.error("Waitlist signup error:", error);
    res.status(500).json({
      error: "Failed to join waitlist",
      details: error.message,
    });
  }
});

// Get all waitlist entries (protected route that we can add later)
router.get("/", async (req, res) => {
  try {
    const { data: entries, error } = await supabaseClient
      .from("waitlist")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    res.json(entries);
  } catch (error) {
    console.error("Error fetching waitlist:", error);
    res.status(500).json({
      error: "Failed to fetch waitlist",
      details: error.message,
    });
  }
});

module.exports = router;
