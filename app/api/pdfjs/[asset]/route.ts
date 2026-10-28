import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ asset: string }> }
) {
  const { asset } = await context.params;

  const allowedAssets: Record<string, string> = {
    'pdf.min.mjs': 'pdf.min.mjs',
    'pdf.worker.min.mjs': 'pdf.worker.min.mjs',
  };

  const targetFile = allowedAssets[asset];
  if (!targetFile) {
    return new NextResponse('Not Found', { status: 404 });
  }

  try {
    const filePath = path.join(
      process.cwd(),
      'node_modules',
      'pdfjs-dist',
      'build',
      targetFile
    );
    const content = await fs.readFile(filePath, 'utf-8');

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error(`Failed to serve PDF.js asset ${targetFile}:`, err);
    return new NextResponse('Failed to load PDF.js asset', { status: 500 });
  }
}
