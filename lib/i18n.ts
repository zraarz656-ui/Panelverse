export type Language = 'en' | 'ml';

export interface Translations {
  // Navigation
  discover: string;
  schedule: string;
  requests: string;
  me: string;
  admin: string;
  myLibrary: string;

  // Home Page
  featuredSerialization: string;
  readNow: string;
  allEpisodes: string;
  continueReading: string;
  progress: string;
  newEpisodes: string;
  libraryCatalog: string;
  searchPlaceholder: string;
  filterAll: string;
  filterWebtoon: string;
  filterManga: string;
  filterAllGenres: string;
  sortBy: string;
  sortPopular: string;
  sortRating: string;
  sortTitle: string;
  noSeriesFound: string;
  resetFilters: string;

  // Reader Controls
  episode: string;
  chapter: string;
  page: string;
  comments: string;
  width: string;
  direction: string;
  nextEpisode: string;
  prevEpisode: string;
  nextChapter: string;
  prevChapter: string;
  backToSeries: string;
  readingProgress: string;

  // Me Tab
  anonymousProfile: string;
  anonymousReader: string;
  bookmarks: string;
  recoveryKey: string;
  generateNewKey: string;
  restoreAccount: string;
  enterRecoveryKey: string;
  restore: string;

  // Schedule & Requests
  weeklyReleaseSchedule: string;
  todaysDrops: string;
  communityRequests: string;
  requestNewTitle: string;
  upvote: string;

  // Common
  loading: string;
  views: string;
  rating: string;
  author: string;
  artist: string;
  status: string;
  ongoing: string;
  completed: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    discover: 'Discover',
    schedule: 'Schedule',
    requests: 'Requests',
    me: 'Me',
    admin: 'Admin',
    myLibrary: 'My Library',

    featuredSerialization: 'Featured Serialization',
    readNow: 'Read Now',
    allEpisodes: 'All Episodes',
    continueReading: 'Continue Reading',
    progress: 'Progress',
    newEpisodes: 'New Episodes',
    libraryCatalog: 'Library Catalog',
    searchPlaceholder: 'Search titles, authors, genres...',
    filterAll: 'All',
    filterWebtoon: 'Webtoons (Scroll)',
    filterManga: 'Manga (Paged RTL)',
    filterAllGenres: 'All Genres',
    sortBy: 'Sort by',
    sortPopular: 'Most Popular',
    sortRating: 'Highest Rated',
    sortTitle: 'Title A-Z',
    noSeriesFound: 'No series found matching your criteria.',
    resetFilters: 'Reset Filters',

    episode: 'Episode',
    chapter: 'Chapter',
    page: 'Page',
    comments: 'Comments',
    width: 'Width',
    direction: 'Direction',
    nextEpisode: 'Next Episode',
    prevEpisode: 'Previous Episode',
    nextChapter: 'Next Chapter',
    prevChapter: 'Previous Chapter',
    backToSeries: 'Back to Series',
    readingProgress: 'Reading Progress',

    anonymousProfile: 'Anonymous Reader Profile',
    anonymousReader: 'Anonymous Reader',
    bookmarks: 'Bookmarks',
    recoveryKey: 'Recovery Key',
    generateNewKey: 'Generate New Recovery Key',
    restoreAccount: 'Restore Session with Key',
    enterRecoveryKey: 'Paste 32-character recovery key',
    restore: 'Restore Account',

    weeklyReleaseSchedule: 'Weekly Release Schedule',
    todaysDrops: "Today's Drops",
    communityRequests: 'Community Licensing Requests',
    requestNewTitle: 'Propose New Title',
    upvote: 'Upvote',

    loading: 'Loading...',
    views: 'views',
    rating: 'Rating',
    author: 'Author',
    artist: 'Artist',
    status: 'Status',
    ongoing: 'Ongoing',
    completed: 'Completed',
  },
  ml: {
    discover: 'കണ്ടെത്തുക',
    schedule: 'ഷെഡ്യൂൾ',
    requests: 'അഭ്യർത്ഥനകൾ',
    me: 'എന്റെ അക്കൗണ്ട്',
    admin: 'അഡ്മിൻ',
    myLibrary: 'എന്റെ ലൈബ്രറി',

    featuredSerialization: 'പ്രത്യേക പരമ്പര',
    readNow: 'ഇപ്പോൾ വായിക്കുക',
    allEpisodes: 'എല്ലാ എപ്പിസോഡുകളും',
    continueReading: 'വായന തുടരുക',
    progress: 'പുരോഗതി',
    newEpisodes: 'പുതിയ എപ്പിസോഡുകൾ',
    libraryCatalog: 'ലൈബ്രറി കാറ്റലോഗ്',
    searchPlaceholder: 'ശീർഷകങ്ങൾ, രചയിതാക്കൾ, കാറ്റഗറി തിരയുക...',
    filterAll: 'എല്ലാം',
    filterWebtoon: 'വെബ്റ്റൂൺ (സ്ക്രോൾ)',
    filterManga: 'മാംഗ (പേജ്ഡ് RTL)',
    filterAllGenres: 'എല്ലാ വിഭാഗങ്ങളും',
    sortBy: 'ക്രമീകരിക്കുക',
    sortPopular: 'ഏറ്റവും പ്രശസ്തമായത്',
    sortRating: 'കൂടുതൽ റേറ്റിംഗ്',
    sortTitle: 'അക്ഷരമാലാക്രമം',
    noSeriesFound: 'തിരഞ്ഞ വിവരങ്ങൾക്ക് അനുയോജ്യമായ പരമ്പരകൾ ലഭ്യമല്ല.',
    resetFilters: 'ഫിൽട്ടർ പുനഃക്രമീകരിക്കുക',

    episode: 'എപ്പിസോഡ്',
    chapter: 'അധ്യായം',
    page: 'പേജ്',
    comments: 'അഭിപ്രായങ്ങൾ',
    width: 'വീതി',
    direction: 'ദിശ',
    nextEpisode: 'അടുത്ത എപ്പിസോഡ്',
    prevEpisode: 'മുമ്പത്തെ എപ്പിസോഡ്',
    nextChapter: 'അടുത്ത അധ്യായം',
    prevChapter: 'മുമ്പത്തെ അധ്യായം',
    backToSeries: 'പരമ്പരയിലേക്ക് മടങ്ങുക',
    readingProgress: 'വായനാ പുരോഗതി',

    anonymousProfile: 'അജ്ഞാത വായനക്കാരന്റെ പ്രൊഫൈൽ',
    anonymousReader: 'അജ്ഞാത വായനക്കാരൻ',
    bookmarks: 'ബുക്ക്മാർക്കുകൾ',
    recoveryKey: 'റിക്കവറി കീ',
    generateNewKey: 'പുതിയ റിക്കവറി കീ നിർമ്മിക്കുക',
    restoreAccount: 'കീ ഉപയോഗിച്ച് അക്കൗണ്ട് വീണ്ടെടുക്കുക',
    enterRecoveryKey: '32-അക്ഷര റിക്കവറി കീ ഇവിടെ നൽകുക',
    restore: 'വീണ്ടെടുക്കുക',

    weeklyReleaseSchedule: 'പ്രതിവാര റിലീസ് ഷെഡ്യൂൾ',
    todaysDrops: 'ഇന്നത്തെ റിലീസുകൾ',
    communityRequests: 'ലൈസൻസിംഗ് അഭ്യർത്ഥനകൾ',
    requestNewTitle: 'പുതിയ പരമ്പര നിർദ്ദേശിക്കുക',
    upvote: 'വോട്ട് ചെയ്യുക',

    loading: 'ലോഡ് ചെയ്യുന്നു...',
    views: 'വായനകൾ',
    rating: 'റേറ്റിംഗ്',
    author: 'രചയിതാവ്',
    artist: 'ചിത്രകാരൻ',
    status: 'സ്റ്റാറ്റസ്',
    ongoing: 'തുടരുന്നു',
    completed: 'പൂർത്തിയായി',
  },
};
