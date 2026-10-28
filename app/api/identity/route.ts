import { NextRequest, NextResponse } from 'next/server';
import { generateUsername, generateRecoveryKey, generateToken, hashString } from '@/lib/identity';
import { dataStore } from '@/lib/data-store';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const limit = checkRateLimit(`identity_${clientIp}`, { maxRequests: 15, windowSeconds: 60 });
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(limit.resetInSeconds) } }
      );
    }

    const existingToken = req.cookies.get('reader_token')?.value;

    if (existingToken) {
      const session = dataStore.getSession(existingToken);
      if (session) {
        return NextResponse.json({
          id: session.id,
          username: session.username,
          isNew: false,
          bookmarks: session.bookmarks,
        });
      }
    }

    // Create fresh reader identity
    const username = generateUsername();
    const recoveryKey = generateRecoveryKey();
    const token = generateToken();
    const recoveryKeyHash = hashString(recoveryKey);
    const userId = `usr_${token.slice(0, 10)}`;

    const newSession = {
      id: userId,
      username,
      createdAt: new Date().toISOString(),
      bookmarks: [],
    };

    dataStore.setSession(token, newSession);
    dataStore.mapRecoveryKeyHash(recoveryKeyHash, token);

    const response = NextResponse.json(
      {
        id: userId,
        username,
        recoveryKey, // Only shown once at creation!
        isNew: true,
        bookmarks: [],
      },
      { status: 201 }
    );

    response.cookies.set('reader_token', token, {
      httpOnly: false, // Accessible to client for reliable sync
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('Identity error:', error);
    return NextResponse.json({ error: 'Failed to establish reader identity' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, recoveryKey } = body;
    const token = req.cookies.get('reader_token')?.value;

    if (action === 'regenerate_key') {
      if (!token) {
        return NextResponse.json({ error: 'No active reader session' }, { status: 401 });
      }
      const session = dataStore.getSession(token);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      const newRecoveryKey = generateRecoveryKey();
      const newHash = hashString(newRecoveryKey);
      dataStore.mapRecoveryKeyHash(newHash, token);

      return NextResponse.json({
        success: true,
        recoveryKey: newRecoveryKey,
        username: session.username,
      });
    }

    if (action === 'recover_account') {
      if (!recoveryKey || typeof recoveryKey !== 'string') {
        return NextResponse.json({ error: 'Please provide a valid recovery key' }, { status: 400 });
      }

      const inputHash = hashString(recoveryKey.trim());
      const session = dataStore.getSessionByRecoveryKeyHash(inputHash);

      if (!session) {
        return NextResponse.json({ error: 'Invalid recovery key. No reader profile found.' }, { status: 404 });
      }

      const newToken = generateToken();
      dataStore.setSession(newToken, session);
      dataStore.mapRecoveryKeyHash(inputHash, newToken);

      const response = NextResponse.json({
        success: true,
        id: session.id,
        username: session.username,
        bookmarks: session.bookmarks,
      });

      response.cookies.set('reader_token', newToken, {
        httpOnly: false,
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      });

      return response;
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Identity update error:', error);
    return NextResponse.json({ error: 'Identity operation failed' }, { status: 500 });
  }
}
