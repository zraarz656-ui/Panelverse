'use client';

import { useState } from 'react';
import { createCoverSvg } from '@/lib/svg-covers';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
  fallbackType?: 'webtoon' | 'manga';
  priority?: boolean;
}

export function ResilientImage({
  src,
  alt,
  className = '',
  fallbackTitle,
  fallbackType = 'webtoon',
  priority = false,
}: ResilientImageProps) {
  const [errorSrc, setErrorSrc] = useState<string | null>(null);

  const fallbackSrc = createCoverSvg(
    (fallbackTitle || alt || 'PANELVERSE').slice(0, 22).toUpperCase(),
    fallbackType === 'manga' ? 'cyberpunk' : 'shadow',
    fallbackType
  );

  const hasError = Boolean(errorSrc && errorSrc === src);
  const activeSrc = hasError || !src ? fallbackSrc : src;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={activeSrc}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      referrerPolicy="no-referrer"
      onError={() => {
        if (src && errorSrc !== src) setErrorSrc(src);
      }}
      className={`h-full w-full ${className}`}
    />
  );
}
