const { supabaseClient } = require("../config/supabase");

// Create a new dream
const createDream = async (req, res) => {
  console.log("Create dream request received:", {
    body: req.body,
    userId: req.user?.user_id,
  });

  try {
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

    const userId = req.user.user_id;
    console.log("Extracted user ID:", userId);

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
      console.error("Supabase error during dream creation:", dreamError);
      throw dreamError;
    }

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
        dream_tags(
          tags(id, name)
        ),
        dream_moods(
          moods(id, name),
          intensity
        )
      `
      )
      .eq("id", dreamData.id)
      .single();

    if (fetchError) throw fetchError;

    // Format the response
    const formattedDream = {
      ...completeDream,
      tags: completeDream.dream_tags.map((dt) => dt.tags.name),
      moods: completeDream.dream_moods.map((dm) => ({
        name: dm.moods.name,
        intensity: dm.intensity,
      })),
    };

    delete formattedDream.dream_tags;
    delete formattedDream.dream_moods;

    console.log("Dream created successfully:", formattedDream);
    res.status(201).json(formattedDream);
  } catch (error) {
    console.error("Error creating dream:", error);
    res
      .status(500)
      .json({ message: "Failed to create dream", error: error.message });
  }
};

// Get all dreams for the authenticated user
const getDreams = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const { data, error } = await supabaseClient
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
      .eq("user_id", userId)
      .order("dream_date", { ascending: false });

    if (error) throw error;

    // Format the response
    const formattedDreams = data.map((dream) => ({
      ...dream,
      tags: dream.dream_tags.map((dt) => dt.tags.name),
      moods: dream.dream_moods.map((dm) => ({
        name: dm.moods.name,
        intensity: dm.intensity,
      })),
    }));

    formattedDreams.forEach((dream) => {
      delete dream.dream_tags;
      delete dream.dream_moods;
    });

    res.json(formattedDreams);
  } catch (error) {
    console.error("Error fetching dreams:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch dreams", error: error.message });
  }
};

// Get a specific dream by ID
const getDreamById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;

    const { data, error } = await supabaseClient
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
      .eq("user_id", userId)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ message: "Dream not found" });
    }

    // Format the response
    const formattedDream = {
      ...data,
      tags: data.dream_tags.map((dt) => dt.tags.name),
      moods: data.dream_moods.map((dm) => ({
        name: dm.moods.name,
        intensity: dm.intensity,
      })),
    };

    delete formattedDream.dream_tags;
    delete formattedDream.dream_moods;

    res.json(formattedDream);
  } catch (error) {
    console.error("Error fetching dream:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch dream", error: error.message });
  }
};

// Update a dream
const updateDream = async (req, res) => {
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
};

// Delete a dream
const deleteDream = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;

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

    // Delete dream (this will cascade delete dream_tags and dream_moods)
    const { error } = await supabaseClient
      .from("dreams")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;

    res.json({ message: "Dream deleted successfully" });
  } catch (error) {
    console.error("Error deleting dream:", error);
    res
      .status(500)
      .json({ message: "Failed to delete dream", error: error.message });
  }
};

// Get dreams by date
const getDreamsByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.user.user_id;

    console.log("Fetching dreams for date:", date);

    const { data, error } = await supabaseClient
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
      .eq("user_id", userId)
      .eq("dream_date", date)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase query error:", error);
      throw error;
    }

    console.log("Found dreams:", data);

    // Format the response
    const formattedDreams = data.map((dream) => ({
      ...dream,
      tags: dream.dream_tags.map((dt) => dt.tags.name),
      moods: dream.dream_moods.map((dm) => ({
        name: dm.moods.name,
        intensity: dm.intensity,
      })),
    }));

    formattedDreams.forEach((dream) => {
      delete dream.dream_tags;
      delete dream.dream_moods;
    });

    console.log("Sending formatted dreams:", formattedDreams);
    res.json(formattedDreams);
  } catch (error) {
    console.error("Error fetching dreams by date:", error);
    res.status(500).json({
      message: "Failed to fetch dreams by date",
      error: error.message,
    });
  }
};

module.exports = {
  createDream,
  getDreams,
  getDreamById,
  updateDream,
  deleteDream,
  getDreamsByDate,
};