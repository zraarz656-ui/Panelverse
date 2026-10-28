'use client';

import { useState } from 'react';
import { KeyRound, Check, Copy, X } from 'lucide-react';

interface IdentityBootstrapProps {
  username: string;
  recoveryKey: string | null;
  isNew: boolean;
}

export function IdentityBootstrap({ username, recoveryKey, isNew }: IdentityBootstrapProps) {
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isNew || !recoveryKey || dismissed) {
    return null;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(recoveryKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative mb-6 rounded-xl border border-rose-900/60 bg-gradient-to-r from-rose-950/40 via-slate-900/60 to-indigo-950/40 p-4 text-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-600/20 text-rose-400 border border-rose-500/30">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                Anonymous Identity Activated
              </span>
              <span className="text-xs text-slate-400">· Welcome, <strong className="text-white">{username}</strong></span>
            </div>
            <p className="mt-1 text-xs text-slate-300">
              Only hashed keys are stored on our servers. Save your one-time recovery key to restore your reading progress and bookmarks on any device.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <code className="rounded bg-black/60 px-2.5 py-1 text-xs font-mono font-medium text-rose-300 border border-rose-900/40 select-all">
                {recoveryKey}
              </code>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Key'}</span>
              </button>
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="rounded p-1 text-slate-400 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
