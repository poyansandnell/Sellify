import { Link } from 'wouter';

type AppDownloadCtaProps = {
  language: string;
};

function getStoreLinks() {
  const candidates = [
    {
      label: 'App Store',
      url: import.meta.env.VITE_SELLIFY_IOS_APP_URL,
      host: 'apps.apple.com',
    },
    {
      label: 'Google Play',
      url: import.meta.env.VITE_SELLIFY_ANDROID_APP_URL,
      host: 'play.google.com',
    },
  ];

  return candidates.flatMap(({ label, url, host }) => {
    if (!url) return [];
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.hostname !== host) return [];
      if (host === 'play.google.com' && !parsed.pathname.startsWith('/store/apps/details')) return [];
      if (host === 'apps.apple.com' && !parsed.pathname.startsWith('/app/')) return [];
      return [{ label, url: parsed.toString() }];
    } catch {
      return [];
    }
  });
}

export function AppDownloadCta({ language }: AppDownloadCtaProps) {
  const isSwedish = language === 'sv';
  const storeLinks = getStoreLinks();

  return (
    <section className="rounded-3xl border border-primary/15 bg-primary/5 p-5 md:p-7">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <h2 className="font-display text-xl font-bold">
            {isSwedish ? 'Ta med Sellify i mobilen' : 'Take Sellify with you'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {storeLinks.length
              ? isSwedish
                ? 'Hämta appen och håll koll på annonser och meddelanden när du är på språng.'
                : 'Get the app to keep up with listings and messages on the go.'
              : isSwedish
                ? 'De officiella appbutikslänkarna visas här när Sellify har publicerats i butikerna.'
                : 'Official store links will appear here when Sellify is published in the app stores.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {storeLinks.map((store) => (
            <a
              key={store.label}
              href={store.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-foreground px-4 font-semibold text-background transition-opacity hover:opacity-90"
            >
              {store.label}
            </a>
          ))}
          {!storeLinks.length && (
            <Link
              href="/sign-up"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {isSwedish ? 'Börja på webben' : 'Get started on the web'}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}