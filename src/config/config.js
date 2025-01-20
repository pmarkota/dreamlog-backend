require("dotenv").config();

// Debug logging
console.log("Environment variables loaded in config.js:");
console.log("OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);
console.log(
  "Raw OPENAI_API_KEY value type:",
  typeof process.env.OPENAI_API_KEY
);
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
console.log(
  "Config object structure:",
  JSON.stringify(
    {
      ...config,
      openai: { apiKey: config.openai.apiKey ? "[HIDDEN]" : undefined },
      sendgrid: { apiKey: config.sendgrid.apiKey ? "[HIDDEN]" : undefined },
      supabase: {
        serviceKey: config.supabase.serviceKey ? "[HIDDEN]" : undefined,
      },
    },
    null,
    2
  )
);

// Export the config object directly
module.exports = config;
