import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';
import { Comment } from '@/lib/types';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const comments = dataStore.getComments(id);
    return NextResponse.json(comments);
  } catch (error) {
    console.error('Failed to get comments:', error);
    return NextResponse.json({ error: 'Failed to retrieve comments' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clientIp = getClientIp(req.headers);
    const limit = checkRateLimit(`comments_${clientIp}`, { maxRequests: 10, windowSeconds: 60 });
    if (!limit.success) {
      return NextResponse.json(
        { error: 'You are commenting too fast. Please wait a minute.' },
        { status: 429, headers: { 'Retry-After': String(limit.resetInSeconds) } }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { content, username, userId, seriesId, spoiler } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Comment content cannot be empty' }, { status: 400 });
    }

    const newComment: Comment = {
      id: `comm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      chapterId: id,
      seriesId: seriesId || '',
      userId: userId || 'anonymous',
      username: username || 'GuestReader',
      content: content.trim(),
      createdAt: 'Just now',
      upvotes: 0,
      userUpvoted: false,
      spoiler: Boolean(spoiler),
    };

    const saved = dataStore.addComment(newComment);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error('Failed to post comment:', error);
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 });
  }
}
