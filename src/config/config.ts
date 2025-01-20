import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_KEY",
  "OPENAI_API_KEY",
  "NODE_ENV",
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Export validated configuration
export const config = {
  supabase: {
    url: process.env.SUPABASE_URL!,
    serviceKey: process.env.SUPABASE_SERVICE_KEY!,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
  },
  nodeEnv: process.env.NODE_ENV!,
} as const;
