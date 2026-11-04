import { createClient } from '@supabase/supabase-js';
import { appEnvironment } from '../../config/env';
import type { Database } from '../../types/database';

export const supabase = appEnvironment.isSupabaseConfigured
  ? createClient<Database>(appEnvironment.supabaseUrl, appEnvironment.supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
