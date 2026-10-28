import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';
import { fetchLiveChaptersForSeries } from '@/lib/internet-manga';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const series = dataStore.getSeriesById(id) || dataStore.getSeriesBySlug(id);

    if (!series) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    let chapters = dataStore.getChaptersBySeriesId(series.id);

    // Dynamically sync hosted chapters from MangaDex API
    if (series.mangadexId) {
      const liveChapters = await fetchLiveChaptersForSeries(series);
      if (liveChapters.length > 0) {
        chapters = dataStore.syncSeriesChaptersWithLiveFeed(series.id, liveChapters);
      }
    }

    return NextResponse.json({
      ...series,
      chaptersCount: chapters.length,
      chapters,
    });
  } catch (error) {
    console.error('Failed to get series:', error);
    return NextResponse.json({ error: 'Failed to retrieve series' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updated = dataStore.updateSeries(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update series:', error);
    return NextResponse.json({ error: 'Failed to update series' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = dataStore.getSeriesById(id) || dataStore.getSeriesBySlug(id);
    const deleted = dataStore.deleteSeries(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Series deleted successfully',
      deletedSeries: existing,
    });
  } catch (error) {
    console.error('Failed to delete series:', error);
    return NextResponse.json({ error: 'Failed to delete series' }, { status: 500 });
  }
}
