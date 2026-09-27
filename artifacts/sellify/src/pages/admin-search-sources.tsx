import { useMemo, useState } from 'react';
import {
  ExternalLink,
  Globe2,
  Info,
  RefreshCw,
  Search,
  ShieldBan,
} from 'lucide-react';
import {
  getListModerationSearchSourcesQueryKey,
  useGetMe,
  useListModerationSearchSources,
  type SearchSourceAdmin,
} from '@workspace/api-client-react';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const copy = {
  sv: {
    eyebrow: 'Moderatorverktyg',
    title: 'Externa sökkällor',
    description: 'En skrivskyddad översikt över källor som kan bidra med lagligt godkända externa annonser i Sellifys sökresultat.',
    dataNote: 'Juridik och integrationsstatus visas här. Ändringar görs i ett separat integrationsflöde.',
    sources: 'Registrerade källor',
    active: 'Aktiva källor',
    inventory: 'Externa annonser',
    filter: 'Sök källa eller land',
    refresh: 'Uppdatera',
    loading: 'Hämtar källregister…',
    error: 'Källregistret kunde inte hämtas.',
    retry: 'Försök igen',
    empty: 'Inga externa källor är registrerade.',
    noResults: 'Inga källor matchar sökningen.',
    source: 'Källa',
    legal: 'Juridik',
    integration: 'Integration',
    crawling: 'Indexering',
    inventoryLabel: 'Annonslager',
    approved: 'Godkänd',
    review: 'Granskning krävs',
    partnership: 'Partnerskap krävs',
    disabled: 'Inaktiverad',
    enabled: 'Aktiv',
    notEnabled: 'Inte aktiv',
    robotsAllowed: 'Robots tillåter indexering',
    robotsBlocked: 'Robots blockerar indexering',
    robotsUnknown: 'Robots ej kontrollerad',
    apiReady: 'API-integration',
    feedReady: 'Feed-integration',
    indexReady: 'Index-integration',
    setupRequired: 'Konfiguration krävs',
    apiKey: 'API-nyckel krävs',
    terms: 'Villkor',
    apiDocs: 'API-dokumentation',
    lastSuccess: 'Senast lyckad körning',
    lastFailure: 'Senaste fel',
    never: 'Aldrig',
    readOnly: 'Skrivskyddad vy',
    details: 'Detaljer',
  },
  en: {
    eyebrow: 'Moderator tools',
    title: 'External search sources',
    description: 'A read-only overview of sources that may contribute legally approved external listings to Sellify search results.',
    dataNote: 'Legal and integration status are shown here. Changes happen in a separate integration workflow.',
    sources: 'Registered sources',
    active: 'Active sources',
    inventory: 'External listings',
    filter: 'Search source or country',
    refresh: 'Refresh',
    loading: 'Loading source registry…',
    error: 'The source registry could not be loaded.',
    retry: 'Try again',
    empty: 'No external sources are registered.',
    noResults: 'No sources match your search.',
    source: 'Source',
    legal: 'Legal',
    integration: 'Integration',
    crawling: 'Indexing',
    inventoryLabel: 'Inventory',
    approved: 'Approved',
    review: 'Review required',
    partnership: 'Partnership required',
    disabled: 'Disabled',
    enabled: 'Active',
    notEnabled: 'Not active',
    robotsAllowed: 'Robots allows indexing',
    robotsBlocked: 'Robots blocks indexing',
    robotsUnknown: 'Robots not checked',
    apiReady: 'API integration',
    feedReady: 'Feed integration',
    indexReady: 'Index integration',
    setupRequired: 'Setup required',
    apiKey: 'API key required',
    terms: 'Terms',
    apiDocs: 'API documentation',
    lastSuccess: 'Last successful run',
    lastFailure: 'Latest error',
    never: 'Never',
    readOnly: 'Read-only view',
    details: 'Details',
  },
} as const;
type SourceCopy = typeof copy.sv | typeof copy.en;

function countryName(code: string, language: 'sv' | 'en') {
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function timestamp(value: string | null | undefined, language: 'sv' | 'en') {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === 'sv' ? 'sv-SE' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function legalLabel(source: SearchSourceAdmin, language: 'sv' | 'en') {
  if (source.legalStatus === 'APPROVED' && source.legalApproval) return language === 'sv' ? 'Godkänd' : 'Approved';
  if (source.legalStatus === 'PARTNERSHIP_REQUIRED') return language === 'sv' ? 'Partnerskap krävs' : 'Partnership required';
  if (source.legalStatus === 'DISABLED') return language === 'sv' ? 'Inaktiverad' : 'Disabled';
  return language === 'sv' ? 'Granskning krävs' : 'Review required';
}

function legalTone(source: SearchSourceAdmin) {
  if (source.legalStatus === 'APPROVED' && source.legalApproval) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (source.legalStatus === 'DISABLED') return 'border-muted bg-muted text-muted-foreground';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function integrationLabel(source: SearchSourceAdmin, language: 'sv' | 'en') {
  if (!source.enabled || source.sourceType === 'DISABLED') return language === 'sv' ? 'Inte aktiv' : 'Not active';
  if (source.partnershipRequired) return language === 'sv' ? 'Partnerskap krävs' : 'Partnership required';
  if (source.sourceType === 'API') return language === 'sv' ? 'API-integration' : 'API integration';
  if (source.sourceType === 'FEED') return language === 'sv' ? 'Feed-integration' : 'Feed integration';
  if (source.sourceType === 'INDEX') return language === 'sv' ? 'Index-integration' : 'Index integration';
  return language === 'sv' ? 'Konfiguration krävs' : 'Setup required';
}

export default function AdminSearchSources() {
  const { language } = useI18n();
  const labels = copy[language];
  const { data: me, isLoading: isMeLoading, isError: isMeError } = useGetMe();
  const isModerator = me?.isModerator === true;
  const {
    data: sources,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useListModerationSearchSources({
    query: {
      enabled: isModerator,
      queryKey: getListModerationSearchSourcesQueryKey(),
      staleTime: 30_000,
    },
  });
  const [filter, setFilter] = useState('');
  const allSources = sources ?? [];
  const filteredSources = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase(language);
    if (!needle) return allSources;
    return allSources.filter((source) =>
      [source.name, source.country, countryName(source.country, language), source.baseUrl ?? '', source.sourceType]
        .join(' ')
        .toLocaleLowerCase(language)
        .includes(needle),
    );
  }, [allSources, filter, language]);
  const activeSources = allSources.filter((source) => source.enabled && source.legalApproval && source.legalStatus === 'APPROVED').length;
  const externalListings = allSources.reduce((sum, source) => sum + source.externalListingCount, 0);
  const numberFormat = new Intl.NumberFormat(language);

  if (isMeLoading) {
    return (
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-8" data-testid="state-search-sources-me-loading">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </section>
    );
  }

  if (isMeError || !isModerator) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center p-6 text-center" data-testid="state-search-sources-denied">
        <ShieldBan className="mb-4 h-14 w-14 text-destructive" />
        <h1 className="font-display text-2xl font-bold">{language === 'sv' ? 'Åtkomst nekad' : 'Access denied'}</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          {language === 'sv' ? 'Du behöver moderatorbehörighet för att visa sökkällor.' : 'Moderator access is required to view search sources.'}
        </p>
      </div>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            <Globe2 className="h-4 w-4" />
            {labels.eyebrow}
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl" data-testid="heading-search-sources">{labels.title}</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">{labels.description}</p>
          <p className="mt-1 text-sm text-muted-foreground">{labels.dataNote}</p>
        </div>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching} data-testid="button-refresh-search-sources">
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          {labels.refresh}
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label={labels.sources} value={isLoading ? '—' : numberFormat.format(allSources.length)} testId="metric-search-sources" />
        <Metric label={labels.active} value={isLoading ? '—' : numberFormat.format(activeSources)} accent testId="metric-active-search-sources" />
        <Metric label={labels.inventory} value={isLoading ? '—' : numberFormat.format(externalListings)} testId="metric-external-listings" />
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={labels.filter} className="pl-9" aria-label={labels.filter} data-testid="input-filter-search-sources" />
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground" data-testid="status-search-sources-read-only">
            <Info className="h-3.5 w-3.5" />
            {labels.readOnly}
          </span>
        </div>

        {isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center" data-testid="state-search-sources-error">
            <p className="text-sm text-destructive">{labels.error}</p>
            <Button className="mt-3" variant="outline" onClick={() => void refetch()} data-testid="button-retry-search-sources">{labels.retry}</Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3" data-testid="state-search-sources-loading">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground" data-testid="state-search-sources-empty">
            {allSources.length === 0 ? labels.empty : labels.noResults}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[940px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-3 font-semibold">{labels.source}</th>
                    <th className="px-3 py-3 font-semibold">{labels.legal}</th>
                    <th className="px-3 py-3 font-semibold">{labels.integration}</th>
                    <th className="px-3 py-3 font-semibold">{labels.crawling}</th>
                    <th className="px-3 py-3 text-right font-semibold">{labels.inventoryLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSources.map((source) => <SourceRow key={source.id} source={source} language={language} labels={labels} numberFormat={numberFormat} />)}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 lg:hidden">
              {filteredSources.map((source) => <SourceCard key={source.id} source={source} language={language} labels={labels} numberFormat={numberFormat} />)}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value, testId, accent = false }: { label: string; value: string; testId: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-card p-5 shadow-sm ${accent ? 'border-secondary/30 bg-secondary/5' : ''}`} data-testid={testId}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}

function SourceIdentity({ source, language, labels }: { source: SearchSourceAdmin; language: 'sv' | 'en'; labels: SourceCopy }) {
  const baseUrl = source.baseUrl && safeHttpUrl(source.baseUrl);
  return (
    <div className="min-w-[220px]">
      <div className="font-semibold" data-testid={`text-search-source-name-${source.id}`}>{source.name}</div>
      <div className="mt-1 text-xs text-muted-foreground">{countryName(source.country, language)} · {source.sourceType}</div>
      {baseUrl ? (
        <a href={baseUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-primary hover:underline" data-testid={`link-search-source-url-${source.id}`}>
          <span className="truncate">{baseUrl}</span><ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ) : <span className="mt-1 block text-xs text-muted-foreground">{labels.details}</span>}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {source.termsUrl && safeHttpUrl(source.termsUrl) && <a href={safeHttpUrl(source.termsUrl)!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" data-testid={`link-search-source-terms-${source.id}`}>{labels.terms}</a>}
        {source.apiDocsUrl && safeHttpUrl(source.apiDocsUrl) && <a href={safeHttpUrl(source.apiDocsUrl)!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" data-testid={`link-search-source-api-docs-${source.id}`}>{labels.apiDocs}</a>}
      </div>
    </div>
  );
}

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function SourceRow({ source, language, labels, numberFormat }: { source: SearchSourceAdmin; language: 'sv' | 'en'; labels: SourceCopy; numberFormat: Intl.NumberFormat }) {
  const robots = source.robotsAllowsIndexing === true ? labels.robotsAllowed : source.robotsAllowsIndexing === false ? labels.robotsBlocked : labels.robotsUnknown;
  return (
    <tr className="border-b align-top last:border-0 hover:bg-muted/30" data-testid={`row-search-source-${source.id}`}>
      <td className="px-3 py-4"><SourceIdentity source={source} language={language} labels={labels} /></td>
      <td className="px-3 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${legalTone(source)}`}>{legalLabel(source, language)}</span></td>
      <td className="px-3 py-4">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${source.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{integrationLabel(source, language)}</span>
        {source.apiKeyRequired && <div className="mt-2 text-xs text-muted-foreground">{labels.apiKey}</div>}
        {source.lastError && <div className="mt-2 max-w-[220px] text-xs text-destructive" title={source.lastError}>{source.lastError}</div>}
      </td>
      <td className="px-3 py-4 text-xs text-muted-foreground">{robots}<div className="mt-1">{timestamp(source.robotsCheckedAt, language) ?? labels.never}</div>{source.lastFailure && <div className="mt-2 text-destructive">{labels.lastFailure}: {timestamp(source.lastFailure, language) ?? labels.never}</div>}</td>
      <td className="px-3 py-4 text-right tabular-nums"><span className="font-semibold">{numberFormat.format(source.externalListingCount)}</span><div className="mt-1 text-xs text-muted-foreground">{timestamp(source.lastSuccess, language) ?? labels.never}</div></td>
    </tr>
  );
}

function SourceCard({ source, language, labels, numberFormat }: { source: SearchSourceAdmin; language: 'sv' | 'en'; labels: SourceCopy; numberFormat: Intl.NumberFormat }) {
  const robots = source.robotsAllowsIndexing === true ? labels.robotsAllowed : source.robotsAllowsIndexing === false ? labels.robotsBlocked : labels.robotsUnknown;
  return (
    <article className="rounded-xl border p-4" data-testid={`card-search-source-${source.id}`}>
      <div className="flex items-start justify-between gap-3">
        <SourceIdentity source={source} language={language} labels={labels} />
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${legalTone(source)}`}>{legalLabel(source, language)}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
        <div><p className="text-xs text-muted-foreground">{labels.integration}</p><p className="mt-1 font-medium">{integrationLabel(source, language)}</p></div>
        <div><p className="text-xs text-muted-foreground">{labels.inventoryLabel}</p><p className="mt-1 font-semibold tabular-nums">{numberFormat.format(source.externalListingCount)}</p></div>
        <div><p className="text-xs text-muted-foreground">{labels.crawling}</p><p className="mt-1 text-xs">{robots}</p></div>
        <div><p className="text-xs text-muted-foreground">{labels.lastSuccess}</p><p className="mt-1 text-xs">{timestamp(source.lastSuccess, language) ?? labels.never}</p></div>
      </div>
      {source.lastError && <p className="mt-3 border-t pt-3 text-xs text-destructive">{source.lastError}</p>}
    </article>
  );
}