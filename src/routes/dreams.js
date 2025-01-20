const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const { supabaseClient } = require("../config/supabase");
const { analyzeDream } = require("../utils/aiUtils");
const dreamController = require("../controllers/dreamController");

// Get dream categories
router.get("/categories", authenticateToken, async (req, res) => {
  try {
    console.log("Fetching categories");

    const { data: tags, error } = await supabaseClient
      .from("tags")
      .select("category")
      .not("category", "is", null);

    if (error) {
      console.error("Error fetching categories:", error);
      throw error;
    }

    // Get unique categories
    const uniqueCategories = [...new Set(tags.map((t) => t.category))].filter(
      Boolean
    );
    console.log("Found categories:", uniqueCategories);
    res.json(uniqueCategories);
  } catch (error) {
    console.error("Error in /categories:", error);
    res
      .status(500)
      .json({ message: "Error fetching categories", error: error.message });
  }
});

// Get dream moods
router.get("/moods", authenticateToken, async (req, res) => {
  try {
    console.log("Fetching moods");

    const { data: moods, error } = await supabaseClient
      .from("moods")
      .select("name")
      .order("name");

    if (error) {
      console.error("Error fetching moods:", error);
      throw error;
    }

    const moodNames = moods.map((m) => m.name);
    console.log("Found moods:", moodNames);
    res.json(moodNames);
  } catch (error) {
    console.error("Error in /moods:", error);
    res
      .status(500)
      .json({ message: "Error fetching moods", error: error.message });
  }
});

// Get dream statistics
router.get("/stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);

    // Get total dreams count
    const { count: totalDreams, error: totalError } = await supabaseClient
      .from("dreams")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (totalError) throw totalError;

    // Get this week's dreams count
    const { count: weekDreams, error: weekError } = await supabaseClient
      .from("dreams")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("dream_date", startOfWeek.toISOString().split("T")[0]);

    if (weekError) throw weekError;

    // Get lucid dreams count
    const { count: lucidDreams, error: lucidError } = await supabaseClient
      .from("dreams")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_lucid", true);

    if (lucidError) throw lucidError;

    res.json({
      total_dreams: totalDreams || 0,
      dreams_this_week: weekDreams || 0,
      lucid_dreams: lucidDreams || 0,
    });
  } catch (error) {
    console.error("Error fetching dream stats:", error);
    res.status(500).json({
      message: "Failed to fetch dream statistics",
      error: error.message,
    });
  }
});

// Get AI usage stats
router.get("/ai-usage", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log("Getting AI usage stats for user:", userId);

    const stats = await dreamController.checkAIUsageLimit(userId);
    console.log("AI usage stats:", stats);

    res.json({
      canUseAI: stats.canUseAI,
      remainingUses: stats.remainingUses,
      isUnlimited: stats.remainingUses === -1,
    });
  } catch (error) {
    console.error("Error getting AI usage stats:", error);
    res.status(500).json({
      error: "Failed to get AI usage stats",
      details: error.message,
    });
  }
});

// Get all dreams with filters
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log("Fetching dreams for user:", userId);

    const {
      search,
      category,
      mood,
      startDate,
      endDate,
      isLucid,
      sortBy = "dream_date",
      sortOrder = "desc",
    } = req.query;

    console.log("Query params:", {
      search,
      category,
      mood,
      startDate,
      endDate,
      isLucid,
      sortBy,
      sortOrder,
    });

    // Start the query
    let query = supabaseClient
      .from("dreams")
      .select(
        `
        *,
        dream_tags (
          tags (id, name, category)
        ),
        dream_moods (
          moods (id, name),
          intensity
        )
      `
      )
      .eq("user_id", userId);

    // Apply filters
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (startDate) {
      query = query.gte("dream_date", startDate);
    }

    if (endDate) {
      query = query.lte("dream_date", endDate);
    }

    if (isLucid !== undefined) {
      query = query.eq("is_lucid", isLucid === "true");
    }

    // Apply sorting
    const validSortColumns = ["dream_date", "title", "dream_type"];
    const validSortOrders = ["asc", "desc"];

    const finalSortBy = validSortColumns.includes(sortBy)
      ? sortBy
      : "dream_date";
    const finalSortOrder = validSortOrders.includes(sortOrder.toLowerCase())
      ? sortOrder.toLowerCase()
      : "desc";

    query = query.order(finalSortBy, { ascending: finalSortOrder === "asc" });

    console.log("Executing Supabase query...");
    const { data: dreams, error } = await query;

    if (error) {
      console.error("Supabase query error:", error);
      throw error;
    }

    console.log("Raw dreams data:", dreams);

    // Process the data to match the expected format
    const processedDreams = dreams.map((dream) => ({
      ...dream,
      tags:
        dream.dream_tags?.map((dt) => ({
          name: dt.tags.name,
          category: dt.tags.category,
        })) || [],
      moods:
        dream.dream_moods?.map((dm) => ({
          name: dm.moods.name,
          intensity: dm.intensity,
        })) || [],
    }));

    console.log("Processed dreams:", processedDreams);

    // Filter by category if specified (post-processing because we need to check tag categories)
    let filteredDreams = category
      ? processedDreams.filter((dream) =>
          dream.tags.some((tag) => tag.category === category)
        )
      : processedDreams;

    // Filter by mood if specified (post-processing because we need to check mood names)
    if (mood) {
      filteredDreams = filteredDreams.filter((dream) =>
        dream.moods.some((m) => m.name === mood)
      );
    }

    // Clean up response by removing junction table data
    filteredDreams.forEach((dream) => {
      delete dream.dream_tags;
      delete dream.dream_moods;
    });

    console.log("Sending response with dreams:", filteredDreams);
    res.json(filteredDreams);
  } catch (error) {
    console.error("Error fetching dreams:", error);
    res
      .status(500)
      .json({ message: "Error fetching dreams", error: error.message });
  }
});

// Get dreams by date
router.get("/by-date/:date", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { date } = req.params;
    console.log("Fetching dreams for date:", date, "user:", userId);

    const { data: dreams, error } = await supabaseClient
      .from("dreams")
      .select(
        `
        *,
        dream_tags (
          tags (id, name, category)
        ),
        dream_moods (
          moods (id, name),
          intensity
        )
      `
      )
      .eq("user_id", userId)
      .eq("dream_date", date);

    if (error) {
      console.error("Error fetching dreams by date:", error);
      throw error;
    }

    // Process the data to match the expected format
    const processedDreams = dreams.map((dream) => ({
      ...dream,
      tags:
        dream.dream_tags?.map((dt) => ({
          name: dt.tags.name,
          category: dt.tags.category,
        })) || [],
      moods:
        dream.dream_moods?.map((dm) => ({
          name: dm.moods.name,
          intensity: dm.intensity,
        })) || [],
    }));

    // Clean up response by removing junction table data
    processedDreams.forEach((dream) => {
      delete dream.dream_tags;
      delete dream.dream_moods;
    });

    res.json(processedDreams);
  } catch (error) {
    console.error("Error in /by-date/:date:", error);
    res.status(500).json({
      message: "Error fetching dreams by date",
      error: error.message,
    });
  }
});

// Create a new dream
router.post("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log("Creating dream for user:", userId);

    const {
      title,
      description,
      dream_date,
      is_lucid,
      clarity_level,
      sleep_quality,
      dream_type,
      tags,
      moods,
    } = req.body;

    console.log("Dream data:", req.body);

    // First, create the dream
    const { data: dreamData, error: dreamError } = await supabaseClient
      .from("dreams")
      .insert([
        {
          user_id: userId,
          title,
          description,
          dream_date,
          is_lucid,
          clarity_level,
          sleep_quality,
          dream_type,
        },
      ])
      .select()
      .single();

    if (dreamError) {
      console.error("Error creating dream:", dreamError);
      throw dreamError;
    }

    console.log("Created dream:", dreamData);

    // Handle tags
    if (tags && tags.length > 0) {
      // First ensure all tags exist in the tags table
      const { data: existingTags, error: tagsError } = await supabaseClient
        .from("tags")
        .select("id, name")
        .in("name", tags);

      if (tagsError) throw tagsError;

      const existingTagNames = existingTags?.map((t) => t.name) || [];
      const newTags = tags.filter((t) => !existingTagNames.includes(t));

      // Insert new tags
      if (newTags.length > 0) {
        const { error: newTagsError } = await supabaseClient
          .from("tags")
          .insert(newTags.map((name) => ({ name })));

        if (newTagsError) throw newTagsError;
      }

      // Get all tag IDs (both existing and newly created)
      const { data: allTags, error: allTagsError } = await supabaseClient
        .from("tags")
        .select("id, name")
        .in("name", tags);

      if (allTagsError) throw allTagsError;

      // Create dream_tags associations
      const dreamTags = allTags.map((tag) => ({
        dream_id: dreamData.id,
        tag_id: tag.id,
      }));

      const { error: dreamTagsError } = await supabaseClient
        .from("dream_tags")
        .insert(dreamTags);

      if (dreamTagsError) throw dreamTagsError;
    }

    // Handle moods
    if (moods && moods.length > 0) {
      // First ensure all moods exist in the moods table
      const { data: existingMoods, error: moodsError } = await supabaseClient
        .from("moods")
        .select("id, name")
        .in(
          "name",
          moods.map((m) => m.name)
        );

      if (moodsError) throw moodsError;

      const existingMoodNames = existingMoods?.map((m) => m.name) || [];
      const newMoods = moods
        .filter((m) => !existingMoodNames.includes(m.name))
        .map((m) => ({ name: m.name }));

      // Insert new moods
      if (newMoods.length > 0) {
        const { error: newMoodsError } = await supabaseClient
          .from("moods")
          .insert(newMoods);

        if (newMoodsError) throw newMoodsError;
      }

      // Get all mood IDs (both existing and newly created)
      const { data: allMoods, error: allMoodsError } = await supabaseClient
        .from("moods")
        .select("id, name")
        .in(
          "name",
          moods.map((m) => m.name)
        );

      if (allMoodsError) throw allMoodsError;

      // Create dream_moods associations with intensity
      const dreamMoods = allMoods.map((mood) => {
        const userMood = moods.find((m) => m.name === mood.name);
        return {
          dream_id: dreamData.id,
          mood_id: mood.id,
          intensity: userMood.intensity || 1,
        };
      });

      const { error: dreamMoodsError } = await supabaseClient
        .from("dream_moods")
        .insert(dreamMoods);

      if (dreamMoodsError) throw dreamMoodsError;
    }

    // Fetch the complete dream data with tags and moods
    const { data: completeDream, error: fetchError } = await supabaseClient
      .from("dreams")
      .select(
        `
        *,
        dream_tags (
          tags (id, name, category)
        ),
        dream_moods (
          moods (id, name),
          intensity
        )
      `
      )
      .eq("id", dreamData.id)
      .single();

    if (fetchError) throw fetchError;

    // Process the data to match the expected format
    const processedDream = {
      ...completeDream,
      tags:
        completeDream.dream_tags?.map((dt) => ({
          name: dt.tags.name,
          category: dt.tags.category,
        })) || [],
      moods:
        completeDream.dream_moods?.map((dm) => ({
          name: dm.moods.name,
          intensity: dm.intensity,
        })) || [],
    };

    // Clean up response by removing junction table data
    delete processedDream.dream_tags;
    delete processedDream.dream_moods;

    console.log("Sending processed dream:", processedDream);
    res.status(201).json(processedDream);
  } catch (error) {
    console.error("Error creating dream:", error);
    res
      .status(500)
      .json({ message: "Error creating dream", error: error.message });
  }
});

// Analyze dream with AI
router.post("/:id/analyze", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const dreamId = req.params.id;

    // First check if analysis already exists
    const { data: existingAnalysis, error: fetchError } = await supabaseClient
      .from("dream_analysis")
      .select("*")
      .eq("dream_id", dreamId)
      .eq("analysis_type", "ai_analysis")
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching existing analysis:", fetchError);
      throw fetchError;
    }

    // If analysis exists, return it
    if (existingAnalysis) {
      return res.json({
        analysis: existingAnalysis.interpretation,
        sentiment:
          existingAnalysis.sentiment_score > 0
            ? "positive"
            : existingAnalysis.sentiment_score < 0
            ? "negative"
            : "neutral",
        themes: existingAnalysis.themes || [],
        symbols: existingAnalysis.symbols_detected || [],
        recommendations: existingAnalysis.personal_growth_insights
          ? existingAnalysis.personal_growth_insights.split("\n")
          : [],
      });
    }

    // If no analysis exists, generate new one
    try {
      const analysis = await analyzeDream(userId, dreamId);

      if (!analysis) {
        return res.status(403).json({
          message:
            "You have reached your AI analysis limit. Upgrade to premium for unlimited analyses.",
        });
      }

      // Store the analysis in the dream_analysis table
      const { error: analysisError } = await supabaseClient
        .from("dream_analysis")
        .insert([
          {
            dream_id: dreamId,
            analysis_type: "ai_analysis",
            themes: analysis.themes,
            interpretation: analysis.analysis,
            symbols_detected: analysis.symbols,
            sentiment_score:
              analysis.sentiment === "positive"
                ? 1
                : analysis.sentiment === "negative"
                ? -1
                : 0,
            personal_growth_insights: analysis.recommendations.join("\n"),
            lucid_dreaming_tips: analysis.recommendations
              .filter((r) => r.toLowerCase().includes("lucid"))
              .join("\n"),
            recurring_patterns: analysis.themes.join(", "),
            psychological_analysis: analysis.analysis,
          },
        ]);

      if (analysisError) {
        console.error("Error storing analysis:", analysisError);
        throw analysisError;
      }

      res.json(analysis);
    } catch (analysisError) {
      console.error("Error in analyzeDream:", analysisError);
      if (analysisError.message?.includes("not found")) {
        return res.status(404).json({
          message: "Dream not found or you don't have access to it",
        });
      }
      throw analysisError;
    }
  } catch (error) {
    console.error("Error in analyze endpoint:", error);
    res.status(500).json({
      message: "Failed to analyze dream",
      error: error.message,
    });
  }
});

// Get a single dream by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    console.log("Fetching dream with ID:", id, "for user:", userId);

    const { data: dream, error } = await supabaseClient
      .from("dreams")
      .select(
        `
        *,
        dream_tags (
          tags (id, name, category)
        ),
        dream_moods (
          moods (id, name),
          intensity
        )
      `
      )
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching dream:", error);
      throw error;
    }

    if (!dream) {
      return res.status(404).json({ message: "Dream not found" });
    }

    // Process the data to match the expected format
    const processedDream = {
      ...dream,
      tags:
        dream.dream_tags?.map((dt) => ({
          name: dt.tags.name,
          category: dt.tags.category,
        })) || [],
      moods:
        dream.dream_moods?.map((dm) => ({
          name: dm.moods.name,
          intensity: dm.intensity,
        })) || [],
    };

    // Clean up response by removing junction table data
    delete processedDream.dream_tags;
    delete processedDream.dream_moods;

    console.log("Sending dream:", processedDream);
    res.json(processedDream);
  } catch (error) {
    console.error("Error fetching dream:", error);
    res
      .status(500)
      .json({ message: "Error fetching dream", error: error.message });
  }
});

// Get dream analysis
router.get("/:id/analysis", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const dreamId = req.params.id;
    console.log("Fetching analysis for dream:", dreamId, "for user:", userId);

    // Check if analysis exists
    const { data: existingAnalysis, error: fetchError } = await supabaseClient
      .from("dream_analysis")
      .select("*")
      .eq("dream_id", dreamId)
      .eq("analysis_type", "ai_analysis")
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching analysis:", fetchError);
      throw fetchError;
    }

    if (!existingAnalysis) {
      return res
        .status(404)
        .json({ message: "No analysis found for this dream" });
    }

    res.json(existingAnalysis);
  } catch (error) {
    console.error("Error fetching dream analysis:", error);
    res.status(500).json({
      message: "Error fetching dream analysis",
      error: error.message,
    });
  }
});

// Update a dream
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const {
      title,
      description,
      dream_date,
      is_lucid,
      clarity_level,
      sleep_quality,
      dream_type,
      tags,
      moods,
    } = req.body;

    // First, check if the dream exists and belongs to the user
    const { data: existingDream, error: fetchError } = await supabaseClient
      .from("dreams")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !existingDream) {
      return res.status(404).json({ message: "Dream not found" });
    }

    // Update dream basic info
    const { error: updateError } = await supabaseClient
      .from("dreams")
      .update({
        title,
        description,
        dream_date,
        is_lucid,
        clarity_level,
        sleep_quality,
        dream_type,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (updateError) throw updateError;

    // Delete existing tags and moods
    await supabaseClient.from("dream_tags").delete().eq("dream_id", id);
    await supabaseClient.from("dream_moods").delete().eq("dream_id", id);

    // Handle tags
    if (tags && tags.length > 0) {
      // First ensure all tags exist in the tags table
      const { data: existingTags, error: tagsError } = await supabaseClient
        .from("tags")
        .select("id, name")
        .in("name", tags);

      if (tagsError) throw tagsError;

      const existingTagNames = existingTags.map((t) => t.name);
      const newTags = tags.filter((t) => !existingTagNames.includes(t));

      // Insert new tags
      if (newTags.length > 0) {
        const { error: newTagsError } = await supabaseClient
          .from("tags")
          .insert(newTags.map((name) => ({ name })));

        if (newTagsError) throw newTagsError;
      }

      // Get all tag IDs (both existing and newly created)
      const { data: allTags, error: allTagsError } = await supabaseClient
        .from("tags")
        .select("id, name")
        .in("name", tags);

      if (allTagsError) throw allTagsError;

      // Create dream_tags associations
      const dreamTags = allTags.map((tag) => ({
        dream_id: id,
        tag_id: tag.id,
      }));

      const { error: dreamTagsError } = await supabaseClient
        .from("dream_tags")
        .insert(dreamTags);

      if (dreamTagsError) throw dreamTagsError;
    }

    // Handle moods
    if (moods && moods.length > 0) {
      // First ensure all moods exist in the moods table
      const { data: existingMoods, error: moodsError } = await supabaseClient
        .from("moods")
        .select("id, name")
        .in(
          "name",
          moods.map((m) => m.name)
        );

      if (moodsError) throw moodsError;

      const existingMoodNames = existingMoods.map((m) => m.name);
      const newMoods = moods
        .filter((m) => !existingMoodNames.includes(m.name))
        .map((m) => ({ name: m.name }));

      // Insert new moods
      if (newMoods.length > 0) {
        const { error: newMoodsError } = await supabaseClient
          .from("moods")
          .insert(newMoods);

        if (newMoodsError) throw newMoodsError;
      }

      // Get all mood IDs (both existing and newly created)
      const { data: allMoods, error: allMoodsError } = await supabaseClient
        .from("moods")
        .select("id, name")
        .in(
          "name",
          moods.map((m) => m.name)
        );

      if (allMoodsError) throw allMoodsError;

      // Create dream_moods associations with intensity
      const dreamMoods = allMoods.map((mood) => {
        const userMood = moods.find((m) => m.name === mood.name);
        return {
          dream_id: id,
          mood_id: mood.id,
          intensity: userMood.intensity || 1,
        };
      });

      const { error: dreamMoodsError } = await supabaseClient
        .from("dream_moods")
        .insert(dreamMoods);

      if (dreamMoodsError) throw dreamMoodsError;
    }

    // Fetch the updated dream with all relations
    const { data: updatedDream, error: fetchUpdatedError } =
      await supabaseClient
        .from("dreams")
        .select(
          `
        *,
        dream_tags(
          tags(id, name)
        ),
        dream_moods(
          moods(id, name),
          intensity
        )
      `
        )
        .eq("id", id)
        .single();

    if (fetchUpdatedError) throw fetchUpdatedError;

    // Format the response
    const formattedDream = {
      ...updatedDream,
      tags: updatedDream.dream_tags.map((dt) => dt.tags.name),
      moods: updatedDream.dream_moods.map((dm) => ({
        name: dm.moods.name,
        intensity: dm.intensity,
      })),
    };

    delete formattedDream.dream_tags;
    delete formattedDream.dream_moods;

    res.json(formattedDream);
  } catch (error) {
    console.error("Error updating dream:", error);
    res
      .status(500)
      .json({ message: "Failed to update dream", error: error.message });
  }
});

module.exports = router;
