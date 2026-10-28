'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  ArrowRight,
  Globe,
  Layers,
} from 'lucide-react';
import { migrateFirestoreToSupabase, SupabaseMigrationSummary } from '@/lib/supabase-sync';
import { safeFetchJson } from '@/lib/utils';

interface SupabaseStatusResponse {
  ok: boolean;
  supabaseUrl: string;
  projectRef: string;
  sqlEditorUrl: string;
  bucketReady: boolean;
  tablesReady: boolean;
  tableStatus: Record<string, { ready: boolean; count: number }>;
  sqlSchema: string;
  vercelEnvBlock: string;
}

export function LaunchDeployAssistant() {
  const [status, setStatus] = useState<SupabaseStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationReport, setMigrationReport] = useState<SupabaseMigrationSummary | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  const checkSupabaseStatus = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setIsLoadingStatus(true);
    }
    try {
      const data = await safeFetchJson<SupabaseStatusResponse>('/api/admin/migrate-supabase', {
        cache: 'no-store',
      });
      if (data && data.ok) {
        setStatus(data);
      }
    } catch {
      // Ignore transient warmup
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    safeFetchJson<SupabaseStatusResponse>('/api/admin/migrate-supabase', {
      cache: 'no-store',
    })
      .then((data) => {
        if (active && data && data.ok) {
          setStatus(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingStatus(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleCopySql = async () => {
    if (!status?.sqlSchema) return;
    try {
      await navigator.clipboard.writeText(status.sqlSchema);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch {
      // Ignore
    }
  };

  const handleCopyVercelEnv = async () => {
    if (!status?.vercelEnvBlock) return;
    try {
      await navigator.clipboard.writeText(status.vercelEnvBlock);
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 2500);
    } catch {
      // Ignore
    }
  };

  const handleRunMigration = async () => {
    if (isMigrating) return;
    setIsMigrating(true);
    try {
      const report = await migrateFirestoreToSupabase();
      setMigrationReport(report);
      await checkSupabaseStatus();
    } catch (err) {
      setMigrationReport({
        ok: false,
        tablesReady: false,
        migrated: { series: 0, chapters: 0, progress: 0, comments: 0, requests: 0 },
        message: err instanceof Error ? err.message : 'Migration failed',
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const [ghToken, setGhToken] = useState('');
  const [ghRepo, setGhRepo] = useState('zraarz656-ui/panelverse-app');
  const [isPushingGh, setIsPushingGh] = useState(false);
  const [ghPushResult, setGhPushResult] = useState<{
    ok: boolean;
    message?: string;
    error?: string;
    url?: string;
  } | null>(null);

  const handleDirectGithubPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ghToken.trim() || isPushingGh) return;
    setIsPushingGh(true);
    setGhPushResult(null);
    try {
      const res = await fetch('/api/admin/github-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: ghToken.trim(), repo: ghRepo.trim() }),
      });
      const data = await res.json();
      setGhPushResult(data);
    } catch (err) {
      setGhPushResult({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to push to GitHub',
      });
    } finally {
      setIsPushingGh(false);
    }
  };

  const tableEntries = status?.tableStatus
    ? Object.entries(status.tableStatus)
    : [
        ['series', { ready: false, count: 0 }],
        ['chapters', { ready: false, count: 0 }],
        ['reading_progress', { ready: false, count: 0 }],
        ['comments', { ready: false, count: 0 }],
        ['requests', { ready: false, count: 0 }],
      ];

  return (
    <div className="space-y-6">
      {/* Direct 1-Click GitHub Push via Token */}
      <section className="rounded-xl border border-rose-500/40 bg-slate-900/95 p-6">
        <div className="border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 text-xs text-rose-400 font-medium">
            <span>Direct GitHub Export</span>
            <span aria-hidden="true">·</span>
            <span>Bypasses AI Studio Sync Error</span>
          </div>
          <h2 className="mt-1 text-lg font-semibold text-white">
            Push Full Codebase Directly to GitHub
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Paste your GitHub Personal Access Token below to push all files directly to your GitHub repository.
          </p>
        </div>

        <form onSubmit={handleDirectGithubPush} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Target Repository
              </label>
              <input
                type="text"
                value={ghRepo}
                onChange={(e) => setGhRepo(e.target.value)}
                placeholder="zraarz656-ui/panelverse-app"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                GitHub Personal Access Token (repo scope)
              </label>
              <input
                type="password"
                value={ghToken}
                onChange={(e) => setGhToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={isPushingGh || !ghToken.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-rose-500 transition-colors cursor-pointer disabled:opacity-50"
            >
              <ArrowRight className="h-4 w-4" />
              <span>{isPushingGh ? 'Pushing to GitHub...' : 'Push Code to GitHub Now'}</span>
            </button>
          </div>
        </form>

        {ghPushResult && (
          <div
            className={`mt-4 rounded-lg border p-4 text-xs ${
              ghPushResult.ok
                ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'
                : 'border-rose-500/30 bg-rose-950/30 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {ghPushResult.ok ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              )}
              <span>{ghPushResult.ok ? ghPushResult.message : ghPushResult.error}</span>
            </div>
            {ghPushResult.ok && ghPushResult.url && (
              <div className="mt-2">
                <a
                  href={ghPushResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-400 underline font-medium"
                >
                  <span>Open {ghPushResult.url}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </div>
        )}
      </section>
      {/* Step 1: 1-Click Supabase SQL Schema & Live Table Readiness */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/90 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>01. Database & Storage</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-300">
                {status?.projectRef || 'ahizfmtvgrfujoipmtdq'}
              </span>
            </div>
            <h2 className="mt-1 text-lg font-semibold text-white">
              Supabase SQL Schema & Storage Verification
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void checkSupabaseStatus()}
              disabled={isLoadingStatus}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingStatus ? 'animate-spin' : ''}`} />
              <span>Verify Tables</span>
            </button>

            <button
              type="button"
              onClick={() => void handleCopySql()}
              disabled={!status?.sqlSchema}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              {copiedSql ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Copied SQL Schema</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy SQL Schema</span>
                </>
              )}
            </button>

            <a
              href={
                status?.sqlEditorUrl ||
                'https://supabase.com/dashboard/project/ahizfmtvgrfujoipmtdq/sql/new'
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-slate-600 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <span>Open Supabase SQL Editor</span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </a>
          </div>
        </div>

        {/* Storage & Table Matrix */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5">
            <div className="text-xs text-slate-400">Storage Bucket</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-white">content</span>
              {status?.bucketReady ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" /> Pending
                </span>
              )}
            </div>
          </div>

          {tableEntries.map(([tableName, info]) => {
            const typedInfo = info as { ready: boolean; count: number };
            return (
              <div key={String(tableName)} className="rounded-lg border border-slate-800 bg-slate-950 p-3.5">
                <div className="text-xs text-slate-400 truncate">public.{String(tableName)}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono tabular-nums text-sm font-semibold text-white">
                    {typedInfo.ready ? `${typedInfo.count} rows` : 'Not created'}
                  </span>
                  {typedInfo.ready ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!status?.tablesReady && !isLoadingStatus && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <span>
                Click <strong>Copy SQL Schema</strong> above, paste it into the{' '}
                <strong>Supabase SQL Editor</strong>, and click <strong>Run</strong> to create the 5
                Postgres tables.
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Step 2: 1-Click Firestore & Catalog Migration to Supabase */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/90 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>02. Data Migration</span>
              <span aria-hidden="true">·</span>
              <span>Firestore & Local Catalog to Supabase Postgres</span>
            </div>
            <h2 className="mt-1 text-lg font-semibold text-white">
              Migrate Series, Chapters & Reading Progress
            </h2>
          </div>

          <button
            type="button"
            onClick={() => void handleRunMigration()}
            disabled={isMigrating}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Database className="h-3.5 w-3.5" />
            <span>
              {isMigrating ? 'Migrating to Supabase...' : 'Migrate Data to Supabase'}
            </span>
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-400 leading-relaxed">
          Syncs all current series, chapter page arrays, user reading progress, episode comments, and
          community requests from Firestore and the server catalog into your Supabase Postgres tables.
          You can also run <code className="font-mono text-slate-200">npm run migrate:supabase</code>{' '}
          from the terminal at any time.
        </p>

        {migrationReport && (
          <div
            className={`mt-4 rounded-lg border p-4 text-xs ${
              migrationReport.ok
                ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200'
                : 'border-amber-500/30 bg-amber-950/20 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {migrationReport.ok ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              )}
              <span>{migrationReport.message}</span>
            </div>

            {migrationReport.ok && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5 font-mono tabular-nums">
                <div className="rounded bg-slate-950/70 px-3 py-2 text-slate-300">
                  Series: <strong className="text-white">{migrationReport.migrated.series}</strong>
                </div>
                <div className="rounded bg-slate-950/70 px-3 py-2 text-slate-300">
                  Chapters:{' '}
                  <strong className="text-white">{migrationReport.migrated.chapters}</strong>
                </div>
                <div className="rounded bg-slate-950/70 px-3 py-2 text-slate-300">
                  Progress:{' '}
                  <strong className="text-white">{migrationReport.migrated.progress}</strong>
                </div>
                <div className="rounded bg-slate-950/70 px-3 py-2 text-slate-300">
                  Comments:{' '}
                  <strong className="text-white">{migrationReport.migrated.comments}</strong>
                </div>
                <div className="rounded bg-slate-950/70 px-3 py-2 text-slate-300">
                  Requests:{' '}
                  <strong className="text-white">{migrationReport.migrated.requests}</strong>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Step 3: Push to GitHub & Deploy Free on Vercel */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/90 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>03. Free Production Hosting</span>
              <span aria-hidden="true">·</span>
              <span>GitHub + Vercel Free Tier</span>
            </div>
            <h2 className="mt-1 text-lg font-semibold text-white">
              Push to GitHub & Deploy on Vercel for Free
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyVercelEnv()}
              disabled={!status?.vercelEnvBlock}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              {copiedEnv ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Copied Vercel .env Block</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Vercel .env Variables</span>
                </>
              )}
            </button>

            <a
              href="https://vercel.com/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-slate-600 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Globe className="h-3.5 w-3.5 text-rose-400" />
              <span>Open Vercel Import</span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </a>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Step 1</span>
              <Layers className="h-3.5 w-3.5 text-slate-500" />
            </div>
            <h3 className="mt-1 text-sm font-semibold text-white">
              Export to GitHub from AI Studio
            </h3>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              Click the <strong>GitHub icon</strong> in the top-right toolbar of Google AI Studio
              (or Download ZIP) to push this repository to your personal GitHub account.
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Step 2</span>
              <Copy className="h-3.5 w-3.5 text-slate-500" />
            </div>
            <h3 className="mt-1 text-sm font-semibold text-white">
              Paste Environment Variables in Vercel
            </h3>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              In <a href="https://vercel.com/new" target="_blank" rel="noopener noreferrer" className="text-rose-400 underline">vercel.com/new</a>, import your GitHub repo, click <strong>Environment Variables</strong>, and paste the copied <code className="font-mono text-slate-200">.env</code> block in one paste.
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Step 3</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
            </div>
            <h3 className="mt-1 text-sm font-semibold text-white">
              Click Deploy (100% Free)
            </h3>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              Vercel builds your Next.js app with <code className="font-mono text-slate-200">vercel.json</code> (60s function timeout + Sharp HD WebP) connected to your Supabase database & CDN.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
