const { Configuration, OpenAIApi } = require("openai");

let openaiInstance = null;

const getOpenAIInstance = () => {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key is missing");
    }

    const configuration = new Configuration({
      apiKey: apiKey,
    });

    openaiInstance = new OpenAIApi(configuration);
  }
  return openaiInstance;
};

module.exports = {
  getOpenAIInstance,
};
