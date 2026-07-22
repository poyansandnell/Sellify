import { useI18n } from '@/lib/i18n';
import { useGetMyFavorites, useToggleFavorite } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { joinApi, formatCurrency, formatRelativeTime } from '@/lib/utils';
import { Heart, Search, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Favorites() {
  const { t, language } = useI18n();
  const { data: listings, isLoading, refetch } = useGetMyFavorites();
  const toggleFavorite = useToggleFavorite();

  const handleToggle = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    try {
      await toggleFavorite.mutateAsync({ id });
      refetch();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full p-4 md:p-8">
      <h1 className="text-3xl font-display font-bold mb-6">{t.profile.favorites}</h1>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-square rounded-2xl" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-5 w-1/3" />
            </div>
          ))}
        </div>
      ) : !listings || listings.length === 0 ? (
        <div className="p-16 border-2 border-dashed border-border rounded-3xl text-center flex flex-col items-center gap-4 bg-muted/20 max-w-2xl mx-auto mt-12">
           <Heart className="w-12 h-12 text-muted-foreground opacity-50" />
           <h3 className="font-display font-bold text-xl">Du har inga sparade annonser</h3>
           <Link href="/search" className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-bold shadow-sm hover:shadow active:scale-95 transition-all mt-2">
             Hitta favoriter
           </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6">
          {listings.map(listing => (
            <Link key={listing.id} href={`/listing/${listing.slug}`} className="group flex flex-col gap-2">
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted">
                {listing.images?.[0] ? (
                  <img src={joinApi(listing.images[0])} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Search className="w-8 h-8 opacity-20" /></div>
                )}
                <button 
                  className="absolute top-2 right-2 p-2 rounded-full bg-card/80 backdrop-blur-md text-red-500 hover:text-muted-foreground transition-colors shadow-sm" 
                  aria-label="Remove Favorite" 
                  onClick={(e) => handleToggle(e, listing.id)}
                >
                  <Heart className="w-4 h-4 fill-current" />
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
          ))}
        </div>
      )}
    </div>
  );
}
