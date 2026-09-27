import { useMemo, useState } from 'react';
import { ExternalLink, Loader2, MapPin, RefreshCw, Search, ShieldBan } from 'lucide-react';
import {
  getListSeoLocationNodesQueryKey,
  useGetMe,
  useListSeoLocationNodes,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';

const text = {
  sv: {
    title: 'SEO-sidor per ort',
    description: 'En sida visas per ort med minst en aktiv Sellify-annons. Statusen visar om sidan finns med i sitemap, inte Googles faktiska indexering.',
    dataNote: 'Visar bara annonser som finns på Sellify. Inga externa annonser importeras.',
    locations: 'Lokala SEO-sidor',
    listings: 'Aktiva annonser på sidorna',
    search: 'Sök ort, region eller land',
    refresh: 'Uppdatera',
    location: 'Ort',
    country: 'Land',
    count: 'Aktiva annonser',
    page: 'Sidsökväg',
    status: 'Sitemap',
    included: 'Med i sitemap',
    open: 'Öppna sida',
    loading: 'Hämtar SEO-sidor…',
    error: 'Det gick inte att hämta SEO-sidorna.',
    retry: 'Försök igen',
    empty: 'Inga lokala SEO-sidor finns ännu.',
    noResults: 'Inga orter matchar sökningen.',
    deniedTitle: 'Åtkomst nekad',
    deniedText: 'Du behöver moderatorbehörighet för att visa SEO-administrationen.',
  },
  en: {
    title: 'SEO pages by location',
    description: 'One page is listed for each location with at least one active Sellify listing. Sitemap status does not confirm Google indexing.',
    dataNote: 'Only Sellify listings are shown. No external ads are imported.',
    locations: 'Local SEO pages',
    listings: 'Active listings on these pages',
    search: 'Search city, region, or country',
    refresh: 'Refresh',
    location: 'City',
    country: 'Country',
    count: 'Active listings',
    page: 'Page path',
    status: 'Sitemap',
    included: 'In sitemap',
    open: 'Open page',
    loading: 'Loading SEO pages…',
    error: 'Could not load the SEO pages.',
    retry: 'Try again',
    empty: 'There are no local SEO pages yet.',
    noResults: 'No locations match your search.',
    deniedTitle: 'Access denied',
    deniedText: 'Moderator access is required to view SEO administration.',
  },
} as const;

function countryName(code: string, language: 'sv' | 'en') {
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export default function AdminSeo() {
  const { language } = useI18n();
  const labels = text[language];
  const { data: me, isLoading: isMeLoading, isError: isMeError } = useGetMe();
  const isModerator = me?.isModerator === true;
  const {
    data: locations,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useListSeoLocationNodes({
    query: {
      enabled: isModerator,
      queryKey: getListSeoLocationNodesQueryKey(),
      staleTime: 30_000,
    },
  });
  const [filter, setFilter] = useState('');
  const queryClient = useQueryClient();
  const allLocations = locations ?? [];
  const filteredLocations = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase(language);
    if (!needle) return allLocations;
    return allLocations.filter((item) =>
      [item.city, item.region ?? '', item.country, countryName(item.country, language), item.path]
        .join(' ')
        .toLocaleLowerCase(language)
        .includes(needle),
    );
  }, [allLocations, filter, language]);
  const totalListings = allLocations.reduce((sum, item) => sum + item.listingCount, 0);
  const numberFormat = new Intl.NumberFormat(language);

  if (isMeLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label={labels.loading} />
      </div>
    );
  }

  if (isMeError || !isModerator) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
        <ShieldBan className="mb-4 h-14 w-14 text-destructive" />
        <h1 className="text-2xl font-bold">{labels.deniedTitle}</h1>
        <p className="mt-2 max-w-md text-muted-foreground">{labels.deniedText}</p>
      </div>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
            <MapPin className="h-4 w-4" />
            Sellify admin
          </p>
          <h1 className="text-3xl font-bold tracking-tight">{labels.title}</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">{labels.description}</p>
          <p className="mt-1 text-sm text-muted-foreground">{labels.dataNote}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey: getListSeoLocationNodesQueryKey() });
            void refetch();
          }}
          disabled={isFetching}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          {labels.refresh}
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">{labels.locations}</p>
          <p className="mt-2 text-3xl font-bold">{isLoading ? '—' : numberFormat.format(allLocations.length)}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">{labels.listings}</p>
          <p className="mt-2 text-3xl font-bold">{isLoading ? '—' : numberFormat.format(totalListings)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={labels.search}
            className="pl-9"
            aria-label={labels.search}
          />
        </div>

        {isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">{labels.error}</p>
            <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
              {labels.retry}
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{labels.loading}</span>
          </div>
        ) : filteredLocations.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            {allLocations.length === 0 ? labels.empty : labels.noResults}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-3 font-semibold">{labels.location}</th>
                  <th className="px-3 py-3 font-semibold">{labels.country}</th>
                  <th className="px-3 py-3 text-right font-semibold">{labels.count}</th>
                  <th className="px-3 py-3 font-semibold">{labels.page}</th>
                  <th className="px-3 py-3 font-semibold">{labels.status}</th>
                </tr>
              </thead>
              <tbody>
                {filteredLocations.map((item) => (
                  <tr key={item.path} className="border-b last:border-0 hover:bg-muted/40" data-testid="seo-location-row">
                    <td className="px-3 py-4">
                      <div className="font-semibold">{item.city}</div>
                      {item.region && <div className="mt-0.5 text-xs text-muted-foreground">{item.region}</div>}
                    </td>
                    <td className="px-3 py-4">{countryName(item.country, language)}</td>
                    <td className="px-3 py-4 text-right tabular-nums">{numberFormat.format(item.listingCount)}</td>
                    <td className="px-3 py-4">
                      <a
                        href={item.path}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        {labels.open}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">{item.path}</div>
                    </td>
                    <td className="px-3 py-4">
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                        {labels.included}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}