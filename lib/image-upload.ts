'use client';

export interface ProcessedPanelPage {
  name: string;
  dataUrl: string;
  sizeKb: number;
}

export function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}

/**
 * Pause briefly to let mobile browsers paint progress updates cleanly.
 */
function yieldToMainThread(ms = 15): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Streams a local PDF file in lightweight 1.5 MB slices (Blob.slice) to the
 * Server-Side PDF Processor (/api/admin/pdf-processor).
 *
 * This completely eliminates client-side PDF.js Web Workers, HTML5 <canvas> allocations,
 * and multi-megabyte Base64 arrays in mobile browser memory while preserving full HD width.
 */
export async function uploadPdfToServerProcessor(
  file: File,
  options?: {
    maxPages?: number;
    onProgress?: (status: string) => void;
  }
): Promise<ProcessedPanelPage[]> {
  const maxPages = options?.maxPages ?? 60;
  const CHUNK_SIZE = 1.5 * 1024 * 1024; // 1.5 MB per chunk — zero mobile RAM spike
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  const jobId = `pdf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(file.size, start + CHUNK_SIZE);
    const chunkBlob = file.slice(start, end);
    const pct = Math.round(((chunkIndex + 1) / totalChunks) * 100);

    options?.onProgress?.(
      totalChunks > 1
        ? `Uploading "${file.name}" to Server HD PDF Processor (${pct}%)...`
        : `Sending "${file.name}" to Server HD PDF Processor...`
    );

    const chunkRes = await fetch('/api/admin/pdf-processor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-upload-action': 'append-chunk',
        'x-job-id': jobId,
        'x-chunk-index': String(chunkIndex),
        'x-total-chunks': String(totalChunks),
      },
      body: chunkBlob,
    });

    if (!chunkRes.ok) {
      let errMsg = `Failed to upload PDF chunk ${chunkIndex + 1}/${totalChunks}`;
      try {
        const errData = await chunkRes.json();
        if (errData?.error) errMsg = errData.error;
      } catch {
        // ignore JSON parse error
      }
      throw new Error(errMsg);
    }

    await yieldToMainThread(10);
  }

  options?.onProgress?.(
    `Server rendering HD full-width WebP panels from "${file.name}"...`
  );

  const finalizeRes = await fetch('/api/admin/pdf-processor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'finalize_pdf',
      jobId,
      fileName: file.name,
      maxPages,
    }),
  });

  const data = await finalizeRes.json();
  if (!finalizeRes.ok || !data?.success) {
    const errText = String(data?.error || '');
    // Automatic fallback on Vercel Free Tier Serverless where native /usr/bin/gs is absent:
    // Renders 1 page at a time, sends to server Sharp + Supabase Storage, and frees phone RAM immediately.
    if (errText.includes('/usr/bin/gs') || errText.includes('ENOENT')) {
      return streamPdfPagesToSupabaseViaSharp(file, jobId, maxPages, options?.onProgress);
    }
    throw new Error(errText || 'Server failed to extract PDF pages.');
  }

  const pages: Array<{ pageNumber: number; name: string; url: string; sizeKb: number }> =
    Array.isArray(data.pages) ? data.pages : [];

  return pages.map((p) => ({
    name: p.name,
    dataUrl: p.url, // Lightweight server/Supabase URL — keeps phone RAM near zero
    sizeKb: p.sizeKb,
  }));
}

/**
 * Serverless fallback for Vercel Free Tier (where /usr/bin/gs is not installed):
 * Extracts 1 page at a time on a single reused canvas, immediately uploads to
 * server-side Sharp + Supabase Storage ('content' bucket), and frees canvas memory
 * after every page so phone RAM stays near zero.
 */
async function streamPdfPagesToSupabaseViaSharp(
  file: File,
  jobId: string,
  maxPages: number,
  onProgress?: (status: string) => void
): Promise<ProcessedPanelPage[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    disableAutoFetch: true,
    disableStream: true,
  });
  const pdfDoc = await loadingTask.promise;
  const totalPages = Math.min(pdfDoc.numPages, maxPages);
  const results: ProcessedPanelPage[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.(
      `Streaming HD Page ${pageNum}/${totalPages} of "${file.name}" to Supabase Storage...`
    );
    const page = await pdfDoc.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const targetScale = Math.min(2.0, Math.max(1.2, 1280 / Math.max(1, baseViewport.width)));
    const viewport = page.getViewport({ scale: targetScale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d', { alpha: false });

    if (ctx) {
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    }

    const pageDataUrl = canvas.toDataURL('image/webp', 0.92);
    // Immediately release mobile canvas & page memory before network upload
    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();

    const uploadRes = await fetch('/api/admin/pdf-processor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upload_single_page',
        jobId,
        fileName: file.name,
        pageNumber: pageNum,
        imageDataUrl: pageDataUrl,
      }),
    });

    const uploadJson = await uploadRes.json();
    if (uploadRes.ok && uploadJson?.page?.url) {
      results.push({
        name: uploadJson.page.name,
        dataUrl: uploadJson.page.url,
        sizeKb: Number(uploadJson.page.sizeKb || 80),
      });
    }

    await yieldToMainThread(25);
  }

  await pdfDoc.destroy();
  return results;
}

/**
 * Sends a remote PDF URL or Google Drive PDF share link to the Server-Side PDF Processor
 * so the server downloads, extracts, and optimizes all pages into HD WebP without using phone memory.
 */
export async function processPdfUrlViaServer(
  pdfUrl: string,
  options?: {
    maxPages?: number;
    onProgress?: (status: string) => void;
  }
): Promise<{
  fileName: string;
  totalSizeKb: number;
  pages: ProcessedPanelPage[];
}> {
  const maxPages = options?.maxPages ?? 60;
  options?.onProgress?.('Server is downloading & rendering HD WebP pages from link...');

  const res = await fetch('/api/admin/pdf-processor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'process_url',
      pdfUrl: pdfUrl.trim(),
      maxPages,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(
      data?.error || 'Could not download or extract PDF from the provided link.'
    );
  }

  const pages: Array<{ pageNumber: number; name: string; url: string; sizeKb: number }> =
    Array.isArray(data.pages) ? data.pages : [];

  return {
    fileName: data.fileName || 'remote-chapter.pdf',
    totalSizeKb: Number(data.totalSizeKb || 0),
    pages: pages.map((p) => ({
      name: p.name,
      dataUrl: p.url,
      sizeKb: p.sizeKb,
    })),
  };
}

/**
 * Uploads a single image file to the server-side sharp HD WebP processor and returns compact URL(s).
 */
export async function uploadImageFileToServerWebp(
  file: File,
  jobId: string,
  pageIndex: number
): Promise<ProcessedPanelPage[]> {
  const res = await fetch('/api/admin/pdf-processor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'x-upload-action': 'single-image',
      'x-job-id': jobId,
      'x-page-index': String(pageIndex),
      'x-file-name': encodeURIComponent(file.name),
    },
    body: file,
  });

  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `Failed to process image "${file.name}" on server`);
  }

  if (Array.isArray(data.pages) && data.pages.length > 0) {
    return data.pages.map(
      (p: { name: string; url: string; sizeKb: number }) => ({
        name: p.name,
        dataUrl: p.url,
        sizeKb: p.sizeKb,
      })
    );
  }

  if (data.page) {
    return [
      {
        name: data.page.name,
        dataUrl: data.page.url,
        sizeKb: data.page.sizeKb,
      },
    ];
  }

  throw new Error(`No processed output returned for "${file.name}"`);
}

/**
 * Compresses a single cover image File into a lightweight WebP server URL or Data URL.
 */
export async function compressImageFileToDataUrl(
  file: File,
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    maxCharLength?: number;
  }
): Promise<string> {
  try {
    const coverJobId = `cover_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const uploaded = await uploadImageFileToServerWebp(file, coverJobId, 1);
    if (uploaded?.[0]?.dataUrl) {
      return uploaded[0].dataUrl;
    }
  } catch {
    // Fallback to lightweight canvas encoding if server upload fails
  }

  const maxWidth = options?.maxWidth ?? 800;
  const maxHeight = options?.maxHeight ?? 1200;

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.decoding = 'async';

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      img.onload = null;
      img.onerror = null;
      img.src = '';
    };

    img.onerror = () => {
      cleanup();
      reject(new Error(`Unsupported image file: ${file.name}`));
    };

    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width || 600;
        let h = img.naturalHeight || img.height || 850;
        if (w > maxWidth) {
          h = Math.round(h * (maxWidth / w));
          w = maxWidth;
        }
        if (h > maxHeight) {
          w = Math.round(w * (maxHeight / h));
          h = maxHeight;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
        }
        let encoded = canvas.toDataURL('image/webp', 0.85);
        if (!encoded.startsWith('data:image/webp')) {
          encoded = canvas.toDataURL('image/jpeg', 0.85);
        }
        canvas.width = 1;
        canvas.height = 1;
        cleanup();
        resolve(encoded);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    img.src = objectUrl;
  });
}

/**
 * Processes a mix of PDF files and/or image files using the Server-Side HD PDF & WebP Processor
 * so mobile browsers never run out of RAM during extraction while keeping full HD width.
 */
export async function compressMultipleImageFiles(
  files: FileList | File[],
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    maxCharLength?: number;
    maxPages?: number;
    onProgress?: (status: string) => void;
    onPageExtracted?: (page: ProcessedPanelPage, current: number, total: number) => void;
  }
): Promise<ProcessedPanelPage[]> {
  const fileArray = Array.from(files);
  fileArray.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );

  const maxPages = options?.maxPages ?? 60;
  const results: ProcessedPanelPage[] = [];
  const batchJobId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  for (let i = 0; i < fileArray.length; i++) {
    if (results.length >= maxPages) break;
    const file = fileArray[i];
    const remainingSlots = maxPages - results.length;

    if (isPdfFile(file)) {
      const pdfPages = await uploadPdfToServerProcessor(file, {
        maxPages: remainingSlots,
        onProgress: options?.onProgress,
      });
      results.push(...pdfPages);
    } else {
      options?.onProgress?.(
        `Server optimizing HD image ${i + 1} of ${fileArray.length} ("${file.name}")...`
      );
      const uploadedSlices = await uploadImageFileToServerWebp(
        file,
        batchJobId,
        results.length + 1
      );
      results.push(...uploadedSlices);
      if (uploadedSlices[0]) {
        options?.onPageExtracted?.(uploadedSlices[0], results.length, fileArray.length);
      }
      await yieldToMainThread(10);
    }
  }

  return results.slice(0, maxPages);
}
