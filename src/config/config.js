require("dotenv").config();

// Debug logging
console.log("Environment variables loaded:");
console.log("OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);
console.log("All env variables:", Object.keys(process.env));

const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.SENDGRID_FROM_EMAIL,
    fromName: process.env.SENDGRID_FROM_NAME,
  },
};

// Debug logging of final config
console.log("Final config structure:", {
  openaiKeyExists: !!config.openai?.apiKey,
  sendgridKeyExists: !!config.sendgrid?.apiKey,
});

module.exports = config;
