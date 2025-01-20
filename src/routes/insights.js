const express = require("express");
const router = express.Router();
const { authenticateToken, isPremium } = require("../middleware/auth");
const { supabaseClient } = require("../config/supabase");

// Get dream statistics (requires premium)
router.get("/stats", authenticateToken, isPremium, async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Get total dreams count
    const { count: totalDreams, error: countError } = await supabaseClient
      .from("dreams")
      .select("*", { count: "exact" })
      .eq("user_id", userId);

    if (countError) throw countError;

    // Get lucid dreams count
    const { count: lucidDreams, error: lucidError } = await supabaseClient
      .from("dreams")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .eq("is_lucid", true);

    if (lucidError) throw lucidError;

    // Calculate average clarity and sleep quality
    const { data: averages, error: avgError } = await supabaseClient
      .from("dreams")
      .select("clarity_level, sleep_quality")
      .eq("user_id", userId);

    if (avgError) throw avgError;

    const avgClarity =
      averages.reduce((sum, dream) => sum + (dream.clarity_level || 0), 0) /
      averages.length;
    const avgSleepQuality =
      averages.reduce((sum, dream) => sum + (dream.sleep_quality || 0), 0) /
      averages.length;

    res.json({
      total_dreams: totalDreams,
      lucid_dreams: lucidDreams,
      lucidity_rate: totalDreams ? (lucidDreams / totalDreams) * 100 : 0,
      average_clarity: avgClarity || 0,
      average_sleep_quality: avgSleepQuality || 0,
    });
  } catch (error) {
    console.error("Error fetching dream statistics:", error);
    res.status(500).json({
      message: "Error fetching dream statistics",
      error: error.message,
    });
  }
});

// Get mood patterns (requires premium)
router.get("/moods", authenticateToken, isPremium, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const { data: moodData, error: moodError } = await supabaseClient
      .from("dreams")
      .select(
        `
        dream_date,
        dream_moods (
          intensity,
          moods (
            name
          )
        )
      `
      )
      .eq("user_id", userId)
      .order("dream_date", { ascending: true });

    if (moodError) throw moodError;

    // Process mood data
    const moodPatterns = moodData.reduce((acc, dream) => {
      const date = dream.dream_date;
      dream.dream_moods?.forEach((dm) => {
        if (dm.moods?.name) {
          if (!acc[dm.moods.name]) {
            acc[dm.moods.name] = {
              count: 0,
              average_intensity: 0,
              by_date: {},
            };
          }
          acc[dm.moods.name].count++;
          acc[dm.moods.name].average_intensity += dm.intensity || 0;
          acc[dm.moods.name].by_date[date] = dm.intensity || 0;
        }
      });
      return acc;
    }, {});

    // Calculate averages
    Object.keys(moodPatterns).forEach((mood) => {
      moodPatterns[mood].average_intensity /= moodPatterns[mood].count;
    });

    res.json(moodPatterns);
  } catch (error) {
    console.error("Error fetching mood patterns:", error);
    res.status(500).json({
      message: "Error fetching mood patterns",
      error: error.message,
    });
  }
});

// Get theme analysis (requires premium)
router.get("/themes", authenticateToken, isPremium, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const { data: dreams, error: dreamError } = await supabaseClient
      .from("dreams")
      .select(
        `
        dream_date,
        dream_tags (
          tags (
            name,
            category
          )
        ),
        dream_analysis (
          themes,
          symbols_detected
        )
      `
      )
      .eq("user_id", userId)
      .order("dream_date", { ascending: true });

    if (dreamError) throw dreamError;

    // Process theme and symbol data
    const themeAnalysis = {
      common_themes: {},
      common_symbols: {},
      by_date: {},
    };

    dreams.forEach((dream) => {
      const date = dream.dream_date;
      themeAnalysis.by_date[date] = {
        themes: [],
        symbols: [],
      };

      // Process themes from AI analysis
      dream.dream_analysis?.forEach((analysis) => {
        if (analysis.themes) {
          analysis.themes.forEach((theme) => {
            themeAnalysis.common_themes[theme] =
              (themeAnalysis.common_themes[theme] || 0) + 1;
            themeAnalysis.by_date[date].themes.push(theme);
          });
        }
        if (analysis.symbols_detected) {
          analysis.symbols_detected.forEach((symbol) => {
            themeAnalysis.common_symbols[symbol] =
              (themeAnalysis.common_symbols[symbol] || 0) + 1;
            themeAnalysis.by_date[date].symbols.push(symbol);
          });
        }
      });

      // Process tags
      dream.dream_tags?.forEach((dt) => {
        if (dt.tags?.name) {
          themeAnalysis.common_symbols[dt.tags.name] =
            (themeAnalysis.common_symbols[dt.tags.name] || 0) + 1;
          themeAnalysis.by_date[date].symbols.push(dt.tags.name);
        }
      });
    });

    res.json(themeAnalysis);
  } catch (error) {
    console.error("Error fetching theme analysis:", error);
    res.status(500).json({
      message: "Error fetching theme analysis",
      error: error.message,
    });
  }
});

// Get dream timing patterns (requires premium)
router.get(
  "/timing-patterns",
  authenticateToken,
  isPremium,
  async (req, res) => {
    try {
      const userId = req.user.user_id;

      // Get dreams with dates and lucidity info
      const { data: dreams, error: dreamError } = await supabaseClient
        .from("dreams")
        .select("dream_date, is_lucid, clarity_level")
        .eq("user_id", userId)
        .order("dream_date", { ascending: true });

      if (dreamError) throw dreamError;

      // Process dreams by day of week
      const byDayOfWeek = Array(7)
        .fill()
        .map((_, i) => ({
          day: i,
          total: 0,
          lucid: 0,
          lucidityRate: 0,
          avgClarity: 0,
        }));

      // Process dreams by hour
      const byHour = Array(24)
        .fill()
        .map((_, i) => ({
          hour: i,
          total: 0,
          lucid: 0,
        }));

      dreams.forEach((dream) => {
        const date = new Date(dream.dream_date);
        const dayOfWeek = date.getDay();
        const hour = date.getHours();

        // Update day of week stats
        byDayOfWeek[dayOfWeek].total++;
        if (dream.is_lucid) byDayOfWeek[dayOfWeek].lucid++;
        if (dream.clarity_level) {
          byDayOfWeek[dayOfWeek].avgClarity =
            (byDayOfWeek[dayOfWeek].avgClarity *
              (byDayOfWeek[dayOfWeek].total - 1) +
              dream.clarity_level) /
            byDayOfWeek[dayOfWeek].total;
        }

        // Update hour stats
        byHour[hour].total++;
        if (dream.is_lucid) byHour[hour].lucid++;
      });

      // Calculate lucidity rates
      byDayOfWeek.forEach((day) => {
        day.lucidityRate = day.total ? (day.lucid / day.total) * 100 : 0;
      });

      // Find best times for lucid dreams
      const bestLucidityTimes = byHour
        .map((hour, index) => ({
          hour: index,
          count: hour.lucid,
          rate: hour.total ? (hour.lucid / hour.total) * 100 : 0,
        }))
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 5);

      res.json({
        byDayOfWeek,
        bestLucidityTimes,
      });
    } catch (error) {
      console.error("Error fetching timing patterns:", error);
      res.status(500).json({
        message: "Error fetching timing patterns",
        error: error.message,
      });
    }
  }
);

// Get mood and theme analysis (requires premium)
router.get(
  "/mood-theme-analysis",
  authenticateToken,
  isPremium,
  async (req, res) => {
    try {
      const userId = req.user.user_id;

      // Get dreams with moods and analysis
      const { data: dreams, error: dreamError } = await supabaseClient
        .from("dreams")
        .select(
          `
          id,
          dream_date,
          is_lucid,
          dream_moods (
            moods (
              name,
              category
            ),
            intensity
          ),
          dream_analysis (
            themes
          )
        `
        )
        .eq("user_id", userId)
        .order("dream_date", { ascending: true });

      if (dreamError) throw dreamError;

      // Initialize analysis objects
      const moodFrequency = {};
      const moodsByLucidity = {
        lucid: {},
        nonLucid: {},
      };
      const commonThemes = {};

      dreams.forEach((dream) => {
        // Process moods
        dream.dream_moods?.forEach((dm) => {
          if (dm.moods?.name) {
            // Update mood frequency
            moodFrequency[dm.moods.name] =
              (moodFrequency[dm.moods.name] || 0) + 1;

            // Update moods by lucidity
            const lucidityType = dream.is_lucid ? "lucid" : "nonLucid";
            moodsByLucidity[lucidityType][dm.moods.name] =
              (moodsByLucidity[lucidityType][dm.moods.name] || 0) + 1;
          }
        });

        // Process themes
        dream.dream_analysis?.forEach((analysis) => {
          analysis.themes?.forEach((theme) => {
            commonThemes[theme] = (commonThemes[theme] || 0) + 1;
          });
        });
      });

      res.json({
        moodFrequency,
        moodsByLucidity,
        commonThemes,
      });
    } catch (error) {
      console.error("Error fetching mood and theme analysis:", error);
      res.status(500).json({
        message: "Error fetching mood and theme analysis",
        error: error.message,
      });
    }
  }
);

module.exports = router;
