import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://demo-restaurant.supabase.co';
const SUPABASE_ANON_KEY = 'demo-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
  },
});
