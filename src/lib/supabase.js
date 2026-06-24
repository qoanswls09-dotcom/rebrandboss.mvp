import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = 'https://xtolgctjjzpgsoyisbzc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0b2xnY3RqanpwZ3NveWlzYnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNzc0MTUsImV4cCI6MjA5NTc1MzQxNX0.tF09jnP-9shgJasvEDQjoDswb2z_6ykw-nZt_ipHtRs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});