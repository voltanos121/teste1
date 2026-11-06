// Configure com os dados públicos do seu projeto Supabase.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://bgbghfdesrnkkbonkpok.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_PdhyHUWl600_SKoV3qvHxg_AxuEq9EN';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
