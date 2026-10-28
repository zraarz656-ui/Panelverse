'use client';

import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  ensureUserFirestoreProfile,
  handleFirestoreError,
  OperationType,
  sanitizeFirestoreId,
  VALIDATION_RULES,
} from '@/lib/firebase';
import { safeFetchJson } from '@/lib/utils';

export interface IdentityState {
  id: string;
  username: string;
  recoveryKey: string | null;
  isNew: boolean;
  bookmarks: string[];
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  email: string | null;
  isAdmin: boolean;
}

export function useIdentity() {
  const [state, setState] = useState<IdentityState>({
    id: '',
    username: '',
    recoveryKey: null,
    isNew: false,
    bookmarks: [],
    isLoading: true,
    error: null,
    isAuthenticated: false,
    isAuthReady: false,
    email: null,
    isAdmin: false,
  });

  // 1. Bootstrap anonymous cookie session as fallback
  useEffect(() => {
    let isMounted = true;
    safeFetchJson<{
      id?: string;
      username?: string;
      recoveryKey?: string | null;
      isNew?: boolean;
      bookmarks?: string[];
    }>('/api/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          setState((prev) => {
            if (prev.isAuthenticated) return prev;
            return {
              ...prev,
              id: data.id || 'usr_local_guest',
              username: data.username || 'GuestReader_101',
              recoveryKey: data.recoveryKey || null,
              isNew: Boolean(data.isNew),
              bookmarks: data.bookmarks || [],
              isLoading: false,
              error: null,
            };
          });
        } else {
          setState((prev) => {
            if (prev.isAuthenticated) return prev;
            return {
              ...prev,
              id: 'usr_local_guest',
              username: 'GuestReader_101',
              isLoading: false,
              error: null,
            };
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Track Firebase Auth state & subscribe to Firestore /users/{uid} when authenticated
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        const safeUid = sanitizeFirestoreId(firebaseUser.uid);
        try {
          await ensureUserFirestoreProfile(
            safeUid,
            firebaseUser.displayName,
            firebaseUser.email,
            []
          );
        } catch (err) {
          console.error('Failed to ensure Firestore user profile:', err);
        }

        const isBootstrappedAdmin =
          firebaseUser.email === 'yuniquearun@gmail.com' && firebaseUser.emailVerified;

        const userPath = `users/${safeUid}`;
        unsubscribeProfile = onSnapshot(
          doc(db, 'users', safeUid),
          (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              setState((prev) => ({
                ...prev,
                id: safeUid,
                username: data.username || firebaseUser.displayName || 'Reader',
                bookmarks: Array.isArray(data.bookmarks) ? data.bookmarks : prev.bookmarks,
                isAuthenticated: true,
                isAuthReady: true,
                email: firebaseUser.email,
                isAdmin: isBootstrappedAdmin || data.role === 'admin',
                isLoading: false,
              }));
            } else {
              setState((prev) => ({
                ...prev,
                id: safeUid,
                username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Reader',
                isAuthenticated: true,
                isAuthReady: true,
                email: firebaseUser.email,
                isAdmin: isBootstrappedAdmin,
                isLoading: false,
              }));
            }
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, userPath);
          }
        );
      } else {
        setState((prev) => ({
          ...prev,
          isAuthenticated: false,
          isAuthReady: true,
          email: null,
          isAdmin: false,
        }));
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user) {
        await ensureUserFirestoreProfile(
          cred.user.uid,
          cred.user.displayName,
          cred.user.email,
          state.bookmarks
        );
      }
    } catch (err) {
      console.error('Google Sign-In error:', err);
      throw err;
    }
  }, [state.bookmarks]);

  const signOutUser = useCallback(async () => {
    try {
      await signOut(auth);
      const res = await fetch('/api/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          id: data.id || 'usr_local_guest',
          username: data.username || 'GuestReader_101',
          bookmarks: data.bookmarks || [],
          isAuthenticated: false,
          email: null,
        }));
      }
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  }, []);

  const refreshIdentity = useCallback(async () => {
    try {
      const res = await fetch('/api/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => {
          if (prev.isAuthenticated) return prev;
          return {
            ...prev,
            id: data.id,
            username: data.username,
            recoveryKey: data.recoveryKey || null,
            isNew: Boolean(data.isNew),
            bookmarks: data.bookmarks || [],
            isLoading: false,
            error: null,
          };
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const generateNewRecoveryKey = async () => {
    try {
      const res = await fetch('/api/identity', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_key' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to regenerate key');
      setState((prev) => ({
        ...prev,
        recoveryKey: data.recoveryKey,
      }));
      return data.recoveryKey;
    } catch (err: unknown) {
      const e = err as Error;
      throw new Error(e.message || 'Key regeneration error');
    }
  };

  const recoverAccount = async (key: string) => {
    try {
      const res = await fetch('/api/identity', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recover_account', recoveryKey: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid recovery key');
      setState((prev) => ({
        ...prev,
        id: data.id,
        username: data.username,
        bookmarks: data.bookmarks || [],
        recoveryKey: null,
      }));
      return data;
    } catch (err: unknown) {
      const e = err as Error;
      throw new Error(e.message || 'Account recovery failed');
    }
  };

  const toggleBookmark = async (seriesId: string) => {
    const safeSeriesId = sanitizeFirestoreId(seriesId);

    // Sync with Firestore if signed in with Google
    if (auth.currentUser && auth.currentUser.emailVerified) {
      const safeUid = sanitizeFirestoreId(auth.currentUser.uid);
      const userPath = `users/${safeUid}`;
      const exists = state.bookmarks.includes(safeSeriesId);
      const nextBookmarks = exists
        ? state.bookmarks.filter((id) => id !== safeSeriesId)
        : [...state.bookmarks, safeSeriesId].slice(0, VALIDATION_RULES.MAX_BOOKMARKS);

      setState((prev) => ({ ...prev, bookmarks: nextBookmarks }));
      try {
        await updateDoc(doc(db, 'users', safeUid), {
          bookmarks: nextBookmarks,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, userPath);
      }
    }

    try {
      const res = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: state.id, seriesId }),
      });
      const data = await res.json();
      if (data.bookmarks && !auth.currentUser) {
        setState((prev) => ({ ...prev, bookmarks: data.bookmarks }));
      }
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  };

  return {
    ...state,
    signInWithGoogle,
    signOutUser,
    generateNewRecoveryKey,
    recoverAccount,
    toggleBookmark,
    refreshIdentity,
  };
}
