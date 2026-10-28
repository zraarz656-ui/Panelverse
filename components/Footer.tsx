import Link from 'next/link';
import { BookOpen, ShieldCheck } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-slate-800/80 bg-slate-950 py-8 text-xs text-slate-400">
      <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-rose-600 to-indigo-600 text-white">
            <BookOpen className="h-3.5 w-3.5" />
          </span>
          <span className="font-bold text-white">PanelVerse</span>
          <span className="text-slate-600">·</span>
          <span>Webtoon & Manga Serialization</span>
        </div>

        <nav className="flex flex-wrap items-center gap-5 text-slate-400">
          <Link href="/dmca" className="hover:text-white transition-colors">
            DMCA & Copyright
          </Link>
          <Link href="/terms" className="hover:text-white transition-colors">
            Terms of Service
          </Link>
          <Link href="/schedule" className="hover:text-white transition-colors">
            Release Schedule
          </Link>
          <Link href="/requests" className="hover:text-white transition-colors">
            Series Requests
          </Link>
          <Link href="/admin" className="hover:text-white transition-colors">
            Admin Console
          </Link>
        </nav>

        <div className="text-[11px] text-slate-500">
          © {new Date().getFullYear()} PanelVerse. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
