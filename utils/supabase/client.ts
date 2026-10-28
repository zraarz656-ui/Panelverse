import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ahizfmtvgrfujoipmtdq.supabase.co';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_Eedg843YhCeVYwYmIgeDBw_BZdP3xoI';

export const createClient = () => createBrowserClient(supabaseUrl, supabaseKey);
