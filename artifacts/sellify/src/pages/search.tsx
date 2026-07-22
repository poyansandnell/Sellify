import { useI18n } from '@/lib/i18n';
import { useListListings, useListCategories } from '@workspace/api-client-react';
import { useLocation, Link, useSearch } from 'wouter';
import { formatCurrency, formatRelativeTime, joinApi } from '@/lib/utils';
import { Search as SearchIcon, Filter, MapPin, Heart } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';

export default function Search() {
  const { t, language } = useI18n();
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const q = urlParams.get('q') || '';
  const category = urlParams.get('category') || '';
  
  const [searchQuery, setSearchQuery] = useState(q);

  useEffect(() => {
    setSearchQuery(q);
  }, [q]);

  const { data: listingsData, isLoading } = useListListings({ q, categoryId: category ? Number(category) : undefined });
  const { data: categories } = useListCategories();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery) {
      setLocation(`/search?q=${encodeURIComponent(searchQuery)}${category ? `&category=${category}` : ''}`);
    } else {
      setLocation(`/search${category ? `?category=${category}` : ''}`);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] md:h-[calc(100dvh-64px)] max-w-7xl mx-auto w-full bg-background">
      {/* Search Header */}
      <div className="bg-card border-b p-4 sticky top-0 z-40 shrink-0 shadow-sm flex flex-col gap-3">
        <div className="flex gap-2">
          <form onSubmit={handleSearch} className="flex-1 relative flex items-center">
            <SearchIcon className="w-5 h-5 absolute left-4 text-muted-foreground" />
            <input 
              type="search" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t.home.searchPlaceholder} 
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-muted border border-transparent focus:bg-background focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
            />
          </form>
          <button className="w-12 h-12 shrink-0 rounded-xl border flex items-center justify-center hover:bg-muted text-foreground transition-colors">
            <Filter className="w-5 h-5" />
          </button>
        </div>
        
        {/* Quick filters */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          <Link href="/search" className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${!category ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}>
            Alla
          </Link>
          {categories?.map(cat => (
            <Link 
              key={cat.id} 
              href={`/search?category=${cat.id}${q ? `&q=${q}` : ''}`} 
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${category === String(cat.id) ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
            >
              {language === 'en' ? cat.nameEn : cat.nameSv}
            </Link>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <h1 className="font-display font-bold text-xl mb-4">
          {listingsData?.total ? `${listingsData.total} resultat` : 'Sökresultat'}
          {q && ` för "${q}"`}
        </h1>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6">
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="aspect-square rounded-2xl" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-5 w-1/3" />
              </div>
            ))
          ) : listingsData?.items.length === 0 ? (
            <div className="col-span-full py-20 text-center flex flex-col items-center text-muted-foreground">
              <SearchIcon className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-lg font-medium">{t.home.noListings}</p>
            </div>
          ) : (
            listingsData?.items.map(listing => (
              <Link key={listing.id} href={`/listing/${listing.slug}`} className="group flex flex-col gap-2">
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted">
                  {listing.images?.[0] ? (
                    <img src={joinApi(listing.images[0])} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground"><SearchIcon className="w-8 h-8 opacity-20" /></div>
                  )}
                  <button className="absolute top-2 right-2 p-2 rounded-full bg-card/80 backdrop-blur-md text-muted-foreground hover:text-red-500 transition-colors shadow-sm" aria-label="Favorite" onClick={(e) => e.preventDefault()}>
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
                    <span className="truncate flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" /> {listing.city || 'Okänd ort'}</span>
                    <span className="flex-shrink-0 ml-2">{formatRelativeTime(listing.createdAt, language === 'sv' ? 'sv-SE' : 'en-US')}</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
