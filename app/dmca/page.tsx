'use client';

import Link from 'next/link';
import { ShieldAlert, Mail, ArrowLeft, FileText, CheckCircle2 } from 'lucide-react';
import { TopNavbar } from '@/components/TopNavbar';
import { BottomNav } from '@/components/BottomNav';
import { Footer } from '@/components/Footer';
import { useIdentity } from '@/hooks/useIdentity';

export default function DmcaPage() {
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
              <ShieldAlert className="h-4 w-4" />
              <span>Legal Compliance</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              DMCA & Copyright Takedown Policy
            </h1>
            <p className="mt-2 text-xs text-slate-400">
              Last updated: October 2026. PanelVerse respects the intellectual property rights of creators, artists, and publishers.
            </p>
          </div>

          <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <h2 className="text-base font-bold text-white">1. Copyright Policy Overview</h2>
            <p>
              PanelVerse (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;the Platform&rdquo;) complies with the Digital Millennium Copyright Act (17 U.S.C. § 512) and international copyright legislation. It is our policy to respond expeditiously to clear, formal notices of alleged copyright infringement that comply with statutory requirements.
            </p>

            <h2 className="text-base font-bold text-white pt-2">2. Designated Copyright Agent</h2>
            <p>
              Notices of claimed infringement regarding content hosted or indexed on PanelVerse should be directed to our designated copyright agent:
            </p>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs font-mono space-y-1">
              <div><strong>Designated Agent:</strong> PanelVerse Copyright Compliance Officer</div>
              <div><strong>Email:</strong> <a href="mailto:yuniquearun@gmail.com" className="text-rose-400 underline">yuniquearun@gmail.com</a></div>
              <div><strong>Platform:</strong> PanelVerse Digital Reader Network</div>
            </div>

            <h2 className="text-base font-bold text-white pt-2">3. Required Information for Takedown Notices</h2>
            <p>
              To ensure prompt processing under 17 U.S.C. § 512(c)(3), your written notice must include:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li>A physical or electronic signature of the authorized copyright owner or agent.</li>
              <li>Identification of the copyrighted manga, webtoon, or artwork claimed to have been infringed.</li>
              <li>Identification of the material to be removed, including specific URL(s) on PanelVerse (e.g. series or chapter link).</li>
              <li>Your contact information: full name, address, telephone number, and email address.</li>
              <li>A statement that you have a good faith belief that use of the material is not authorized by the copyright owner, its agent, or the law.</li>
              <li>A statement, under penalty of perjury, that the information in the notification is accurate and that you are authorized to act on behalf of the owner.</li>
            </ul>

            <h2 className="text-base font-bold text-white pt-2">4. Counter-Notification Procedure</h2>
            <p>
              If content you submitted was removed due to a mistake or misidentification, you may submit a formal counter-notification containing your signature, identification of the removed content, and consent to jurisdiction under applicable federal or national courts.
            </p>

            <h2 className="text-base font-bold text-white pt-2">5. Repeat Infringer Policy</h2>
            <p>
              In accordance with Section 512(i)(1)(A) of the DMCA, PanelVerse reserves the right to terminate access and remove accounts or community upload privileges of users who are found to repeatedly infringe copyright laws.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span className="text-xs text-slate-400">Need immediate assistance?</span>
            <a
              href="mailto:yuniquearun@gmail.com?subject=DMCA%20Takedown%20Notice%20-%20PanelVerse"
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition-colors"
            >
              <Mail className="h-4 w-4" />
              <span>Submit Notice to Copyright Agent</span>
            </a>
          </div>
        </div>
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
