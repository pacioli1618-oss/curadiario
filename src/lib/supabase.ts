import {createClient} from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).');
}

// Browser client with a Supabase Auth session (magic link / e-mail code). PKCE: the link sends a
// one-time code back to /auth/callback, exchanged for the session in this same browser.
// Every call goes through the public.cd_* RPCs (src/lib/api.ts); the tables are not exposed.
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'curadiario:auth'},
});
