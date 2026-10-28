import { createClient } from '@supabase/supabase-js';

export const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://ahizfmtvgrfujoipmtdq.supabase.co';

const fallbackAnonKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'placeholder-anon-key';

export const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  fallbackAnonKey;

export const supabaseJwksUrl =
  process.env.SUPABASE_JWKS_URL ||
  'https://ahizfmtvgrfujoipmtdq.supabase.co/auth/v1/.well-known/jwks.json';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseKey &&
    supabaseKey !== 'placeholder-anon-key' &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('YOUR-PROJECT')
);

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: { persistSession: false },
  }
);

let bucketEnsured = false;

/**
 * Ensures the public 'content' bucket exists in Supabase Storage for storing
 * HD WebP chapter pages and series covers.
 */
export async function ensureSupabaseContentBucket(): Promise<boolean> {
  if (!supabaseAdmin || !isSupabaseConfigured) return false;
  if (bucketEnsured) return true;

  try {
    const { data: buckets, error: listErr } = await supabaseAdmin.storage.listBuckets();
    if (listErr) return false;

    const existing = buckets?.find((b) => b.id === 'content' || b.name === 'content');
    if (!existing) {
      const { error: createErr } = await supabaseAdmin.storage.createBucket('content', {
        public: true,
      });
      if (createErr && !createErr.message.toLowerCase().includes('already exists')) {
        return false;
      }
    } else if (!existing.public) {
      await supabaseAdmin.storage.updateBucket('content', { public: true });
    }

    bucketEnsured = true;
    return true;
  } catch {
    return false;
  }
}
