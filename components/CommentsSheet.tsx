'use client';

import { useState, useEffect } from 'react';
import { X, MessageSquare, ThumbsUp, Send, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Comment } from '@/lib/types';
import { auth, VALIDATION_RULES } from '@/lib/firebase';
import {
  subscribeChapterComments,
  createFirestoreComment,
  upvoteFirestoreComment,
} from '@/lib/supabase-sync';

interface CommentsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  chapterId: string;
  seriesId: string;
  currentUserId: string;
  currentUsername: string;
}

export function CommentsSheet({
  isOpen,
  onClose,
  chapterId,
  seriesId,
  currentUserId,
  currentUsername,
}: CommentsSheetProps) {
  const [apiComments, setApiComments] = useState<Comment[]>([]);
  const [firestoreComments, setFirestoreComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    fetch(`/api/chapters/${chapterId}/comments`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load comments');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setApiComments(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load comments:', err);
        if (isMounted) setIsLoading(false);
      });

    let unsubscribe: (() => void) | null = null;
    if (auth.currentUser) {
      unsubscribe = subscribeChapterComments(chapterId, (fsList) => {
        if (isMounted) {
          setFirestoreComments(fsList);
        }
      });
    }

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen, chapterId]);

  const mergedComments = (() => {
    const map = new Map<string, Comment>();
    for (const c of firestoreComments) {
      map.set(c.id, c);
    }
    for (const c of apiComments) {
      if (!map.has(c.id)) {
        map.set(c.id, c);
      }
    }
    return Array.from(map.values());
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCommentText.trim().slice(0, VALIDATION_RULES.MAX_COMMENT_LENGTH);
    if (!trimmed || isSubmitting) return;

    try {
      setIsSubmitting(true);

      if (auth.currentUser && auth.currentUser.emailVerified) {
        await createFirestoreComment({
          chapterId,
          seriesId,
          username: currentUsername || auth.currentUser.displayName || 'Reader',
          content: trimmed,
          spoiler: isSpoiler,
        });
      }

      const res = await fetch(`/api/chapters/${chapterId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          userId: currentUserId,
          username: currentUsername || 'GuestReader',
          seriesId,
          spoiler: isSpoiler,
        }),
      });

      if (res.ok) {
        const added = await res.json();
        if (!auth.currentUser) {
          setApiComments((prev) => [added, ...prev]);
        }
        setNewCommentText('');
        setIsSpoiler(false);
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpvote = async (commentId: string, currentUpvotes: number) => {
    try {
      if (auth.currentUser && auth.currentUser.emailVerified && commentId.startsWith('cmt_')) {
        await upvoteFirestoreComment(commentId, currentUpvotes);
        return;
      }

      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upvote' }),
      });
      if (res.ok) {
        const updated = await res.json();
        setApiComments((prev) =>
          prev.map((c) =>
            c.id === commentId ? { ...c, upvotes: updated.upvotes, userUpvoted: true } : c
          )
        );
      }
    } catch (err) {
      console.error('Upvote failed:', err);
    }
  };

  const toggleSpoilerReveal = (commentId: string) => {
    setRevealedSpoilers((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity">
      <div
        className="flex h-full w-full max-w-md flex-col bg-slate-900 border-l border-slate-800 text-slate-100 shadow-2xl transition-transform"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3.5">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-rose-400" />
            <h2 className="text-sm font-semibold text-white">Episode Comments</h2>
            <span className="text-xs text-slate-400">({mergedComments.length})</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Close comments"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Comment List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-xs text-slate-500">
              Loading comments...
            </div>
          ) : mergedComments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-xs text-slate-500">
              <MessageSquare className="h-8 w-8 text-slate-700 mb-2" />
              <p>No comments on this chapter yet.</p>
              <p className="mt-1 text-slate-600">Be the first reader to share your thoughts!</p>
            </div>
          ) : (
            mergedComments.map((comment) => {
              const isRevealed = revealedSpoilers[comment.id];
              return (
                <div
                  key={comment.id}
                  className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 text-xs"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-1.5">
                    <span className="font-semibold text-slate-200">{comment.username}</span>
                    <span className="text-[11px] text-slate-500">{comment.createdAt}</span>
                  </div>

                  {comment.spoiler && !isRevealed ? (
                    <div className="my-2 flex items-center justify-between rounded bg-amber-950/30 border border-amber-900/40 p-2 text-amber-300">
                      <span className="flex items-center gap-1.5 text-[11px]">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        Spoiler warning
                      </span>
                      <button
                        onClick={() => toggleSpoilerReveal(comment.id)}
                        className="flex items-center gap-1 text-[11px] font-medium text-amber-200 underline hover:text-white"
                      >
                        <Eye className="h-3 w-3" /> Reveal
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <p className="text-slate-200 leading-relaxed break-words">{comment.content}</p>
                      {comment.spoiler && (
                        <button
                          onClick={() => toggleSpoilerReveal(comment.id)}
                          className="mt-1 flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300"
                        >
                          <EyeOff className="h-3 w-3" /> Hide spoiler
                        </button>
                      )}
                    </div>
                  )}

                  <div className="mt-2.5 flex items-center gap-3 pt-2 border-t border-slate-800/40 text-[11px] text-slate-500">
                    <button
                      onClick={() => handleUpvote(comment.id, comment.upvotes)}
                      className={`flex items-center gap-1 transition-colors ${
                        comment.userUpvoted ? 'text-rose-400 font-semibold' : 'hover:text-slate-300'
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      <span className="tabular-nums">{comment.upvotes}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="border-t border-slate-800 p-3.5 bg-slate-950/70">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
            <span>
              Commenting as <strong className="text-slate-200">{currentUsername || 'Guest'}</strong>
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isSpoiler}
                onChange={(e) => setIsSpoiler(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-0"
              />
              <span>Mark Spoiler</span>
            </label>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={VALIDATION_RULES.MAX_COMMENT_LENGTH}
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newCommentText.trim() || isSubmitting}
              className="flex items-center justify-center rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-40 transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
