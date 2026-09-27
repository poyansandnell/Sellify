export const SITEMAP_LISTINGS_PER_FILE = 45_000;

export function getListingSitemapPageCount(total: number): number {
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new RangeError("Listing count must be a non-negative safe integer");
  }

  return Math.ceil(total / SITEMAP_LISTINGS_PER_FILE);
}

export function isValidSitemapPage(page: number): boolean {
  return Number.isSafeInteger(page) && page >= 0;
}

export function getListingSitemapPageOffset(page: number): number {
  if (!isValidSitemapPage(page)) {
    throw new RangeError("Sitemap page must be a non-negative safe integer");
  }

  return page * SITEMAP_LISTINGS_PER_FILE;
}

export function getLocationSitemapPath(
  country: string,
  region: string | null,
  city: string,
): string {
  return `/location/${encodeURIComponent(country.toUpperCase())}/${encodeURIComponent(region?.trim() || "_")}/${encodeURIComponent(city.trim())}`;
}

export function isLocationPageIndexable(listingCount: number): boolean {
  return Number.isSafeInteger(listingCount) && listingCount >= 1;
}