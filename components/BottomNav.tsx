'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Calendar, ThumbsUp, User, ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  // Hide bottom nav while inside active reader to maximize viewport immersion
  if (pathname.startsWith('/read/')) {
    return null;
  }

  const tabs = [
    { label: t.discover, href: '/', icon: Compass },
    { label: t.schedule, href: '/schedule', icon: Calendar },
    { label: t.requests, href: '/requests', icon: ThumbsUp },
    { label: t.me, href: '/me', icon: User },
    { label: t.admin, href: '/admin', icon: ShieldAlert },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 block md:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-md pb-safe">
      <div className="grid grid-cols-5 h-14 items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            tab.href === '/'
              ? pathname === '/'
              : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center min-h-[44px] py-1 transition-colors ${
                isActive ? 'text-rose-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4.5 w-4.5" />
              <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
