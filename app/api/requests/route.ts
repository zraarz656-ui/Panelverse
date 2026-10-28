import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';
import { SeriesRequest } from '@/lib/types';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function GET() {
  try {
    const requests = dataStore.getRequests();
    return NextResponse.json(requests);
  } catch (error) {
    console.error('Failed to get requests:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const limit = checkRateLimit(`requests_${clientIp}`, { maxRequests: 5, windowSeconds: 60 });
    if (!limit.success) {
      return NextResponse.json(
        { error: 'You have submitted too many requests. Please wait a minute.' },
        { status: 429, headers: { 'Retry-After': String(limit.resetInSeconds) } }
      );
    }

    const body = await req.json();
    const { title, type, author, reason, sourceUrl, requestedBy } = body;

    if (!title || !reason) {
      return NextResponse.json({ error: 'Title and reason are required' }, { status: 400 });
    }

    const newRequest: SeriesRequest = {
      id: `req-${Date.now()}`,
      title: title.trim(),
      type: type === 'manga' ? 'manga' : 'webtoon',
      author: author?.trim() || undefined,
      reason: reason.trim(),
      sourceUrl: sourceUrl?.trim() || undefined,
      requestedBy: requestedBy || 'AnonymousReader',
      votes: 1,
      userVoted: true,
      status: 'Pending',
      createdAt: 'Just now',
    };

    const saved = dataStore.addRequest(newRequest);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error('Failed to submit request:', error);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }
}
