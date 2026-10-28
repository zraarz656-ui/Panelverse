import { NextRequest, NextResponse } from 'next/server';
import { createCoverSvg, createReaderPanelSvg } from '@/lib/svg-covers';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');
  const title = searchParams.get('title') || 'PanelVerse';
  const mode = searchParams.get('mode') || 'cover';
  const chapterNum = Number(searchParams.get('chapter') || '1') || 1;
  const pageNum = Number(searchParams.get('page') || '1') || 1;
  const theme = (searchParams.get('theme') || 'shadow') as
    | 'shadow'
    | 'cyberpunk'
    | 'celestial'
    | 'mecha'
    | 'cafe'
    | 'dungeon';
  const type = (searchParams.get('type') === 'manga' ? 'manga' : 'webtoon') as
    | 'webtoon'
    | 'manga';

  const sendFallbackSvg = () => {
    const dataUri =
      mode === 'page'
        ? createReaderPanelSvg(title, chapterNum, pageNum, type)
        : createCoverSvg(title, theme, type);
    const svgXml = decodeURIComponent(dataUri.replace('data:image/svg+xml;utf8,', ''));
    return new NextResponse(svgXml, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  };

  if (!targetUrl || !targetUrl.startsWith('http')) {
    return sendFallbackSvg();
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const headers: Record<string, string> = {
      'User-Agent': 'PanelVerseReader/2.0 (Webtoon & Manga Reader)',
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };

    if (targetUrl.includes('mangadex')) {
      headers.Referer = 'https://mangadex.org/';
    }

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return sendFallbackSvg();
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength < 100) {
      return sendFallbackSvg();
    }

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return sendFallbackSvg();
  }
}
