import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { Filter, Info, ExternalLink, MapPin, Search as SearchIcon } from 'lucide-react';
import {
  useListCategories,
  useSearchAllListings,
  type SearchAllListingsSort,
  type UnifiedSearchListing,
} from '@workspace/api-client-react';
import { useI18n } from '@/lib/i18n';
import { LocationFields } from '@/components/LocationFields';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatRelativeTime, joinApi } from '@/lib/utils';
import type { ListingLocation } from '@/lib/location';

function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function imageSource(listing: UnifiedSearchListing) {
  const image = listing.images[0];
  if (!image || (listing.isExternal && listing.imageMode === 'NO_EXTERNAL_IMAGES')) return null;
  if (listing.isExternal && listing.imageMode === 'IMAGE_URL_ONLY') return safeHttpUrl(image);
  if (listing.isExternal) return safeHttpUrl(image) ?? joinApi(image);
  return joinApi(image);
}

function statusLabel(status: UnifiedSearchListing['status'], language: 'sv' | 'en') {
  const labels = language === 'sv'
    ? { active: 'Aktiv', sold: 'Såld', removed: 'Borttagen', unknown: 'Okänd status' }
    : { active: 'Active', sold: 'Sold', removed: 'Removed', unknown: 'Unknown status' };
  return labels[status];
}

export default function Search() {
  const { t, language } = useI18n();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const q = urlParams.get('q') || '';
  const category = urlParams.get('category') || '';
  const sortValue = urlParams.get('sort');
  const sort: SearchAllListingsSort | undefined = sortValue === 'newest' || sortValue === 'price_asc' || sortValue === 'price_desc'
    ? sortValue
    : undefined;
  const [searchQuery, setSearchQuery] = useState(q);
  const [locationFilters, setLocationFilters] = useState<ListingLocation>({
    country: urlParams.get('country') || '',
    city: urlParams.get('city') || '',
    region: urlParams.get('region') || '',
    postalCode: urlParams.get('postalCode') || '',
  });
  const [showLocationFilters, setShowLocationFilters] = useState(
    Boolean(urlParams.get('country') || urlParams.get('city') || urlParams.get('region') || urlParams.get('postalCode')),
  );

  useEffect(() => setSearchQuery(q), [q]);
  useEffect(() => {
    setLocationFilters({
      country: urlParams.get('country') || '',
      city: urlParams.get('city') || '',
      region: urlParams.get('region') || '',
      postalCode: urlParams.get('postalCode') || '',
    });
  }, [searchString]);

  const searchPath = (queryValue: string, categoryValue: string, filters: ListingLocation) => {
    const params = new URLSearchParams();
    if (queryValue.trim()) params.set('q', queryValue.trim());
    if (categoryValue) params.set('category', categoryValue);
    if (sort) params.set('sort', sort);
    if (filters.country) params.set('country', filters.country);
    if (filters.city.trim()) params.set('city', filters.city.trim());
    if (filters.region.trim()) params.set('region', filters.region.trim());
    if (filters.postalCode.trim()) params.set('postalCode', filters.postalCode.trim());
    const queryString = params.toString();
    return queryString ? `/search?${queryString}` : '/search';
  };

  const searchParams = {
    q: q || undefined,
    categoryId: category ? Number(category) : undefined,
    country: locationFilters.country || undefined,
    city: locationFilters.city.trim() || undefined,
    region: locationFilters.region.trim() || undefined,
    postalCode: locationFilters.postalCode.trim() || undefined,
    sort,
    limit: 40,
  };
  const {
    data: listingsData,
    isLoading,
    isError,
    refetch,
  } = useSearchAllListings(searchParams);
  const { data: categories } = useListCategories();

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocation(searchPath(searchQuery, category, locationFilters));
  };

  const applyLocationFilters = () => {
    setLocation(searchPath(searchQuery, category, locationFilters));
    setShowLocationFilters(false);
  };

  const resultCopy = language === 'sv'
    ? `${listingsData?.total ?? 0} ${listingsData?.total === 1 ? 'resultat' : 'resultat'}`
    : `${listingsData?.total ?? 0} ${listingsData?.total === 1 ? 'result' : 'results'}`;
  const noActiveSources = !isLoading && !isError && listingsData?.activeExternalSources === 0;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <section className="sticky top-0 z-40 shrink-0 border-b bg-card/95 p-4 shadow-sm backdrop-blur md:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
          <div className="flex gap-2">
            <form onSubmit={handleSearch} className="relative flex flex-1 items-center" data-testid="form-search">
              <SearchIcon className="absolute left-4 h-5 w-5 text-muted-foreground" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t.home.searchPlaceholder}
                aria-label={language === 'sv' ? 'Sök annonser' : 'Search listings'}
                data-testid="input-search"
                className="h-12 w-full rounded-xl border border-transparent bg-muted pl-12 pr-4 font-medium transition-all focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </form>
            <button
              type="button"
              aria-label={language === 'sv' ? 'Visa platsfilter' : 'Show location filters'}
              aria-expanded={showLocationFilters}
              data-testid="button-toggle-location-filters"
              onClick={() => setShowLocationFilters((visible) => !visible)}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-foreground transition-colors hover:bg-muted ${showLocationFilters ? 'border-primary text-primary' : ''}`}
            >
              <Filter className="h-5 w-5" />
            </button>
          </div>

          <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
            <Link
              href={searchPath(searchQuery, '', locationFilters)}
              data-testid="link-category-all"
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${!category ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
            >
              {language === 'sv' ? 'Alla' : 'All'}
            </Link>
            {categories?.map((cat) => (
              <Link
                key={cat.id}
                href={searchPath(searchQuery, String(cat.id), locationFilters)}
                data-testid={`link-category-${cat.id}`}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${category === String(cat.id) ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
              >
                {language === 'en' ? cat.nameEn : cat.nameSv}
              </Link>
            ))}
          </div>

          {showLocationFilters && (
            <div className="rounded-xl border bg-card p-4">
              <LocationFields
                value={locationFilters}
                onChange={setLocationFilters}
                language={language}
                idPrefix="search-location"
                allowAnyCountry
              />
              <Button type="button" onClick={applyLocationFilters} className="mt-4 h-11 w-full" data-testid="button-apply-location-filters">
                {language === 'sv' ? 'Visa annonser här' : 'Show listings here'}
              </Button>
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {language === 'sv' ? 'En sökning, fler möjligheter' : 'One search, more possibilities'}
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl" data-testid="heading-search-results">
              {resultCopy}{q && <span className="font-normal text-muted-foreground"> {language === 'sv' ? `för “${q}”` : `for “${q}”`}</span>}
            </h1>
          </div>
          {!isLoading && !isError && listingsData && (
            <div className="flex flex-wrap gap-2 text-sm" data-testid="summary-search-sources">
              <span className="rounded-full border bg-card px-3 py-1.5 font-medium">
                {language === 'sv' ? `${listingsData.sellifyCount} på Sellify` : `${listingsData.sellifyCount} on Sellify`}
              </span>
              <span className="rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1.5 font-medium text-secondary-foreground">
                {language === 'sv' ? `${listingsData.externalCount} externa` : `${listingsData.externalCount} external`}
              </span>
            </div>
          )}
        </div>

        {noActiveSources && (
          <div className="mb-6 flex gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm" data-testid="notice-external-sources-unavailable">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">
                {language === 'sv' ? 'Externa källor är inte aktiva ännu.' : 'External sources are not active yet.'}
              </span>{' '}
              {language === 'sv'
                ? 'De visas först när juridiskt godkännande finns och integrationen är konfigurerad.'
                : 'They will appear after legal approval and integration setup are complete.'}
            </p>
          </div>
        )}

        {isError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center" data-testid="state-search-error">
            <SearchIcon className="mx-auto mb-3 h-10 w-10 text-destructive/70" />
            <h2 className="font-display text-xl font-semibold">
              {language === 'sv' ? 'Sökningen kunde inte laddas' : 'Search could not be loaded'}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {language === 'sv' ? 'Försök igen om en liten stund.' : 'Please try again in a moment.'}
            </p>
            <Button variant="outline" className="mt-5" onClick={() => void refetch()} data-testid="button-retry-search">
              {language === 'sv' ? 'Försök igen' : 'Try again'}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-7 md:grid-cols-4 md:gap-x-6 lg:grid-cols-5">
            {isLoading ? (
              Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="flex flex-col gap-2" data-testid={`skeleton-search-result-${index}`}>
                  <Skeleton className="aspect-square rounded-2xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-5 w-1/2" />
                </div>
              ))
            ) : listingsData?.items.length === 0 ? (
              <div className="col-span-full flex flex-col items-center py-20 text-center text-muted-foreground" data-testid="state-search-empty">
                <SearchIcon className="mb-4 h-12 w-12 opacity-20" />
                <p className="text-lg font-medium">{t.home.noListings}</p>
                <p className="mt-1 max-w-md text-sm">
                  {language === 'sv' ? 'Prova ett annat sökord eller justera platsfiltret.' : 'Try another search term or adjust the location filter.'}
                </p>
              </div>
            ) : (
              listingsData?.items.map((listing) => (
                <SearchResultCard key={`${listing.sourceId}-${listing.id}`} listing={listing} language={language} />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function SearchResultCard({ listing, language }: { listing: UnifiedSearchListing; language: 'sv' | 'en' }) {
  const image = imageSource(listing);
  const originalUrl = listing.isExternal ? safeHttpUrl(listing.originalUrl) : null;
  const cardContent = (
    <>
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
        {image ? (
          <img src={image} alt={listing.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" data-testid={`img-search-result-${listing.id}`} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground" data-testid={`placeholder-search-result-${listing.id}`}>
            <SearchIcon className="h-8 w-8 opacity-20" />
          </div>
        )}
        {listing.status !== 'active' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
            <span className="rounded-full bg-card px-4 py-1 font-display text-lg font-bold shadow-lg" data-testid={`status-search-result-${listing.id}`}>
              {statusLabel(listing.status, language)}
            </span>
          </div>
        )}
      </div>
      <div>
        <h2 className="truncate font-medium text-foreground transition-colors group-hover:text-primary" data-testid={`text-search-result-title-${listing.id}`}>{listing.title}</h2>
        <p className="mt-0.5 font-display text-lg font-bold" data-testid={`text-search-result-price-${listing.id}`}>
          {formatCurrency(listing.price, listing.currency ?? 'SEK', language === 'sv' ? 'sv-SE' : 'en-US') || (language === 'sv' ? 'Pris saknas' : 'Price unavailable')}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" /> {listing.city || (language === 'sv' ? 'Okänd ort' : 'Unknown location')}</span>
          <span className="shrink-0">{formatRelativeTime(listing.publishedAt, language === 'sv' ? 'sv-SE' : 'en-US')}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground" data-testid={`text-search-result-source-${listing.id}`}>
          <span className="truncate">{listing.isExternal ? (language === 'sv' ? `Extern källa · ${listing.sourceName}` : `External source · ${listing.sourceName}`) : (language === 'sv' ? 'Sellify' : 'Sellify')}</span>
          {listing.isExternal && originalUrl && <ExternalLink className="h-3.5 w-3.5 shrink-0" />}
        </div>
      </div>
    </>
  );

  if (!listing.isExternal && listing.slug) {
    return <Link href={`/listing/${listing.slug}`} className="group flex flex-col gap-2" data-testid={`link-search-result-${listing.id}`}>{cardContent}</Link>;
  }
  if (listing.isExternal && originalUrl) {
    return <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="group flex flex-col gap-2" data-testid={`link-external-result-${listing.id}`}>{cardContent}</a>;
  }
  return <div className="group flex flex-col gap-2" data-testid={`card-search-result-${listing.id}`}>{cardContent}</div>;
}
