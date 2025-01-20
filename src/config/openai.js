const { Configuration, OpenAIApi } = require("openai");

let openaiInstance = null;

const getOpenAIInstance = () => {
  if (!openaiInstance) {
    // Add debug logging
    console.log("Getting OpenAI instance...");

    // Get config and handle possible nested structure
    const config = require("./config");
    console.log("Raw config:", JSON.stringify(config, null, 2));

    // Try to get API key from various possible locations
    const apiKey =
      process.env.OPENAI_API_KEY ||
      config?.config?.openai?.apiKey ||
      config?.openai?.apiKey;

    console.log("API Key exists:", !!apiKey);

    if (!apiKey) {
      throw new Error("OpenAI API key is missing");
    }

    const configuration = new Configuration({
      apiKey: apiKey,
    });

    openaiInstance = new OpenAIApi(configuration);
    console.log("OpenAI instance created successfully");
  }
  return openaiInstance;
};

module.exports = {
  getOpenAIInstance,
};
