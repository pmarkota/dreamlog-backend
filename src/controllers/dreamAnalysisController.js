const { supabaseClient } = require("../config/supabase");
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Basic dream analysis (free feature)
const getBasicAnalysis = async (req, res) => {
  try {
    const { dreamId } = req.params;
    const userId = req.user.user_id;

    // Fetch dream details
    const { data: dream, error: dreamError } = await supabaseClient
      .from("dreams")
      .select(
        `
        *,
        dream_tags(tags(name)),
        dream_moods(moods(name), intensity)
      `
      )
      .eq("id", dreamId)
      .eq("user_id", userId)
      .single();

    if (dreamError) {
      console.error("Error fetching dream:", dreamError);
      throw dreamError;
    }
    if (!dream) {
      return res.status(404).json({ message: "Dream not found" });
    }

    console.log("Dream data:", JSON.stringify(dream, null, 2));

    // Check if analysis already exists
    const { data: existingAnalysis, error: analysisError } =
      await supabaseClient
        .from("dream_analysis")
        .select("*")
        .eq("dream_id", dreamId)
        .eq("analysis_type", "basic")
        .single();

    if (existingAnalysis) {
      console.log(
        "Returning existing analysis:",
        JSON.stringify(existingAnalysis, null, 2)
      );
      return res.json(existingAnalysis);
    }

    // Generate AI analysis
    const prompt = `Please analyze this dream and provide:
1. A brief analysis (4 sentences or less)
2. The overall emotional tone/sentiment (Format: SCORE: [number between -1 and 1], followed by explanation. Example: "SCORE: 0.8 - This dream has a very positive tone because...")
3. Key themes present
4. Important symbols and their meanings

Title: ${dream.title}
Description: ${dream.description}
Tags: ${(dream.dream_tags || [])
      .map((dt) => dt?.tags?.name || "")
      .filter(Boolean)
      .join(", ")}
Moods: ${(dream.dream_moods || [])
      .map((dm) => `${dm.moods?.name} (${dm.intensity}/5)`)
      .filter(Boolean)
      .join(", ")}
Lucid: ${dream.is_lucid ? "Yes" : "No"}
Clarity: ${dream.clarity_level}/5`;

    const aiResponse = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a dream analyst providing concise interpretations. Keep your analysis brief and focused on the most important elements. Format your response in sections:\n1. Analysis: (4 sentences)\n2. Sentiment: (Start with 'SCORE: [number between -1 and 1]' then explain the score. Use -1 for very negative, -0.5 for negative, 0 for neutral, 0.5 for positive, 1 for very positive)\n3. Themes: (comma-separated list)\n4. Symbols: (list with brief meanings)",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const aiAnalysis = aiResponse.data.choices[0].message.content;
    const sections = extractSectionsFromAnalysis(aiAnalysis);

    // Extract sentiment score from AI analysis
    const sentimentSection = sections["Sentiment"] || "";
    console.log("Sentiment section:", sentimentSection);
    let sentimentScore = 0;
    const scoreMatch = sentimentSection.match(/SCORE:\s*([-+]?\d*\.?\d+)/);
    console.log("Score match:", scoreMatch);
    if (scoreMatch) {
      sentimentScore = parseFloat(scoreMatch[1]);
      console.log("Extracted score:", sentimentScore);
    } else if (sentimentSection.toLowerCase().includes("positive")) {
      sentimentScore = sentimentSection.toLowerCase().includes("very")
        ? 1
        : 0.5;
      console.log("Fallback positive score:", sentimentScore);
    } else if (sentimentSection.toLowerCase().includes("negative")) {
      sentimentScore = sentimentSection.toLowerCase().includes("very")
        ? -1
        : -0.5;
      console.log("Fallback negative score:", sentimentScore);
    } else {
      console.log(
        "No sentiment detected, using default score:",
        sentimentScore
      );
    }

    // Format basic analysis
    const analysis = {
      dream_id: dreamId,
      analysis_type: "basic",
      themes: extractThemes(sections["Themes"] || ""),
      symbols_detected: extractSymbols(sections["Symbols"] || ""),
      interpretation: sections["Analysis"] || aiAnalysis,
      sentiment_score: sentimentScore,
      psychological_analysis: null,
      personal_growth_insights: null,
      lucid_dreaming_tips: null,
      recurring_patterns: null,
    };

    console.log("Generated analysis:", JSON.stringify(analysis, null, 2));

    // Save analysis
    const { data: savedAnalysis, error: saveError } = await supabaseClient
      .from("dream_analysis")
      .insert([analysis])
      .select()
      .single();

    if (saveError) {
      console.error("Error saving analysis:", saveError);
      throw saveError;
    }

    console.log("Saved analysis:", JSON.stringify(savedAnalysis, null, 2));

    res.json(savedAnalysis);
  } catch (error) {
    console.error("Error in basic dream analysis:", error);
    res
      .status(500)
      .json({ message: "Failed to analyze dream", error: error.message });
  }
};

// Helper function to extract symbols with meanings
function extractSymbols(symbolsText) {
  if (!symbolsText) return [];
  // Split by newlines or commas
  const symbols = symbolsText
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  // If symbols contain meanings (with ':' or '-'), extract just the symbol name
  return symbols.map((s) => s.split(/[:|-]/)[0].trim());
}

// Premium dream analysis with GPT-3.5-turbo
const getPremiumAnalysis = async (req, res) => {
  try {
    const { dreamId } = req.params;
    const userId = req.user.user_id;

    // Check if user is premium
    if (!req.user.is_premium) {
      return res.status(403).json({ message: "Premium subscription required" });
    }

    // Check for ANY existing analysis for this dream (both basic and premium)
    const { data: existingAnalysis, error: analysisError } =
      await supabaseClient
        .from("dream_analysis")
        .select("*")
        .eq("dream_id", dreamId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (existingAnalysis) {
      // If there's a premium analysis, return it
      if (existingAnalysis.analysis_type === "premium") {
        return res.json(existingAnalysis);
      }
      // If there's a basic analysis, upgrade it to premium
      const { data: dream, error: dreamError } = await supabaseClient
        .from("dreams")
        .select(
          `
          *,
          dream_tags(tags(name)),
          dream_moods(moods(name), intensity)
        `
        )
        .eq("id", dreamId)
        .eq("user_id", userId)
        .single();

      if (dreamError) throw dreamError;
      if (!dream) {
        return res.status(404).json({ message: "Dream not found" });
      }

      // Generate premium analysis
      const prompt = generateDreamAnalysisPrompt(dream);
      const aiResponse = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a professional dream analyst. Address the user directly using 'you/your'. Format your response with these exact headers:\n1. Main themes and symbols:\n2. Psychological interpretation:\n3. Personal growth insights:\n4. Lucid dreaming potential:\n5. Recommendations for future dreams:\n6. Emotional tone/sentiment: (Start with 'SCORE: [number between -1 and 1]' then explain the score. Use -1 for very negative, -0.5 for negative, 0 for neutral, 0.5 for positive, 1 for very positive)\nKeep each section concise but meaningful.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 1000,
        presence_penalty: 0.0,
        frequency_penalty: 0.0,
      });

      const aiAnalysis = aiResponse.data.choices[0].message.content;
      const sections = extractSectionsFromAnalysis(aiAnalysis);

      // Extract sentiment score from AI analysis
      const sentimentSection = sections["Emotional tone/sentiment"] || "";
      console.log("Sentiment section:", sentimentSection);
      let sentimentScore = 0;
      const scoreMatch = sentimentSection.match(/SCORE:\s*([-+]?\d*\.?\d+)/);
      console.log("Score match:", scoreMatch);
      if (scoreMatch) {
        sentimentScore = parseFloat(scoreMatch[1]);
        console.log("Extracted score:", sentimentScore);
      } else if (sentimentSection.toLowerCase().includes("positive")) {
        sentimentScore = sentimentSection.toLowerCase().includes("very")
          ? 1
          : 0.5;
        console.log("Fallback positive score:", sentimentScore);
      } else if (sentimentSection.toLowerCase().includes("negative")) {
        sentimentScore = sentimentSection.toLowerCase().includes("very")
          ? -1
          : -0.5;
        console.log("Fallback negative score:", sentimentScore);
      } else {
        console.log(
          "No sentiment detected, using default score:",
          sentimentScore
        );
      }

      // Update the existing analysis to premium
      const { data: updatedAnalysis, error: updateError } = await supabaseClient
        .from("dream_analysis")
        .update({
          analysis_type: "premium",
          interpretation: aiAnalysis,
          themes: extractThemes(sections["Main themes and symbols"] || ""),
          symbols_detected: extractSymbols(
            sections["Main themes and symbols"] || ""
          ),
          sentiment_score: sentimentScore,
          psychological_analysis:
            sections["Psychological interpretation"] || "",
          personal_growth_insights: sections["Personal growth insights"] || "",
          lucid_dreaming_tips: sections["Lucid dreaming potential"] || "",
          recurring_patterns:
            sections["Recommendations for future dreams"] || "",
        })
        .eq("id", existingAnalysis.id)
        .select()
        .single();

      if (updateError) throw updateError;
      return res.json(updatedAnalysis);
    }

    // If no analysis exists, fetch dream and create new premium analysis
    const { data: dream, error: dreamError } = await supabaseClient
      .from("dreams")
      .select(
        `
        *,
        dream_tags(tags(name)),
        dream_moods(moods(name), intensity)
      `
      )
      .eq("id", dreamId)
      .eq("user_id", userId)
      .single();

    if (dreamError) throw dreamError;
    if (!dream) {
      return res.status(404).json({ message: "Dream not found" });
    }

    // Generate new premium analysis
    const prompt = generateDreamAnalysisPrompt(dream);
    const aiResponse = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a professional dream analyst. Address the user directly using 'you/your'. Format your response with these exact headers:\n1. Main themes and symbols:\n2. Psychological interpretation:\n3. Personal growth insights:\n4. Lucid dreaming potential:\n5. Recommendations for future dreams:\n6. Emotional tone/sentiment: (Start with 'SCORE: [number between -1 and 1]' then explain the score. Use -1 for very negative, -0.5 for negative, 0 for neutral, 0.5 for positive, 1 for very positive)\nKeep each section concise but meaningful.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 1000,
      presence_penalty: 0.0,
      frequency_penalty: 0.0,
    });

    const aiAnalysis = aiResponse.data.choices[0].message.content;
    const sections = extractSectionsFromAnalysis(aiAnalysis);

    // Extract sentiment score from AI analysis
    const sentimentSection = sections["Emotional tone/sentiment"] || "";
    console.log("Sentiment section:", sentimentSection);
    let sentimentScore = 0;
    const scoreMatch = sentimentSection.match(/SCORE:\s*([-+]?\d*\.?\d+)/);
    console.log("Score match:", scoreMatch);
    if (scoreMatch) {
      sentimentScore = parseFloat(scoreMatch[1]);
      console.log("Extracted score:", sentimentScore);
    } else if (sentimentSection.toLowerCase().includes("positive")) {
      sentimentScore = sentimentSection.toLowerCase().includes("very")
        ? 1
        : 0.5;
      console.log("Fallback positive score:", sentimentScore);
    } else if (sentimentSection.toLowerCase().includes("negative")) {
      sentimentScore = sentimentSection.toLowerCase().includes("very")
        ? -1
        : -0.5;
      console.log("Fallback negative score:", sentimentScore);
    } else {
      console.log(
        "No sentiment detected, using default score:",
        sentimentScore
      );
    }

    const analysis = {
      dream_id: dreamId,
      analysis_type: "premium",
      themes: extractThemes(sections["Main themes and symbols"] || ""),
      interpretation: aiAnalysis,
      symbols_detected: extractSymbols(
        sections["Main themes and symbols"] || ""
      ),
      sentiment_score: sentimentScore,
      psychological_analysis: sections["Psychological interpretation"] || "",
      personal_growth_insights: sections["Personal growth insights"] || "",
      lucid_dreaming_tips: sections["Lucid dreaming potential"] || "",
      recurring_patterns: sections["Recommendations for future dreams"] || "",
    };

    // Save new analysis
    const { data: savedAnalysis, error: saveError } = await supabaseClient
      .from("dream_analysis")
      .insert([analysis])
      .select()
      .single();

    if (saveError) throw saveError;
    return res.json(savedAnalysis);
  } catch (error) {
    console.error("Error in premium dream analysis:", error);
    res
      .status(500)
      .json({ message: "Failed to analyze dream", error: error.message });
  }
};

// Get daily dream prompt
const getDailyPrompt = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Get today's prompt
    const { data: prompt, error: promptError } = await supabaseClient
      .from("dream_prompts")
      .select("*")
      .eq("active_date", today)
      .single();

    if (promptError) throw promptError;

    // If no prompt exists for today, create one
    if (!prompt) {
      const newPrompt = await generateDailyPrompt(req.user.is_premium);
      const { data: savedPrompt, error: saveError } = await supabaseClient
        .from("dream_prompts")
        .insert([
          {
            prompt_text: newPrompt.prompt,
            category: newPrompt.category,
            is_premium: newPrompt.isPremium,
            active_date: today,
          },
        ])
        .select()
        .single();

      if (saveError) throw saveError;
      return res.json(savedPrompt);
    }

    // If prompt is premium and user is not premium, return a basic prompt
    if (prompt.is_premium && !req.user.is_premium) {
      return res.json({
        ...prompt,
        prompt_text:
          "Upgrade to premium to access today's special dream prompt!",
        is_premium: true,
      });
    }

    res.json(prompt);
  } catch (error) {
    console.error("Error getting daily prompt:", error);
    res
      .status(500)
      .json({ message: "Failed to get daily prompt", error: error.message });
  }
};

// Helper functions
const calculateSentimentScore = (moods) => {
  if (!moods || moods.length === 0) return 0;

  const moodCategories = {
    Happy: "positive",
    Excited: "positive",
    Peaceful: "positive",
    Neutral: "neutral",
    Confused: "neutral",
    Anxious: "negative",
    Scared: "negative",
    Sad: "negative",
    Angry: "negative",
  };

  const moodScores = {
    positive: 1,
    neutral: 0,
    negative: -1,
  };

  let totalScore = 0;
  let totalMoods = 0;

  for (const mood of moods) {
    if (mood.moods?.name && mood.intensity) {
      const category = moodCategories[mood.moods.name] || "neutral";
      const baseScore = moodScores[category];
      totalScore += baseScore * (mood.intensity / 5);
      totalMoods++;
    }
  }

  return totalMoods > 0 ? totalScore / totalMoods : 0;
};

const generateDreamAnalysisPrompt = (dream) => {
  const tags = (dream.dream_tags || [])
    .map((dt) => dt?.tags?.name)
    .filter(Boolean)
    .join(", ");
  const moods = (dream.dream_moods || [])
    .map((dm) => `${dm.moods?.name} (${dm.intensity}/5)`)
    .filter(Boolean)
    .join(", ");

  return `Analyze your dream concisely with all sections:
Title: ${dream.title}
Description: ${dream.description}
Tags: ${tags}
Moods: ${moods}
Lucid: ${dream.is_lucid ? "Yes" : "No"}
Clarity: ${dream.clarity_level}/5

Use these exact section headers and speak directly to the user:
1. Main themes and symbols in your dream:
2. Your psychological interpretation:
3. Your personal growth insights:
4. Your lucid dreaming potential:
5. Recommendations for your future dreams:
6. Emotional tone/sentiment: (Start with 'SCORE: [number between -1 and 1]' then explain the score. Use -1 for very negative, -0.5 for negative, 0 for neutral, 0.5 for positive, 1 for very positive. Consider both the dream content and the dreamer's moods.)

Keep each section focused and meaningful. Address the user directly using "you" and "your".`;
};

const extractThemes = (aiAnalysis) => {
  // Extract themes from the AI analysis
  const themes = aiAnalysis
    .split(/[.,!?\n]/)
    .filter((sentence) => {
      const lower = sentence.toLowerCase().trim();
      return (
        lower.includes("theme") ||
        lower.includes("symbol") ||
        lower.includes("represent") ||
        lower.includes("signif")
      );
    })
    .map((theme) => {
      // Extract the actual theme from the sentence
      const cleaned = theme
        .trim()
        .replace(/^[^a-zA-Z]+/, "") // Remove non-letter characters from start
        .replace(/^(the theme of|theme:|themes:|symbol:|symbols:)/i, "")
        .trim();
      return cleaned;
    })
    .filter((theme) => theme.length > 0 && theme.length < 50); // Reasonable length for a theme

  return themes.length > 0 ? themes : ["General Dream"]; // Fallback theme
};

const generateDailyPrompt = async (isPremium) => {
  // In a real implementation, this would be more sophisticated
  // and possibly use AI to generate prompts
  const basicPrompts = [
    "What colors were most vivid in your dream?",
    "Did you recognize any familiar faces?",
    "Were you able to fly or have other supernatural abilities?",
    "What emotions did you feel during the dream?",
  ];

  const premiumPrompts = [
    "Explore the connection between your current life challenges and your dream narrative",
    "Analyze the symbolic meaning of recurring characters in your dreams",
    "How did the dream environment reflect your subconscious desires?",
    "What lucid dreaming techniques could you apply based on this dream?",
  ];

  const prompts = isPremium
    ? [...basicPrompts, ...premiumPrompts]
    : basicPrompts;
  const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];

  return {
    prompt: randomPrompt,
    category: isPremium ? "premium" : "basic",
    isPremium: isPremium,
  };
};

const extractSectionsFromAnalysis = (aiAnalysis) => {
  const sections = {};
  const sectionHeaders = [
    "Main themes and symbols",
    "Psychological interpretation",
    "Personal growth insights",
    "Lucid dreaming potential",
    "Recommendations for future dreams",
    "Emotional tone/sentiment",
  ];

  let currentSection = "";
  let currentContent = [];

  aiAnalysis.split("\n").forEach((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    // Check if line is a section header
    const headerMatch = trimmedLine.match(/\d+\.\s*(.*?):|([^:]+):/);
    if (headerMatch) {
      // Save previous section if exists
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = currentContent.join("\n").trim();
      }
      currentSection = (headerMatch[1] || headerMatch[2]).trim();
      currentContent = [];
    } else {
      currentContent.push(trimmedLine);
    }
  });

  // Save the last section
  if (currentSection && currentContent.length > 0) {
    sections[currentSection] = currentContent.join("\n").trim();
  }

  return sections;
};

module.exports = {
  getBasicAnalysis,
  getPremiumAnalysis,
  getDailyPrompt,
};
