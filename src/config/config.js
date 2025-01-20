require("dotenv").config();

// Debug logging
console.log("Environment variables loaded in config.js:");
console.log("OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);
console.log("All env variables:", Object.keys(process.env));

// Validate required environment variables
const requiredEnvVars = ["OPENAI_API_KEY"];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);

if (missingEnvVars.length > 0) {
  console.error("Missing required environment variables:", missingEnvVars);
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}

const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || null,
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || null,
    fromEmail: process.env.SENDGRID_FROM_EMAIL || null,
    fromName: process.env.SENDGRID_FROM_NAME || null,
  },
};

// Debug logging of final config
console.log("Final config structure:", {
  openaiKeyExists: !!config.openai?.apiKey,
  sendgridKeyExists: !!config.sendgrid?.apiKey,
  configKeys: Object.keys(config),
});

module.exports = config;
