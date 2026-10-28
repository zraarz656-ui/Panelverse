import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';

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

    const chapters = dataStore.getChaptersBySeriesId(series.id);
    return NextResponse.json({ series, chapters });
  } catch (error) {
    console.error('Failed to get series chapters:', error);
    return NextResponse.json({ error: 'Failed to retrieve chapters' }, { status: 500 });
  }
}
