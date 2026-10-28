import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { dataStore } from '@/lib/data-store';
import firebaseConfig from '@/firebase-applet-config.json';

interface FirestoreRestDocument {
  name: string;
  fields?: Record<string, Record<string, unknown>>;
}

export async function GET() {
  try {
    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://ahizfmtvgrfujoipmtdq.supabase.co';
    const publishableKey =
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      'sb_publishable_Eedg843YhCeVYwYmIgeDBw_BZdP3xoI';
    const secretKey =
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      '';
    const jwksUrl =
      process.env.SUPABASE_JWKS_URL ||
      `${supabaseUrl}/auth/v1/.well-known/jwks.json`;

    const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
    const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;

    // 1. Check / ensure public 'content' Storage bucket
    let bucketReady = false;
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      bucketReady = Array.isArray(buckets) && buckets.some((b) => b.name === 'content');
      if (!bucketReady) {
        const { error: createErr } = await supabaseAdmin.storage.createBucket('content', {
          public: true,
          fileSizeLimit: 52428800,
        });
        if (!createErr) bucketReady = true;
      }
    } catch {
      bucketReady = false;
    }

    // 2. Check Postgres tables & row counts
    const tableStatus: Record<string, { ready: boolean; count: number }> = {
      series: { ready: false, count: 0 },
      chapters: { ready: false, count: 0 },
      reading_progress: { ready: false, count: 0 },
      comments: { ready: false, count: 0 },
      requests: { ready: false, count: 0 },
    };

    await Promise.all(
      Object.keys(tableStatus).map(async (tableName) => {
        try {
          const { count, error } = await supabaseAdmin
            .from(tableName)
            .select('id', { count: 'exact' })
            .limit(1);
          if (!error) {
            tableStatus[tableName] = { ready: true, count: count ?? 0 };
          }
        } catch {
          // Table not created yet
        }
      })
    );

    const tablesReady = Object.values(tableStatus).every((t) => t.ready);

    // 3. Load supabase/schema.sql
    let sqlSchema = '';
    try {
      const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        sqlSchema = fs.readFileSync(schemaPath, 'utf8');
      }
    } catch {
      sqlSchema = '';
    }

    // 4. Build ready-to-paste Vercel Environment Variables block
    const vercelEnvLines = [
      `NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}`,
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
      `SUPABASE_URL=${supabaseUrl}`,
      `SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
      ...(secretKey ? [`SUPABASE_SECRET_KEY=${secretKey}`] : []),
      `SUPABASE_JWKS_URL=${jwksUrl}`,
    ];

    return NextResponse.json({
      ok: true,
      supabaseUrl,
      projectRef,
      sqlEditorUrl,
      bucketReady,
      tablesReady,
      tableStatus,
      sqlSchema,
      vercelEnvBlock: vercelEnvLines.join('\n'),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : 'Status check failed',
      },
      { status: 500 }
    );
  }
}

function parseFirestoreRestValue(valObj: Record<string, unknown> | undefined): unknown {
  if (!valObj) return null;
  if ('stringValue' in valObj) return valObj.stringValue;
  if ('integerValue' in valObj) return Number(valObj.integerValue);
  if ('doubleValue' in valObj) return Number(valObj.doubleValue);
  if ('booleanValue' in valObj) return Boolean(valObj.booleanValue);
  if ('timestampValue' in valObj) return String(valObj.timestampValue);
  if ('arrayValue' in valObj) {
    const arr = (valObj.arrayValue as { values?: Record<string, unknown>[] })?.values || [];
    return arr.map((v) => parseFirestoreRestValue(v));
  }
  if ('mapValue' in valObj) {
    const fields = (valObj.mapValue as { fields?: Record<string, Record<string, unknown>> })?.fields || {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = parseFirestoreRestValue(v);
    }
    return out;
  }
  return null;
}

async function fetchFirestoreCollectionRest(collectionName: string): Promise<Record<string, unknown>[]> {
  try {
    const projectId = firebaseConfig.projectId;
    const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/${collectionName}?pageSize=300`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = (await res.json()) as { documents?: FirestoreRestDocument[] };
    if (!Array.isArray(json.documents)) return [];

    return json.documents.map((doc) => {
      const id = doc.name.split('/').pop() || '';
      const parsed: Record<string, unknown> = { id };
      for (const [k, v] of Object.entries(doc.fields || {})) {
        parsed[k] = parseFirestoreRestValue(v);
      }
      return parsed;
    });
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const clientSeries = Array.isArray(body.series) ? body.series : [];
    const clientChapters = Array.isArray(body.chapters) ? body.chapters : [];
    const clientProgress = Array.isArray(body.progress) ? body.progress : [];
    const clientComments = Array.isArray(body.comments) ? body.comments : [];
    const clientRequests = Array.isArray(body.requests) ? body.requests : [];

    // Also pull from Firestore REST API directly on the server
    const [restSeries, restChapters, restComments, restRequests] = await Promise.all([
      fetchFirestoreCollectionRest('series'),
      fetchFirestoreCollectionRest('chapters'),
      fetchFirestoreCollectionRest('comments'),
      fetchFirestoreCollectionRest('requests'),
    ]);

    // 1. Build unified Series rows (Catalog + Firestore REST + Client Firestore)
    const seriesMap = new Map<string, Record<string, unknown>>();
    const allCatalogSeries = dataStore.getSeries();

    for (const s of allCatalogSeries) {
      seriesMap.set(s.id, {
        id: s.id,
        slug: s.slug || s.id,
        title: s.title,
        origin: s.origin || (s.type === 'manga' ? 'manga' : 'manhwa'),
        type: s.type === 'manga' ? 'manga' : 'webtoon',
        author: s.author || 'Unknown',
        artist: s.artist || s.author || 'Unknown',
        status: s.status === 'Completed' ? 'Completed' : 'Ongoing',
        release_day: s.releaseDay || 'Friday',
        synopsis: s.synopsis || '',
        cover_image: s.coverImage || '/placeholder.jpg',
        genres: Array.isArray(s.genres) && s.genres.length > 0 ? s.genres : ['Action'],
        rating: Number(s.rating ?? 4.9),
        total_views: Math.round(Number(s.totalViews ?? 100)),
        chapters_count: Math.round(Number(s.chaptersCount ?? 0)),
        featured: Boolean(s.featured),
        is_deleted: false,
        malayalam_title: s.malayalamTitle || null,
        malayalam_synopsis: s.malayalamSynopsis || null,
        updated_at: new Date().toISOString(),
      });
    }

    for (const raw of [...restSeries, ...clientSeries]) {
      const id = String(raw.id || '');
      if (!id) continue;
      seriesMap.set(id, {
        id,
        slug: String(raw.slug || id),
        title: String(raw.title || 'Untitled'),
        origin: String(raw.origin || (raw.type === 'manga' ? 'manga' : 'manhwa')),
        type: raw.type === 'manga' ? 'manga' : 'webtoon',
        author: String(raw.author || 'Unknown'),
        artist: String(raw.artist || raw.author || 'Unknown'),
        status: raw.status === 'Completed' ? 'Completed' : 'Ongoing',
        release_day: String(raw.releaseDay || raw.release_day || 'Friday'),
        synopsis: String(raw.synopsis || ''),
        cover_image: String(raw.coverImage || raw.cover_image || '/placeholder.jpg'),
        genres: Array.isArray(raw.genres) ? raw.genres.map(String) : ['Action'],
        rating: Number(raw.rating ?? 4.9),
        total_views: Math.round(Number(raw.totalViews ?? raw.total_views ?? 100)),
        chapters_count: Math.round(Number(raw.chaptersCount ?? raw.chapters_count ?? 0)),
        featured: Boolean(raw.featured),
        is_deleted: Boolean(raw.isDeleted ?? raw.is_deleted ?? false),
        malayalam_title: raw.malayalamTitle ? String(raw.malayalamTitle) : null,
        malayalam_synopsis: raw.malayalamSynopsis ? String(raw.malayalamSynopsis) : null,
        updated_at: new Date().toISOString(),
      });
    }

    // 2. Build unified Chapters rows
    const chaptersMap = new Map<string, Record<string, unknown>>();
    for (const s of allCatalogSeries) {
      const chs = dataStore.getChaptersBySeriesId(s.id);
      for (const c of chs) {
        const pageUrls = Array.isArray(c.pages)
          ? c.pages.map((p) => String(p.imageUrl || '')).filter(Boolean)
          : [];
        chaptersMap.set(c.id, {
          id: c.id,
          series_id: c.seriesId,
          chapter_number: Number(c.chapterNumber ?? 1),
          title: c.title || `Chapter ${c.chapterNumber}`,
          release_date: c.releaseDate || 'Recent',
          views: Math.round(Number(c.views ?? 1)),
          page_urls: pageUrls,
          pages: Array.isArray(c.pages) ? c.pages : [],
          pages_count: pageUrls.length,
          is_deleted: false,
          updated_at: new Date().toISOString(),
        });
      }
    }

    for (const raw of [...restChapters, ...clientChapters]) {
      const id = String(raw.id || '');
      if (!id) continue;
      const pageUrls = Array.isArray(raw.pageUrls)
        ? raw.pageUrls.map(String)
        : Array.isArray(raw.page_urls)
        ? raw.page_urls.map(String)
        : [];
      const pages = pageUrls.map((url: string, idx: number) => ({
        pageNumber: idx + 1,
        imageUrl: url,
        caption: `Panel ${idx + 1}`,
      }));

      chaptersMap.set(id, {
        id,
        series_id: String(raw.seriesId || raw.series_id || ''),
        chapter_number: Number(raw.chapterNumber ?? raw.chapter_number ?? 1),
        title: String(raw.title || 'Episode'),
        release_date: String(raw.releaseDate || raw.release_date || 'Recent'),
        views: Math.round(Number(raw.views ?? 1)),
        page_urls: pageUrls,
        pages,
        pages_count: pageUrls.length,
        is_deleted: Boolean(raw.isDeleted ?? raw.is_deleted ?? false),
        updated_at: new Date().toISOString(),
      });
    }

    // 3. Build unified Reading Progress rows
    const progressMap = new Map<string, Record<string, unknown>>();
    for (const raw of clientProgress) {
      const userId = String(raw.userId || raw.user_id || 'reader');
      const seriesId = String(raw.seriesId || raw.series_id || '');
      if (!seriesId) continue;
      const rowId = `${userId}__${seriesId}`;
      progressMap.set(rowId, {
        id: rowId,
        user_id: userId,
        series_id: seriesId,
        chapter_id: String(raw.chapterId || raw.chapter_id || ''),
        chapter_number: Number(raw.chapterNumber ?? raw.chapter_number ?? 1),
        series_title: String(raw.seriesTitle || raw.series_title || 'Series'),
        series_slug: String(raw.seriesSlug || raw.series_slug || seriesId),
        series_type: raw.seriesType === 'manga' ? 'manga' : 'webtoon',
        cover_image: String(raw.coverImage || raw.cover_image || '/placeholder.jpg'),
        page_index: Math.round(Number(raw.pageIndex ?? raw.page_index ?? 0)),
        total_pages: Math.max(1, Math.round(Number(raw.totalPages ?? raw.total_pages ?? 1))),
        scroll_percentage: Math.round(Number(raw.scrollPercentage ?? raw.scroll_percentage ?? 0)),
        is_completed: Boolean(raw.isCompleted ?? raw.is_completed ?? false),
        updated_at: new Date().toISOString(),
      });
    }

    // 4. Build unified Comments rows
    const commentsMap = new Map<string, Record<string, unknown>>();
    for (const raw of [...restComments, ...clientComments]) {
      const id = String(raw.id || '');
      if (!id) continue;
      commentsMap.set(id, {
        id,
        chapter_id: String(raw.chapterId || raw.chapter_id || ''),
        series_id: String(raw.seriesId || raw.series_id || ''),
        author_id: String(raw.authorId || raw.userId || raw.author_id || 'reader'),
        username: String(raw.username || 'Reader'),
        content: String(raw.content || ''),
        spoiler: Boolean(raw.spoiler),
        upvotes: Math.round(Number(raw.upvotes ?? 0)),
        updated_at: new Date().toISOString(),
      });
    }

    // 5. Build unified Requests rows
    const requestsMap = new Map<string, Record<string, unknown>>();
    for (const r of dataStore.getRequests()) {
      requestsMap.set(r.id, {
        id: r.id,
        title: r.title,
        type: r.type === 'manga' ? 'manga' : 'webtoon',
        author: r.author || 'Unknown Studio',
        reason: r.reason || '',
        requested_by: r.requestedBy || 'Reader',
        author_id: 'community',
        votes: Math.round(Number(r.votes ?? 1)),
        status: r.status || 'Pending',
        updated_at: new Date().toISOString(),
      });
    }
    for (const raw of [...restRequests, ...clientRequests]) {
      const id = String(raw.id || '');
      if (!id) continue;
      requestsMap.set(id, {
        id,
        title: String(raw.title || 'Untitled'),
        type: raw.type === 'manga' ? 'manga' : 'webtoon',
        author: String(raw.author || 'Unknown Studio'),
        reason: String(raw.reason || ''),
        requested_by: String(raw.requestedBy || raw.requested_by || 'Reader'),
        author_id: String(raw.authorId || raw.author_id || 'reader'),
        votes: Math.round(Number(raw.votes ?? 1)),
        status: String(raw.status || 'Pending'),
        updated_at: new Date().toISOString(),
      });
    }

    const seriesRows = Array.from(seriesMap.values());
    const chapterRows = Array.from(chaptersMap.values());
    const progressRows = Array.from(progressMap.values());
    const commentRows = Array.from(commentsMap.values());
    const requestRows = Array.from(requestsMap.values());

    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://ahizfmtvgrfujoipmtdq.supabase.co';
    const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
    const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;

    // Upsert Series first to test if Postgres schema has been applied
    const { error: seriesErr } = await supabaseAdmin
      .from('series')
      .upsert(seriesRows, { onConflict: 'id' });

    if (seriesErr) {
      const isMissingTable =
        seriesErr.code === 'PGRST205' ||
        seriesErr.code === '42P01' ||
        (seriesErr.message && seriesErr.message.includes('schema cache'));

      if (isMissingTable) {
        return NextResponse.json({
          ok: false,
          tablesReady: false,
          migrated: {
            series: 0,
            chapters: 0,
            progress: 0,
            comments: 0,
            requests: 0,
          },
          preparedCounts: {
            series: seriesRows.length,
            chapters: chapterRows.length,
            progress: progressRows.length,
            comments: commentRows.length,
            requests: requestRows.length,
          },
          sqlEditorUrl,
          message:
            'Supabase Storage bucket "content" is active, but the Postgres tables (series, chapters, reading_progress) have not been created yet. Run supabase/schema.sql in your Supabase SQL Editor first, then click Migrate again.',
        });
      }

      return NextResponse.json(
        {
          ok: false,
          tablesReady: false,
          migrated: { series: 0, chapters: 0, progress: 0, comments: 0, requests: 0 },
          message: `Supabase upsert error: ${seriesErr.message}`,
        },
        { status: 500 }
      );
    }

    // Batch upsert Chapters in chunks of 25 so large SVG/URL payloads stay fast
    let migratedChapters = 0;
    for (let i = 0; i < chapterRows.length; i += 25) {
      const batch = chapterRows.slice(i, i + 25);
      const { error: chErr } = await supabaseAdmin
        .from('chapters')
        .upsert(batch, { onConflict: 'id' });
      if (!chErr) {
        migratedChapters += batch.length;
      }
    }

    let migratedProgress = 0;
    if (progressRows.length > 0) {
      const { error: progErr } = await supabaseAdmin
        .from('reading_progress')
        .upsert(progressRows, { onConflict: 'id' });
      if (!progErr) migratedProgress = progressRows.length;
    }

    let migratedComments = 0;
    if (commentRows.length > 0) {
      const { error: cmtErr } = await supabaseAdmin
        .from('comments')
        .upsert(commentRows, { onConflict: 'id' });
      if (!cmtErr) migratedComments = commentRows.length;
    }

    let migratedRequests = 0;
    if (requestRows.length > 0) {
      const { error: reqErr } = await supabaseAdmin
        .from('requests')
        .upsert(requestRows, { onConflict: 'id' });
      if (!reqErr) migratedRequests = requestRows.length;
    }

    return NextResponse.json({
      ok: true,
      tablesReady: true,
      migrated: {
        series: seriesRows.length,
        chapters: migratedChapters,
        progress: migratedProgress,
        comments: migratedComments,
        requests: migratedRequests,
      },
      sqlEditorUrl,
      message: `Successfully migrated ${seriesRows.length} series, ${migratedChapters} chapters, ${migratedProgress} reading progress records, ${migratedComments} comments, and ${migratedRequests} requests to Supabase Postgres.`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        tablesReady: false,
        migrated: { series: 0, chapters: 0, progress: 0, comments: 0, requests: 0 },
        message: err instanceof Error ? err.message : 'Migration failed',
      },
      { status: 500 }
    );
  }
}
