require("dotenv").config();

// Debug logging
console.log("Environment variables loaded in config.js:");
console.log("Environment variables status:", {
  OPENAI_API_KEY: !!process.env.OPENAI_API_KEY ? "exists" : "missing",
  SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY ? "exists" : "missing",
  SENDGRID_FROM_EMAIL: !!process.env.SENDGRID_FROM_EMAIL ? "exists" : "missing",
  SENDGRID_FROM_NAME: !!process.env.SENDGRID_FROM_NAME ? "exists" : "missing",
});

// Log raw values for debugging (without exposing sensitive data)
console.log("Raw SendGrid values:", {
  apiKey: process.env.SENDGRID_API_KEY?.substring(0, 5) + "...",
  fromEmail: process.env.SENDGRID_FROM_EMAIL,
  fromName: process.env.SENDGRID_FROM_NAME,
});

// Validate required environment variables
const requiredEnvVars = [
  "OPENAI_API_KEY",
  "SENDGRID_API_KEY",
  "SENDGRID_FROM_EMAIL",
  "SENDGRID_FROM_NAME",
];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);

if (missingEnvVars.length > 0) {
  console.error("Missing required environment variables:", missingEnvVars);
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}

// Create config object
const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.SENDGRID_FROM_EMAIL,
    fromName: process.env.SENDGRID_FROM_NAME,
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  nodeEnv: process.env.NODE_ENV || "development",
};

// Debug logging of final config
console.log("Config object structure:", {
  hasOpenAI: !!config.openai,
  hasOpenAIKey: !!config.openai?.apiKey,
  hasSendGrid: !!config.sendgrid,
  hasSendGridKey: !!config.sendgrid?.apiKey,
  hasSendGridEmail: !!config.sendgrid?.fromEmail,
  hasSendGridName: !!config.sendgrid?.fromName,
  configKeys: Object.keys(config),
  sendgridConfig: {
    hasApiKey: !!config.sendgrid?.apiKey,
    fromEmail: config.sendgrid?.fromEmail,
    fromName: config.sendgrid?.fromName,
  },
});

// Export a function to get config to ensure consistent state
let configInstance = null;
function getConfig() {
  if (!configInstance) {
    configInstance = config;
  }
  return configInstance;
}

module.exports = getConfig();
