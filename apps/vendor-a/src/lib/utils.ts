import { type ClassValue, clsx } from 'clsx';
import type { CSSProperties } from 'react';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Inline style that staggers a `.row-in` entrance by list position, capped so long lists stay quick. */
export function stagger(index: number): CSSProperties {
  return { '--i': Math.min(index, 8) } as CSSProperties;
}
