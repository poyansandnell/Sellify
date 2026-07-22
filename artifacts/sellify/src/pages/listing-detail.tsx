import { useI18n } from '@/lib/i18n';
import { useGetListingBySlug, useGetSimilarListings, getGetListingBySlugQueryKey, getGetSimilarListingsQueryKey } from '@workspace/api-client-react';
import { MapPin, Heart, MessageSquare, ChevronLeft, Flag, Info, Truck } from 'lucide-react';
import { useRoute, Link } from 'wouter';
import { formatCurrency, formatRelativeTime, joinApi } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect } from 'react';

export default function ListingDetail() {
  const { t, language } = useI18n();
  const [, params] = useRoute('/listing/:slug');
  const slug = params?.slug || '';

  const { data: listing, isLoading } = useGetListingBySlug(slug, { query: { enabled: !!slug, queryKey: getGetListingBySlugQueryKey(slug) } });
  const { data: similar } = useGetSimilarListings(listing?.id ?? 0, { query: { enabled: !!listing?.id, queryKey: getGetSimilarListingsQueryKey(listing?.id ?? 0) } });

  useEffect(() => {
    if (listing) {
      document.title = `${listing.title} - Sellify`;
    }
  }, [listing]);

  if (isLoading) {
    return <div className="p-4 max-w-4xl mx-auto"><Skeleton className="aspect-square w-full rounded-3xl" /></div>;
  }

  if (!listing) {
    return <div className="p-8 text-center">Hittades inte</div>;
  }

  return (
    <div className="pb-24">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-background/80 backdrop-blur-md z-40 px-4 flex items-center justify-between">
        <Link href="/" className="w-10 h-10 rounded-full bg-card border shadow-sm flex items-center justify-center">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <button className="w-10 h-10 rounded-full bg-card border shadow-sm flex items-center justify-center text-muted-foreground hover:text-red-500">
          <Heart className="w-5 h-5" />
        </button>
      </div>

      <div className="max-w-5xl mx-auto w-full md:p-8 flex flex-col md:flex-row gap-8">
        
        {/* Left: Images */}
        <div className="w-full md:w-3/5 flex flex-col gap-2">
          <div className="aspect-[4/3] md:aspect-square bg-muted md:rounded-3xl overflow-hidden relative">
            {listing.images?.[0] ? (
              <img src={joinApi(listing.images[0])} className="w-full h-full object-cover" alt={listing.title} />
            ) : null}
            {listing.status === 'sold' && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                <span className="font-display font-bold text-4xl px-8 py-3 bg-card rounded-full shadow-xl transform -rotate-12">{t.listing.sold}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4 md:px-0">
            {listing.images?.slice(1).map((img, i) => (
              <img key={i} src={joinApi(img)} className="w-20 h-20 md:w-24 md:h-24 rounded-xl object-cover bg-muted flex-shrink-0 cursor-pointer border-2 border-transparent hover:border-primary transition-colors" alt="" />
            ))}
          </div>
        </div>

        {/* Right: Info */}
        <div className="w-full md:w-2/5 px-4 md:px-0 flex flex-col gap-6 pt-2">
          <div>
            <div className="text-sm font-medium text-primary mb-2">{language === 'en' ? listing.categoryNameEn : listing.categoryNameSv}</div>
            <h1 className="text-2xl md:text-3xl font-display font-bold mb-2 leading-tight">{listing.title}</h1>
            <p className="text-3xl md:text-4xl font-display font-bold text-foreground">
              {formatCurrency(listing.price, listing.currency, language === 'sv' ? 'sv-SE' : 'en-US')}
            </p>
            <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
              <Clock className="w-4 h-4" /> Publicerad {formatRelativeTime(listing.createdAt, language === 'sv' ? 'sv-SE' : 'en-US')}
            </p>
          </div>

          <div className="h-px w-full bg-border" />

          {/* Quick specs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-2xl p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase font-semibold">{t.listing.condition}</span>
              <span className="font-medium">{listing.condition || '-'}</span>
            </div>
            <div className="bg-muted/50 rounded-2xl p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase font-semibold">{t.listing.location}</span>
              <span className="font-medium flex items-center gap-1 truncate"><MapPin className="w-4 h-4 shrink-0" /> {listing.city || '-'}</span>
            </div>
          </div>

          {/* Action block */}
          <div className="bg-card border rounded-3xl p-6 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-xl uppercase">
                {listing.sellerName?.[0] || 'S'}
              </div>
              <div className="flex-1">
                <p className="font-bold">{listing.sellerName || 'Anonym'}</p>
                <p className="text-sm text-muted-foreground">Säljer på Sellify sedan i år</p>
              </div>
            </div>
            <Link href={`/messages/new?listingId=${listing.id}`} className="w-full h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium gap-2 shadow-sm hover:shadow active:scale-[0.98] transition-all">
              <MessageSquare className="w-5 h-5" />
              {t.listing.sendMessage}
            </Link>
          </div>

          {/* Description */}
          <div>
            <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2"><Info className="w-5 h-5 text-muted-foreground" /> {t.listing.description}</h3>
            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {listing.description}
            </p>
          </div>

          {/* Shipping options if any */}
          {listing.shipping && listing.shipping !== 'pickup' && (
            <div className="bg-secondary/5 rounded-2xl p-4 flex items-start gap-3 border border-secondary/10">
              <Truck className="w-5 h-5 text-secondary mt-0.5" />
              <div>
                <p className="font-medium text-secondary-foreground">{t.listing.shipping}</p>
                <p className="text-sm text-muted-foreground">Kan skickas</p>
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-center">
             <button className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground">
               <Flag className="w-4 h-4" /> {t.listing.report}
             </button>
          </div>
        </div>
      </div>
      
      {/* Similar listings */}
      {similar && similar.length > 0 && (
        <div className="max-w-5xl mx-auto w-full p-4 md:p-8 mt-8 border-t">
          <h2 className="text-xl font-display font-bold mb-4">{t.listing.similar}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {similar.slice(0, 4).map(sim => (
               <Link key={sim.id} href={`/listing/${sim.slug}`} className="group flex flex-col gap-2">
                 <div className="aspect-square bg-muted rounded-2xl overflow-hidden">
                    {sim.images?.[0] && <img src={joinApi(sim.images[0])} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />}
                 </div>
                 <p className="font-medium truncate mt-1">{sim.title}</p>
                 <p className="font-bold">{sim.price} {sim.currency}</p>
               </Link>
             ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Quick inline clock icon since it wasn't imported from lucide
function Clock(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
