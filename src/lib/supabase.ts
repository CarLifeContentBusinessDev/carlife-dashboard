import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be defined in .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const supabaseObigoPickleUrl = import.meta.env.VITE_SUPABASE_URL_PROD;
const supabaseObigoPickleAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY_PROD;

if (!supabaseObigoPickleUrl || !supabaseObigoPickleAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL_PROD and VITE_SUPABASE_ANON_KEY_PROD must be defined in .env file.'
  );
}

export const supabaseObigoPickle = createClient(
  supabaseObigoPickleUrl,
  supabaseObigoPickleAnonKey
);
