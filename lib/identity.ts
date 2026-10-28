import crypto from 'crypto';

const ADJECTIVES = [
  'Shadow', 'Silent', 'Azure', 'Crimson', 'Neon', 'Echo', 'Void',
  'Solar', 'Lunar', 'Astral', 'Iron', 'Velvet', 'Frost', 'Amber',
  'Chrono', 'Pixel', 'Phantom', 'Storm', 'Mystic', 'Rogue'
];

const NOUNS = [
  'Reader', 'Weaver', 'Walker', 'Scroll', 'Hunter', 'Ronin',
  'Monarch', 'Archon', 'Blade', 'Seeker', 'Vanguard', 'Specter',
  'Nomad', 'Scholar', 'Cipher', 'Striker', 'Sage', 'Wanderer'
];

export function generateUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${adj}${noun}_${num}`;
}

export function generateRecoveryKey(): string {
  const randomHex = crypto.randomBytes(16).toString('hex');
  return `rec_${randomHex}`;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashString(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
