import { createClient, isSupabaseConfigured } from "@/utils/supabase/client";

export { isSupabaseConfigured };

export const supabase = isSupabaseConfigured ? createClient() : null;
