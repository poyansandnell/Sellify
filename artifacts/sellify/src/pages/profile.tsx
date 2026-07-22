import { useI18n } from '@/lib/i18n';
import { useUser, SignOutButton } from '@clerk/react';
import { useGetMe, useUpdateMe } from '@workspace/api-client-react';
import { User, Settings, LogOut, CheckCircle2, Globe, Heart, Package } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'wouter';

export default function Profile() {
  const { t, language, setLanguage } = useI18n();
  const { user } = useUser();
  const { data: profile, isLoading } = useGetMe();
  const updateMe = useUpdateMe();

  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setCity(profile.city || '');
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      await updateMe.mutateAsync({
        data: { displayName, city }
      });
      // Optionally show toast
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full p-4 md:p-8">
      <h1 className="text-3xl font-display font-bold mb-8">{t.profile.title}</h1>

      <div className="bg-card border rounded-3xl p-6 md:p-8 shadow-sm mb-6 flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-4xl mb-4 uppercase">
          {displayName?.[0] || user?.firstName?.[0] || 'U'}
        </div>
        <h2 className="text-2xl font-bold">{displayName || user?.firstName || 'Anonym Användare'}</h2>
        <p className="text-muted-foreground flex items-center gap-1 mt-1 justify-center">
          <CheckCircle2 className="w-4 h-4 text-secondary" /> Verifierad medlem
        </p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Link href="/my-listings" className="bg-card border rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all">
            <Package className="w-8 h-8 text-primary" />
            <span className="font-bold">{t.profile.activeListings}</span>
          </Link>
          <Link href="/favorites" className="bg-card border rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center gap-3 hover:border-red-500/50 hover:bg-red-50 transition-all">
            <Heart className="w-8 h-8 text-red-500" />
            <span className="font-bold">{t.profile.favorites}</span>
          </Link>
        </div>

        <div className="bg-card border rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><User className="w-5 h-5 text-muted-foreground" /> {t.profile.edit}</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-muted-foreground mb-1.5 block">Visningsnamn</label>
              <input 
                type="text" 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-muted-foreground mb-1.5 block">Ort</label>
              <input 
                type="text" 
                value={city} 
                onChange={(e) => setCity(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              />
            </div>
            <button onClick={handleSave} disabled={updateMe.isPending} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-full font-bold shadow-sm hover:shadow active:scale-95 transition-all">
              {updateMe.isPending ? 'Sparar...' : 'Spara ändringar'}
            </button>
          </div>
        </div>

        <div className="bg-card border rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Globe className="w-5 h-5 text-muted-foreground" /> {t.profile.language}</h3>
          <div className="flex gap-4">
            <button 
              onClick={() => setLanguage('sv')}
              className={`flex-1 h-12 rounded-xl border font-medium transition-all ${language === 'sv' ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-muted'}`}
            >
              Svenska
            </button>
            <button 
              onClick={() => setLanguage('en')}
              className={`flex-1 h-12 rounded-xl border font-medium transition-all ${language === 'en' ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-muted'}`}
            >
              English
            </button>
          </div>
        </div>

        <div className="bg-card border rounded-3xl p-2 shadow-sm">
          <SignOutButton>
            <button className="w-full p-4 flex items-center gap-3 text-red-500 font-bold hover:bg-red-500/5 rounded-2xl transition-colors text-left">
              <LogOut className="w-5 h-5" />
              {t.profile.signOut}
            </button>
          </SignOutButton>
        </div>
      </div>
    </div>
  );
}
