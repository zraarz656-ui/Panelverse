import Link from 'next/link';
import { BookOpen, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 mb-4">
        <BookOpen className="h-6 w-6" />
      </div>
      <h1 className="text-3xl font-extrabold text-white tracking-tight">404</h1>
      <h2 className="mt-1 text-base font-semibold text-slate-300">Episode or Page Not Found</h2>
      <p className="mt-2 text-xs text-slate-400 max-w-sm">
        The chapter or series you are looking for may have been moved, renamed, or is currently unavailable.
      </p>
      <Link
        href="/"
        className="mt-6 flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition-colors shadow-lg shadow-rose-950/50"
      >
        <Home className="h-4 w-4" />
        <span>Return to Library</span>
      </Link>
    </div>
  );
}
