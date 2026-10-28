'use client';

import { useState, useEffect } from 'react';
import { ThumbsUp, Plus } from 'lucide-react';
import { TopNavbar } from '@/components/TopNavbar';
import { BottomNav } from '@/components/BottomNav';
import { useIdentity } from '@/hooks/useIdentity';
import { auth, VALIDATION_RULES } from '@/lib/firebase';
import {
  subscribeSeriesRequests,
  createFirestoreRequest,
  upvoteFirestoreRequest,
} from '@/lib/supabase-sync';
import { SeriesRequest } from '@/lib/types';

export default function RequestsPage() {
  const { username, isAuthenticated, isAuthReady } = useIdentity();
  const [apiRequests, setApiRequests] = useState<SeriesRequest[]>([]);
  const [firestoreRequests, setFirestoreRequests] = useState<SeriesRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'webtoon' | 'manga'>('webtoon');
  const [author, setAuthor] = useState('');
  const [reason, setReason] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadRequests() {
      try {
        setIsLoading(true);
        const res = await fetch('/api/requests');
        if (res.ok) {
          const data = await res.json();
          setApiRequests(data);
        }
      } catch (err) {
        console.error('Failed to load requests:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadRequests();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !isAuthenticated) return;
    const unsubscribe = subscribeSeriesRequests((list) => {
      setFirestoreRequests(list);
    });
    return () => unsubscribe();
  }, [isAuthReady, isAuthenticated]);

  const requests = (() => {
    const map = new Map<string, SeriesRequest>();
    for (const r of firestoreRequests) {
      map.set(r.id, r);
    }
    for (const r of apiRequests) {
      if (!map.has(r.id)) {
        map.set(r.id, r);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.votes - a.votes);
  })();

  const handleVote = async (requestId: string, currentVotes: number) => {
    try {
      if (auth.currentUser && auth.currentUser.emailVerified && requestId.startsWith('req_')) {
        await upvoteFirestoreRequest(requestId, currentVotes);
        return;
      }

      const res = await fetch(`/api/requests/${requestId}/vote`, {
        method: 'POST',
      });
      if (res.ok) {
        const updated = await res.json();
        setApiRequests((prev) =>
          prev.map((r) =>
            r.id === requestId
              ? { ...r, votes: updated.votes, userVoted: updated.userVoted }
              : r
          )
        );
      }
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeTitle = title.trim().slice(0, VALIDATION_RULES.MAX_REQUEST_TITLE_LENGTH);
    const safeReason = reason.trim().slice(0, VALIDATION_RULES.MAX_REQUEST_REASON_LENGTH);
    if (!safeTitle || !safeReason || isSubmitting) return;

    try {
      setIsSubmitting(true);

      if (auth.currentUser && auth.currentUser.emailVerified) {
        await createFirestoreRequest({
          title: safeTitle,
          type,
          author: author.trim() || undefined,
          reason: safeReason,
          requestedBy: username || auth.currentUser.displayName || 'Reader',
        });
      }

      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: safeTitle,
          type,
          author: author.trim() || undefined,
          reason: safeReason,
          sourceUrl: sourceUrl.trim() || undefined,
          requestedBy: username || 'AnonymousReader',
        }),
      });

      if (res.ok) {
        const created = await res.json();
        if (!auth.currentUser) {
          setApiRequests((prev) => [created, ...prev]);
        }
        setTitle('');
        setAuthor('');
        setReason('');
        setSourceUrl('');
        setIsModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to submit request:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <TopNavbar username={username} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6 py-8 pb-20 md:pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-8">
          <div>
            <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold uppercase tracking-wider">
              <ThumbsUp className="h-4 w-4" />
              <span>Community Licensing Board</span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-white tracking-tight">
              Series Requests & Community Votes
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Vote on webtoons and manga you want serialized on PanelVerse. Top voted titles get prioritized for licensing.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:from-rose-500 hover:to-indigo-500 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Propose a Series</span>
          </button>
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-xs text-slate-500">
              Loading community proposals...
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400 text-xs">
              No series requests yet. Propose the first title!
            </div>
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-700 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="font-semibold uppercase tracking-wider text-rose-400">
                      {req.type}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Proposed by <strong className="text-slate-300">{req.requestedBy}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{req.createdAt}</span>
                  </div>

                  <h3 className="mt-1.5 text-base font-bold text-white">{req.title}</h3>

                  {req.author && (
                    <div className="text-xs text-slate-400 mt-0.5">
                      Original Creator: {req.author}
                    </div>
                  )}

                  <p className="mt-2 text-xs text-slate-300 leading-relaxed max-w-2xl">
                    {req.reason}
                  </p>

                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider rounded px-2 py-0.5 border ${
                        req.status === 'Acquired'
                          ? 'border-emerald-800/80 bg-emerald-950/40 text-emerald-300'
                          : req.status === 'In Review'
                          ? 'border-amber-800/80 bg-amber-950/40 text-amber-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                </div>

                {/* Vote Button */}
                <div className="flex sm:flex-col items-center justify-center shrink-0">
                  <button
                    onClick={() => handleVote(req.id, req.votes)}
                    disabled={req.status === 'Acquired'}
                    className={`flex items-center sm:flex-col gap-1.5 rounded-xl border px-4 py-2 sm:py-3 transition-colors cursor-pointer min-w-[70px] disabled:opacity-50 ${
                      req.userVoted
                        ? 'border-rose-500 bg-rose-600/20 text-rose-300'
                        : 'border-slate-800 bg-slate-950/80 text-slate-400 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    <ThumbsUp
                      className={`h-4 w-4 ${req.userVoted ? 'fill-rose-400 text-rose-400' : ''}`}
                    />
                    <span className="text-xs font-mono font-bold tabular-nums">{req.votes}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal: Propose New Series */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <h3 className="text-sm font-bold text-white">Propose New Series</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateRequest} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Series Title
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={VALIDATION_RULES.MAX_REQUEST_TITLE_LENGTH}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Omniscient Reader, Berserk..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Format
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as 'webtoon' | 'manga')}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
                    >
                      <option value="webtoon">Webtoon (Scroll)</option>
                      <option value="manga">Manga (Paged RTL)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Author / Studio
                    </label>
                    <input
                      type="text"
                      maxLength={VALIDATION_RULES.MAX_REQUEST_AUTHOR_LENGTH}
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="e.g. Sing Shong"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Why should we license this?
                  </label>
                  <textarea
                    rows={3}
                    required
                    minLength={VALIDATION_RULES.MIN_REQUEST_REASON_LENGTH}
                    maxLength={VALIDATION_RULES.MAX_REQUEST_REASON_LENGTH}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain the plot hook, community hype, or why readers will love it..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !title.trim() || !reason.trim()}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-40"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Proposal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
