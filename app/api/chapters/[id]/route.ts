import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';
import {
  fetchLiveChaptersForSeries,
  resolveLiveChapterPages,
} from '@/lib/internet-manga';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let chapter = dataStore.getChapterById(id);

    // If chapter ID is from a newly discovered MangaDex slot not yet synced in memory, sync first
    if (!chapter) {
      const allSeries = dataStore.getSeries();
      const matchedSeries = allSeries.find((s) =>
        id.startsWith(`ch-${s.id.replace('series-', '')}-`)
      );
      if (matchedSeries && matchedSeries.mangadexId) {
        const liveChapters = await fetchLiveChaptersForSeries(matchedSeries);
        if (liveChapters.length > 0) {
          dataStore.syncSeriesChaptersWithLiveFeed(matchedSeries.id, liveChapters);
          chapter = dataStore.getChapterById(id);
        }
      }
    }

    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    // Ensure full chapter list for the series is synced so next/prev chapter navigation covers all live chapters
    if (chapter.series?.mangadexId && !chapter.mangadexChapterId) {
      const liveChapters = await fetchLiveChaptersForSeries(chapter.series);
      if (liveChapters.length > 0) {
        dataStore.syncSeriesChaptersWithLiveFeed(chapter.series.id, liveChapters);
        chapter = dataStore.getChapterById(id) || chapter;
      }
    }

    const { pages, isLiveStreamed, language } = await resolveLiveChapterPages(
      chapter.series,
      chapter
    );

    return NextResponse.json({
      ...chapter,
      pages,
      pagesCount: pages.length,
      language: language || chapter.language || 'EN',
      isLiveStreamed,
    });
  } catch (error) {
    console.error('Failed to get chapter:', error);
    return NextResponse.json({ error: 'Failed to retrieve chapter' }, { status: 500 });
  }
}
