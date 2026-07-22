import { useI18n } from '@/lib/i18n';
import { Link } from 'wouter';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  const { language } = useI18n();

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background text-center">
      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
        <FileQuestion className="w-12 h-12 text-muted-foreground opacity-50" />
      </div>
      <h1 className="text-4xl font-display font-bold mb-2">404</h1>
      <p className="text-xl text-muted-foreground mb-8">
        {language === 'sv' ? 'Sidan kunde inte hittas' : 'Page not found'}
      </p>
      <Link href="/" className="px-8 py-4 bg-primary text-primary-foreground rounded-full font-bold shadow-sm hover:shadow active:scale-95 transition-all">
        {language === 'sv' ? 'Gå till startsidan' : 'Go to Home'}
      </Link>
    </div>
  );
}
