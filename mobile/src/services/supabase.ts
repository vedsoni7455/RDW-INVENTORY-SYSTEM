import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ztrsflbamxlmwregigqs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3F5X22R0SzkJ5gA9RTXuZA_rBXdrz8O';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
