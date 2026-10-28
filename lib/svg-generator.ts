// Studio resolution SVG artwork renderer for 1K, 2K, 4K outputs

export function generateStudioArtwork(
  prompt: string,
  imageSize: '1K' | '2K' | '4K',
  aspectRatio: string
): string {
  // Dimensions based on resolution and aspect ratio
  const baseDim = imageSize === '4K' ? 4096 : imageSize === '2K' ? 2048 : 1024;
  
  let width = baseDim;
  let height = baseDim;

  if (aspectRatio === '3:4') {
    height = baseDim;
    width = Math.round((baseDim * 3) / 4);
  } else if (aspectRatio === '9:16') {
    height = baseDim;
    width = Math.round((baseDim * 9) / 16);
  } else if (aspectRatio === '4:3') {
    width = baseDim;
    height = Math.round((baseDim * 3) / 4);
  } else if (aspectRatio === '16:9') {
    width = baseDim;
    height = Math.round((baseDim * 9) / 16);
  }

  // Detect theme from prompt
  const lower = prompt.toLowerCase();
  const isCyberpunk = lower.includes('cyber') || lower.includes('samurai') || lower.includes('neon') || lower.includes('blade') || lower.includes('tokyo');
  const isCelestial = lower.includes('celestial') || lower.includes('magic') || lower.includes('empress') || lower.includes('romance') || lower.includes('academy');
  const isMecha = lower.includes('mecha') || lower.includes('robot') || lower.includes('sci-fi') || lower.includes('orbital') || lower.includes('iron');
  const isShadow = lower.includes('shadow') || lower.includes('monarch') || lower.includes('dungeon') || lower.includes('hunter') || lower.includes('dark');

  const c1 = isCyberpunk ? '#050c18' : isCelestial ? '#140826' : isMecha ? '#0a0f1d' : isShadow ? '#090514' : '#080c14';
  const c2 = isCyberpunk ? '#0f2942' : isCelestial ? '#341558' : isMecha ? '#1e293b' : isShadow ? '#1f0e40' : '#1e1b4b';
  const accent = isCyberpunk ? '#06b6d4' : isCelestial ? '#ec4899' : isMecha ? '#38bdf8' : isShadow ? '#a855f7' : '#f43f5e';
  const accentGlow = isCyberpunk ? '#22d3ee' : isCelestial ? '#fbbf24' : isMecha ? '#60a5fa' : isShadow ? '#c084fc' : '#fb7185';

  const titleExtract = prompt.split(',')[0].slice(0, 38).trim();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <linearGradient id="bgGrad" x1="0" y1="0" x2="0.8" y2="1">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
      <linearGradient id="neonGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${accent}"/>
        <stop offset="100%" stop-color="${accentGlow}"/>
      </linearGradient>
      <filter id="studioGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="${Math.round(baseDim * 0.015)}" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
    </defs>

    <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>

    <!-- Subtle studio grid -->
    <g opacity="0.1" stroke="#ffffff" stroke-width="1.5">
      <line x1="0" y1="${height * 0.25}" x2="${width}" y2="${height * 0.25}"/>
      <line x1="0" y1="${height * 0.5}" x2="${width}" y2="${height * 0.5}"/>
      <line x1="0" y1="${height * 0.75}" x2="${width}" y2="${height * 0.75}"/>
      <line x1="${width * 0.25}" y1="0" x2="${width * 0.25}" y2="${height}"/>
      <line x1="${width * 0.5}" y1="0" x2="${width * 0.5}" y2="${height}"/>
      <line x1="${width * 0.75}" y1="0" x2="${width * 0.75}" y2="${height}"/>
    </g>

    <!-- Central Glowing Symbol & Aura -->
    <circle cx="${width * 0.5}" cy="${height * 0.44}" r="${Math.round(width * 0.32)}" fill="url(#neonGrad)" opacity="0.22" filter="url(#studioGlow)"/>
    <circle cx="${width * 0.5}" cy="${height * 0.44}" r="${Math.round(width * 0.38)}" fill="none" stroke="${accent}" stroke-width="${Math.round(baseDim * 0.003)}" stroke-dasharray="16 8"/>

    <!-- Dynamic Silhouette & Vector Geometry -->
    <polygon points="${width * 0.5},${height * 0.18} ${width * 0.76},${height * 0.44} ${width * 0.65},${height * 0.68} ${width * 0.35},${height * 0.68} ${width * 0.24},${height * 0.44}" fill="none" stroke="${accentGlow}" stroke-width="${Math.round(baseDim * 0.004)}" opacity="0.6"/>
    
    <path d="M${width * 0.42} ${height * 0.62} L${width * 0.5} ${height * 0.28} L${width * 0.58} ${height * 0.62} L${width * 0.5} ${height * 0.55} Z" fill="url(#neonGrad)" filter="url(#studioGlow)"/>

    <!-- Japanese Manga Calligraphy Accent -->
    <text x="${width * 0.86}" y="${height * 0.28}" font-family="sans-serif" font-size="${Math.round(baseDim * 0.055)}" font-weight="900" fill="${accentGlow}" opacity="0.75" transform="rotate(8 ${width * 0.86} ${height * 0.28})">
      無双
    </text>

    <!-- Halftone Screentone Overlay Effect -->
    <g opacity="0.18" stroke="#ffffff" stroke-width="2">
      <line x1="${width * 0.1}" y1="${height * 0.3}" x2="${width * 0.35}" y2="${height * 0.65}"/>
      <line x1="${width * 0.15}" y1="${height * 0.3}" x2="${width * 0.4}" y2="${height * 0.65}"/>
      <line x1="${width * 0.2}" y1="${height * 0.3}" x2="${width * 0.45}" y2="${height * 0.65}"/>
    </g>

    <!-- Bottom Scrim & Metadata Plate -->
    <rect y="${height * 0.72}" width="${width}" height="${height * 0.28}" fill="url(#bgGrad)" opacity="0.95"/>
    <line x1="${width * 0.08}" y1="${height * 0.76}" x2="${width * 0.92}" y2="${height * 0.76}" stroke="${accent}" stroke-width="${Math.round(baseDim * 0.002)}" opacity="0.5"/>

    <!-- Resolution & Badge Header -->
    <rect x="${width * 0.08}" y="${height * 0.07}" width="${Math.round(width * 0.28)}" height="${Math.round(height * 0.038)}" rx="${Math.round(baseDim * 0.008)}" fill="#000000" opacity="0.7" stroke="${accent}" stroke-width="1.5"/>
    <text x="${width * 0.22}" y="${height * 0.095}" font-family="system-ui, sans-serif" font-size="${Math.round(baseDim * 0.018)}" font-weight="800" fill="${accentGlow}" text-anchor="middle" letter-spacing="1">
      ${imageSize} RESOLUTION
    </text>

    <!-- Main Title & Prompt Text -->
    <text x="${width * 0.08}" y="${height * 0.83}" font-family="system-ui, sans-serif" font-size="${Math.round(baseDim * 0.034)}" font-weight="800" fill="#ffffff" letter-spacing="-0.5">
      ${titleExtract}
    </text>
    <text x="${width * 0.08}" y="${height * 0.88}" font-family="system-ui, sans-serif" font-size="${Math.round(baseDim * 0.016)}" font-weight="500" fill="#94a3b8" letter-spacing="0.5">
      PANELVERSE HIGH-FIDELITY STUDIO · ${aspectRatio} FORMAT
    </text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
