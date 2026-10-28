'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import blueprint from '../firebase-blueprint.json';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Synchronized validation constants parsed directly from firebase-blueprint.json
export const VALIDATION_RULES = {
  ID_PATTERN: new RegExp(blueprint.entities.UserProfile.properties.uid.pattern || '^[a-zA-Z0-9_\\-]+$'),
  MAX_ID_LENGTH: blueprint.entities.UserProfile.properties.uid.maxLength || 128,
  MIN_USERNAME_LENGTH: blueprint.entities.UserProfile.properties.username.minLength || 2,
  MAX_USERNAME_LENGTH: blueprint.entities.UserProfile.properties.username.maxLength || 60,
  MAX_BOOKMARKS: blueprint.entities.UserProfile.properties.bookmarks.maxLength || 50,
  MAX_COMMENT_LENGTH: blueprint.entities.ChapterComment.properties.content.maxLength || 1000,
  MAX_REQUEST_TITLE_LENGTH: blueprint.entities.SeriesRequest.properties.title.maxLength || 160,
  MAX_REQUEST_AUTHOR_LENGTH: blueprint.entities.SeriesRequest.properties.author.maxLength || 120,
  MIN_REQUEST_REASON_LENGTH: blueprint.entities.SeriesRequest.properties.reason.minLength || 3,
  MAX_REQUEST_REASON_LENGTH: blueprint.entities.SeriesRequest.properties.reason.maxLength || 1000,
  MAX_SERIES_TITLE_LENGTH: blueprint.entities.LibrarySeries.properties.title.maxLength || 160,
  MAX_SERIES_SYNOPSIS_LENGTH: blueprint.entities.LibrarySeries.properties.synopsis.maxLength || 2000,
  MAX_SERIES_COVER_LENGTH: blueprint.entities.LibrarySeries.properties.coverImage.maxLength || 100000,
  MAX_SERIES_GENRES: blueprint.entities.LibrarySeries.properties.genres.maxLength || 12,
  MAX_CHAPTER_TITLE_LENGTH: blueprint.entities.LibraryChapter.properties.title.maxLength || 200,
  MAX_CHAPTER_PAGES: blueprint.entities.LibraryChapter.properties.pageUrls.maxLength || 60,
  MAX_COVER_URL_LENGTH: blueprint.entities.ReadingProgress.properties.coverImage.maxLength || 1024,
};

export function sanitizeFirestoreId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, VALIDATION_RULES.MAX_ID_LENGTH);
  return cleaned.length > 0 ? cleaned : 'doc_default';
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on client boot
let connectionTested = false;
export async function testFirestoreConnection() {
  if (typeof window === 'undefined' || connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if (typeof window !== 'undefined') {
  testFirestoreConnection();
}

/**
 * Ensures the signed-in user's public profile (/users/{uid}) and isolated PII
 * document (/users/{uid}/private/info) exist in Firestore.
 */
export async function ensureUserFirestoreProfile(
  uid: string,
  displayName: string | null,
  email: string | null,
  fallbackBookmarks: string[] = []
) {
  const safeUid = sanitizeFirestoreId(uid);
  const userPath = `users/${safeUid}`;
  const userRef = doc(db, 'users', safeUid);

  const rawUsername = (displayName || email?.split('@')[0] || 'Reader').trim();
  const safeUsername =
    rawUsername.length >= VALIDATION_RULES.MIN_USERNAME_LENGTH
      ? rawUsername.slice(0, VALIDATION_RULES.MAX_USERNAME_LENGTH)
      : `Reader_${safeUid.slice(0, 6)}`;

  const safeBookmarks = fallbackBookmarks
    .map((id) => sanitizeFirestoreId(id))
    .slice(0, VALIDATION_RULES.MAX_BOOKMARKS);

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      try {
        await setDoc(userRef, {
          uid: safeUid,
          username: safeUsername,
          role: 'reader',
          bookmarks: safeBookmarks,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (writeErr) {
        handleFirestoreError(writeErr, OperationType.CREATE, userPath);
      }
    }

    if (email && email.length >= 3) {
      const privatePath = `users/${safeUid}/private/info`;
      const privateRef = doc(db, 'users', safeUid, 'private', 'info');
      const privSnap = await getDoc(privateRef);
      const safeEmail = email.slice(0, 254);
      if (!privSnap.exists()) {
        try {
          await setDoc(privateRef, {
            uid: safeUid,
            email: safeEmail,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (privErr) {
          handleFirestoreError(privErr, OperationType.CREATE, privatePath);
        }
      } else if (privSnap.data()?.email !== safeEmail) {
        try {
          await updateDoc(privateRef, {
            email: safeEmail,
            updatedAt: serverTimestamp(),
          });
        } catch (privUpdateErr) {
          handleFirestoreError(privUpdateErr, OperationType.UPDATE, privatePath);
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('{"error":')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.GET, userPath);
  }
}
