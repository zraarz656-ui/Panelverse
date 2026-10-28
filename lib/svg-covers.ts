// High-fidelity stylized SVG illustrations for resilient, zero-broken covers and reader panels

function safeSlice(raw: string, start: number, end?: number): string {
  const chars = Array.from(String(raw || ''));
  const sliced = chars.slice(start, end).join('');
  return typeof sliced.toWellFormed === 'function' ? sliced.toWellFormed() : sliced;
}

function escapeXml(raw: string): string {
  const wellFormed =
    typeof String(raw || '').toWellFormed === 'function'
      ? String(raw || '').toWellFormed()
      : String(raw || '');
  return wellFormed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function createCoverSvg(
  title: string,
  theme: 'shadow' | 'cyberpunk' | 'celestial' | 'mecha' | 'cafe' | 'dungeon',
  type: 'webtoon' | 'manga'
): string {
  const safeTitle = escapeXml(safeSlice(title, 0, 24));
  const safeType = escapeXml(type.toUpperCase());

  const themes = {
    shadow: {
      bg1: '#090514',
      bg2: '#1b0d3a',
      accent: '#a855f7',
      accent2: '#6366f1',
      glow: '#c084fc',
      silhouette: '#020108',
      symbol: `<path d="M150 120 L250 120 L280 200 L200 320 L120 200 Z" fill="url(#grad2)" opacity="0.35"/>
               <circle cx="200" cy="220" r="60" fill="none" stroke="#a855f7" stroke-width="2" stroke-dasharray="8 4"/>
               <path d="M170 280 L200 160 L230 280 L200 250 Z" fill="#c084fc" filter="url(#glow)"/>`,
    },
    cyberpunk: {
      bg1: '#050b14',
      bg2: '#0b2038',
      accent: '#06b6d4',
      accent2: '#f43f5e',
      glow: '#22d3ee',
      silhouette: '#03080f',
      symbol: `<rect x="120" y="140" width="160" height="180" rx="8" fill="none" stroke="#06b6d4" stroke-width="2" opacity="0.4"/>
               <line x1="80" y1="200" x2="320" y2="200" stroke="#f43f5e" stroke-width="1.5" opacity="0.6"/>
               <line x1="80" y1="260" x2="320" y2="260" stroke="#06b6d4" stroke-width="1" stroke-dasharray="4 4"/>
               <path d="M160 300 L200 180 L240 300" stroke="#22d3ee" stroke-width="3" fill="none"/>`,
    },
    celestial: {
      bg1: '#130826',
      bg2: '#281347',
      accent: '#ec4899',
      accent2: '#fbbf24',
      glow: '#f472b6',
      silhouette: '#0a0417',
      symbol: `<circle cx="200" cy="210" r="70" fill="url(#grad2)" opacity="0.3"/>
               <circle cx="200" cy="210" r="85" fill="none" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="4 6"/>
               <polygon points="200,150 215,195 260,210 215,225 200,270 185,225 140,210 185,195" fill="#fbcfe8" filter="url(#glow)"/>`,
    },
    mecha: {
      bg1: '#0f172a',
      bg2: '#1e293b',
      accent: '#e2e8f0',
      accent2: '#38bdf8',
      glow: '#38bdf8',
      silhouette: '#020617',
      symbol: `<polygon points="200,130 270,180 250,290 150,290 130,180" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.5"/>
               <polygon points="200,160 240,195 230,260 170,260 160,195" fill="url(#grad2)" opacity="0.3"/>
               <circle cx="200" cy="220" r="14" fill="#38bdf8" filter="url(#glow)"/>`,
    },
    cafe: {
      bg1: '#1c130d',
      bg2: '#3b2518',
      accent: '#f59e0b',
      accent2: '#e11d48',
      glow: '#fbbf24',
      silhouette: '#0e0906',
      symbol: `<path d="M140 250 C140 300, 260 300, 260 250 L260 210 L140 210 Z" fill="url(#grad2)" opacity="0.4"/>
               <path d="M260 220 C280 220, 290 235, 280 250 C270 260, 260 255, 260 250" fill="none" stroke="#f59e0b" stroke-width="2.5"/>
               <path d="M170 190 Q180 160 175 140 M200 190 Q210 155 205 135 M230 190 Q240 160 235 140" stroke="#fbbf24" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>`,
    },
    dungeon: {
      bg1: '#071510',
      bg2: '#0e2b20',
      accent: '#10b981',
      accent2: '#34d399',
      glow: '#6ee7b7',
      silhouette: '#020805',
      symbol: `<path d="M150 150 L250 150 L270 290 L130 290 Z" fill="none" stroke="#10b981" stroke-width="2" opacity="0.4"/>
               <path d="M170 180 L230 180 L245 280 L155 280 Z" fill="url(#grad2)" opacity="0.3"/>
               <line x1="200" y1="130" x2="200" y2="290" stroke="#34d399" stroke-width="2.5" filter="url(#glow)"/>
               <line x1="160" y1="230" x2="240" y2="230" stroke="#34d399" stroke-width="2.5"/>`,
    },
  };

  const t = themes[theme] || themes.shadow;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" width="100%" height="100%">
    <defs>
      <linearGradient id="grad1" x1="0" y1="0" x2="0.8" y2="1">
        <stop offset="0%" stop-color="${t.bg1}"/>
        <stop offset="100%" stop-color="${t.bg2}"/>
      </linearGradient>
      <linearGradient id="grad2" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${t.accent}"/>
        <stop offset="100%" stop-color="${t.accent2}"/>
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="8" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
    </defs>
    <rect width="400" height="560" fill="url(#grad1)"/>
    <g opacity="0.15">
      <line x1="0" y1="140" x2="400" y2="140" stroke="#ffffff" stroke-width="1"/>
      <line x1="0" y1="280" x2="400" y2="280" stroke="#ffffff" stroke-width="1"/>
      <line x1="0" y1="420" x2="400" y2="420" stroke="#ffffff" stroke-width="1"/>
      <line x1="200" y1="0" x2="200" y2="560" stroke="#ffffff" stroke-width="1"/>
    </g>
    ${t.symbol}
    <rect x="24" y="24" width="76" height="22" rx="4" fill="${t.silhouette}" opacity="0.8"/>
    <text x="62" y="39" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="${t.accent}" text-anchor="middle" letter-spacing="1">
      ${safeType}
    </text>
    <rect y="380" width="400" height="180" fill="url(#grad1)" opacity="0.95"/>
    <line x1="24" y1="420" x2="376" y2="420" stroke="${t.accent}" stroke-width="1" opacity="0.4"/>
    <text x="24" y="465" font-family="system-ui, sans-serif" font-size="22" font-weight="800" fill="#ffffff" letter-spacing="-0.5">
      ${safeTitle}
    </text>
    <text x="24" y="495" font-family="system-ui, sans-serif" font-size="12" font-weight="500" fill="#94a3b8" letter-spacing="0.5">
      ORIGINAL SERIALIZATION
    </text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function createReaderPanelSvg(
  seriesTitle: string,
  chapterNum: number,
  pageNum: number,
  type: 'webtoon' | 'manga',
  dialogue?: string
): string {
  const isWebtoon = type === 'webtoon';
  const width = isWebtoon ? 800 : 700;
  const height = isWebtoon ? 1200 : 1000;
  const safeSeries = escapeXml(safeSlice(seriesTitle, 0, 36));
  const rawDialogue = (dialogue || 'The gate has finally opened...!').replace(/^["']|["']$/g, '');
  const safeLine1 = escapeXml(safeSlice(rawDialogue, 0, 46));
  const safeLine2 = escapeXml(safeSlice(rawDialogue, 46, 92));

  if (isWebtoon) {
    const bgColors = [
      ['#090d16', '#1e1b4b', '#a855f7'],
      ['#130a1e', '#311042', '#ec4899'],
      ['#071a17', '#134e4a', '#10b981'],
      ['#1a1209', '#431407', '#f59e0b'],
    ];
    const [c1, c2, accent] = bgColors[(pageNum - 1) % bgColors.length];

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
      <defs>
        <linearGradient id="panelGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="${c2}"/>
        </linearGradient>
        <radialGradient id="auraGrad" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="${c1}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#panelGrad)"/>

      <!-- Top Cinematic Action Frame -->
      <rect x="36" y="44" width="728" height="510" rx="10" fill="#050811" stroke="${accent}" stroke-width="2" stroke-opacity="0.5"/>
      <circle cx="400" cy="300" r="210" fill="url(#auraGrad)"/>

      <!-- Speed lines & Energy Geometry -->
      <g stroke="${accent}" stroke-width="1.5" opacity="0.35">
        <line x1="60" y1="80" x2="320" y2="250"/>
        <line x1="740" y1="80" x2="480" y2="250"/>
        <line x1="60" y1="510" x2="320" y2="340"/>
        <line x1="740" y1="510" x2="480" y2="340"/>
      </g>

      <!-- Heroic Character Silhouette -->
      <polygon points="400,155 495,380 445,380 420,515 380,515 355,380 305,380" fill="#0f172a" stroke="${accent}" stroke-width="2.5"/>
      <circle cx="400" cy="130" r="34" fill="#0f172a" stroke="#f8fafc" stroke-width="2.5"/>
      <circle cx="388" cy="126" r="5" fill="${accent}"/>
      <circle cx="412" cy="126" r="5" fill="${accent}"/>

      <!-- Speech Bubble 1 -->
      <rect x="64" y="74" width="460" height="${safeLine2 ? 92 : 68}" rx="18" fill="#ffffff"/>
      <polygon points="180,${safeLine2 ? 166 : 142} 210,${safeLine2 ? 192 : 168} 225,${safeLine2 ? 166 : 142}" fill="#ffffff"/>
      <text x="294" y="114" font-family="system-ui, sans-serif" font-size="15" font-weight="700" fill="#0f172a" text-anchor="middle">
        ${safeLine1}
      </text>
      ${
        safeLine2
          ? `<text x="294" y="140" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#334155" text-anchor="middle">${safeLine2}</text>`
          : ''
      }

      <!-- Bottom Dramatic Panel Frame -->
      <rect x="36" y="590" width="728" height="530" rx="10" fill="#050811" stroke="#38bdf8" stroke-width="2" stroke-opacity="0.45"/>
      <polygon points="100,1080 400,660 700,1080" fill="${accent}" opacity="0.22"/>
      <circle cx="400" cy="870" r="115" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="10 6"/>
      <path d="M260 870 L400 730 L540 870 L400 1010 Z" fill="none" stroke="#f43f5e" stroke-width="2.5"/>

      <!-- System / Narrative Caption Box -->
      <rect x="210" y="625" width="515" height="78" rx="14" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
      <text x="467" y="670" font-family="system-ui, sans-serif" font-size="15" font-weight="700" fill="#f8fafc" text-anchor="middle">
        [${safeSeries} · Episode ${chapterNum} · Scene ${pageNum}]
      </text>

      <!-- Footer -->
      <text x="42" y="${height - 26}" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#94a3b8">
        ${safeSeries} · Ep. ${chapterNum}
      </text>
      <text x="${width - 42}" y="${height - 26}" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#e2e8f0" text-anchor="end">
        Panel ${pageNum}
      </text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } else {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
      <rect width="${width}" height="${height}" fill="#f8fafc"/>
      <rect x="32" y="32" width="${width - 64}" height="${height - 64}" fill="#ffffff" stroke="#0f172a" stroke-width="4"/>
      <line x1="32" y1="470" x2="${width - 32}" y2="470" stroke="#0f172a" stroke-width="4"/>
      <line x1="390" y1="470" x2="390" y2="${height - 32}" stroke="#0f172a" stroke-width="4"/>

      <!-- Manga Speed Lines -->
      <g stroke="#0f172a" stroke-width="1.5" opacity="0.25">
        <line x1="40" y1="60" x2="340" y2="440"/>
        <line x1="80" y1="60" x2="380" y2="440"/>
        <line x1="120" y1="60" x2="420" y2="440"/>
        <line x1="160" y1="60" x2="460" y2="440"/>
      </g>

      <!-- Character Silhouette -->
      <polygon points="240,450 310,190 385,450" fill="#0f172a"/>
      <circle cx="312" cy="145" r="36" fill="#0f172a"/>

      <!-- Speech Balloon -->
      <rect x="330" y="75" width="310" height="110" rx="40" fill="#ffffff" stroke="#0f172a" stroke-width="3"/>
      <text x="485" y="122" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#0f172a" text-anchor="middle">
        ${safeLine1}
      </text>
      ${
        safeLine2
          ? `<text x="485" y="148" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#334155" text-anchor="middle">${safeLine2}</text>`
          : ''
      }

      <!-- Bottom Left Impact Frame -->
      <rect x="48" y="488" width="324" height="${height - 538}" fill="#0f172a"/>
      <polygon points="105,540 315,540 210,850" fill="#ffffff"/>
      <text x="210" y="700" font-family="system-ui, sans-serif" font-size="18" font-weight="900" fill="#0f172a" text-anchor="middle">
        DOOOOOM!!
      </text>

      <!-- Bottom Right Frame -->
      <ellipse cx="530" cy="690" rx="110" ry="70" fill="#ffffff" stroke="#0f172a" stroke-width="3"/>
      <text x="530" y="695" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#0f172a" text-anchor="middle">
        ${safeSeries} · Ch. ${chapterNum}
      </text>

      <text x="44" y="${height - 10}" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#475569">
        ${safeSeries} · Chapter ${chapterNum}
      </text>
      <text x="${width - 44}" y="${height - 10}" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#0f172a" text-anchor="end">
        Page ${pageNum}
      </text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
}
