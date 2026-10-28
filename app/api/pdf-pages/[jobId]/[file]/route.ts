import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { createReaderPanelSvg } from '@/lib/svg-covers';
import { supabaseAdmin } from '@/lib/supabase';

const TMP_PAGES_ROOT = '/tmp/panelverse-pdf-pages';
const CACHE_PAGES_ROOT = path.join(process.cwd(), 'node_modules', '.cache', 'panelverse-pdf-pages');

function sanitizeSegment(seg: string): string {
  return seg.replace(/[^a-zA-Z0-9_.-]/g, '');
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string; file: string }> }
) {
  try {
    const { jobId, file } = await context.params;
    const safeJobId = sanitizeSegment(jobId);
    const safeFile = sanitizeSegment(file);

    if (!safeJobId || !safeFile) {
      return new NextResponse('Invalid page asset path', { status: 400 });
    }

    const ext = path.extname(safeFile).toLowerCase();
    const contentType =
      ext === '.webp'
        ? 'image/webp'
        : ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : 'application/octet-stream';

    const tmpFilePath = path.join(TMP_PAGES_ROOT, safeJobId, safeFile);
    const cacheFilePath = path.join(CACHE_PAGES_ROOT, safeJobId, safeFile);

    let resolvedPath: string | null = null;
    if (fs.existsSync(tmpFilePath)) {
      resolvedPath = tmpFilePath;
    } else if (fs.existsSync(cacheFilePath)) {
      resolvedPath = cacheFilePath;
    }

    if (resolvedPath) {
      const fileBuffer = fs.readFileSync(resolvedPath);
      return new NextResponse(new Uint8Array(fileBuffer), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // Fallback: Check Supabase Storage 'content' bucket if configured
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.storage
          .from('content')
          .download(`pdf-pages/${safeJobId}/${safeFile}`);
        if (!error && data) {
          const arrayBuffer = await data.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          try {
            fs.mkdirSync(path.dirname(tmpFilePath), { recursive: true });
            fs.writeFileSync(tmpFilePath, buffer);
          } catch {
            // ignore local cache write error
          }
          return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        }
      } catch {
        // Ignore Supabase storage lookup error
      }
    }

    // Graceful SVG fallback if temporary file was cleaned up
    const matchPage = safeFile.match(/(\d+)/);
    const pageNum = matchPage ? Number(matchPage[1]) : 1;
    const fallbackDataUri = createReaderPanelSvg('Chapter Page', 1, pageNum, 'webtoon');
    const svgContent = decodeURIComponent(
      fallbackDataUri.replace(/^data:image\/svg\+xml;utf8,/, '')
    );

    return new NextResponse(svgContent, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error serving processed PDF page:', error);
    return new NextResponse('Failed to load page image', { status: 500 });
  }
}
