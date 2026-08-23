import { useState } from 'react';
import { SignIn, SignUp } from '@clerk/react';
import { useI18n } from '@/lib/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Link } from 'wouter';

const CURRENT_TERMS_VERSION = '2026-08-23';

export function SignInPage() {
  const { t, language } = useI18n();
  const sv = language === 'sv';
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  const [accepted, setAccepted] = useState(false);

  const handleChecked = (checked: boolean) => {
    setAccepted(checked);
    if (checked) {
      localStorage.setItem('pendingTermsAcceptance', JSON.stringify({ version: CURRENT_TERMS_VERSION, timestamp: Date.now() }));
    } else {
      localStorage.removeItem('pendingTermsAcceptance');
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background">
      <div className="mb-8 text-center max-w-[440px] w-full">
        <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-2xl mx-auto mb-4">S</div>
        <h1 className="text-2xl font-display font-bold">{t.auth.welcome}</h1>
        <p className="text-muted-foreground">{t.auth.subtitle}</p>

        <div className="mt-6 flex items-start gap-3 p-4 bg-card border rounded-2xl text-left shadow-sm">
          <Checkbox
            id="terms"
            checked={accepted}
            onCheckedChange={handleChecked}
            data-testid="checkbox-consent"
            className="mt-1"
          />
          <Label htmlFor="terms" className="text-sm font-medium leading-tight cursor-pointer">
            {sv ? 'Jag accepterar' : 'I accept the'} <Link href="/terms" className="text-primary hover:underline" data-testid="link-terms">{sv ? 'användarvillkoren' : 'Terms of Use'}</Link> {sv ? 'och' : 'and'} <Link href="/privacy" className="text-primary hover:underline" data-testid="link-privacy">{sv ? 'integritetspolicyn' : 'Privacy Policy'}</Link>
          </Label>
        </div>
      </div>
      <div className={accepted ? 'opacity-100' : 'opacity-50 pointer-events-none grayscale'}>
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

export function SignUpPage() {
  const { t, language } = useI18n();
  const sv = language === 'sv';
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  const [accepted, setAccepted] = useState(false);

  const handleChecked = (checked: boolean) => {
    setAccepted(checked);
    if (checked) {
      localStorage.setItem('pendingTermsAcceptance', JSON.stringify({ version: CURRENT_TERMS_VERSION, timestamp: Date.now() }));
    } else {
      localStorage.removeItem('pendingTermsAcceptance');
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background">
      <div className="mb-8 text-center max-w-[440px] w-full">
        <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-2xl mx-auto mb-4">S</div>
        <h1 className="text-2xl font-display font-bold">{t.auth.welcome}</h1>
        <p className="text-muted-foreground">{t.auth.subtitle}</p>

        <div className="mt-6 flex items-start gap-3 p-4 bg-card border rounded-2xl text-left shadow-sm">
          <Checkbox
            id="terms"
            checked={accepted}
            onCheckedChange={handleChecked}
            data-testid="checkbox-consent"
            className="mt-1"
          />
          <Label htmlFor="terms" className="text-sm font-medium leading-tight cursor-pointer">
            {sv ? 'Jag accepterar' : 'I accept the'} <Link href="/terms" className="text-primary hover:underline" data-testid="link-terms">{sv ? 'användarvillkoren' : 'Terms of Use'}</Link> {sv ? 'och' : 'and'} <Link href="/privacy" className="text-primary hover:underline" data-testid="link-privacy">{sv ? 'integritetspolicyn' : 'Privacy Policy'}</Link>
          </Label>
        </div>
      </div>
      <div className={accepted ? 'opacity-100' : 'opacity-50 pointer-events-none grayscale'}>
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </div>
  );
}
