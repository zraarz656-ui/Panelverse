import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { supabaseAdmin, ensureSupabaseContentBucket } from '@/lib/supabase';

const execFileAsync = promisify(execFile);

const TMP_UPLOAD_ROOT = '/tmp/panelverse-pdf-uploads';
const TMP_PAGES_ROOT = '/tmp/panelverse-pdf-pages';
const CACHE_PAGES_ROOT = path.join(
  process.cwd(),
  'node_modules',
  '.cache',
  'panelverse-pdf-pages'
);

export interface ServerProcessedPage {
  pageNumber: number;
  name: string;
  url: string;
  sizeKb: number;
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || `job_${Date.now()}`;
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function saveWebpPageToStorage(jobId: string, fileName: string, buffer: Buffer): string {
  const safeJob = sanitizeId(jobId);
  const tmpDir = path.join(TMP_PAGES_ROOT, safeJob);
  const cacheDir = path.join(CACHE_PAGES_ROOT, safeJob);

  ensureDir(tmpDir);
  fs.writeFileSync(path.join(tmpDir, fileName), buffer);

  try {
    ensureDir(cacheDir);
    fs.writeFileSync(path.join(cacheDir, fileName), buffer);
  } catch {
    // Non-fatal if node_modules/.cache is read-only in some environments
  }

  // Mirror to Supabase Storage 'content' bucket in background if configured
  if (supabaseAdmin) {
    ensureSupabaseContentBucket()
      .then((ready) => {
        if (!ready || !supabaseAdmin) return;
        return supabaseAdmin.storage
          .from('content')
          .upload(`pdf-pages/${safeJob}/${fileName}`, buffer, {
            contentType: 'image/webp',
            upsert: true,
          });
      })
      .catch(() => {
        // Ignore background storage sync errors
      });
  }

  return `/api/pdf-pages/${safeJob}/${fileName}`;
}

/**
 * Converts an input image (file path or buffer) into 1 or more high-definition
 * full-width WebP panels without EVER shrinking width due to tall Webtoon strip height.
 *
 * If the image is a tall vertical Webtoon strip (e.g. 1080 x 15000), it keeps 100% of
 * its HD width (up to 1280px wide) and slices vertically into seamless segments that
 * stay under mobile GPU texture limits (3600px) and WebP's 16383px height cap.
 */
async function convertPageToHdWebpSlices(params: {
  source: string | Buffer;
  safeJobId: string;
  baseLabel: string;
  maxSlicesForThisPage: number;
  startPageCounter: number;
}): Promise<{ slices: ServerProcessedPage[]; totalSizeKb: number }> {
  const { source, safeJobId, baseLabel, maxSlicesForThisPage, startPageCounter } = params;
  const TARGET_MAX_WIDTH = 1280;
  const IDEAL_SLICE_HEIGHT = 3600;
  const WEBP_MAX_HEIGHT = 16000;

  const instance = sharp(source, { limitInputPixels: false });
  const meta = await instance.metadata();
  const origWidth = meta.width || 1080;
  const origHeight = meta.height || 1600;

  // Only constrain width (NEVER constrain height so tall Webtoon strips keep full HD width!)
  const targetWidth = Math.min(origWidth, TARGET_MAX_WIDTH);
  const widthScale = targetWidth / origWidth;
  const scaledHeight = Math.max(1, Math.round(origHeight * widthScale));

  // Determine how many vertical slices to split this page into:
  // - Standard manga/comic page (scaledHeight <= 3800): 1 slice
  // - Tall webtoon strip (e.g. 1080 x 15000): split into seamless vertical slices
  let numSlices = 1;
  if (scaledHeight > 3800 && maxSlicesForThisPage > 1) {
    const idealCount = Math.ceil(scaledHeight / IDEAL_SLICE_HEIGHT);
    numSlices = Math.min(maxSlicesForThisPage, idealCount);
  }
  // Ensure each slice stays below WebP's 16,383px hardware encoder limit
  while (Math.ceil(scaledHeight / numSlices) > WEBP_MAX_HEIGHT) {
    numSlices++;
  }

  // If only 1 slice is needed, resize by width only and encode at HD quality 92
  if (numSlices === 1) {
    const outIdx = startPageCounter;
    const padded = String(outIdx).padStart(3, '0');
    const outWebpName = `page-${padded}.webp`;

    const webpBuffer = await sharp(source, { limitInputPixels: false })
      .resize({
        width: targetWidth,
        withoutEnlargement: true,
      })
      .webp({
        quality: 92,
        smartSubsample: true,
        effort: 4,
      })
      .toBuffer();

    const sizeKb = Math.max(1, Math.round(webpBuffer.byteLength / 1024));
    const publicUrl = saveWebpPageToStorage(safeJobId, outWebpName, webpBuffer);

    return {
      totalSizeKb: sizeKb,
      slices: [
        {
          pageNumber: outIdx,
          name: baseLabel,
          url: publicUrl,
          sizeKb,
        },
      ],
    };
  }

  // For multi-slice tall Webtoon strips: resize width once to lossless raw/PNG buffer, then extract slices
  const resizedPngBuffer = await sharp(source, { limitInputPixels: false })
    .resize({
      width: targetWidth,
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 1 })
    .toBuffer();

  const resizedMeta = await sharp(resizedPngBuffer, { limitInputPixels: false }).metadata();
  const actualW = resizedMeta.width || targetWidth;
  const actualH = resizedMeta.height || scaledHeight;
  const sliceHeight = Math.ceil(actualH / numSlices);

  const slices: ServerProcessedPage[] = [];
  let totalSizeKb = 0;

  for (let s = 0; s < numSlices; s++) {
    const top = s * sliceHeight;
    if (top >= actualH) break;
    const height = Math.min(sliceHeight, actualH - top);
    if (height <= 0) break;

    const outIdx = startPageCounter + slices.length;
    const padded = String(outIdx).padStart(3, '0');
    const outWebpName = `page-${padded}.webp`;

    const webpBuffer = await sharp(resizedPngBuffer, { limitInputPixels: false })
      .extract({
        left: 0,
        top,
        width: actualW,
        height,
      })
      .webp({
        quality: 92,
        smartSubsample: true,
        effort: 4,
      })
      .toBuffer();

    const sizeKb = Math.max(1, Math.round(webpBuffer.byteLength / 1024));
    totalSizeKb += sizeKb;
    const publicUrl = saveWebpPageToStorage(safeJobId, outWebpName, webpBuffer);

    slices.push({
      pageNumber: outIdx,
      name: numSlices > 1 ? `${baseLabel} (Part ${s + 1}/${numSlices})` : baseLabel,
      url: publicUrl,
      sizeKb,
    });
  }

  return { slices, totalSizeKb };
}

/**
 * Converts a Google Drive share URL or view link into a direct download URL.
 */
function normalizePdfDownloadUrl(rawUrl: string): { url: string; driveFileId?: string } {
  const trimmed = rawUrl.trim();

  // Pattern 1: https://drive.google.com/file/d/FILE_ID/view...
  const fileDMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (fileDMatch?.[1]) {
    const fileId = fileDMatch[1];
    return {
      url: `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
      driveFileId: fileId,
    };
  }

  // Pattern 2: https://drive.google.com/open?id=FILE_ID or uc?id=FILE_ID
  const idParamMatch = trimmed.match(
    /drive\.google\.com\/(?:open|uc)\?[^#]*[?&]id=([a-zA-Z0-9_-]+)/i
  );
  if (idParamMatch?.[1]) {
    const fileId = idParamMatch[1];
    return {
      url: `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
      driveFileId: fileId,
    };
  }

  return { url: trimmed };
}

/**
 * Downloads a PDF from a direct URL or Google Drive link into destPdfPath.
 */
async function downloadPdfFromUrl(rawUrl: string, destPdfPath: string): Promise<string> {
  const { url, driveFileId } = normalizePdfDownloadUrl(rawUrl);

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
      Accept: 'application/pdf,application/octet-stream,*/*',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Remote server returned HTTP ${response.status} when fetching PDF URL.`);
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  let buffer = Buffer.from(await response.arrayBuffer());

  // Handle Google Drive large-file confirmation HTML page if needed
  if (
    driveFileId &&
    (contentType.includes('text/html') || buffer.subarray(0, 5).toString('utf8') !== '%PDF-')
  ) {
    const html = buffer.toString('utf8');
    const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/i);
    const confirmUrl = `https://drive.usercontent.google.com/download?id=${driveFileId}&export=download&confirm=t${
      uuidMatch?.[1] ? `&uuid=${encodeURIComponent(uuidMatch[1])}` : ''
    }`;

    const retryRes = await fetch(confirmUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
      },
      redirect: 'follow',
    });

    if (retryRes.ok) {
      buffer = Buffer.from(await retryRes.arrayBuffer());
    }
  }

  // Find %PDF- header within the first 1024 bytes (some servers prepend whitespace/headers)
  const headerSlice = buffer.subarray(0, 1024).toString('latin1');
  const pdfHeaderIndex = headerSlice.indexOf('%PDF-');
  if (pdfHeaderIndex === -1) {
    throw new Error(
      'The provided URL did not return a valid PDF file. If using Google Drive, ensure link sharing is set to "Anyone with the link".'
    );
  }

  const cleanPdfBuffer = pdfHeaderIndex > 0 ? buffer.subarray(pdfHeaderIndex) : buffer;
  fs.writeFileSync(destPdfPath, cleanPdfBuffer);

  try {
    const parsedUrl = new URL(rawUrl);
    const base = path.basename(parsedUrl.pathname);
    if (base && base.toLowerCase().endsWith('.pdf')) {
      return decodeURIComponent(base);
    }
  } catch {
    // ignore URL parse error
  }
  return driveFileId ? `gdrive-${driveFileId.slice(0, 8)}.pdf` : 'remote-chapter.pdf';
}

/**
 * Renders a PDF file on disk into HD WebP pages using Ghostscript (/usr/bin/gs)
 * with lossless 24-bit PNG + 4x antialiasing at 180 DPI, followed by full-width
 * sharp WebP conversion (preserving 100% of horizontal resolution on tall Webtoon strips).
 */
async function processPdfFileOnServer(params: {
  jobId: string;
  pdfPath: string;
  fileName: string;
  maxPages?: number;
}): Promise<{
  jobId: string;
  fileName: string;
  pageCount: number;
  totalSizeKb: number;
  pages: ServerProcessedPage[];
}> {
  const { jobId, pdfPath, fileName } = params;
  const maxTotalOutputPages = Math.min(60, Math.max(1, Number(params.maxPages) || 60));
  const safeJobId = sanitizeId(jobId);
  const workDir = path.dirname(pdfPath);
  const rawPattern = path.join(workDir, 'raw-page-%03d.png');

  // Render pages with Ghostscript in lossless 24-bit PNG with 4x subpixel antialiasing at 180 DPI
  await execFileAsync(
    '/usr/bin/gs',
    [
      '-dSAFER',
      '-dBATCH',
      '-dNOPAUSE',
      '-dQUIET',
      '-sDEVICE=png16m',
      '-dTextAlphaBits=4',
      '-dGraphicsAlphaBits=4',
      '-r180',
      '-dFirstPage=1',
      `-dLastPage=${maxTotalOutputPages}`,
      `-sOutputFile=${rawPattern}`,
      pdfPath,
    ],
    { timeout: 180000, maxBuffer: 15 * 1024 * 1024 }
  );

  // Collect rendered raw PNG files
  const filesInWorkDir = fs
    .readdirSync(workDir)
    .filter((f) => f.startsWith('raw-page-') && f.endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (filesInWorkDir.length === 0) {
    throw new Error('No pages could be extracted from the PDF file.');
  }

  const numPdfPages = filesInWorkDir.length;
  // Budget vertical slices per PDF page so total output stays within Firestore's 60-page array limit
  const maxSlicesPerPdfPage = Math.max(1, Math.floor(maxTotalOutputPages / numPdfPages));

  const cleanBaseName = fileName.replace(/\.pdf$/i, '').trim() || 'Chapter';
  const processedPages: ServerProcessedPage[] = [];
  let totalSizeKb = 0;

  for (let i = 0; i < filesInWorkDir.length; i++) {
    if (processedPages.length >= maxTotalOutputPages) break;
    const rawFile = filesInWorkDir[i];
    const rawFullPath = path.join(workDir, rawFile);
    const pdfPageNum = i + 1;
    const remainingBudget = maxTotalOutputPages - processedPages.length;
    const allowedSlices = Math.min(maxSlicesPerPdfPage, remainingBudget);

    try {
      const { slices, totalSizeKb: pageKb } = await convertPageToHdWebpSlices({
        source: rawFullPath,
        safeJobId,
        baseLabel: `${cleanBaseName} - Page ${String(pdfPageNum).padStart(2, '0')}`,
        maxSlicesForThisPage: allowedSlices,
        startPageCounter: processedPages.length + 1,
      });

      totalSizeKb += pageKb;
      processedPages.push(...slices);
    } finally {
      try {
        fs.unlinkSync(rawFullPath);
      } catch {
        // ignore cleanup error
      }
    }
  }

  // Remove the source input.pdf after conversion
  try {
    fs.unlinkSync(pdfPath);
  } catch {
    // ignore cleanup error
  }

  return {
    jobId: safeJobId,
    fileName,
    pageCount: processedPages.length,
    totalSizeKb,
    pages: processedPages,
  };
}

export async function POST(req: NextRequest) {
  try {
    const uploadAction = req.headers.get('x-upload-action') || '';

    // 1. Chunked binary upload (1.5 MB slices from mobile file.slice() — zero phone RAM)
    if (uploadAction === 'append-chunk') {
      const rawJobId = req.headers.get('x-job-id') || `pdf_${Date.now()}`;
      const chunkIndex = Number(req.headers.get('x-chunk-index') || '0');
      const safeJobId = sanitizeId(rawJobId);

      const jobUploadDir = path.join(TMP_UPLOAD_ROOT, safeJobId);
      ensureDir(jobUploadDir);
      const targetPdfPath = path.join(jobUploadDir, 'input.pdf');

      const arrayBuffer = await req.arrayBuffer();
      const chunkBuffer = Buffer.from(arrayBuffer);

      if (chunkIndex === 0 && fs.existsSync(targetPdfPath)) {
        fs.unlinkSync(targetPdfPath);
      }
      fs.appendFileSync(targetPdfPath, chunkBuffer);

      return NextResponse.json({
        success: true,
        jobId: safeJobId,
        chunkIndex,
        bytesWritten: chunkBuffer.byteLength,
      });
    }

    // 2. Single image file upload -> server-side HD sharp WebP conversion (full width preserved)
    if (uploadAction === 'single-image') {
      const rawJobId = req.headers.get('x-job-id') || `img_${Date.now()}`;
      const pageIndex = Number(req.headers.get('x-page-index') || '1');
      const rawFileName = decodeURIComponent(
        req.headers.get('x-file-name') || `page-${pageIndex}.jpg`
      );
      const safeJobId = sanitizeId(rawJobId);

      const arrayBuffer = await req.arrayBuffer();
      const inputBuffer = Buffer.from(arrayBuffer);

      const { slices } = await convertPageToHdWebpSlices({
        source: inputBuffer,
        safeJobId,
        baseLabel: rawFileName,
        maxSlicesForThisPage: 4,
        startPageCounter: pageIndex,
      });

      return NextResponse.json({
        success: true,
        jobId: safeJobId,
        page: slices[0],
        pages: slices,
      });
    }

    const contentType = (req.headers.get('content-type') || '').toLowerCase();

    // 3. Direct Multipart FormData upload
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const maxPages = Number(formData.get('maxPages') || '60');

      if (!file) {
        return NextResponse.json({ error: 'No PDF file provided in FormData' }, { status: 400 });
      }

      const safeJobId = sanitizeId(`pdf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
      const jobUploadDir = path.join(TMP_UPLOAD_ROOT, safeJobId);
      ensureDir(jobUploadDir);
      const targetPdfPath = path.join(jobUploadDir, 'input.pdf');

      const fileBuffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(targetPdfPath, fileBuffer);

      const result = await processPdfFileOnServer({
        jobId: safeJobId,
        pdfPath: targetPdfPath,
        fileName: file.name || 'chapter.pdf',
        maxPages,
      });

      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    // 4. JSON actions: 'finalize_pdf', 'process_url', or 'upload_single_page' (Vercel Serverless fallback)
    const body = await req.json();
    const { action, jobId, fileName, pdfUrl, maxPages, imageDataUrl, pageNumber } = body;

    if (action === 'upload_single_page') {
      if (!imageDataUrl || typeof imageDataUrl !== 'string') {
        return NextResponse.json({ error: 'imageDataUrl is required' }, { status: 400 });
      }
      const safeJobId = sanitizeId(jobId || `vercel_${Date.now()}`);
      const pageNum = Math.max(1, Number(pageNumber) || 1);
      const base64Part = imageDataUrl.includes(',')
        ? imageDataUrl.split(',')[1]
        : imageDataUrl;
      const inputBuffer = Buffer.from(base64Part, 'base64');

      const outFileName = `page-${String(pageNum).padStart(3, '0')}.webp`;
      const webpBuffer = await sharp(inputBuffer)
        .resize({
          width: 1280,
          withoutEnlargement: true,
          fit: 'inside',
        })
        .webp({
          quality: 92,
          smartSubsample: true,
          effort: 4,
        })
        .toBuffer();

      const sizeKb = Math.max(1, Math.round(webpBuffer.length / 1024));
      const supabasePublicUrl = await uploadPageToSupabaseStorage(
        safeJobId,
        outFileName,
        webpBuffer
      );

      // Also save locally as fallback
      const outJobDir = path.join(PUBLIC_PAGES_ROOT, safeJobId);
      ensureDir(outJobDir);
      fs.writeFileSync(path.join(outJobDir, outFileName), webpBuffer);

      const finalUrl =
        supabasePublicUrl ||
        `/api/pdf-pages/${encodeURIComponent(safeJobId)}/${encodeURIComponent(outFileName)}`;

      return NextResponse.json({
        success: true,
        page: {
          pageNumber: pageNum,
          url: finalUrl,
          sizeKb,
          name: `${fileName || 'chapter.pdf'} - Page ${pageNum}`,
        },
      });
    }

    if (action === 'finalize_pdf') {
      if (!jobId) {
        return NextResponse.json({ error: 'jobId is required to finalize PDF' }, { status: 400 });
      }
      const safeJobId = sanitizeId(jobId);
      const targetPdfPath = path.join(TMP_UPLOAD_ROOT, safeJobId, 'input.pdf');

      if (!fs.existsSync(targetPdfPath)) {
        return NextResponse.json(
          { error: 'Uploaded PDF chunks not found on server. Please try uploading again.' },
          { status: 404 }
        );
      }

      const result = await processPdfFileOnServer({
        jobId: safeJobId,
        pdfPath: targetPdfPath,
        fileName: fileName || 'chapter.pdf',
        maxPages: Number(maxPages) || 60,
      });

      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    if (action === 'process_url') {
      if (!pdfUrl || typeof pdfUrl !== 'string' || !pdfUrl.trim()) {
        return NextResponse.json(
          { error: 'Please provide a valid PDF URL or Google Drive share link.' },
          { status: 400 }
        );
      }

      const safeJobId = sanitizeId(`url_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
      const jobUploadDir = path.join(TMP_UPLOAD_ROOT, safeJobId);
      ensureDir(jobUploadDir);
      const targetPdfPath = path.join(jobUploadDir, 'input.pdf');

      const downloadedName = await downloadPdfFromUrl(pdfUrl.trim(), targetPdfPath);
      const result = await processPdfFileOnServer({
        jobId: safeJobId,
        pdfPath: targetPdfPath,
        fileName: downloadedName,
        maxPages: Number(maxPages) || 60,
      });

      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    return NextResponse.json({ error: 'Unsupported PDF processor action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Server PDF Processor error:', error);
    const msg =
      error instanceof Error ? error.message : 'Server failed to process the PDF file.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
