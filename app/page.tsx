'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Flame,
  BookOpen,
  ArrowRight,
  Clock,
  ChevronRight,
  Globe,
  Plus,
  X,
  Star,
  Check,
} from 'lucide-react';
import { TopNavbar } from '@/components/TopNavbar';
import { BottomNav } from '@/components/BottomNav';
import { Footer } from '@/components/Footer';
import { SeriesCard } from '@/components/SeriesCard';
import { ResilientImage } from '@/components/ResilientImage';
import { useIdentity } from '@/hooks/useIdentity';
import { useLanguage } from '@/context/LanguageContext';
import {
  subscribeReadingProgressFromFirestore,
  subscribeLibrarySeriesFromFirestore,
  mergeSeriesWithFirestore,
  PersistedSeriesRecord,
} from '@/lib/supabase-sync';
import { Series, ReadingProgress } from '@/lib/types';
import { InternetMangaSearchResult } from '@/lib/internet-manga';
import { safeFetchJson } from '@/lib/utils';

export default function HomePage() {
  const router = useRouter();
  const {
    id: userId,
    username,
    bookmarks,
    isAuthenticated,
    isAuthReady,
    toggleBookmark,
  } = useIdentity();
  const { language, t } = useLanguage();

  const [baseSeriesList, setBaseSeriesList] = useState<Series[]>([]);
  const [firestoreSeries, setFirestoreSeries] = useState<PersistedSeriesRecord[]>([]);
  const [continueReading, setContinueReading] = useState<ReadingProgress[]>([]);
  const [selectedType, setSelectedType] = useState<'all' | 'manhwa' | 'manga' | 'manhua'>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'title'>('popular');
  const [isLoading, setIsLoading] = useState(true);

  // Live Internet Search & Import Modal State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [internetQuery, setInternetQuery] = useState('');
  const [internetResults, setInternetResults] = useState<InternetMangaSearchResult[]>([]);
  const [isSearchingInternet, setIsSearchingInternet] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setIsLoading(true);
        const data = await safeFetchJson<Series[]>('/api/series');
        if (isMounted && Array.isArray(data)) {
          setBaseSeriesList(data);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
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

  useEffect(() => {
    if (!userId || isAuthenticated) return;
    let isMounted = true;
    async function loadProgress() {
      const data = await safeFetchJson<ReadingProgress[]>(`/api/progress?userId=${encodeURIComponent(userId)}`);
      if (isMounted && Array.isArray(data)) {
        setContinueReading(data);
      }
    }
    loadProgress();
    return () => {
      isMounted = false;
    };
  }, [userId, isAuthenticated]);

  useEffect(() => {
    if (!isAuthReady || !isAuthenticated || !userId) return;
    const unsubscribe = subscribeReadingProgressFromFirestore(userId, (items) => {
      setContinueReading(items);
    });
    return () => unsubscribe();
  }, [isAuthReady, isAuthenticated, userId]);

  const genres = useMemo(() => {
    const set = new Set<string>();
    seriesList.forEach((s) => s.genres.forEach((g) => set.add(g)));
    return Array.from(set);
  }, [seriesList]);

  const filteredSeries = useMemo(() => {
    return seriesList
      .filter((item) => {
        if (selectedType !== 'all') {
          if (selectedType === 'manhwa') {
            if (item.origin !== 'manhwa' && !(item.type === 'webtoon' && !item.origin)) {
              return false;
            }
          } else if (selectedType === 'manga') {
            if (item.origin !== 'manga' && item.type !== 'manga') return false;
          } else if (selectedType === 'manhua') {
            if (item.origin !== 'manhua') return false;
          }
        }
        if (selectedGenre !== 'all' && !item.genres.includes(selectedGenre)) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchMlTitle = item.malayalamTitle
            ? item.malayalamTitle.toLowerCase().includes(q)
            : false;
          const matchKrTitle = item.koreanTitle
            ? item.koreanTitle.toLowerCase().includes(q)
            : false;
          const matchJpTitle = item.japaneseTitle
            ? item.japaneseTitle.toLowerCase().includes(q)
            : false;
          const matchZhTitle = item.chineseTitle
            ? item.chineseTitle.toLowerCase().includes(q)
            : false;
          const matchAuthor = item.author.toLowerCase().includes(q);
          const matchGenre = item.genres.some((g) => g.toLowerCase().includes(q));
          if (
            !matchTitle &&
            !matchMlTitle &&
            !matchKrTitle &&
            !matchJpTitle &&
            !matchZhTitle &&
            !matchAuthor &&
            !matchGenre
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'popular') return b.totalViews - a.totalViews;
        if (sortBy === 'rating') return b.rating - a.rating;
        return a.title.localeCompare(b.title);
      });
  }, [seriesList, selectedType, selectedGenre, searchQuery, sortBy]);

  const featured = seriesList.find((s) => s.featured) || seriesList[0];

  const featuredTitle =
    featured && language === 'ml' && featured.malayalamTitle
      ? featured.malayalamTitle
      : featured?.title;

  const featuredSynopsis =
    featured && language === 'ml' && featured.malayalamSynopsis
      ? featured.malayalamSynopsis
      : featured?.synopsis;

  const handleInternetSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const q = (customQuery ?? internetQuery).trim();
    if (!q) return;

    try {
      setIsSearchingInternet(true);
      const res = await fetch(`/api/internet-search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setInternetResults(data);
      }
    } catch (err) {
      console.error('Internet search error:', err);
    } finally {
      setIsSearchingInternet(false);
    }
  };

  const handleImportSeries = async (item: InternetMangaSearchResult, openImmediately: boolean) => {
    try {
      setImportingId(item.externalId);
      const res = await fetch('/api/internet-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        const created: Series = await res.json();
        setBaseSeriesList((prev) => {
          if (prev.some((s) => s.id === created.id || s.slug === created.slug)) {
            return prev;
          }
          return [created, ...prev];
        });
        if (openImmediately) {
          setImportModalOpen(false);
          router.push(`/series/${created.slug}`);
        }
      }
    } catch (err) {
      console.error('Failed to import series:', err);
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <TopNavbar username={username} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-6 pb-20 md:pb-12">
        {/* Featured Hero Banner */}
        {featured && (
          <section className="relative mb-10 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
              {/* Left Column: Headline, Metadata, and Primary CTAs */}
              <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10 lg:col-span-7">
                <div className="flex items-center gap-2 text-xs text-rose-400 font-semibold tracking-wide">
                  <Flame className="h-4 w-4 shrink-0" />
                  <span>{t.featuredSerialization}</span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="uppercase text-slate-300 font-mono text-[11px]">
                    {featured.origin || featured.type}
                  </span>
                  {featured.koreanTitle && (
                    <>
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                      <span className="text-slate-400 font-normal">{featured.koreanTitle}</span>
                    </>
                  )}
                </div>

                <h1 className="mt-2.5 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white text-balance leading-tight">
                  {featuredTitle}
                </h1>

                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="text-slate-200">By {featured.author}</span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span>{featured.genres.join(' / ')}</span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="text-amber-400 font-mono tabular-nums font-semibold">
                    ★ {featured.rating.toFixed(2)}
                  </span>
                </div>

                <p className="mt-3.5 text-xs sm:text-sm text-slate-300 leading-relaxed line-clamp-3">
                  {featuredSynopsis}
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/series/${featured.slug}`}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-rose-950/50 hover:from-rose-500 hover:to-rose-400 transition-all whitespace-nowrap shrink-0"
                  >
                    <BookOpen className="h-4 w-4 shrink-0" />
                    <span>{t.readNow}</span>
                  </Link>
                  <Link
                    href={`/read/${featured.latestChapterId || 'ch-solo-leveling-1'}`}
                    className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>{t.allEpisodes}</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Link>
                </div>
              </div>

              {/* Right Column: Properly Aligned Visual Spotlight */}
              <div className="relative flex items-center justify-center p-6 sm:p-8 lg:p-10 lg:col-span-5 bg-gradient-to-br from-slate-950/90 via-slate-900/50 to-slate-950 border-t lg:border-t-0 lg:border-l border-slate-800/80 overflow-hidden">
                <div className="relative aspect-[3/4] w-48 sm:w-56 md:w-60 rounded-xl overflow-hidden shadow-2xl border border-slate-700/60 bg-slate-950 transition-transform duration-200 hover:scale-[1.02]">
                  <ResilientImage
                    src={featured.coverImage}
                    alt={featuredTitle || 'Featured'}
                    fallbackTitle={featured.title}
                    fallbackType={featured.type}
                    priority
                    className="object-cover object-center"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Continue Reading Section */}
        {continueReading.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Clock className="h-4 w-4 text-rose-400" />
                <span>{t.continueReading}</span>
              </div>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {continueReading.length} in progress
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {continueReading.map((item) => (
                <Link
                  key={item.seriesId}
                  href={`/read/${item.chapterId}`}
                  className="group flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-900/50 p-3 hover:border-slate-700 hover:bg-slate-900 transition-all"
                >
                  <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-950">
                    <ResilientImage
                      src={item.coverImage}
                      alt={item.seriesTitle}
                      fallbackTitle={item.seriesTitle}
                      fallbackType={item.seriesType}
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-white truncate group-hover:text-rose-400 transition-colors">
                      {item.seriesTitle}
                    </h4>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {item.seriesType === 'webtoon' ? t.episode : t.chapter} {item.chapterNumber}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full bg-rose-500 rounded-full"
                          style={{ width: `${item.scrollPercentage}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono tabular-nums text-slate-400">
                        {item.scrollPercentage}%
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Discovery & Filter Suite */}
        <section className="mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            {/* Interactive Tradition & Format Segmented Controls */}
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/80 p-1 shrink-0">
              {[
                { id: 'all', label: t.filterAll },
                { id: 'manhwa', label: 'Korean Manhwa' },
                { id: 'manga', label: 'Japanese Manga' },
                { id: 'manhua', label: 'Chinese Manhua' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() =>
                    setSelectedType(tab.id as 'all' | 'manhwa' | 'manga' | 'manhua')
                  }
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedType === tab.id
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input, Sort Dropdown & Live Internet Import Trigger */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/90 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as 'popular' | 'rating' | 'title')
                }
                className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 focus:border-rose-500 focus:outline-none cursor-pointer"
              >
                <option value="popular">{t.sortPopular}</option>
                <option value="rating">{t.sortRating}</option>
                <option value="title">{t.sortTitle}</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setImportModalOpen(true);
                  if (internetResults.length === 0) {
                    setInternetQuery('Demon Slayer');
                    handleInternetSearch(undefined, 'Demon Slayer');
                  }
                }}
                className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-600/15 px-3.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-600 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Import from Internet</span>
              </button>
            </div>
          </div>

          {/* Genre Filter Scroll Strip */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-2 no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedGenre('all')}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedGenre === 'all'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              {t.filterAllGenres}
            </button>
            {genres.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setSelectedGenre(g)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedGenre === g
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </section>

        {/* Series Catalog Grid */}
        <section>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-xs text-slate-500">
              {t.loading}
            </div>
          ) : filteredSeries.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-900/20 py-16 text-center">
              <BookOpen className="h-10 w-10 text-slate-700 mb-3" />
              <p className="text-sm font-semibold text-slate-300">{t.noSeriesFound}</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedType('all');
                  setSelectedGenre('all');
                  setSearchQuery('');
                }}
                className="mt-4 rounded-lg bg-slate-900 border border-slate-800 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {t.resetFilters}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
              {filteredSeries.map((series) => (
                <SeriesCard
                  key={series.id}
                  series={series}
                  isBookmarked={bookmarks.includes(series.id)}
                  onToggleBookmark={(e) => {
                    e.preventDefault();
                    toggleBookmark(series.id);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Live Internet Search & Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-white">
                  Search & Import Real Manga, Manhwa & Manhua
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Live search across MangaDex and MyAnimeList global catalogs with instant reader streaming.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => handleInternetSearch(e)}
              className="flex items-center gap-2 border-b border-slate-800/80 bg-slate-900/50 px-6 py-3.5"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={internetQuery}
                  onChange={(e) => setInternetQuery(e.target.value)}
                  placeholder="Search e.g. Eleceed, Bleach, Vagabond, Nano Machine, Blue Lock..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isSearchingInternet}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isSearchingInternet ? 'Searching...' : 'Search Internet'}
              </button>
            </form>

            {/* Quick preset suggestions */}
            <div className="flex items-center gap-2 border-b border-slate-900 px-6 py-2.5 text-xs text-slate-400 overflow-x-auto no-scrollbar">
              <span className="text-slate-500 shrink-0">Popular:</span>
              {['Eleceed', 'Vagabond', 'Blue Lock', 'Nano Machine', 'Dandadan', 'Frieren'].map(
                (term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setInternetQuery(term);
                      handleInternetSearch(undefined, term);
                    }}
                    className="rounded-md bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {term}
                  </button>
                )
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isSearchingInternet ? (
                <div className="flex h-48 items-center justify-center text-xs text-slate-400">
                  Querying MangaDex & MyAnimeList catalogs...
                </div>
              ) : internetResults.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-center text-xs text-slate-500">
                  <Globe className="h-8 w-8 text-slate-700 mb-2" />
                  <p>Enter any Manga, Manhwa, or Manhua title above to search the internet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {internetResults.map((item) => {
                    const alreadyAdded = seriesList.some(
                      (s) => s.title.toLowerCase() === item.title.toLowerCase()
                    );
                    const isBusy = importingId === item.externalId;

                    return (
                      <div
                        key={item.externalId}
                        className="flex gap-3.5 rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 hover:border-slate-700 transition-colors"
                      >
                        <div className="relative aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-lg bg-slate-950 border border-slate-800">
                          <ResilientImage
                            src={item.coverImage}
                            alt={item.title}
                            fallbackTitle={item.title}
                            fallbackType={item.type}
                            className="object-cover"
                          />
                        </div>
                        <div className="flex flex-1 flex-col justify-between min-w-0">
                          <div>
                            <div className="flex items-center gap-1.5 text-[11px] text-rose-400 font-semibold uppercase">
                              <span>{item.origin}</span>
                              <span aria-hidden="true" className="text-slate-600">
                                ·
                              </span>
                              <span className="flex items-center gap-0.5 text-amber-400 font-mono tabular-nums">
                                <Star className="h-3 w-3 fill-amber-400" />
                                {item.rating.toFixed(2)}
                              </span>
                            </div>
                            <h3 className="mt-0.5 text-sm font-bold text-white line-clamp-1">
                              {item.title}
                            </h3>
                            <p className="text-[11px] text-slate-400 truncate">
                              By {item.author} · {item.genres.slice(0, 2).join(' / ')}
                            </p>
                            <p className="mt-1.5 text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                              {item.synopsis}
                            </p>
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleImportSeries(item, true)}
                              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                              <span>{isBusy ? 'Importing...' : 'Read Now'}</span>
                            </button>

                            <button
                              type="button"
                              disabled={isBusy || alreadyAdded}
                              onClick={() => handleImportSeries(item, false)}
                              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {alreadyAdded ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                  <span>In Library</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="h-3.5 w-3.5" />
                                  <span>Add</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Footer />
      <BottomNav />
    </div>
  );
}
