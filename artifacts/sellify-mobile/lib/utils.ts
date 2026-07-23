export const API_ORIGIN = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export function imageUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/objects/')) return `${API_ORIGIN}/api/storage${path}`;
  return `${API_ORIGIN}${path}`;
}

export function listingUrl(slug: string): string {
  return `${API_ORIGIN}/listing/${slug}`;
}

export function formatPrice(price: number, currency: string): string {
  const rounded = Math.round(price);
  const formatted = rounded.toLocaleString('sv-SE');
  if (currency === 'SEK') return `${formatted} kr`;
  return `${formatted} ${currency}`;
}

export function timeAgo(iso: string, lang: 'sv' | 'en'): string {
  const then = new Date(iso).getTime();
  const diffMin = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (diffMin < 1) return lang === 'sv' ? 'nyss' : 'just now';
  if (diffMin < 60) return `${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return lang === 'sv' ? `${hours} tim` : `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return lang === 'sv' ? `${days} d` : `${days} d`;
  return new Date(iso).toLocaleDateString(lang === 'sv' ? 'sv-SE' : 'en-US', {
    day: 'numeric',
    month: 'short',
  });
}
