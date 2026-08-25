import { createClient } from "@supabase/supabase-js";

// Public client -- safe to use in the browser.
// Row Level Security (RLS) in Supabase is what actually keeps each
// person's data private; this key alone does not bypass it.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
