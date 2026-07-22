import { SignIn, SignUp } from '@clerk/react';
import { useI18n } from '@/lib/i18n';

export function SignInPage() {
  const { t } = useI18n();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background">
      <div className="mb-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-2xl mx-auto mb-4">S</div>
        <h1 className="text-2xl font-display font-bold">{t.auth.welcome}</h1>
        <p className="text-muted-foreground">{t.auth.subtitle}</p>
      </div>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

export function SignUpPage() {
  const { t } = useI18n();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background">
      <div className="mb-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-2xl mx-auto mb-4">S</div>
        <h1 className="text-2xl font-display font-bold">{t.auth.welcome}</h1>
        <p className="text-muted-foreground">{t.auth.subtitle}</p>
      </div>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}
