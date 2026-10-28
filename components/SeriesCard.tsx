'use client';

import Link from 'next/link';
import { Star, Bookmark } from 'lucide-react';
import { Series } from '@/lib/types';
import { useLanguage } from '@/context/LanguageContext';
import { ResilientImage } from './ResilientImage';

interface SeriesCardProps {
  series: Series;
  isBookmarked?: boolean;
  onToggleBookmark?: (e: React.MouseEvent, id: string) => void;
}

export function SeriesCard({ series, isBookmarked, onToggleBookmark }: SeriesCardProps) {
  const { language, t } = useLanguage();

  const displayTitle =
    language === 'ml' && series.malayalamTitle ? series.malayalamTitle : series.title;
  const displayStatus = series.status === 'Completed' ? t.completed : t.ongoing;
  const originLabel =
    series.origin === 'manhua'
      ? 'Manhua'
      : series.origin === 'manhwa'
      ? 'Manhwa'
      : series.type === 'manga'
      ? 'Manga'
      : 'Webtoon';

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/40 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-black/40">
      {/* Cover Image Container */}
      <Link
        href={`/series/${series.slug}`}
        className="relative aspect-[3/4] w-full overflow-hidden bg-slate-950"
      >
        <ResilientImage
          src={series.coverImage}
          alt={displayTitle}
          fallbackTitle={series.title}
          fallbackType={series.type}
          priority={series.featured}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {/* Measured Bottom Contrast Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent pointer-events-none" />

        {/* Unboxed Tradition Label */}
        <div className="absolute bottom-2.5 left-2.5 text-[11px] font-semibold tracking-wider uppercase text-slate-200">
          {originLabel}
        </div>

        {/* Rating */}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 text-[11px] font-medium text-amber-300">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          <span className="font-mono tabular-nums">{series.rating.toFixed(2)}</span>
        </div>

        {/* Bookmark Trigger */}
        {onToggleBookmark && (
          <button
            type="button"
            onClick={(e) => onToggleBookmark(e, series.id)}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark series'}
            className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950/75 text-slate-300 backdrop-blur-sm transition-colors hover:bg-rose-600 hover:text-white cursor-pointer"
          >
            <Bookmark
              className={`h-4 w-4 ${isBookmarked ? 'fill-rose-500 text-rose-500' : ''}`}
            />
          </button>
        )}
      </Link>

      {/* Card Content with Zero-Pill Typographic Discipline */}
      <div className="flex flex-1 flex-col p-3.5">
        <Link href={`/series/${series.slug}`}>
          <h3 className="line-clamp-1 text-sm font-semibold text-slate-100 transition-colors group-hover:text-rose-400">
            {displayTitle}
          </h3>
        </Link>

        {/* Unboxed text metadata with dot separators */}
        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400 line-clamp-1">
          <span>{series.genres[0]}</span>
          {series.genres[1] && (
            <>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span>{series.genres[1]}</span>
            </>
          )}
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span className="font-mono tabular-nums">
            {series.chaptersCount} {series.type === 'webtoon' ? 'eps' : 'ch'}
          </span>
        </div>

        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
          <span className="truncate max-w-[125px]">{series.author}</span>
          <span className="capitalize text-slate-400 font-medium">{displayStatus}</span>
        </div>
      </div>
    </div>
  );
}
