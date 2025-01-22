const { Configuration, OpenAIApi } = require("openai");
const config = require("../config/config");
const { supabaseClient: supabase } = require("../config/supabase");

// Debug logging
console.log("AI Utils configuration:", {
  hasConfig: !!config,
  configKeys: Object.keys(config),
  hasOpenAI: !!config?.openai,
  openaiConfig: config?.openai
    ? {
        hasApiKey: !!config.openai.apiKey,
      }
    : "missing",
});

// Initialize OpenAI with error handling
let openai;
try {
  if (!config || typeof config !== "object") {
    throw new Error("Config is not properly loaded");
  }

  if (!config.openai || typeof config.openai !== "object") {
    throw new Error("OpenAI config section is missing");
  }

  if (!config.openai.apiKey) {
    throw new Error("OpenAI API key is missing in config");
  }

  const configuration = new Configuration({
    apiKey: config.openai.apiKey,
  });

  openai = new OpenAIApi(configuration);
  console.log("OpenAI client initialized successfully");
} catch (error) {
  console.error("Failed to initialize OpenAI:", error.message);
  console.error("Config state:", {
    hasConfig: !!config,
    configType: typeof config,
    hasOpenAISection: !!config?.openai,
    hasAPIKey: !!config?.openai?.apiKey,
  });
  throw error;
}

async function canUserUseAI(userId) {
  console.log("[aiUtils] Checking AI usage for user:", userId);

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("is_premium")
    .eq("id", userId)
    .single();

  if (userError) {
    console.error("[aiUtils] Error fetching user premium status:", userError);
    throw userError;
  }

  console.log("[aiUtils] User premium status:", user?.is_premium);

  if (user?.is_premium) {
    console.log("[aiUtils] User is premium, allowing AI usage");
    return true;
  }

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  console.log(
    "[aiUtils] Checking free tier usage since:",
    oneWeekAgo.toISOString()
  );

  const { count, error: countError } = await supabase
    .from("ai_analysis_usage")
    .select("id", { count: "exact" })
    .eq("user_id", userId)
    .gte("created_at", oneWeekAgo.toISOString());

  if (countError) {
    console.error("[aiUtils] Error checking AI usage count:", countError);
    throw countError;
  }

  const canUse = (count || 0) < 1;
  console.log("[aiUtils] AI usage count:", count, "Can use AI:", canUse);

  return canUse; // Free users get 1 analysis per week
}

async function recordAIUsage(userId, dreamId) {
  await supabase.from("ai_analysis_usage").insert({
    user_id: userId,
    dream_id: dreamId,
    analysis_type: "dream_analysis",
  });
}

async function getRemainingAnalyses(userId) {
  const { data: user } = await supabase
    .from("users")
    .select("is_premium")
    .eq("id", userId)
    .single();

  if (user?.is_premium) return Infinity;

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { count } = await supabase
    .from("ai_analysis_usage")
    .select("id", { count: "exact" })
    .eq("user_id", userId)
    .gte("created_at", oneWeekAgo.toISOString());

  return Math.max(0, 1 - (count || 0)); // Free users get 1 analysis per week
}

async function analyzeDream(userId, dreamId) {
  const canUse = await canUserUseAI(userId);
  if (!canUse) return null;

  // Fetch the current dream with a less restrictive query
  const { data: dream, error: dreamError } = await supabase
    .from("dreams")
    .select(
      `
      *,
      dream_moods (
        intensity,
        moods (
          name
        )
      )
    `
    )
    .eq("id", dreamId)
    .single();

  if (dreamError) {
    console.error("Error fetching dream:", dreamError);
    throw dreamError;
  }

  if (!dream) return null;

  // Fetch recent dreams for pattern analysis (last 5 dreams)
  const { data: recentDreams, error: recentDreamsError } = await supabase
    .from("dreams")
    .select(
      `
      *,
      dream_moods (
        intensity,
        moods (
          name
        )
      )
    `
    )
    .eq("user_id", userId)
    .neq("id", dreamId) // Exclude current dream
    .order("created_at", { ascending: false })
    .limit(5);

  if (recentDreamsError) {
    console.error("Error fetching recent dreams:", recentDreamsError);
    throw recentDreamsError;
  }

  try {
    const dreamForAnalysis = {
      description: dream.description,
      moods:
        dream.dream_moods
          ?.map((dm) => ({
            name: dm.moods?.name,
            intensity: dm.intensity,
          }))
          .filter((mood) => mood.name) || [], // Filter out any moods with missing names
      is_lucid: dream.is_lucid || false,
      recentDreams:
        recentDreams?.map((d) => ({
          description: d.description,
          moods:
            d.dream_moods
              ?.map((dm) => ({
                name: dm.moods?.name,
                intensity: dm.intensity,
              }))
              .filter((mood) => mood.name) || [],
          is_lucid: d.is_lucid || false,
        })) || [],
    };

    const analysis = await performDreamAnalysis(dreamForAnalysis);
    await recordAIUsage(userId, dreamId);
    return analysis;
  } catch (error) {
    console.error("Error analyzing dream:", error);
    throw error;
  }
}

async function performDreamAnalysis(dream) {
  const recentDreamsContext =
    dream.recentDreams.length > 0
      ? `\n\nRecent dream history for pattern analysis:
      ${dream.recentDreams
        .map(
          (d, i) => `
      Dream ${i + 1}:
      Description: ${d.description}
      Moods: ${d.moods
        .map((mood) => `${mood.name} (Intensity: ${mood.intensity})`)
        .join(", ")}
      Is Lucid: ${d.is_lucid ? "Yes" : "No"}`
        )
        .join("\n")}`
      : "";

  const prompt = `Analyze this dream and provide insights in JSON format, considering your recent dream history for pattern recognition. Include the following sections:
  - analysis: A detailed interpretation of your dream, speaking directly to you using "you" and "your"
  - sentiment: The overall emotional tone (positive/negative/neutral)
  - themes: Array of key themes present in your dream
  - symbols: Array of important symbols and their meanings
  - recommendations: Array of actionable insights or suggestions for you
  - patterns: Array of patterns identified across your recent dreams (recurring symbols, themes, or emotions)
  - emotional_progression: Analysis of how your emotional state has evolved across dreams
  - lucidity_development: Insights on your lucid dreaming progress and potential

The current dream details are:
Description: ${dream.description}
Moods: ${dream.moods
    .map((mood) => `${mood.name} (Intensity: ${mood.intensity})`)
    .join(", ")}
Is Lucid: ${dream.is_lucid ? "Yes" : "No"}${recentDreamsContext}`;

  const response = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content:
          "You are a dream analysis expert with expertise in pattern recognition and psychological interpretation. Analyze dreams and provide insights in a structured JSON format. Always address the user directly using 'you' and 'your' instead of 'the dreamer'. Format your response as valid JSON with these fields: analysis (string), sentiment (string), themes (array), symbols (array), recommendations (array), patterns (array), emotional_progression (string), lucidity_development (string). Ensure the response is valid JSON without any markdown formatting or code block markers.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 1500,
  });

  const result = response.data.choices[0]?.message?.content;
  if (!result) throw new Error("No analysis generated");

  try {
    const cleanResult = result.replace(/```json\n?|\n?```/g, "").trim();
    const analysis = JSON.parse(cleanResult);

    // Validate required fields
    if (
      !analysis.analysis ||
      !analysis.sentiment ||
      !analysis.themes ||
      !analysis.symbols ||
      !analysis.recommendations ||
      !analysis.patterns ||
      !analysis.emotional_progression ||
      !analysis.lucidity_development
    ) {
      throw new Error("Invalid analysis format");
    }

    // Ensure symbols is an array of strings
    if (Array.isArray(analysis.symbols) && analysis.symbols[0]?.symbol) {
      analysis.symbols = analysis.symbols.map(
        (s) => `${s.symbol}: ${s.meaning}`
      );
    }

    return analysis;
  } catch (error) {
    console.error("Error parsing analysis:", error, "\nRaw result:", result);
    throw new Error("Failed to parse analysis result");
  }
}

async function analyzeDreamWithAI(dream) {
  try {
    const dreamForAnalysis = {
      description: dream.description,
      moods: dream.moods || [],
      is_lucid: dream.is_lucid || false,
    };

    return await performDreamAnalysis(dreamForAnalysis);
  } catch (error) {
    console.error("Error in AI dream analysis:", error);
    throw error;
  }
}

async function analyzeDreamBatch(dreams) {
  try {
    const analyses = await Promise.all(
      dreams.map((dream) => {
        const dreamForAnalysis = {
          description: dream.description,
          moods: dream.moods || [],
          is_lucid: dream.is_lucid || false,
        };
        return performDreamAnalysis(dreamForAnalysis);
      })
    );
    return analyses;
  } catch (error) {
    console.error("Error in batch dream analysis:", error);
    throw error;
  }
}

module.exports = {
  canUserUseAI,
  recordAIUsage,
  getRemainingAnalyses,
  analyzeDream,
  analyzeDreamWithAI,
  analyzeDreamBatch,
};
