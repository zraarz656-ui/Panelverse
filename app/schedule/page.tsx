'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Calendar, Star, ChevronRight } from 'lucide-react';
import { TopNavbar } from '@/components/TopNavbar';
import { BottomNav } from '@/components/BottomNav';
import { ResilientImage } from '@/components/ResilientImage';
import { useIdentity } from '@/hooks/useIdentity';
import {
  subscribeLibrarySeriesFromFirestore,
  mergeSeriesWithFirestore,
  PersistedSeriesRecord,
} from '@/lib/firebase-sync';
import { Series } from '@/lib/types';

export default function SchedulePage() {
  const { username, isAuthReady } = useIdentity();
  const [baseSeriesList, setBaseSeriesList] = useState<Series[]>([]);
  const [firestoreSeries, setFirestoreSeries] = useState<PersistedSeriesRecord[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('all');

  const daysOfWeek = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ] as const;

  const currentDayIndex = new Date().getDay();
  const todayName = daysOfWeek[(currentDayIndex + 6) % 7];

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/series');
        if (res.ok) {
          const data = await res.json();
          setBaseSeriesList(data);
        }
      } catch (err) {
        console.error('Failed to load schedule:', err);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    const unsubscribe = subscribeLibrarySeriesFromFirestore((records) => {
      setFirestoreSeries(records);
    });
    return () => unsubscribe();
  }, [isAuthReady]);

  const seriesList = useMemo(
    () => mergeSeriesWithFirestore(baseSeriesList, firestoreSeries),
    [baseSeriesList, firestoreSeries]
  );

  const filteredDays = selectedDay === 'all' ? daysOfWeek : [selectedDay as (typeof daysOfWeek)[number]];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <TopNavbar username={username} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 py-8 pb-20 md:pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-8">
          <div>
            <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold tracking-wide">
              <Calendar className="h-4 w-4" />
              <span>Release Calendar</span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-white tracking-tight">
              Weekly Serialization Schedule
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              New Manhwa, Manga, and Manhua episodes drop at 00:00 KST / JST on scheduled days. Today is{' '}
              <strong className="text-white">{todayName}</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDay('all')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                selectedDay === 'all'
                  ? 'bg-rose-600 text-white'
                  : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              Full Week
            </button>
            <button
              type="button"
              onClick={() => setSelectedDay(todayName)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                selectedDay === todayName
                  ? 'bg-rose-600 text-white'
                  : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              Today ({todayName})
            </button>
          </div>
        </div>

        <div className="space-y-8">
          {filteredDays.map((day) => {
            const daySeries = seriesList.filter((s) => s.releaseDay === day);
            const isToday = day === todayName;

            return (
              <div key={day} className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-bold text-white">{day}</h2>
                    {isToday && (
                      <span className="text-xs font-semibold text-rose-400">
                        · Today&apos;s Drops
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 font-mono tabular-nums">
                    {daySeries.length} {daySeries.length === 1 ? 'Release' : 'Releases'}
                  </span>
                </div>

                {daySeries.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">No scheduled releases on this day.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {daySeries.map((s) => (
                      <Link
                        key={s.id}
                        href={`/series/${s.slug}`}
                        className="group flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 hover:border-slate-700 hover:bg-slate-900/80 transition-all"
                      >
                        <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-950">
                          <ResilientImage
                            src={s.coverImage}
                            alt={s.title}
                            fallbackTitle={s.title}
                            fallbackType={s.type}
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-rose-400">
                            <span>{s.origin || s.type}</span>
                            <span aria-hidden="true" className="text-slate-600">
                              ·
                            </span>
                            <span className="text-slate-400 normal-case">{s.genres[0]}</span>
                          </div>
                          <h3 className="text-xs font-bold text-white truncate group-hover:text-rose-400 transition-colors mt-0.5">
                            {s.title}
                          </h3>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                            <span className="truncate">{s.author}</span>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-400 font-mono tabular-nums font-medium flex items-center gap-0.5">
                              <Star className="h-2.5 w-2.5 fill-amber-400" />
                              {s.rating.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-white transition-colors shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
