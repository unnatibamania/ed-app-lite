import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || "";

// Create a Supabase client with the service role key for server-side operations
// This client has admin privileges and can bypass Row Level Security (RLS) policies
const supabaseServer = createClient(supabaseUrl, supabaseServiceRoleKey);

export default supabaseServer; 