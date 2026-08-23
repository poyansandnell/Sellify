import React, { useEffect, useState } from 'react';
import { useGetTermsAcceptance, useAcceptTerms, getGetTermsAcceptanceQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { Link } from 'wouter';
import { useUser, useAuth } from '@clerk/react';
import { Loader2 } from 'lucide-react';

const CURRENT_TERMS_VERSION = '2026-08-23';

function getValidPendingVersion() {
  const pendingRaw = localStorage.getItem('pendingTermsAcceptance');
  if (pendingRaw) {
    try {
      const pending = JSON.parse(pendingRaw);
      const now = Date.now();
      if (
        pending.version === CURRENT_TERMS_VERSION &&
        pending.timestamp &&
        now - pending.timestamp < 15 * 60 * 1000
      ) {
        return pending.version;
      } else {
        localStorage.removeItem('pendingTermsAcceptance');
      }
    } catch (e) {
      localStorage.removeItem('pendingTermsAcceptance');
    }
  }
  return null;
}

export function TermsGate({ children }: { children: React.ReactNode }) {
  const { t, language } = useI18n();
  const sv = language === 'sv';
  const { isSignedIn, isLoaded } = useAuth();
  const queryClient = useQueryClient();

  const { data: terms, isLoading, refetch } = useGetTermsAcceptance({
    query: {
      enabled: isLoaded && isSignedIn,
      queryKey: getGetTermsAcceptanceQueryKey()
    }
  });

  const acceptTerms = useAcceptTerms();

  const hasAcceptedCurrent = terms?.acceptedVersion === CURRENT_TERMS_VERSION;

  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);

  const mutateRef = React.useRef(acceptTerms.mutate);
  mutateRef.current = acceptTerms.mutate;

  useEffect(() => {
    if (isLoaded && isSignedIn && terms && !hasAcceptedCurrent) {
      const pendingVersion = getValidPendingVersion();
      if (pendingVersion === CURRENT_TERMS_VERSION) {
        setIsAutoSubmitting(true);
        mutateRef.current({ data: { version: CURRENT_TERMS_VERSION } }, {
          onSuccess: () => {
            localStorage.removeItem('pendingTermsAcceptance');
            queryClient.invalidateQueries({ queryKey: getGetTermsAcceptanceQueryKey() });
          },
          onSettled: () => {
            setIsAutoSubmitting(false);
          }
        });
      }
    }
  }, [isLoaded, isSignedIn, terms, hasAcceptedCurrent, queryClient]);

  if (!isLoaded || (isSignedIn && isLoading) || isAutoSubmitting) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isSignedIn && terms && !hasAcceptedCurrent && getValidPendingVersion() !== CURRENT_TERMS_VERSION) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-background min-h-[50vh]">
        <div className="max-w-md w-full bg-card border rounded-3xl p-8 shadow-sm flex flex-col gap-6 text-center">
          <h2 className="text-2xl font-display font-bold">{sv ? 'Uppdaterade villkor' : 'Terms Update'}</h2>
          <p className="text-muted-foreground">
            {sv ? "Vi har uppdaterat våra användarvillkor och vår integritetspolicy. Vänligen acceptera de senaste versionerna för att fortsätta använda Sellify." : "We've updated our Terms of Use and Privacy Policy. Please accept the latest versions to continue using Sellify."}
          </p>
          <div className="flex gap-4 justify-center text-sm">
            <Link href="/terms" className="text-primary hover:underline" data-testid="link-terms">{sv ? 'Användarvillkor' : 'Terms of Use'}</Link>
            <Link href="/privacy" className="text-primary hover:underline" data-testid="link-privacy">{sv ? 'Integritetspolicy' : 'Privacy Policy'}</Link>
          </div>
          <Button
            size="lg"
            className="w-full rounded-full"
            data-testid="button-accept-terms"
            disabled={acceptTerms.isPending}
            onClick={() => {
              acceptTerms.mutate({ data: { version: CURRENT_TERMS_VERSION } }, {
                onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: getGetTermsAcceptanceQueryKey() });
                }
              });
            }}
          >
            {acceptTerms.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (sv ? "Jag accepterar" : "I Accept")}
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
