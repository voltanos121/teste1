// Configure com os dados públicos do seu projeto Supabase.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://hmrjzhnrmyrmqtkaprtl.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_nRmug9PrIUJS3kBcolIoSA_aN9DeLnC';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
