import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useAnalyzeImages, useCreateListing, usePublishListing, useRequestUploadUrl } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { Camera, Upload, Sparkles, X, Check, CheckCircle2 } from 'lucide-react';
import { joinApi } from '@/lib/utils';
import { cn } from '@/lib/utils';

type SellStep = 'photos' | 'analyzing' | 'review' | 'publishing';

export default function SellPage() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<SellStep>('photos');
  
  // State
  const [images, setImages] = useState<{file?: File, objectPath: string, preview: string}[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Mutations
  const requestUploadUrl = useRequestUploadUrl();
  const analyzeImages = useAnalyzeImages();
  const createListing = useCreateListing();

  const publishListing = usePublishListing();

  // Handlers
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    const files = Array.from(e.target.files);
    const newImages = [...images];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // 1. Get upload URL
        const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({ 
          data: { name: file.name, size: file.size, contentType: file.type } 
        });
        
        // 2. PUT file
        const putRes = await fetch(uploadURL, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type }
        });
        if (!putRes.ok) {
          throw new Error(`Upload failed with status ${putRes.status}`);
        }
        
        // 3. Store
        newImages.push({
          file,
          objectPath,
          preview: URL.createObjectURL(file)
        });
        
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      } catch (err) {
        console.error("Upload failed", err);
      }
    }
    
    setImages(newImages);
    setIsUploading(false);
    
    // Auto-advance if we have images
    if (newImages.length > 0 && step === 'photos') {
      startAnalysis(newImages.map(img => img.objectPath));
    }
  };

  const startAnalysis = async (objectPaths: string[]) => {
    setStep('analyzing');
    try {
      const aiDraft = await analyzeImages.mutateAsync({
        data: { images: objectPaths, locale: 'sv' }
      });
      setDraft({
        ...aiDraft,
        images: objectPaths, // preserve order
        price: aiDraft.suggestedPrice || 0
      });
      setStep('review');
    } catch (err) {
      console.error("Analysis failed", err);
      // Fallback to empty draft
      setDraft({
        title: '', description: '', categoryId: 1, condition: 'Begagnad', price: 0, images: objectPaths
      });
      setStep('review');
    }
  };

  const handlePublish = async () => {
    if (!draft) return;
    setStep('publishing');
    try {
      const listing = await createListing.mutateAsync({
        data: {
          title: draft.title,
          description: draft.description,
          categoryId: draft.categoryId || null,
          condition: ['new', 'like_new', 'good', 'fair', 'worn'].includes(draft.condition) ? draft.condition as any : 'good',
          price: Number(draft.price),
          currency: 'SEK',
          city: 'Okänd', // Ideally we'd get this from user profile
          country: 'SE',
          shipping: 'both',
          images: images.map(i => i.objectPath)
        }
      });
      
      await publishListing.mutateAsync({ id: listing.id });
      
      setLocation(`/listing/${listing.slug}`);
    } catch (err) {
      console.error("Publish failed", err);
      setStep('review');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="h-14 bg-card border-b flex items-center justify-center px-4 sticky top-0 z-40">
        <h1 className="font-display font-bold text-lg">{t.sell.title}</h1>
      </div>

      <div className="max-w-2xl mx-auto p-4 flex flex-col gap-6 mt-4">
        
        {step === 'photos' && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-6">
            <div className="w-24 h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
              <Camera className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold mb-2">Ta bilder av produkten</h2>
              <p className="text-muted-foreground max-w-sm mx-auto">Vår AI fyller automatiskt i rubrik, beskrivning och sätter rätt pris baserat på dina bilder.</p>
            </div>
            
            <div className="relative w-full max-w-sm mt-4">
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                onChange={handleFileSelect}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
              />
              <button className="w-full h-14 rounded-full bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95 transition-all">
                {isUploading ? (
                  <>{t.sell.uploading} {uploadProgress}%</>
                ) : (
                  <><Upload className="w-5 h-5" /> Välj bilder</>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-32 text-center gap-8 animate-in fade-in">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                <Sparkles className="w-10 h-10 text-primary animate-bounce" />
              </div>
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-3xl font-display font-bold text-primary">{t.sell.analyzing}</h2>
            <div className="flex gap-2">
               {images.map((img, i) => (
                 <img key={i} src={img.preview} className="w-16 h-16 rounded-xl object-cover shadow-sm opacity-50" />
               ))}
            </div>
          </div>
        )}

        {step === 'review' && draft && (
          <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-8 duration-500">
            <div className="bg-primary/5 text-primary px-4 py-3 rounded-2xl flex items-center gap-3">
              <Sparkles className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">AI har skapat ett utkast. Kontrollera och ändra om något inte stämmer.</p>
            </div>

            {/* Photos Card */}
            <ReviewCard title="Bilder" onEdit={() => setStep('photos')}>
               <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                 {images.map((img, i) => (
                   <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0 group">
                     <img src={img.preview} className="w-full h-full object-cover" />
                     {i === 0 && <span className="absolute bottom-1 left-1 bg-background/90 text-[10px] px-2 py-0.5 rounded font-bold">Omslag</span>}
                   </div>
                 ))}
                 <label className="w-24 h-24 rounded-xl border-2 border-dashed border-primary/30 text-primary flex items-center justify-center shrink-0 cursor-pointer hover:bg-primary/5">
                    <PlusIcon className="w-6 h-6" />
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} />
                 </label>
               </div>
            </ReviewCard>

            {/* Product Card */}
            <ReviewCard title="Produkt">
               <div className="flex flex-col gap-4">
                 <EditableField label="Rubrik" value={draft.title} onChange={(v) => setDraft({...draft, title: v})} isAi={draft.uncertainFields?.includes('title')} />
                 <div className="grid grid-cols-2 gap-4">
                   <EditableField label="Skick" value={draft.condition || 'Begagnad'} onChange={(v) => setDraft({...draft, condition: v})} />
                   <EditableField label="Varumärke" value={draft.brand || ''} onChange={(v) => setDraft({...draft, brand: v})} />
                 </div>
               </div>
            </ReviewCard>

            {/* Price Card */}
            <ReviewCard title="Pris">
               <div className="flex flex-col gap-4">
                 {draft.suggestedPriceRange && (
                   <div className="bg-muted p-3 rounded-xl flex items-center justify-between">
                     <span className="text-sm text-muted-foreground">AI-rekommendation</span>
                     <span className="font-bold">{draft.suggestedPriceRange}</span>
                   </div>
                 )}
                 <div className="relative">
                   <input 
                     type="number" 
                     value={draft.price} 
                     onChange={(e) => setDraft({...draft, price: e.target.value})}
                     className="w-full h-16 text-3xl font-display font-bold text-center bg-transparent border-b-2 border-border focus:border-primary focus:outline-none transition-colors"
                   />
                   <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground font-bold">kr</span>
                 </div>
               </div>
            </ReviewCard>

            {/* Description Card */}
            <ReviewCard title="Beskrivning">
               <textarea 
                 value={draft.description}
                 onChange={(e) => setDraft({...draft, description: e.target.value})}
                 className="w-full h-32 p-3 bg-muted/50 rounded-xl border border-transparent focus:border-primary focus:bg-background focus:outline-none resize-none"
               />
            </ReviewCard>

            {/* Fixed Bottom Action */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t z-50">
              <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
                <button onClick={() => setStep('photos')} className="px-6 py-4 font-bold text-muted-foreground hover:bg-muted rounded-full">
                  Avbryt
                </button>
                <button onClick={handlePublish} className="flex-1 h-14 rounded-full bg-primary text-primary-foreground font-bold text-lg shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-6 h-6" /> Publicera nu
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'publishing' && (
          <div className="flex flex-col items-center justify-center py-32 text-center gap-8">
            <div className="w-20 h-20 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
            <h2 className="text-2xl font-display font-bold text-primary">{t.sell.publishing}</h2>
            <p className="text-muted-foreground">Skapar din webbsida och laddar upp bilderna i hög kvalitet...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewCard({ title, children, onEdit }: { title: string, children: React.ReactNode, onEdit?: () => void }) {
  return (
    <div className="bg-card border rounded-3xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-lg">{title}</h3>
        {onEdit && <button onClick={onEdit} className="text-sm text-primary font-medium">Ändra</button>}
      </div>
      {children}
    </div>
  );
}

function EditableField({ label, value, onChange, isAi }: { label: string, value: string, onChange: (v: string) => void, isAi?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
        {label}
        {isAi && <span title="AI föreslår att du kontrollerar detta"><Sparkles className="w-3 h-3 text-secondary" /></span>}
      </label>
      <input 
        type="text" 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full h-12 px-3 rounded-xl border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-foreground",
          isAi ? "border-secondary/50 bg-secondary/5 focus:border-secondary" : "border-border"
        )}
      />
    </div>
  );
}

function PlusIcon(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
