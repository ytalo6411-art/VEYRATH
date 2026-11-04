const environment = import.meta.env;

const supabaseUrl = environment.VITE_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = environment.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

const hasSupabaseUrl = Boolean(supabaseUrl);
const hasSupabaseKey = Boolean(supabaseAnonKey);

export const appEnvironment = {
  supabaseUrl,
  supabaseAnonKey,
  isSupabaseConfigured: hasSupabaseUrl && hasSupabaseKey,
  hasPartialSupabaseConfig: hasSupabaseUrl !== hasSupabaseKey,
};
