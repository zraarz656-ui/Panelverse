import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { action, reason, reportedBy } = body;

    if (action === 'report') {
      const report = dataStore.addReport({
        id: `rep-${Date.now()}`,
        targetType: 'comment',
        targetId: id,
        reason: reason || 'Community guideline violation',
        reportedBy: reportedBy || 'Reader',
        reportedAt: new Date().toISOString(),
        status: 'Pending',
      });
      return NextResponse.json({ success: true, message: 'Report submitted for review', report });
    }

    // Default: upvote
    const updated = dataStore.upvoteComment(id);
    if (!updated) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Comment action error:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    const success = dataStore.deleteComment(id);
    return NextResponse.json({ success });
  } catch (error) {
    console.error('Comment delete error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
