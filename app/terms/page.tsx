'use client';

import Link from 'next/link';
import { FileText, ArrowLeft, ShieldCheck, Lock, UserCheck } from 'lucide-react';
import { TopNavbar } from '@/components/TopNavbar';
import { BottomNav } from '@/components/BottomNav';
import { Footer } from '@/components/Footer';
import { useIdentity } from '@/hooks/useIdentity';

export default function TermsPage() {
  const { username } = useIdentity();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <TopNavbar username={username} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 sm:px-6 py-8 pb-20 md:pb-12">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Discover
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:p-10 space-y-8">
          <div>
            <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold uppercase tracking-wider">
              <FileText className="h-4 w-4" />
              <span>Terms & Reader Privacy</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Terms of Service & Reader Privacy Policy
            </h1>
            <p className="mt-2 text-xs text-slate-400">
              Effective Date: October 2026. Please read these terms carefully before accessing PanelVerse.
            </p>
          </div>

          <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <h2 className="text-base font-bold text-white">1. Acceptance of Terms</h2>
            <p>
              By accessing, browsing, or reading webtoons and manga on PanelVerse, you agree to comply with and be bound by these Terms of Service. If you disagree with any part of these terms, you must discontinue your use of the platform.
            </p>

            <h2 className="text-base font-bold text-white pt-2">2. Anonymous Reader Privacy &amp; Data Minimization</h2>
            <p>
              PanelVerse is engineered from the ground up on privacy-first principles:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li><strong>Zero PII Collection:</strong> We do not ask for or store email addresses, passwords, phone numbers, or real identities for readers.</li>
              <li><strong>Cryptographic One-Way Hashes:</strong> When you start reading, your browser is assigned an anonymous pseudorandom token and a recovery key. Only SHA-256 hashes of recovery keys are stored server-side.</li>
              <li><strong>Local Bookmarks &amp; History:</strong> Your reading progress, scroll positions, and bookmarked series are tied exclusively to your anonymous session.</li>
              <li><strong>Recovery:</strong> Because keys are never stored in plaintext, your recovery key can only be shown once. You may regenerate keys or restore an account anytime in the Me profile tab.</li>
            </ul>

            <h2 className="text-base font-bold text-white pt-2">3. Community Guidelines &amp; Comment Conduct</h2>
            <p>
              Our discussion boards and episode comment threads are intended to be respectful and constructive. You agree not to:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li>Post unsolicited spoilers without checking the &ldquo;Mark Spoiler&rdquo; mask.</li>
              <li>Harass, threaten, defame, or abuse other community members or creators.</li>
              <li>Spam external links, commercial solicitations, or malicious content.</li>
            </ul>
            <p>
              Violating comments may be removed by administrators, and repeat violators will have their token revoked.
            </p>

            <h2 className="text-base font-bold text-white pt-2">4. Content Ownership &amp; Intellectual Property</h2>
            <p>
              All manga, manhwa, webtoon panels, artwork, logos, and serialized stories displayed on PanelVerse belong to their respective creators, publishers, and licensors. Unauthorized scraping, commercial redistribution, or reproduction without express permission is strictly prohibited.
            </p>

            <h2 className="text-base font-bold text-white pt-2">5. Disclaimer of Warranties &amp; Limitation of Liability</h2>
            <p>
              The platform and all serialized content are provided &ldquo;as is&rdquo; without warranties of any kind. PanelVerse shall not be liable for any indirect, incidental, or consequential damages resulting from your use of or inability to access the service.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800 text-xs text-slate-500">
            For questions regarding these terms, reach our legal officer at <a href="mailto:yuniquearun@gmail.com" className="text-rose-400 underline">yuniquearun@gmail.com</a>.
          </div>
        </div>
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
