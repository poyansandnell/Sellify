import { useI18n } from '@/lib/i18n';
import { useListCategories, useGetHomeFeed } from '@workspace/api-client-react';
import { Search, MapPin, Clock, Heart } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { formatCurrency, formatRelativeTime, joinApi } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function Home() {
  const { t, language } = useI18n();
  const [, setLocation] = useLocation();

  const { data: categories, isLoading: isLoadingCats } = useListCategories();
  const { data: feed, isLoading: isLoadingFeed } = useGetHomeFeed();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get('q');
    if (q) setLocation(`/search?q=${encodeURIComponent(q as string)}`);
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      {/* Search Hero */}
      <div className="bg-primary/5 rounded-3xl p-6 md:p-12 text-center flex flex-col items-center gap-6 mt-2 md:mt-4">
        <h1 className="text-3xl md:text-5xl font-display font-bold text-foreground max-w-xl leading-tight">
          {language === 'sv' ? 'Hitta nya favoriter i din närhet' : 'Find new favorites near you'}
        </h1>
        <form onSubmit={handleSearch} className="w-full max-w-2xl relative flex items-center">
          <Search className="w-5 h-5 absolute left-4 text-muted-foreground" />
          <input 
            type="search" 
            name="q"
            placeholder={t.home.searchPlaceholder} 
            className="w-full h-14 pl-12 pr-4 rounded-2xl bg-card border border-border shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg transition-all"
          />
        </form>
      </div>

      {/* Categories */}
      <div>
        <h2 className="text-xl font-display font-bold mb-4">{t.home.categories}</h2>
        <div className="flex overflow-x-auto gap-3 pb-2 snap-x hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
          {isLoadingCats ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-24 rounded-full flex-shrink-0" />
            ))
          ) : categories?.map(cat => (
            <Link key={cat.id} href={`/search?category=${cat.id}`} className="flex-shrink-0 px-5 py-2.5 rounded-full bg-card border border-border hover:border-primary hover:bg-primary/5 transition-colors font-medium whitespace-nowrap text-sm shadow-sm">
              {language === 'en' ? cat.nameEn : cat.nameSv}
            </Link>
          ))}
        </div>
      </div>

      {/* Newest Listings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> {t.home.newest}
          </h2>
          <Link href="/search?sort=newest" className="text-primary font-medium text-sm hover:underline">{t.home.viewAll}</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6">
          {isLoadingFeed ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2"><Skeleton className="aspect-square rounded-2xl" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-5 w-1/3" /></div>
            ))
          ) : feed?.newest.length === 0 ? (
            <p className="col-span-full text-muted-foreground">{t.home.noListings}</p>
          ) : feed?.newest.map(listing => (
            <ListingCard key={listing.id} listing={listing} language={language} />
          ))}
        </div>
      </div>
      
      {/* Nearby */}
      {feed?.nearby && feed.nearby.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-secondary" /> {t.home.nearby}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6">
            {feed.nearby.map(listing => (
              <ListingCard key={listing.id} listing={listing} language={language} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ListingCard({ listing, language }: { listing: any, language: string }) {
  return (
    <Link href={`/listing/${listing.slug}`} className="group flex flex-col gap-2">
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted">
        {listing.images?.[0] ? (
          <img src={joinApi(listing.images[0])} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Search className="w-8 h-8 opacity-20" /></div>
        )}
        <button className="absolute top-2 right-2 p-2 rounded-full bg-card/80 backdrop-blur-md text-muted-foreground hover:text-red-500 transition-colors shadow-sm" aria-label="Favorite" onClick={(e) => { e.preventDefault(); /* todo wire up toggle */ }}>
          <Heart className="w-4 h-4" />
        </button>
        {listing.status === 'sold' && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
            <span className="font-display font-bold text-xl px-4 py-1 bg-card rounded-full shadow-lg transform -rotate-12">Såld</span>
          </div>
        )}
      </div>
      <div>
        <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">{listing.title}</h3>
        <p className="font-display font-bold text-lg mt-0.5">{formatCurrency(listing.price, listing.currency, language === 'sv' ? 'sv-SE' : 'en-US')}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
          <span className="truncate">{listing.city || 'Okänd ort'}</span>
          <span className="flex-shrink-0 ml-2">{formatRelativeTime(listing.createdAt, language === 'sv' ? 'sv-SE' : 'en-US')}</span>
        </div>
      </div>
    </Link>
  );
}
