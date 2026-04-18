import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://koiawtfuuevblrvlpuhe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JnbSRv8Y1Ue_BAp5q9EWMA_YjZmAwcZ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
