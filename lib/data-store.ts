import fs from 'fs';
import {
  Series,
  Chapter,
  Comment,
  SeriesRequest,
  ReadingProgress,
  UserSession,
  ModerationReport,
  SeriesOrigin,
  SeriesType,
} from './types';
import { createCoverSvg, createReaderPanelSvg } from './svg-covers';
import { buildProxiedImageUrl, DiscoveredMangaDexChapter } from './internet-manga';

const PERSIST_STATE_FILE = '/tmp/panelverse-library-state-v4.json';

interface PersistedLibraryState {
  seriesOverrides: Record<string, Series>;
  deletedSeriesIds: string[];
  chapterOverrides: Record<string, Chapter>;
  deletedChapterIds: string[];
}

class DatabaseStore {
  private series: Series[] = [];
  private chapters: Chapter[] = [];
  private comments: Comment[] = [];
  private requests: SeriesRequest[] = [];
  private progress: Map<string, ReadingProgress[]> = new Map();
  private sessions: Map<string, UserSession> = new Map();
  private keyToSession: Map<string, string> = new Map();
  private reports: ModerationReport[] = [];
  private seriesOverrides: Map<string, Series> = new Map();
  private deletedSeriesIds: Set<string> = new Set();
  private chapterOverrides: Map<string, Chapter> = new Map();
  private deletedChapterIds: Set<string> = new Set();

  constructor() {
    this.seedInitialData();
    this.loadPersistedState();
  }

  private loadPersistedState() {
    try {
      if (!fs.existsSync(PERSIST_STATE_FILE)) return;
      const raw = fs.readFileSync(PERSIST_STATE_FILE, 'utf-8');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PersistedLibraryState>;

      if (Array.isArray(parsed.deletedSeriesIds)) {
        parsed.deletedSeriesIds.forEach((id) => {
          this.deletedSeriesIds.add(id);
          this.series = this.series.filter((s) => s.id !== id);
          this.chapters = this.chapters.filter((c) => c.seriesId !== id);
        });
      }

      if (parsed.seriesOverrides && typeof parsed.seriesOverrides === 'object') {
        for (const [id, override] of Object.entries(parsed.seriesOverrides)) {
          if (this.deletedSeriesIds.has(id)) continue;
          this.seriesOverrides.set(id, override);
          const idx = this.series.findIndex((s) => s.id === id);
          if (idx >= 0) {
            this.series[idx] = { ...this.series[idx], ...override };
          } else {
            this.series.unshift(override);
          }
        }
      }

      if (Array.isArray(parsed.deletedChapterIds)) {
        parsed.deletedChapterIds.forEach((id) => {
          this.deletedChapterIds.add(id);
          this.chapters = this.chapters.filter((c) => c.id !== id);
        });
      }

      if (parsed.chapterOverrides && typeof parsed.chapterOverrides === 'object') {
        for (const [id, chOverride] of Object.entries(parsed.chapterOverrides)) {
          if (this.deletedChapterIds.has(id) || this.deletedSeriesIds.has(chOverride.seriesId)) {
            continue;
          }
          this.chapterOverrides.set(id, chOverride);
          const idx = this.chapters.findIndex((c) => c.id === id);
          if (idx >= 0) {
            this.chapters[idx] = { ...this.chapters[idx], ...chOverride };
          } else {
            this.chapters.push(chOverride);
          }
        }
      }

      this.recomputeSeriesChapterCounts();
    } catch (e) {
      console.error('Failed to load persisted library state:', e);
    }
  }

  private savePersistedState() {
    try {
      const payload: PersistedLibraryState = {
        seriesOverrides: Object.fromEntries(this.seriesOverrides.entries()),
        deletedSeriesIds: Array.from(this.deletedSeriesIds),
        chapterOverrides: Object.fromEntries(this.chapterOverrides.entries()),
        deletedChapterIds: Array.from(this.deletedChapterIds),
      };
      fs.writeFileSync(PERSIST_STATE_FILE, JSON.stringify(payload), 'utf-8');
    } catch (e) {
      console.error('Failed to save persisted library state:', e);
    }
  }

  private recomputeSeriesChapterCounts() {
    for (const s of this.series) {
      const chs = this.chapters
        .filter((c) => c.seriesId === s.id)
        .sort((a, b) => a.chapterNumber - b.chapterNumber);
      s.chaptersCount = chs.length;
      if (chs.length > 0) {
        s.latestChapterId = chs[chs.length - 1].id;
      }
    }
  }

  private seedInitialData() {
    this.series = [
      // ==================== KOREAN MANHWA & WEBTOONS ====================
      {
        id: 'series-solo-leveling',
        slug: 'solo-leveling',
        title: 'Solo Leveling',
        origin: 'manhwa',
        koreanTitle: '나 혼자만 레벨업',
        malayalamTitle: 'സോളോ ലെവലിംഗ് (Solo Leveling)',
        malayalamSynopsis:
          'പത്ത് വർഷങ്ങൾക്ക് മുമ്പ് മറ്റ് ലോകങ്ങളിലേക്കുള്ള കവാടം തുറക്കപ്പെട്ടപ്പോൾ, ഏറ്റവും ദുർബലനായ ഇ-റാങ്ക് ഹണ്ടർ സങ് ജിൻ-വൂ ഒരു രഹസ്യ ഇരട്ട ഡൺജിയണിൽ മരണത്തെ അഭിമുഖീകരിക്കുകയും നിഗൂഢമായ സിസ്റ്റം വഴി ഷാഡോ മൊണാർക്കായി ഉയരുകയും ചെയ്യുന്നു.',
        author: 'Chugong',
        artist: 'DUBU (Redice Studio)',
        type: 'webtoon',
        genres: ['Action', 'System', 'Fantasy'],
        status: 'Completed',
        synopsis:
          'Ten years ago, after "the Gate" that connected the real world with the monster world opened, ordinary people received the power to hunt monsters within the Gate. Sung Jinwoo, notoriously known as the Weakest Hunter of All Mankind, awakens a secret Player System inside a deadly double dungeon.',
        coverImage: buildProxiedImageUrl(
          'https://cdn.myanimelist.net/images/manga/3/222295l.jpg',
          'SOLO LEVELING',
          'webtoon',
          'shadow'
        ),
        rating: 4.97,
        totalViews: 4850000,
        releaseDay: 'Wednesday',
        chaptersCount: 3,
        latestChapterId: 'ch-solo-leveling-3',
        featured: true,
        mangadexId: '32d76d19-8a05-4db0-9fc2-e0b0648fe9d0',
        malId: 121496,
      },
      {
        id: 'series-omniscient-reader',
        slug: 'omniscient-readers-viewpoint',
        title: "Omniscient Reader's Viewpoint",
        origin: 'manhwa',
        koreanTitle: '전지적 독자 시점',
        malayalamTitle: 'ഓംനിസിയന്റ് റീഡേഴ്സ് വ്യൂപോയിന്റ്',
        malayalamSynopsis:
          'താൻ പത്ത് വർഷമായി വായിച്ചുകൊണ്ടിരുന്ന നോവൽ യാഥാർത്ഥ്യമായി മാറുമ്പോൾ, ലോകത്തിന്റെ അവസാനം എങ്ങനെ സംഭവിക്കുമെന്ന് അറിയാവുന്ന ഒരേയൊരു വ്യക്തി കിം ഡോക്ജ മാത്രമാണ്.',
        author: 'sing N song',
        artist: 'Sleepy-C (Redice Studio)',
        type: 'webtoon',
        genres: ['Action', 'System', 'Fantasy'],
        status: 'Ongoing',
        synopsis:
          'Kim Dokja does not consider himself the protagonist of his own life. One day, the apocalyptic web novel he alone read for ten years—"Three Ways to Survive in a Ruined World"—suddenly becomes reality on his subway train home, and constellations begin sponsoring incarnations.',
        coverImage: buildProxiedImageUrl(
          'https://cdn.myanimelist.net/images/manga/2/232022l.jpg',
          'OMNISCIENT READER',
          'webtoon',
          'celestial'
        ),
        rating: 4.95,
        totalViews: 3620000,
        releaseDay: 'Tuesday',
        chaptersCount: 3,
        latestChapterId: 'ch-omniscient-reader-3',
        featured: true,
        mangadexId: '3df1a9a3-a1be-47a3-9e90-9b3e55b1d0ac',
        malId: 132214,
      },
      {
        id: 'series-tower-of-god',
        slug: 'tower-of-god',
        title: 'Tower of God',
        origin: 'manhwa',
        koreanTitle: '신의 탑',
        malayalamTitle: 'ടവർ ഓഫ് ഗോഡ് (Tower of God)',
        malayalamSynopsis:
          'സമ്പത്തും അധികാരവും മാന്ത്രികശക്തിയും എല്ലാം മുകളിലുണ്ടെന്ന് വിശ്വസിക്കപ്പെടുന്ന നിഗൂഢമായ ഗോപുരത്തിലേക്ക് തന്റെ പ്രിയ സുഹൃത്ത് റേച്ചലിനെ തേടി ഇരുപത്തിയഞ്ചാം ബാം പ്രവേശിക്കുന്നു.',
        author: 'SIU',
        artist: 'SIU',
        type: 'webtoon',
        genres: ['Fantasy', 'Adventure', 'Action'],
        status: 'Ongoing',
        synopsis:
          'What do you desire? Money and wealth? Honor and pride? Authority and power? Revenge? Or something that transcends them all? Whatever you desire—it is in here. Twenty-Fifth Bam enters the mysterious Tower as an Irregular to reunite with his only friend, Rachel.',
        coverImage: buildProxiedImageUrl(
          'https://cdn.myanimelist.net/images/manga/2/204832l.jpg',
          'TOWER OF GOD',
          'webtoon',
          'dungeon'
        ),
        rating: 4.89,
        totalViews: 2980000,
        releaseDay: 'Monday',
        chaptersCount: 3,
        latestChapterId: 'ch-tower-of-god-3',
        featured: false,
        mangadexId: '57e1d491-1dc9-4854-83bf-7a9379566fb2',
        malId: 122663,
      },
      {
        id: 'series-tbate',
        slug: 'the-beginning-after-the-end',
        title: 'The Beginning After The End',
        origin: 'manhwa',
        koreanTitle: '끝이 아닌 시작',
        malayalamTitle: 'ദി ബിഗിനിംഗ് ആഫ്റ്റർ ദി എൻഡ്',
        malayalamSynopsis:
          'സമാനതകളില്ലാത്ത ശക്തിയുള്ള ഗ്രേ രാജാവ് മാന്ത്രികതയും ഡ്രാഗണുകളും നിറഞ്ഞ ഡിക്കാത്തെൻ ഭൂഖണ്ഡത്തിൽ ആർതർ ലെയ്‌വിൻ എന്ന പേരിൽ പുനർജനിക്കുന്നു.',
        author: 'TurtleMe',
        artist: 'Fuyuki23',
        type: 'webtoon',
        genres: ['Fantasy', 'Action', 'Adventure'],
        status: 'Ongoing',
        synopsis:
          'King Grey has unrivaled strength, wealth, and prestige in a world governed by martial ability. However, solitude lingers closely behind those with great power. Reincarnated into a new world filled with magic and monsters as Arthur Leywin, the king has a second chance to relive his life.',
        coverImage: buildProxiedImageUrl(
          'https://uploads.mangadex.org/covers/4ada20eb-085a-491a-8c49-477ab42014d7/4298e756-edf0-4bd6-9b83-340bfdb27771.jpg.512.jpg',
          'TBATE',
          'webtoon',
          'celestial'
        ),
        rating: 4.91,
        totalViews: 2740000,
        releaseDay: 'Friday',
        chaptersCount: 3,
        latestChapterId: 'ch-tbate-3',
        featured: false,
        mangadexId: '4ada20eb-085a-491a-8c49-477ab42014d7',
      },

      // ==================== JAPANESE MANGA (RTL PAGED) ====================
      {
        id: 'series-one-piece',
        slug: 'one-piece',
        title: 'One Piece',
        origin: 'manga',
        japaneseTitle: 'ワンピース',
        malayalamTitle: 'വൺ പീസ് (One Piece)',
        malayalamSynopsis:
          'കടൽക്കൊള്ളക്കാരുടെ രാജാവാകാൻ കൊതിക്കുന്ന മങ്കി ഡി. ലൂഫിയും സ്ട്രോ ഹാറ്റ് പൈറേറ്റ്സും ഇതിഹാസ നിധിയായ വൺ പീസ് തേടി ഗ്രാൻഡ് ലൈനിലൂടെ നടത്തുന്ന സാഹസിക യാത്ര.',
        author: 'Eiichiro Oda',
        artist: 'Eiichiro Oda',
        type: 'manga',
        genres: ['Shonen', 'Adventure', 'Action'],
        status: 'Ongoing',
        synopsis:
          'Gol D. Roger, the King of the Pirates, declared before his execution that his legendary treasure, One Piece, lay hidden at the end of the Grand Line. Monkey D. Luffy, a boy whose body gained the properties of rubber after eating the Gomu Gomu Devil Fruit, sets sail with the Straw Hat Crew.',
        coverImage: buildProxiedImageUrl(
          'https://cdn.myanimelist.net/images/manga/2/253146l.jpg',
          'ONE PIECE',
          'manga',
          'cyberpunk'
        ),
        rating: 4.98,
        totalViews: 6150000,
        releaseDay: 'Sunday',
        chaptersCount: 3,
        latestChapterId: 'ch-one-piece-3',
        featured: true,
        mangadexId: 'a1c7c817-4e59-43b7-9365-09675a149a6f',
        malId: 13,
      },
      {
        id: 'series-jujutsu-kaisen',
        slug: 'jujutsu-kaisen',
        title: 'Jujutsu Kaisen',
        origin: 'manga',
        japaneseTitle: '呪術廻戦',
        malayalamTitle: 'ജുജുത്സു കൈസെൻ (Jujutsu Kaisen)',
        malayalamSynopsis:
          'തന്റെ സുഹൃത്തുക്കളെ രക്ഷിക്കാൻ ശപിക്കപ്പെട്ട റയോമെൻ സുകുനയുടെ വിരൽ വിഴുങ്ങുന്ന യുജി ഇറ്റാഡോരി ടോക്കിയോ ജുജുത്സു ഹൈസ്കൂളിലെ മാന്ത്രിക പോരാട്ടങ്ങളിലേക്ക് പ്രവേശിക്കുന്നു.',
        author: 'Gege Akutami',
        artist: 'Gege Akutami',
        type: 'manga',
        genres: ['Shonen', 'Supernatural', 'Action'],
        status: 'Completed',
        synopsis:
          'Idly indulging in baseless paranormal activities with the Occult Club, high schooler Yuuji Itadori swallows a rotting cursed talisman—the finger of Ryomen Sukuna, the undisputed King of Curses—and is inducted into Tokyo Jujutsu High under Satoru Gojo.',
        coverImage: buildProxiedImageUrl(
          'https://cdn.myanimelist.net/images/manga/3/210341l.jpg',
          'JUJUTSU KAISEN',
          'manga',
          'shadow'
        ),
        rating: 4.92,
        totalViews: 4120000,
        releaseDay: 'Sunday',
        chaptersCount: 3,
        latestChapterId: 'ch-jujutsu-kaisen-3',
        featured: false,
        mangadexId: 'c52b2ce3-7f95-469c-96b0-479524fb7a1a',
        malId: 113138,
      },
      {
        id: 'series-berserk',
        slug: 'berserk',
        title: 'Berserk',
        origin: 'manga',
        japaneseTitle: 'ベルセルク',
        malayalamTitle: 'ബെർസെർക്ക് (Berserk)',
        malayalamSynopsis:
          'ഭീമാകാരമായ ഡ്രാഗൺ സ്ലേയർ വാളേന്തി ശപിക്കപ്പെട്ട മുദ്രയുമായി അന്ധകാര ശക്തികളോട് പോരാടുന്ന കറുത്ത വാൾപ്പയറ്റുകാരൻ ഗട്ട്സിന്റെ ഇതിഹാസ കാവ്യം.',
        author: 'Kentaro Miura',
        artist: 'Kentaro Miura / Studio Gaga',
        type: 'manga',
        genres: ['Seinen', 'Dark Fantasy', 'Action'],
        status: 'Ongoing',
        synopsis:
          'Guts, a former mercenary now known as the "Black Swordsman," is out for revenge. Marked with a deadly Brand of Sacrifice that attracts demonic apostles of the God Hand every night, he wields the colossal Dragon Slayer slab of iron across a dark medieval realm.',
        coverImage: buildProxiedImageUrl(
          'https://cdn.myanimelist.net/images/manga/1/157897l.jpg',
          'BERSERK',
          'manga',
          'mecha'
        ),
        rating: 4.99,
        totalViews: 5340000,
        releaseDay: 'Friday',
        chaptersCount: 3,
        latestChapterId: 'ch-berserk-3',
        featured: false,
        mangadexId: '801513ba-a712-498c-8f57-cae55b38cc92',
        malId: 2,
      },
      {
        id: 'series-chainsaw-man',
        slug: 'chainsaw-man',
        title: 'Chainsaw Man',
        origin: 'manga',
        japaneseTitle: 'チェンソーマン',
        malayalamTitle: 'ചെയിൻസോ മാൻ (Chainsaw Man)',
        malayalamSynopsis:
          'തന്റെ വളർത്തു ചെയിൻസോ ഡെവിൾ പൊച്ചീറ്റയുമായി ലയിച്ച് ചെയിൻസോ മാനായി മാറുന്ന ഡെൻജി പബ്ലിക് സേഫ്റ്റി ഡെവിൾ ഹണ്ടേഴ്സിന്റെ ഭാഗമാകുന്നു.',
        author: 'Tatsuki Fujimoto',
        artist: 'Tatsuki Fujimoto',
        type: 'manga',
        genres: ['Shonen', 'Action', 'Supernatural'],
        status: 'Ongoing',
        synopsis:
          'Denji has a simple dream—to live a happy and peaceful life. Betrayed by the yakuza he worked for to pay off his deceased father\'s debt, his pet devil Pochita merges with his heart, granting him the power to pull the cord on his chest and transform into Chainsaw Man.',
        coverImage: buildProxiedImageUrl(
          'https://cdn.myanimelist.net/images/manga/3/216464l.jpg',
          'CHAINSAW MAN',
          'manga',
          'cyberpunk'
        ),
        rating: 4.91,
        totalViews: 3890000,
        releaseDay: 'Tuesday',
        chaptersCount: 3,
        latestChapterId: 'ch-chainsaw-man-3',
        featured: false,
        mangadexId: 'a77742b1-befd-49a4-bff5-1ad4e6b0ef7b',
        malId: 116778,
      },
      {
        id: 'series-horimiya',
        slug: 'horimiya',
        title: 'Horimiya',
        origin: 'manga',
        japaneseTitle: 'ホリミヤ',
        malayalamTitle: 'ഹൊറിമിയ (Horimiya)',
        malayalamSynopsis:
          'സ്കൂളിൽ തിളങ്ങുന്ന ക്യോക്കോ ഹോറിയും ശാന്തനായ ഇസുമി മിയാമുറയും സ്കൂളിന് പുറത്തുള്ള തങ്ങളുടെ യഥാർത്ഥ രഹസ്യ ജീവിതം പരസ്പരം തിരിച്ചറിയുമ്പോൾ വിരിയുന്ന സൗഹൃദവും പ്രണയവും.',
        author: 'HERO',
        artist: 'Daisuke Hagiwara',
        type: 'manga',
        genres: ['Romance', 'Slice of Life', 'Comedy'],
        status: 'Completed',
        synopsis:
          'Although admired at school for her amiability and academic prowess, high school student Kyouko Hori has been hiding another side of herself. One afternoon, a pierced and tattooed boy brings her little brother home—revealing himself to be her quiet, bespectacled classmate Izumi Miyamura.',
        coverImage: buildProxiedImageUrl(
          'https://cdn.myanimelist.net/images/manga/2/169878l.jpg',
          'HORIMIYA',
          'manga',
          'cafe'
        ),
        rating: 4.88,
        totalViews: 1940000,
        releaseDay: 'Saturday',
        chaptersCount: 3,
        latestChapterId: 'ch-horimiya-3',
        featured: false,
        mangadexId: 'a25e46ec-30f7-4db6-89df-cacbc1d9a900',
        malId: 42451,
      },

      // ==================== CHINESE MANHUA ====================
      {
        id: 'series-tales-of-demons-and-gods',
        slug: 'tales-of-demons-and-gods',
        title: 'Tales of Demons and Gods',
        origin: 'manhua',
        chineseTitle: '妖神记',
        malayalamTitle: 'ടെയിൽസ് ഓഫ് ഡെമൺസ് ആൻഡ് ഗോഡ്സ്',
        malayalamSynopsis:
          'സേജ് എംപററുമായുള്ള യുദ്ധത്തിൽ കൊല്ലപ്പെട്ട നീ ലീ, ടെമ്പറൽ ഡെമൺ സ്പിരിറ്റ് ബുക്കിന്റെ സഹായത്തോടെ തന്റെ പതിമൂന്നാം വയസ്സിലേക്ക് പുനർജനിച്ച് ഗ്ലോറി സിറ്റിയെ രക്ഷിക്കാൻ ഒരുങ്ങുന്നു.',
        author: 'Mad Snail',
        artist: 'Jiang Ruotai',
        type: 'webtoon',
        genres: ['Cultivation', 'Martial Arts', 'Wuxia'],
        status: 'Ongoing',
        synopsis:
          'Killed by a Sage Emperor and reborn as his 13-year-old self through the mystical Temporal Demon Spirit Book, Nie Li is given a second chance to cultivate from the lowest bronze rank and protect Glory City and his beloved Ye Ziyun from destruction.',
        coverImage: buildProxiedImageUrl(
          'https://cdn.myanimelist.net/images/manga/1/191295l.jpg',
          'DEMONS AND GODS',
          'webtoon',
          'dungeon'
        ),
        rating: 4.86,
        totalViews: 2450000,
        releaseDay: 'Thursday',
        chaptersCount: 3,
        latestChapterId: 'ch-tales-of-demons-and-gods-3',
        featured: false,
        mangadexId: '812f9696-048f-496d-9ed4-84c99345d1fb',
        malId: 93357,
      },
      {
        id: 'series-martial-peak',
        slug: 'martial-peak',
        title: 'Martial Peak',
        origin: 'manhua',
        chineseTitle: '武炼巅峰',
        malayalamTitle: 'മാർഷ്യൽ പീക്ക് (Martial Peak)',
        malayalamSynopsis:
          'ഹൈ ഹെവൻ പവിലിയനിലെ തൂപ്പുകാരനായ യാങ് കൈ നിഗൂഢമായ കറുത്ത ഗ്രന്ഥം കണ്ടെത്തുകയും ആയോധനകലയുടെ കൊടുമുടിയിലേക്ക് കഠിനമായ പരീക്ഷണങ്ങളിലൂടെ കയറുകയും ചെയ്യുന്നു.',
        author: 'Momo',
        artist: 'Pikapi',
        type: 'webtoon',
        genres: ['Cultivation', 'Martial Arts', 'Action'],
        status: 'Ongoing',
        synopsis:
          'The journey to the martial peak is a lonely, solitary and long one. High Heaven Pavilion trial disciple and humble sweeper Yang Kai obtains a mysterious black stone book that sets him on a relentless path through the Star Boundary and Outer Universe.',
        coverImage: buildProxiedImageUrl(
          'https://uploads.mangadex.org/covers/b1461071-bfbb-43e7-a5b6-a7ba5904649f/d175e74d-4ab7-47f4-8196-371aa51d8c2d.png.512.jpg',
          'MARTIAL PEAK',
          'webtoon',
          'shadow'
        ),
        rating: 4.84,
        totalViews: 3110000,
        releaseDay: 'Saturday',
        chaptersCount: 3,
        latestChapterId: 'ch-martial-peak-3',
        featured: false,
        mangadexId: 'b1461071-bfbb-43e7-a5b6-a7ba5904649f',
      },
      {
        id: 'series-apotheosis',
        slug: 'apotheosis',
        title: 'Apotheosis',
        origin: 'manhua',
        chineseTitle: '百炼成神',
        malayalamTitle: 'അപ്പോത്തിയോസിസ് (Apotheosis)',
        malayalamSynopsis:
          'തന്റെ കുടുംബത്തിന്റെ പതനത്തിന് ശേഷം അടിമയാക്കപ്പെട്ട ലുവോ സെങ്, പുരാതന ദൈവിക ശുദ്ധീകരണ ഗ്രന്ഥത്തിലൂടെ സ്വന്തം ശരീരത്തെ തന്നെ ഒരു ദിവ്യ ആയുധമായി മാറ്റിയെടുക്കുന്നു.',
        author: 'Ranzai Studio',
        artist: 'Ranzai Studio',
        type: 'webtoon',
        genres: ['Cultivation', 'Wuxia', 'Fantasy'],
        status: 'Ongoing',
        synopsis:
          'Luo Zheng, formerly the young master of the Luo family, was degraded to a humble family target dummy after his father was betrayed. Through a supreme ancient cauldron refinement scripture left behind by his father, he refines his mortal flesh into an indestructible divine artifact.',
        coverImage: buildProxiedImageUrl(
          'https://uploads.mangadex.org/covers/cdae359d-5fa9-4d4e-b11a-69dd32b09742/601a10fc-61aa-4102-9387-f6bf613fb934.jpg.512.jpg',
          'APOTHEOSIS',
          'webtoon',
          'celestial'
        ),
        rating: 4.81,
        totalViews: 1890000,
        releaseDay: 'Monday',
        chaptersCount: 3,
        latestChapterId: 'ch-apotheosis-3',
        featured: false,
        mangadexId: 'cdae359d-5fa9-4d4e-b11a-69dd32b09742',
      },
    ];

    // Seed chapters for all 12 real titles
    this.createChaptersForSeries('series-solo-leveling', 'Solo Leveling', 'webtoon', [
      {
        num: 1,
        title: 'Episode 1: The Weakest E-Rank Hunter',
        dialogues: [
          'Hunter Sung Jinwoo, E-Rank. Don\'t fall behind the raid party!',
          'A hidden Double Dungeon inside a D-Rank gate?!',
          'The Cartenon Temple Commandments: First, Worship the Lord.',
          'Everyone get down! The Giant Statue\'s eyes just moved!',
        ],
      },
      {
        num: 2,
        title: 'Episode 2: The Secret Player Awakening',
        dialogues: [
          '[You have completed all requirements of the Secret Quest: Courage of the Weak.]',
          '[Will you accept as a Player? You have 0.02 seconds remaining.]',
          'I survived the altar... and this floating system window only appears to me.',
          '[Daily Quest: Strength Training has arrived. Penalty for failure: Survival Zone.]',
        ],
      },
      {
        num: 3,
        title: 'Episode 3: Arise, Monarch of Shadows',
        dialogues: [
          'Blood-Red Commander Igris has fallen. Job Change Quest complete.',
          'Class Transfer: Necromancer -> The Monarch of Shadows.',
          'Select your command keyword for Shadow Extraction...',
          '"ARISE."',
        ],
      },
    ]);

    this.createChaptersForSeries('series-omniscient-reader', "Omniscient Reader's Viewpoint", 'webtoon', [
      {
        num: 1,
        title: 'Episode 1: Prologue — Three Ways to Survive',
        dialogues: [
          '[The free service of planetary system 8612 has been terminated.]',
          '[The main scenario has arrived.]',
          'A Dokkaebi appeared inside Cabin 3807 of the Seoul Subway!',
          'I am the sole reader who finished all 3,149 chapters of this world.',
        ],
      },
      {
        num: 2,
        title: 'Episode 2: Main Scenario #1 — Proof of Value',
        dialogues: [
          '[Kill one or more living organisms within 30 minutes.]',
          '[The Constellation "Secretive Plotter" is watching your choice.]',
          'Wait—he didn\'t say it had to be a human! Look at the insect container!',
          '[You have achieved the First Kill bonus.]',
        ],
      },
      {
        num: 3,
        title: 'Episode 3: Encounter on Oksu Bridge',
        dialogues: [
          'Yoo Joonghyuk, the 3rd regression protagonist, is standing right there.',
          '[Exclusive Skill: "Omniscient Reader\'s Viewpoint" Stage 1 activated.]',
          '"Tell me, Prophet... how did you survive Cabin 3807?"',
          'Let us make a pact to clear the Star Stream together.',
        ],
      },
    ]);

    this.createChaptersForSeries('series-tower-of-god', 'Tower of God', 'webtoon', [
      {
        num: 1,
        title: 'Episode 1: Headon\'s 1st Floor Ball Test',
        dialogues: [
          'Welcome to the Tower, Twenty-Fifth Bam.',
          'To ascend to the next floor, you must pop the White Steel Eel\'s ball.',
          'Princess Yuri Jahad! Why is a High Ranker on the First Floor?!',
          'Take the Black March needle, boy. Show me a miracle.',
        ],
      },
      {
        num: 2,
        title: 'Episode 2: Evankhell\'s 2nd Floor Culling',
        dialogues: [
          '400 Regulars remain. Reduce your numbers to 200 in ten minutes!',
          'That blue-haired strategist... Khun Aguero Agnis.',
          'And a giant crocodile calling everyone "Turtles"—Rak Wraithraiser!',
          'Team Bam-Khun-Rak is officially formed.',
        ],
      },
      {
        num: 3,
        title: 'Episode 3: The Crown Game Begins',
        dialogues: [
          'Whoever holds the throne at the final round passes the Floor of Test immediately!',
          'Shinsu is responding to Bam without a Pocket contract!',
          'Protect the crown at all costs!',
        ],
      },
    ]);

    this.createChaptersForSeries('series-tbate', 'The Beginning After The End', 'webtoon', [
      {
        num: 1,
        title: 'Episode 1: The Light at the End of the Tunnel',
        dialogues: [
          'In my past life as King Grey, I stood at the pinnacle of martial might.',
          'Wait... why am I an infant being held by two adventurers?!',
          'Welcome to the continent of Dicathen, Arthur Leywin.',
        ],
      },
      {
        num: 2,
        title: 'Episode 2: Awakening the Mana Core',
        dialogues: [
          'By focusing ki breathing on ambient mana particles, the core condenses...',
          'BOOM! The entire house shook! Did a three-year-old just awaken a mana core?!',
          'Quadra-Elemental affinity unlocked.',
        ],
      },
      {
        num: 3,
        title: 'Episode 3: Sylvia\'s Dragon Will',
        dialogues: [
          'Fear not, little one. Though my time fades, my Dragon Will shall guide you.',
          'Take this feathered bond—Sylvie will hatch when you are ready.',
          'Realmheart physique inherited.',
        ],
      },
    ]);

    this.createChaptersForSeries('series-one-piece', 'One Piece', 'manga', [
      {
        num: 1,
        title: 'Chapter 1: Romance Dawn — The Dawn of the Adventure',
        dialogues: [
          'My wealth and treasures? If you want it, I\'ll let you have it... search for it!',
          'Shanks! Your arm—!!',
          '"It\'s just an arm, Luffy. I bet it on the New Era."',
          'I\'m going to become the King of the Pirates!',
        ],
      },
      {
        num: 2,
        title: 'Chapter 2: They Call Him "Straw Hat Luffy"',
        dialogues: [
          'Pirates Evaluator? No, I\'m looking for Pirate Hunter Roronoa Zoro!',
          'Gum-Gum... PISTOL!!',
          'Join my crew, Zoro! Let\'s sail to the Grand Line!',
        ],
      },
      {
        num: 3,
        title: 'Chapter 3: Enter "Pirate Hunter Zoro"',
        dialogues: [
          'Three-Sword Style: Oni Giri!!',
          'If you ever get in the way of my ambition to be the World\'s Greatest Swordsman...',
          'Welcome aboard the first mate of the Straw Hat Pirates!',
        ],
      },
    ]);

    this.createChaptersForSeries('series-jujutsu-kaisen', 'Jujutsu Kaisen', 'manga', [
      {
        num: 1,
        title: 'Chapter 1: Ryomen Sukuna',
        dialogues: [
          '"Yuji... you are strong, so help others when you can."',
          'A Special Grade cursed object?! The seal has been unwrapped!',
          'I just need Cursed Energy to save Fushiguro, right?! *Swallows Sukuna\'s Finger*',
          'BLACK FLASH!!',
        ],
      },
      {
        num: 2,
        title: 'Chapter 2: Secret Execution',
        dialogues: [
          'My name is Satoru Gojo, in charge of the first-years at Jujutsu High.',
          'Let me switch with Sukuna for ten seconds. Don\'t worry, I\'m the strongest.',
          'You have two choices: die now, or consume all twenty fingers first.',
        ],
      },
      {
        num: 3,
        title: 'Chapter 3: For Myself — Domain Expansion',
        dialogues: [
          'Domain Expansion: Unlimited Void.',
          'Everything you perceive is infinite information—you cannot move a muscle.',
          'Cursed Technique Reversal: Red!',
        ],
      },
    ]);

    this.createChaptersForSeries('series-berserk', 'Berserk', 'manga', [
      {
        num: 1,
        title: 'Chapter 1: The Black Swordsman',
        dialogues: [
          'That thing was too big to be called a sword. Too big, too thick, too heavy, and too rough.',
          'It was more like a large hunk of iron.',
          'The Brand on my neck is bleeding again... Apostles are near.',
        ],
      },
      {
        num: 2,
        title: 'Chapter 2: The Brand of Sacrifice',
        dialogues: [
          'When night falls, the spirits of the interstice swarm toward the Brand.',
          'Out of the way, Puck! My cannon arm isn\'t made for warning shots!',
          'Tell your masters in the God Hand that the Black Swordsman is coming.',
        ],
      },
      {
        num: 3,
        title: 'Chapter 3: The Guardians of Desire',
        dialogues: [
          'In this world, is the destiny of mankind controlled by some transcendental entity?',
          'At least it is true that man has no control, even over his own will.',
          'CLAAANG!!',
        ],
      },
    ]);

    this.createChaptersForSeries('series-chainsaw-man', 'Chainsaw Man', 'manga', [
      {
        num: 1,
        title: 'Chapter 1: Dog & Chainsaw',
        dialogues: [
          'Pochita, if we pay off this debt today, maybe we can afford bread with jam!',
          '"Denji... I always loved listening to your dreams. Give me your heart in exchange."',
          'VRRRRMMMMM!! Pull the starter cord!',
        ],
      },
      {
        num: 2,
        title: 'Chapter 2: The Place Where Pochita Is',
        dialogues: [
          'I am Makima, a Public Safety Devil Hunter.',
          'You have two options: be put down as a Devil, or be kept as my human.',
          'What do you put on toast at Public Safety? Butter AND jam?! I\'m in!',
        ],
      },
      {
        num: 3,
        title: 'Chapter 3: Arrival in Tokyo — Power the Blood Fiend',
        dialogues: [
          'Bow before me, human! My name is Power, the Blood Fiend!',
          'Aki Hayakawa\'s Special Division 4 patrol begins now.',
          'Kon.',
        ],
      },
    ]);

    this.createChaptersForSeries('series-horimiya', 'Horimiya', 'manga', [
      {
        num: 1,
        title: 'Chapter 1: A Tiny Happenstance',
        dialogues: [
          'Wait... you brought Souta home, but who are you with all those piercings?!',
          '"Hori-san? It\'s me, Miyamura from class 3-1."',
          'EHHHHH?! You\'re the quiet guy with glasses and long hair?!',
        ],
      },
      {
        num: 2,
        title: 'Chapter 2: You Wear More Than One Face',
        dialogues: [
          'This is our secret after-school side that nobody at Katagiri High knows.',
          'Miyamura came over again today to help make dinner with Souta.',
          'Somehow, having him here feels warmer than anything.',
        ],
      },
      {
        num: 3,
        title: 'Chapter 3: Underneath the Blossoms',
        dialogues: [
          'Did Miyamura just cut his hair?! Every girl in class is staring!',
          '"Even if the sky falls, I\'m glad I met you, Hori-san."',
        ],
      },
    ]);

    this.createChaptersForSeries('series-tales-of-demons-and-gods', 'Tales of Demons and Gods', 'webtoon', [
      {
        num: 1,
        title: 'Episode 1: Reborn Through the Temporal Demon Spirit Book',
        dialogues: [
          'The Sage Emperor\'s Golden Crow array shattered my soul... wait, where am I?',
          'Holy Orchid Institute?! I am thirteen years old again, before Glory City fell!',
          'With my past-life memories of divine inscriptions, I will rewrite history!',
        ],
      },
      {
        num: 2,
        title: 'Episode 2: Defying Teacher Shen Xiu',
        dialogues: [
          'The Sacred Family thinks commoners cannot reach Legend Rank?',
          'Watch as I fuse the Fanged Panda and Shadow Devil Demon Spirits!',
          'Soul Realm surging past 100 Soul Force in a single afternoon!',
        ],
      },
      {
        num: 3,
        title: 'Episode 3: The Ancient Orchid City Ruins',
        dialogues: [
          'Inside the Purple Mist Jungle lies the Nightmare Demon Pot.',
          'Ye Ziyun, stay behind my array formation!',
          'Bronze 5-Star breakthrough achieved!',
        ],
      },
    ]);

    this.createChaptersForSeries('series-martial-peak', 'Martial Peak', 'webtoon', [
      {
        num: 1,
        title: 'Episode 1: The Wordless Black Book',
        dialogues: [
          'Three years as a trial disciple at High Heaven Pavilion, beaten every week...',
          'Why is this black stone pillow emitting golden skeletal meridians?!',
          'Unyielding Golden Skeleton refined! Tempered Body 4th Stage!',
        ],
      },
      {
        num: 2,
        title: 'Episode 2: Nine Star Hegemon Fist',
        dialogues: [
          'Challenger Yang Kai steps into the outer sect arena!',
          'One punch shattered a 6th-Stage disciple\'s defensive qi?!',
          'True Yang Secret Art ignited!',
        ],
      },
      {
        num: 3,
        title: 'Episode 3: Entering the Black Wind Mountain Range',
        dialogues: [
          'A Fourth-Order Monster Core and Nine-Leaf Blood Lotus!',
          'Senior Sister Su Yan\'s Ice Phoenix Qi is resonating with my True Yang Yuan Qi!',
        ],
      },
    ]);

    this.createChaptersForSeries('series-apotheosis', 'Apotheosis', 'webtoon', [
      {
        num: 1,
        title: 'Episode 1: Refined as a Living Artifact',
        dialogues: [
          'Used as a flesh sandbag by the inner sect disciples of 青云宗 (Qingyun Sect)...',
          'The mysterious gold-threaded scripture in my mind is absorbing every blow!',
          'My body itself has tempered into a Lower-Grade Spirit Weapon!',
        ],
      },
      {
        num: 2,
        title: 'Episode 2: The Primordial Chaos Furnace',
        dialogues: [
          'Inside my dantian, a miniature starry universe is awakening!',
          'Dragon Scales Condensing: 100 Dragons of Raw Strength!',
        ],
      },
      {
        num: 3,
        title: 'Episode 3: Breaking the Purgatory Mountain Trial',
        dialogues: [
          'Luo Zheng has cleared the 9th Purgatory Pillar in a single breath!',
          'Even the Sect Master is rising from her throne in shock!',
        ],
      },
    ]);

    // Seed Comments
    this.comments = [
      {
        id: 'c-1',
        chapterId: 'ch-solo-leveling-1',
        seriesId: 'series-solo-leveling',
        userId: 'usr_demo_1',
        username: 'ShadowMonarch_99',
        content:
          'Solo Leveling in vertical webtoon scroll is unmatched! The Double Dungeon statue grin still gives me chills every single reread.',
        createdAt: '1 hour ago',
        upvotes: 142,
        spoiler: false,
      },
      {
        id: 'c-2',
        chapterId: 'ch-solo-leveling-1',
        seriesId: 'series-solo-leveling',
        userId: 'usr_demo_2',
        username: 'IgrisKnight_401',
        content:
          'Wait until Episode 3 when he unlocks the Shadow Extraction command after defeating Blood-Red Commander Igris!',
        createdAt: '3 hours ago',
        upvotes: 88,
        spoiler: true,
      },
      {
        id: 'c-3',
        chapterId: 'ch-one-piece-1',
        seriesId: 'series-one-piece',
        userId: 'usr_demo_3',
        username: 'StrawHat_Navigator',
        content:
          'Reading Romance Dawn in authentic RTL paged mode feels just like holding the physical Shonen Jump tankobon volume.',
        createdAt: '5 hours ago',
        upvotes: 95,
        spoiler: false,
      },
      {
        id: 'c-4',
        chapterId: 'ch-omniscient-reader-1',
        seriesId: 'series-omniscient-reader',
        userId: 'usr_demo_4',
        username: 'UrielConstellation',
        content:
          '[The Constellation "Demon-like Judge of Fire" sponsors 500 coins for this platform!]',
        createdAt: '1 day ago',
        upvotes: 119,
        spoiler: false,
      },
    ];

    // Seed Community Requests
    this.requests = [
      {
        id: 'req-1',
        title: 'Return of the Mount Hua Sect (화산귀환)',
        type: 'webtoon',
        author: 'Biga / LICO',
        requestedBy: 'PlumBlossomSword_702',
        votes: 284,
        reason:
          'Chung Myung is the greatest murim protagonist ever written. Need Season 2 chapters added!',
        status: 'In Review',
        createdAt: '2 days ago',
      },
      {
        id: 'req-2',
        title: 'Vagabond (バガボンド)',
        type: 'manga',
        author: 'Takehiko Inoue',
        requestedBy: 'MusashiRonin_310',
        votes: 241,
        reason:
          'Inoue\'s brushwork in double-page spread RTL mode would look breathtaking.',
        status: 'Pending',
        createdAt: '4 days ago',
      },
      {
        id: 'req-3',
        title: 'Nano Machine (나노마신)',
        type: 'webtoon',
        author: 'Han-Joong-Wol-Ya',
        requestedBy: 'DemonicCultLeader_55',
        votes: 196,
        reason:
          'Sci-fi nanotech combined with martial arts cultivation—peak Korean manhwa action!',
        status: 'Acquired',
        createdAt: '1 week ago',
      },
    ];
  }

  private createChaptersForSeries(
    seriesId: string,
    seriesTitle: string,
    type: 'webtoon' | 'manga',
    chapterDefs: { num: number; title: string; dialogues: string[] }[]
  ) {
    chapterDefs.forEach((chDef) => {
      const chapterId = `ch-${seriesId.replace('series-', '')}-${chDef.num}`;
      const pagesCount = type === 'webtoon' ? 8 : 10;
      const pages = Array.from({ length: pagesCount }, (_, i) => {
        const pageNum = i + 1;
        const dialogue = chDef.dialogues[i % chDef.dialogues.length];
        return {
          pageNumber: pageNum,
          imageUrl: createReaderPanelSvg(seriesTitle, chDef.num, pageNum, type, dialogue),
          caption: `Panel ${pageNum}`,
        };
      });

      this.chapters.push({
        id: chapterId,
        seriesId,
        chapterNumber: chDef.num,
        title: chDef.title,
        releaseDate: `${chDef.num * 2} days ago`,
        views: 42500 * chDef.num,
        pages,
      });
    });
  }

  // Series methods
  public getSeries(params?: {
    q?: string;
    type?: string;
    origin?: string;
    genre?: string;
    status?: string;
    sort?: string;
  }): Series[] {
    this.loadPersistedState();
    let result = [...this.series];

    if (params?.q) {
      const q = params.q.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.author.toLowerCase().includes(q) ||
          (s.malayalamTitle && s.malayalamTitle.toLowerCase().includes(q)) ||
          (s.koreanTitle && s.koreanTitle.toLowerCase().includes(q)) ||
          (s.japaneseTitle && s.japaneseTitle.toLowerCase().includes(q)) ||
          (s.chineseTitle && s.chineseTitle.toLowerCase().includes(q)) ||
          s.genres.some((g) => g.toLowerCase().includes(q))
      );
    }

    if (params?.type && params.type !== 'all') {
      if (
        params.type === 'manhwa' ||
        params.type === 'manga' ||
        params.type === 'manhua'
      ) {
        result = result.filter(
          (s) => s.origin === params.type || s.type === params.type
        );
      } else {
        result = result.filter((s) => s.type === params.type);
      }
    }

    if (params?.origin && params.origin !== 'all') {
      result = result.filter((s) => s.origin === params.origin);
    }

    if (params?.genre && params.genre !== 'all') {
      result = result.filter((s) =>
        s.genres.some((g) => g.toLowerCase() === params.genre?.toLowerCase())
      );
    }

    if (params?.status && params.status !== 'all') {
      result = result.filter((s) => s.status.toLowerCase() === params.status?.toLowerCase());
    }

    if (params?.sort) {
      if (params.sort === 'popular') {
        result.sort((a, b) => b.totalViews - a.totalViews);
      } else if (params.sort === 'rating') {
        result.sort((a, b) => b.rating - a.rating);
      } else if (params.sort === 'title') {
        result.sort((a, b) => a.title.localeCompare(b.title));
      }
    }

    return result;
  }

  public getSeriesBySlug(slug: string): Series | undefined {
    this.loadPersistedState();
    // Support legacy aliases seamlessly
    if (slug === 'shadow-sovereign' || slug === 'series-shadow-sovereign') {
      return this.series.find((s) => s.slug === 'solo-leveling');
    }
    return this.series.find((s) => s.slug === slug || s.id === slug);
  }

  public getSeriesById(id: string): Series | undefined {
    this.loadPersistedState();
    if (id === 'series-shadow-sovereign') {
      return this.series.find((s) => s.id === 'series-solo-leveling');
    }
    return this.series.find((s) => s.id === id);
  }

  public addSeries(series: Series) {
    this.loadPersistedState();
    this.deletedSeriesIds.delete(series.id);
    const existingIdx = this.series.findIndex((s) => s.id === series.id);
    if (existingIdx >= 0) {
      this.series[existingIdx] = { ...this.series[existingIdx], ...series };
    } else {
      this.series.unshift(series);
    }

    // Create 1 starter episode if none exist yet for this series so it's immediately readable
    const existingChs = this.chapters.filter((c) => c.seriesId === series.id);
    if (existingChs.length === 0) {
      const chId = `ch-${series.slug || series.id.replace('series-', '')}-1`;
      const starterCh: Chapter = {
        id: chId,
        seriesId: series.id,
        chapterNumber: 1,
        title: `${series.type === 'webtoon' ? 'Episode' : 'Chapter'} 1: Prologue`,
        releaseDate: 'Just now',
        views: 1,
        pages: Array.from({ length: 6 }, (_, i) => ({
          pageNumber: i + 1,
          imageUrl: createReaderPanelSvg(
            series.title,
            1,
            i + 1,
            series.type,
            `Welcome to ${series.title}`
          ),
          caption: `Panel ${i + 1}`,
        })),
      };
      this.chapters.push(starterCh);
      this.chapterOverrides.set(starterCh.id, starterCh);
      series.chaptersCount = 1;
      series.latestChapterId = starterCh.id;
    }

    this.seriesOverrides.set(series.id, series);
    this.savePersistedState();
    return series;
  }

  public importInternetSeries(data: {
    title: string;
    author: string;
    origin: SeriesOrigin;
    type: SeriesType;
    genres: string[];
    status: 'Ongoing' | 'Completed';
    rating: number;
    synopsis: string;
    coverImage?: string;
    mangadexId?: string;
    malId?: number;
  }): Series {
    this.loadPersistedState();
    const slug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const existing = this.series.find((s) => s.slug === slug);
    if (existing) {
      return existing;
    }

    const seriesId = `series-${slug}-${Date.now().toString().slice(-4)}`;
    const newSeries: Series = {
      id: seriesId,
      slug,
      title: data.title,
      origin: data.origin,
      author: data.author,
      artist: data.author,
      type: data.type,
      genres: data.genres,
      status: data.status,
      synopsis: data.synopsis,
      coverImage:
        data.coverImage ||
        createCoverSvg(data.title.slice(0, 20).toUpperCase(), 'shadow', data.type),
      rating: data.rating,
      totalViews: 125000,
      releaseDay: 'Friday',
      chaptersCount: 3,
      latestChapterId: `ch-${seriesId.replace('series-', '')}-3`,
      featured: false,
      mangadexId: data.mangadexId,
      malId: data.malId,
    };

    this.series.unshift(newSeries);
    this.seriesOverrides.set(seriesId, newSeries);

    this.createChaptersForSeries(seriesId, data.title, data.type, [
      {
        num: 1,
        title: `${data.type === 'webtoon' ? 'Episode' : 'Chapter'} 1: Awakening`,
        dialogues: [
          `Welcome to the world of ${data.title}!`,
          'A new destiny unfolds across the horizon...',
          'The power hidden within finally stirs!',
        ],
      },
      {
        num: 2,
        title: `${data.type === 'webtoon' ? 'Episode' : 'Chapter'} 2: First Trial`,
        dialogues: [
          'They underestimated our resolve.',
          'Break through the barrier with everything you have!',
          'Victory belongs to those who advance!',
        ],
      },
      {
        num: 3,
        title: `${data.type === 'webtoon' ? 'Episode' : 'Chapter'} 3: Sovereign Path`,
        dialogues: [
          'The true test begins on the next floor.',
          'Prepare for the upcoming battle!',
        ],
      },
    ]);

    this.chapters
      .filter((c) => c.seriesId === seriesId)
      .forEach((c) => this.chapterOverrides.set(c.id, c));
    this.savePersistedState();

    return newSeries;
  }

  public updateSeries(id: string, updates: Partial<Series>): Series | undefined {
    this.loadPersistedState();
    const index = this.series.findIndex((s) => s.id === id || s.slug === id);
    if (index === -1) return undefined;

    const current = this.series[index];
    const updated: Series = {
      ...current,
      ...updates,
      id: current.id,
      slug: updates.slug || current.slug,
      title: updates.title !== undefined ? updates.title : current.title,
      type: updates.type === 'manga' || updates.type === 'webtoon' ? updates.type : current.type,
      origin:
        updates.origin === 'manhwa' || updates.origin === 'manga' || updates.origin === 'manhua'
          ? updates.origin
          : current.origin,
      status:
        updates.status === 'Ongoing' || updates.status === 'Completed'
          ? updates.status
          : current.status,
      releaseDay: updates.releaseDay || current.releaseDay,
      author: updates.author !== undefined ? updates.author : current.author,
      artist: updates.artist !== undefined ? updates.artist : current.artist,
      genres:
        Array.isArray(updates.genres) && updates.genres.length > 0
          ? updates.genres
          : current.genres,
      synopsis: updates.synopsis !== undefined ? updates.synopsis : current.synopsis,
      coverImage: updates.coverImage || current.coverImage,
      featured: updates.featured !== undefined ? Boolean(updates.featured) : current.featured,
      rating:
        updates.rating !== undefined && !Number.isNaN(Number(updates.rating))
          ? Math.max(0, Math.min(5, Number(updates.rating)))
          : current.rating,
      malayalamTitle:
        updates.malayalamTitle !== undefined ? updates.malayalamTitle : current.malayalamTitle,
      malayalamSynopsis:
        updates.malayalamSynopsis !== undefined
          ? updates.malayalamSynopsis
          : current.malayalamSynopsis,
    };

    this.series[index] = updated;
    this.seriesOverrides.set(updated.id, updated);
    this.deletedSeriesIds.delete(updated.id);
    this.savePersistedState();
    return updated;
  }

  public deleteSeries(id: string): boolean {
    this.loadPersistedState();
    const s = this.getSeriesById(id) || this.getSeriesBySlug(id);
    if (!s) return false;
    const seriesId = s.id;
    this.series = this.series.filter((item) => item.id !== seriesId);
    const removedChapters = this.chapters.filter((ch) => ch.seriesId === seriesId);
    removedChapters.forEach((ch) => {
      this.deletedChapterIds.add(ch.id);
      this.chapterOverrides.delete(ch.id);
    });
    this.chapters = this.chapters.filter((ch) => ch.seriesId !== seriesId);
    this.comments = this.comments.filter((comm) => comm.seriesId !== seriesId);
    this.seriesOverrides.delete(seriesId);
    this.deletedSeriesIds.add(seriesId);
    this.savePersistedState();
    return true;
  }

  // Chapter methods
  public getChapterById(
    chapterId: string
  ): (Chapter & { series?: Series; prevChapterId?: string; nextChapterId?: string }) | undefined {
    this.loadPersistedState();
    // Support legacy chapter ID alias seamlessly
    const normalizedId = chapterId.startsWith('ch-shadow-')
      ? chapterId.replace('ch-shadow-', 'ch-solo-leveling-')
      : chapterId;

    const chapter = this.chapters.find((c) => c.id === normalizedId);
    if (!chapter) return undefined;

    const series = this.getSeriesById(chapter.seriesId);
    const seriesChapters = this.chapters
      .filter((c) => c.seriesId === chapter.seriesId)
      .sort((a, b) => a.chapterNumber - b.chapterNumber);

    const currentIndex = seriesChapters.findIndex((c) => c.id === normalizedId);
    const prevChapterId = currentIndex > 0 ? seriesChapters[currentIndex - 1].id : undefined;
    const nextChapterId =
      currentIndex < seriesChapters.length - 1 ? seriesChapters[currentIndex + 1].id : undefined;

    return {
      ...chapter,
      series,
      prevChapterId,
      nextChapterId,
    };
  }

  public getChaptersBySeriesId(seriesId: string): Chapter[] {
    this.loadPersistedState();
    const normalizedSeriesId =
      seriesId === 'series-shadow-sovereign' ? 'series-solo-leveling' : seriesId;
    return this.chapters
      .filter((c) => c.seriesId === normalizedSeriesId)
      .sort((a, b) => a.chapterNumber - b.chapterNumber);
  }

  public syncSeriesChaptersWithLiveFeed(
    seriesId: string,
    liveChapters: DiscoveredMangaDexChapter[]
  ): Chapter[] {
    this.loadPersistedState();
    const normalizedSeriesId =
      seriesId === 'series-shadow-sovereign' ? 'series-solo-leveling' : seriesId;
    const series = this.getSeriesById(normalizedSeriesId);
    if (!series || liveChapters.length === 0) {
      return this.getChaptersBySeriesId(normalizedSeriesId);
    }

    const baseSlug = normalizedSeriesId.replace('series-', '');
    const existingForSeries = this.getChaptersBySeriesId(normalizedSeriesId);

    liveChapters.forEach((live, idx) => {
      const slotNum = idx + 1;
      const chapterId = `ch-${baseSlug}-${slotNum}`;
      if (this.deletedChapterIds.has(chapterId)) {
        return;
      }

      const existing = existingForSeries.find(
        (c) => c.id === chapterId || c.chapterNumber === slotNum
      );

      if (existing) {
        if (!existing.hasCustomPages) {
          existing.mangadexChapterId = live.mangadexChapterId;
          existing.language = live.language;
          existing.pagesCount = live.pagesCount;
        }
        if (!existing.isCustomEdited) {
          if (live.releaseDate && live.releaseDate !== 'Recent') {
            existing.releaseDate = live.releaseDate;
          }
          if (slotNum > 3 && live.title) {
            existing.title = live.title;
          }
        }
      } else {
        const defaultPages = Array.from({ length: 8 }, (_, i) => ({
          pageNumber: i + 1,
          imageUrl: createReaderPanelSvg(
            series.title,
            slotNum,
            i + 1,
            series.type,
            live.title
          ),
          caption: `Panel ${i + 1}`,
        }));

        this.chapters.push({
          id: chapterId,
          seriesId: normalizedSeriesId,
          chapterNumber: slotNum,
          title: live.title,
          releaseDate: live.releaseDate,
          views: Math.max(12000, 95000 - slotNum * 2100),
          pages: defaultPages,
          mangadexChapterId: live.mangadexChapterId,
          language: live.language,
          pagesCount: live.pagesCount,
        });
      }
    });

    const updatedChapters = this.getChaptersBySeriesId(normalizedSeriesId);
    series.chaptersCount = updatedChapters.length;
    if (updatedChapters.length > 0) {
      series.latestChapterId = updatedChapters[updatedChapters.length - 1].id;
    }

    return updatedChapters;
  }

  public addChapter(chapter: Chapter) {
    this.loadPersistedState();
    this.deletedChapterIds.delete(chapter.id);
    const existingIdx = this.chapters.findIndex((c) => c.id === chapter.id);
    if (existingIdx >= 0) {
      this.chapters[existingIdx] = chapter;
    } else {
      this.chapters.push(chapter);
    }
    this.chapterOverrides.set(chapter.id, chapter);
    const series = this.getSeriesById(chapter.seriesId);
    if (series) {
      const seriesChs = this.getChaptersBySeriesId(chapter.seriesId);
      series.chaptersCount = seriesChs.length;
      series.latestChapterId = seriesChs[seriesChs.length - 1]?.id || chapter.id;
      this.seriesOverrides.set(series.id, series);
    }
    this.savePersistedState();
    return chapter;
  }

  public updateChapter(
    chapterId: string,
    updates: {
      chapterNumber?: number;
      title?: string;
      releaseDate?: string;
      panelUrls?: string[];
      pages?: Chapter['pages'];
    }
  ): Chapter | undefined {
    this.loadPersistedState();
    const index = this.chapters.findIndex((c) => c.id === chapterId);
    if (index === -1) return undefined;

    const current = this.chapters[index];
    let updatedPages = current.pages;
    let hasCustomPages = current.hasCustomPages;

    if (Array.isArray(updates.panelUrls) && updates.panelUrls.length > 0) {
      updatedPages = updates.panelUrls.map((url, idx) => ({
        pageNumber: idx + 1,
        imageUrl: url.trim(),
        caption: `Panel ${idx + 1}`,
      }));
      hasCustomPages = true;
    } else if (Array.isArray(updates.pages) && updates.pages.length > 0) {
      updatedPages = updates.pages.map((p, idx) => ({
        pageNumber: idx + 1,
        imageUrl: p.imageUrl,
        caption: p.caption || `Panel ${idx + 1}`,
      }));
      hasCustomPages = true;
    }

    const updated: Chapter = {
      ...current,
      chapterNumber:
        updates.chapterNumber !== undefined && !Number.isNaN(Number(updates.chapterNumber))
          ? Number(updates.chapterNumber)
          : current.chapterNumber,
      title: updates.title !== undefined && updates.title.trim() ? updates.title.trim() : current.title,
      releaseDate:
        updates.releaseDate !== undefined && updates.releaseDate.trim()
          ? updates.releaseDate.trim()
          : current.releaseDate,
      pages: updatedPages,
      pagesCount: updatedPages.length,
      hasCustomPages,
      isCustomEdited: true,
    };

    this.chapters[index] = updated;
    this.chapterOverrides.set(updated.id, updated);
    this.deletedChapterIds.delete(updated.id);

    const series = this.getSeriesById(updated.seriesId);
    if (series) {
      const seriesChs = this.getChaptersBySeriesId(updated.seriesId);
      series.chaptersCount = seriesChs.length;
      if (seriesChs.length > 0) {
        series.latestChapterId = seriesChs[seriesChs.length - 1].id;
      }
      this.seriesOverrides.set(series.id, series);
    }

    this.savePersistedState();
    return updated;
  }

  public deleteChapter(chapterId: string): boolean {
    this.loadPersistedState();
    const chapter = this.chapters.find((c) => c.id === chapterId);
    if (!chapter) return false;
    this.chapters = this.chapters.filter((c) => c.id !== chapterId);
    this.chapterOverrides.delete(chapterId);
    this.deletedChapterIds.add(chapterId);
    const series = this.getSeriesById(chapter.seriesId);
    if (series) {
      const remaining = this.getChaptersBySeriesId(chapter.seriesId);
      series.chaptersCount = remaining.length;
      series.latestChapterId =
        remaining.length > 0 ? remaining[remaining.length - 1].id : undefined;
      this.seriesOverrides.set(series.id, series);
    }
    this.savePersistedState();
    return true;
  }

  // Comments
  public getComments(chapterId: string): Comment[] {
    const normalizedId = chapterId.startsWith('ch-shadow-')
      ? chapterId.replace('ch-shadow-', 'ch-solo-leveling-')
      : chapterId;
    return this.comments
      .filter((c) => c.chapterId === normalizedId)
      .sort((a, b) => b.upvotes - a.upvotes);
  }

  public addComment(comment: Comment): Comment {
    this.comments.unshift(comment);
    return comment;
  }

  public upvoteComment(commentId: string): Comment | undefined {
    const comment = this.comments.find((c) => c.id === commentId);
    if (comment) {
      comment.upvotes += 1;
      comment.userUpvoted = true;
    }
    return comment;
  }

  public deleteComment(commentId: string): boolean {
    const initialLen = this.comments.length;
    this.comments = this.comments.filter((c) => c.id !== commentId);
    return this.comments.length < initialLen;
  }

  // Requests
  public getRequests(): SeriesRequest[] {
    return [...this.requests].sort((a, b) => b.votes - a.votes);
  }

  public addRequest(request: SeriesRequest): SeriesRequest {
    this.requests.unshift(request);
    return request;
  }

  public voteRequest(requestId: string): SeriesRequest | undefined {
    const req = this.requests.find((r) => r.id === requestId);
    if (req) {
      if (req.userVoted) {
        req.votes -= 1;
        req.userVoted = false;
      } else {
        req.votes += 1;
        req.userVoted = true;
      }
    }
    return req;
  }

  // Progress
  public getReadingProgress(userId: string): ReadingProgress[] {
    return this.progress.get(userId) || [];
  }

  public saveReadingProgress(userId: string, item: ReadingProgress) {
    const userProgress = this.progress.get(userId) || [];
    const index = userProgress.findIndex((p) => p.seriesId === item.seriesId);
    if (index >= 0) {
      userProgress[index] = { ...item, updatedAt: 'Just now' };
    } else {
      userProgress.unshift({ ...item, updatedAt: 'Just now' });
    }
    this.progress.set(userId, userProgress);
  }

  // User Sessions & Bookmarks
  public getSession(token: string): UserSession | undefined {
    return this.sessions.get(token);
  }

  public setSession(token: string, session: UserSession) {
    this.sessions.set(token, session);
  }

  public getSessionByRecoveryKeyHash(hash: string): UserSession | undefined {
    const token = this.keyToSession.get(hash);
    if (!token) return undefined;
    return this.sessions.get(token);
  }

  public mapRecoveryKeyHash(hash: string, token: string) {
    this.keyToSession.set(hash, token);
  }

  public toggleBookmark(userId: string, seriesId: string): string[] {
    for (const session of this.sessions.values()) {
      if (session.id === userId) {
        if (session.bookmarks.includes(seriesId)) {
          session.bookmarks = session.bookmarks.filter((id) => id !== seriesId);
        } else {
          session.bookmarks.push(seriesId);
        }
        return session.bookmarks;
      }
    }
    return [];
  }

  // Moderation
  public getReports(): ModerationReport[] {
    return this.reports;
  }

  public addReport(report: ModerationReport) {
    this.reports.unshift(report);
    return report;
  }

  public resolveReport(reportId: string, action: 'dismiss' | 'delete_comment'): boolean {
    const report = this.reports.find((r) => r.id === reportId);
    if (!report) return false;

    if (action === 'delete_comment' && report.targetType === 'comment') {
      this.deleteComment(report.targetId);
      report.status = 'Resolved';
    } else {
      report.status = 'Dismissed';
    }
    return true;
  }

  private adminPin: string = '1234';
  private adminSessions: Map<string, number> = new Map();

  public verifyAdminPin(pin: string): boolean {
    const trimmed = (pin || '').trim();
    if (!trimmed) return false;
    if (process.env.ADMIN_PIN && process.env.ADMIN_PIN.trim() === trimmed) {
      return true;
    }
    return this.adminPin === trimmed;
  }

  public setAdminPin(newPin: string): boolean {
    if (!newPin || newPin.trim().length < 4) return false;
    this.adminPin = newPin.trim();
    return true;
  }

  public createAdminSession(token: string, ttlMs: number): void {
    this.adminSessions.set(token, Date.now() + ttlMs);
  }

  public deleteAdminSession(token: string): void {
    this.adminSessions.delete(token);
  }

  public isAdminSessionValid(token: string): boolean {
    const expiry = this.adminSessions.get(token);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.adminSessions.delete(token);
      return false;
    }
    return true;
  }
}

// Versioned singleton key so updated curated catalog replaces any old in-memory instance immediately
const globalForDb = globalThis as unknown as { databaseStoreV4?: DatabaseStore };
export const dataStore = globalForDb.databaseStoreV4 ?? new DatabaseStore();
if (process.env.NODE_ENV !== 'production') {
  globalForDb.databaseStoreV4 = dataStore;
}
