#!/usr/bin/env node
/**
 * PanelVerse: Firestore & Local Catalog -> Supabase Postgres Migration Script
 * Usage:
 *   npm run migrate:supabase
 *   (or: node scripts/migrate-firestore-to-supabase.mjs)
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// 1. Load environment variables from .env.local if present
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://ahizfmtvgrfujoipmtdq.supabase.co';

const SUPABASE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 2. Read Firebase config to query Firestore REST API
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = fs.existsSync(firebaseConfigPath)
  ? JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'))
  : null;

function parseFirestoreValue(valObj) {
  if (!valObj || typeof valObj !== 'object') return null;
  if ('stringValue' in valObj) return valObj.stringValue;
  if ('integerValue' in valObj) return Number(valObj.integerValue);
  if ('doubleValue' in valObj) return Number(valObj.doubleValue);
  if ('booleanValue' in valObj) return Boolean(valObj.booleanValue);
  if ('timestampValue' in valObj) return String(valObj.timestampValue);
  if ('arrayValue' in valObj) {
    const values = valObj.arrayValue?.values || [];
    return values.map(parseFirestoreValue);
  }
  if ('mapValue' in valObj) {
    const fields = valObj.mapValue?.fields || {};
    const out = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = parseFirestoreValue(v);
    }
    return out;
  }
  return null;
}

async function fetchFirestoreCollection(collectionPath) {
  if (!firebaseConfig?.projectId) return [];
  const projectId = firebaseConfig.projectId;
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/${collectionPath}?pageSize=300`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.documents)) return [];

    return data.documents.map((doc) => {
      const id = doc.name.split('/').pop() || '';
      const parsed = { id };
      for (const [k, v] of Object.entries(doc.fields || {})) {
        parsed[k] = parseFirestoreValue(v);
      }
      return parsed;
    });
  } catch {
    return [];
  }
}

async function main() {
  console.log('==============================================================');
  console.log('PanelVerse: Migrating Firestore & Catalog -> Supabase Postgres');
  console.log(`Target Supabase Project: ${SUPABASE_URL}`);
  console.log('==============================================================\n');

  // Ensure 'content' storage bucket is ready
  const { data: buckets } = await supabase.storage.listBuckets();
  const hasContentBucket = Array.isArray(buckets) && buckets.some((b) => b.name === 'content');
  if (!hasContentBucket) {
    const { error: bucketErr } = await supabase.storage.createBucket('content', {
      public: true,
      fileSizeLimit: 52428800,
    });
    if (!bucketErr) {
      console.log('✔ Created public Supabase Storage bucket: "content"');
    }
  } else {
    console.log('✔ Verified public Supabase Storage bucket: "content"');
  }

  // First try calling the running Next.js server migration route if localhost:3000 is active
  try {
    const res = await fetch('http://localhost:3000/api/admin/migrate-supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.ok || res.status === 200) {
      const report = await res.json();
      console.log('\nMigration Report:');
      console.log(JSON.stringify(report, null, 2));
      if (!report.tablesReady) {
        console.log('\nACTION REQUIRED:');
        console.log(`1. Open your Supabase SQL Editor: ${report.sqlEditorUrl}`);
        console.log('2. Paste and run the contents of: supabase/schema.sql');
        console.log('3. Re-run: npm run migrate:supabase');
      }
      return;
    }
  } catch {
    // Next.js server not running on localhost:3000; run direct Firestore -> Supabase migration
  }

  console.log('Fetching collections directly from Firestore REST API...');
  const [fsSeries, fsChapters, fsComments, fsRequests] = await Promise.all([
    fetchFirestoreCollection('series'),
    fetchFirestoreCollection('chapters'),
    fetchFirestoreCollection('comments'),
    fetchFirestoreCollection('requests'),
  ]);

  // Also load persisted local state if present
  const localStatePath = '/tmp/panelverse-library-state-v4.json';
  let localSeries = [];
  let localChapters = [];
  if (fs.existsSync(localStatePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
      localSeries = Array.isArray(parsed.seriesOverrides) ? parsed.seriesOverrides : [];
      localChapters = Array.isArray(parsed.chapterOverrides) ? parsed.chapterOverrides : [];
    } catch {
      // Ignore
    }
  }

  const seriesRows = [...localSeries, ...fsSeries]
    .filter((s) => s && s.id)
    .map((s) => ({
      id: String(s.id),
      slug: String(s.slug || s.id),
      title: String(s.title || 'Untitled'),
      origin: String(s.origin || (s.type === 'manga' ? 'manga' : 'manhwa')),
      type: s.type === 'manga' ? 'manga' : 'webtoon',
      author: String(s.author || 'Unknown'),
      artist: String(s.artist || s.author || 'Unknown'),
      status: s.status === 'Completed' ? 'Completed' : 'Ongoing',
      release_day: String(s.releaseDay || 'Friday'),
      synopsis: String(s.synopsis || ''),
      cover_image: String(s.coverImage || '/placeholder.jpg'),
      genres: Array.isArray(s.genres) ? s.genres.map(String) : ['Action'],
      rating: Number(s.rating ?? 4.9),
      total_views: Math.round(Number(s.totalViews ?? 100)),
      chapters_count: Math.round(Number(s.chaptersCount ?? 0)),
      featured: Boolean(s.featured),
      is_deleted: Boolean(s.isDeleted ?? false),
      malayalam_title: s.malayalamTitle ? String(s.malayalamTitle) : null,
      malayalam_synopsis: s.malayalamSynopsis ? String(s.malayalamSynopsis) : null,
      updated_at: new Date().toISOString(),
    }));

  const chapterRows = [...localChapters, ...fsChapters]
    .filter((c) => c && c.id)
    .map((c) => {
      const pageUrls = Array.isArray(c.pageUrls)
        ? c.pageUrls.map(String)
        : Array.isArray(c.pages)
        ? c.pages.map((p) => String(p.imageUrl || '')).filter(Boolean)
        : [];
      return {
        id: String(c.id),
        series_id: String(c.seriesId || ''),
        chapter_number: Number(c.chapterNumber ?? 1),
        title: String(c.title || 'Episode'),
        release_date: String(c.releaseDate || 'Recent'),
        views: Math.round(Number(c.views ?? 1)),
        page_urls: pageUrls,
        pages: pageUrls.map((url, idx) => ({
          pageNumber: idx + 1,
          imageUrl: url,
          caption: `Panel ${idx + 1}`,
        })),
        pages_count: pageUrls.length,
        is_deleted: Boolean(c.isDeleted ?? false),
        updated_at: new Date().toISOString(),
      };
    });

  console.log(`Prepared ${seriesRows.length} series and ${chapterRows.length} chapters.`);

  if (seriesRows.length > 0) {
    const { error } = await supabase.from('series').upsert(seriesRows, { onConflict: 'id' });
    if (error) {
      console.error('Supabase series upsert warning:', error.message);
      console.log('Ensure you have executed supabase/schema.sql in your Supabase SQL Editor.');
      return;
    }
  }

  if (chapterRows.length > 0) {
    const { error } = await supabase.from('chapters').upsert(chapterRows, { onConflict: 'id' });
    if (error) {
      console.error('Supabase chapters upsert warning:', error.message);
      return;
    }
  }

  if (fsComments.length > 0) {
    const commentRows = fsComments.map((c) => ({
      id: String(c.id),
      chapter_id: String(c.chapterId || ''),
      series_id: String(c.seriesId || ''),
      author_id: String(c.authorId || 'reader'),
      username: String(c.username || 'Reader'),
      content: String(c.content || ''),
      spoiler: Boolean(c.spoiler),
      upvotes: Math.round(Number(c.upvotes ?? 0)),
      updated_at: new Date().toISOString(),
    }));
    await supabase.from('comments').upsert(commentRows, { onConflict: 'id' });
  }

  if (fsRequests.length > 0) {
    const requestRows = fsRequests.map((r) => ({
      id: String(r.id),
      title: String(r.title || 'Untitled'),
      type: r.type === 'manga' ? 'manga' : 'webtoon',
      author: String(r.author || 'Unknown Studio'),
      reason: String(r.reason || ''),
      requested_by: String(r.requestedBy || 'Reader'),
      author_id: String(r.authorId || 'reader'),
      votes: Math.round(Number(r.votes ?? 1)),
      status: String(r.status || 'Pending'),
      updated_at: new Date().toISOString(),
    }));
    await supabase.from('requests').upsert(requestRows, { onConflict: 'id' });
  }

  console.log('✔ Migration complete!');
}

main().catch((err) => {
  console.error('Migration script failed:', err);
  process.exit(1);
});
