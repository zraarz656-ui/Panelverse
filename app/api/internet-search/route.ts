import { NextRequest, NextResponse } from 'next/server';
import { searchInternetCatalog } from '@/lib/internet-manga';
import { dataStore } from '@/lib/data-store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || 'Solo Leveling';
    const results = await searchInternetCatalog(q);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Failed internet search:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      author,
      origin,
      type,
      genres,
      status,
      rating,
      synopsis,
      coverImage,
      mangadexId,
      malId,
    } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const imported = dataStore.importInternetSeries({
      title,
      author: author || 'Original Creator',
      origin: origin || (type === 'manga' ? 'manga' : 'manhwa'),
      type: type === 'manga' ? 'manga' : 'webtoon',
      genres: Array.isArray(genres) && genres.length > 0 ? genres : ['Action', 'Fantasy'],
      status: status === 'Completed' ? 'Completed' : 'Ongoing',
      rating: Number(rating) || 4.85,
      synopsis:
        synopsis ||
        'Imported from the global internet manga and manhwa catalog.',
      coverImage,
      mangadexId,
      malId,
    });

    return NextResponse.json(imported, { status: 201 });
  } catch (error) {
    console.error('Failed to import internet series:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
