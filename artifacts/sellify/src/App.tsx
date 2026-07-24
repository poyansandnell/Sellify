import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ClerkProvider, useAuth, Show } from '@clerk/react';
import { Redirect } from 'wouter';
import { I18nProvider } from '@/lib/i18n';
import { Navigation } from '@/components/layout/Navigation';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Pages
import Home from '@/pages/home';
import { SignInPage, SignUpPage } from '@/pages/auth';
import ListingDetail from '@/pages/listing-detail';
import NotFound from '@/pages/not-found';
import Sell from '@/pages/sell';
import Messages from '@/pages/messages';
import Thread from '@/pages/thread';
import MyListings from '@/pages/my-listings';
import Favorites from '@/pages/favorites';
import Profile from '@/pages/profile';

import Search from '@/pages/search';
import Privacy from '@/pages/privacy';
import Terms from '@/pages/terms';

import { publishableKeyFromHost } from '@clerk/react/internal';

const queryClient = new QueryClient();

function ClerkQueryClientCacheInvalidator() {
  const { sessionId } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    qc.invalidateQueries();
  }, [sessionId, qc]);

  return null;
}

// A simple shell around the pages
function AppShell() {
  return (
    <Navigation>
      <ClerkQueryClientCacheInvalidator />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/listing/:slug" component={ListingDetail} />
        <Route path="/search" component={Search} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        
        <Route path="/sell"><ProtectedRoute><Sell /></ProtectedRoute></Route>
        <Route path="/messages"><ProtectedRoute><Messages /></ProtectedRoute></Route>
        <Route path="/messages/:id"><ProtectedRoute><Thread /></ProtectedRoute></Route>
        <Route path="/my-listings"><ProtectedRoute><MyListings /></ProtectedRoute></Route>
        <Route path="/favorites"><ProtectedRoute><Favorites /></ProtectedRoute></Route>
        <Route path="/profile"><ProtectedRoute><Profile /></ProtectedRoute></Route>
        
        <Route component={NotFound} />
      </Switch>
    </Navigation>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out"><Redirect to="/sign-in" /></Show>
    </>
  );
}

function App() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
  const proxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

  return (
    <ClerkProvider 
      publishableKey={clerkPubKey} 
      proxyUrl={proxyUrl}
      localization={{
        signIn: { start: { title: "Logga in till Sellify", subtitle: "Köp och sälj enkelt" } },
        signUp: { start: { title: "Skapa konto på Sellify", subtitle: "Köp och sälj enkelt" } }
      }}
      appearance={{
        variables: {
          colorPrimary: 'hsl(235, 86%, 65%)',
          colorBackground: 'hsl(0, 0%, 100%)',
          colorForeground: 'hsl(222, 47%, 11%)',
          colorMutedForeground: 'hsl(215, 16%, 47%)',
          colorInput: 'hsl(214, 32%, 91%)',
          colorInputForeground: 'hsl(222, 47%, 11%)',
          fontFamily: '"DM Sans", sans-serif',
          borderRadius: '1rem',
        },
        elements: {
          cardBox: 'bg-card w-[440px] max-w-full shadow-lg border border-border mx-auto',
          headerTitle: 'font-display text-2xl font-bold',
          headerSubtitle: 'text-muted-foreground',
          socialButtonsBlockButton: 'border border-border hover:bg-muted text-foreground',
          formButtonPrimary: 'bg-primary text-primary-foreground hover:bg-primary/90 font-bold',
        }
      }}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <I18nProvider>
            <WouterRouter base={basePath}>
              <AppShell />
            </WouterRouter>
          </I18nProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
