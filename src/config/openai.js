const { Configuration, OpenAIApi } = require("openai");

let openaiInstance = null;

const getOpenAIInstance = () => {
  if (!openaiInstance) {
    // Add debug logging
    console.log("Getting OpenAI instance...");

    // Get config
    const config = require("./config");

    console.log("OpenAI config structure:", {
      hasConfig: !!config,
      configKeys: Object.keys(config),
      hasOpenAI: !!config?.openai,
      hasApiKey: !!config?.openai?.apiKey,
    });

    // Get API key from config
    const apiKey = config?.openai?.apiKey;

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
