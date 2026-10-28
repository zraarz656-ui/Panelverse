import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';
import { ReadingProgress } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || 'guest';
    const progressList = dataStore.getReadingProgress(userId);
    return NextResponse.json(progressList);
  } catch (error) {
    console.error('Failed to get progress:', error);
    return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      seriesId,
      chapterId,
      chapterNumber,
      seriesTitle,
      seriesSlug,
      seriesType,
      coverImage,
      pageIndex,
      totalPages,
      scrollPercentage,
      isCompleted,
    } = body;

    if (!seriesId || !chapterId) {
      return NextResponse.json({ error: 'seriesId and chapterId are required' }, { status: 400 });
    }

    const item: ReadingProgress = {
      seriesId,
      chapterId,
      chapterNumber: Number(chapterNumber) || 1,
      seriesTitle: seriesTitle || 'Unknown Series',
      seriesSlug: seriesSlug || seriesId,
      seriesType: seriesType || 'webtoon',
      coverImage: coverImage || '',
      pageIndex: Number(pageIndex) || 0,
      totalPages: Number(totalPages) || 1,
      scrollPercentage: Math.min(100, Math.max(0, Number(scrollPercentage) || 0)),
      updatedAt: 'Just now',
      isCompleted: Boolean(isCompleted),
    };

    dataStore.saveReadingProgress(userId || 'guest', item);
    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error('Failed to save progress:', error);
    return NextResponse.json({ error: 'Failed to update reading progress' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, seriesId } = body;

    if (!userId || !seriesId) {
      return NextResponse.json({ error: 'userId and seriesId required' }, { status: 400 });
    }

    const updatedBookmarks = dataStore.toggleBookmark(userId, seriesId);
    return NextResponse.json({ success: true, bookmarks: updatedBookmarks });
  } catch (error) {
    console.error('Bookmark toggle error:', error);
    return NextResponse.json({ error: 'Failed to toggle bookmark' }, { status: 500 });
  }
}
