import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

// Initialize Supabase client
export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey
);
