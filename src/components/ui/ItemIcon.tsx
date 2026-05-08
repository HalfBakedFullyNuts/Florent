"use client";

import React, { useState } from 'react';
import { getItemImageUrl } from '../../lib/constants/itemIcons';

interface ItemIconProps {
  itemId: string;
  size?: number;
  className?: string;
}

/**
 * Renders a Cloudflare-resized item icon. Hides silently on load error or
 * when no slug exists for the item. Use adjacent text as the accessible label
 * (alt is intentionally empty).
 */
export function ItemIcon({ itemId, size = 24, className = '' }: ItemIconProps) {
  const [failed, setFailed] = useState(false);
  const url = getItemImageUrl(itemId, size, size);

  if (!url || failed) {
    return <span className={`inline-block shrink-0 ${className}`} style={{ width: size, height: size }} />;
  }

  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
