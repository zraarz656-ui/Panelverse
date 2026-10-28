import { dataStore } from './data-store';
import { Series, ReadingProgress } from './types';

export function getFilteredSeries(params?: {
  q?: string;
  type?: string;
  genre?: string;
  status?: string;
  sort?: string;
}): Series[] {
  return dataStore.getSeries(params);
}

export function getNewEpisodes(limit = 6): Series[] {
  // Returns ongoing series sorted by totalViews or latest chapter
  const all = dataStore.getSeries({ sort: 'popular' });
  return all.slice(0, limit);
}

export function getContinueReading(userId: string): ReadingProgress[] {
  return dataStore.getReadingProgress(userId);
}

export function getFeaturedSeries(): Series[] {
  return dataStore.getSeries().filter((s) => s.featured);
}
