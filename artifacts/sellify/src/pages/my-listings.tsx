import { useI18n } from '@/lib/i18n';
import { useGetMyListings, useMarkListingSold, useDeleteListing } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { joinApi, formatCurrency } from '@/lib/utils';
import { Package, MoreVertical, Eye, Heart, MessageSquare, Check, Trash2, Edit2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export default function MyListings() {
  const { t, language } = useI18n();
  const { data: listings, isLoading, refetch } = useGetMyListings();
  const [tab, setTab] = useState<'active' | 'sold' | 'draft'>('active');
  const [menuOpen, setMenuOpen] = useState<number | null>(null);

  const markSold = useMarkListingSold();
  const deleteListing = useDeleteListing();

  const handleMarkSold = async (id: number) => {
    try {
      await markSold.mutateAsync({ id });
      setMenuOpen(null);
      refetch();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Är du säker på att du vill ta bort annonsen?')) return;
    try {
      await deleteListing.mutateAsync({ id });
      setMenuOpen(null);
      refetch();
    } catch (e) { console.error(e); }
  };

  const filtered = listings?.filter(l => l.status === tab) || [];

  return (
    <div className="max-w-4xl mx-auto w-full p-4 md:p-8">
      <h1 className="text-3xl font-display font-bold mb-6">{t.profile.activeListings}</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-muted/50 p-1.5 rounded-2xl w-full md:w-max">
        <button onClick={() => setTab('active')} className={`flex-1 md:w-32 py-2 rounded-xl text-sm font-bold transition-all ${tab === 'active' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          Aktiva
        </button>
        <button onClick={() => setTab('sold')} className={`flex-1 md:w-32 py-2 rounded-xl text-sm font-bold transition-all ${tab === 'sold' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          Sålda
        </button>
        <button onClick={() => setTab('draft')} className={`flex-1 md:w-32 py-2 rounded-xl text-sm font-bold transition-all ${tab === 'draft' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          Utkast
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1,2].map(i => <Skeleton key={i} className="h-32 w-full rounded-3xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-16 border-2 border-dashed border-border rounded-3xl text-center flex flex-col items-center gap-4 bg-muted/20">
           <Package className="w-12 h-12 text-muted-foreground opacity-50" />
           <h3 className="font-display font-bold text-xl">Inga {tab === 'active' ? 'aktiva annonser' : tab === 'sold' ? 'sålda varor' : 'utkast'}</h3>
           {tab === 'active' && (
             <Link href="/sell" className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-bold shadow-sm hover:shadow active:scale-95 transition-all mt-2">
               Skapa en annons nu
             </Link>
           )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(listing => (
            <div key={listing.id} className="bg-card border rounded-3xl p-3 flex gap-4 items-center group shadow-sm hover:shadow transition-shadow relative">
              <Link href={`/listing/${listing.slug}`} className="w-24 h-24 md:w-32 md:h-32 shrink-0 rounded-2xl bg-muted overflow-hidden">
                {listing.images?.[0] && <img src={joinApi(listing.images[0])} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />}
              </Link>
              
              <div className="flex-1 min-w-0 py-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors pr-8">
                      <Link href={`/listing/${listing.slug}`}>{listing.title}</Link>
                    </h3>
                    <p className="font-medium text-foreground">{formatCurrency(listing.price, listing.currency, language === 'sv' ? 'sv-SE' : 'en-US')}</p>
                  </div>
                  
                  {/* Action Menu Toggle */}
                  <button 
                    onClick={() => setMenuOpen(menuOpen === listing.id ? null : listing.id)}
                    className="absolute right-4 top-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  
                  {/* Action Menu Dropdown */}
                  {menuOpen === listing.id && (
                    <div className="absolute right-4 top-12 w-48 bg-card border shadow-lg rounded-2xl p-2 z-10 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-1">
                      {listing.status === 'active' && (
                        <button onClick={() => handleMarkSold(listing.id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted rounded-xl text-left">
                          <Check className="w-4 h-4" /> Markera som såld
                        </button>
                      )}
                      <button className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted rounded-xl text-left">
                        <Edit2 className="w-4 h-4" /> Redigera
                      </button>
                      <button onClick={() => handleDelete(listing.id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-red-50 text-red-500 rounded-xl text-left">
                        <Trash2 className="w-4 h-4" /> Ta bort
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-4 mt-3 pt-3 border-t">
                   <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground" title="Visningar">
                     <Eye className="w-4 h-4" /> {listing.viewCount || 0}
                   </div>
                   <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground" title="Sparade">
                     <Heart className="w-4 h-4" /> {listing.favoriteCount || 0}
                   </div>
                   <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground" title="Meddelanden">
                     <MessageSquare className="w-4 h-4" /> 0
                   </div>
                   <div className="ml-auto">
                     <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                       listing.status === 'active' ? 'bg-secondary/10 text-secondary' :
                       listing.status === 'sold' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                     }`}>
                       {listing.status === 'active' ? 'Aktiv' : listing.status === 'sold' ? 'Såld' : 'Utkast'}
                     </span>
                   </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Click outside to close menu */}
      {menuOpen !== null && (
        <div className="fixed inset-0 z-0" onClick={() => setMenuOpen(null)} />
      )}
    </div>
  );
}
