import React from 'react';
import { Link, useLocation } from 'wouter';
import { Home, PlusCircle, MessageSquare, List, User } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useUser, Show } from '@clerk/react';
import { cn } from '@/lib/utils';

export function Navigation({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { t } = useI18n();
  const { user } = useUser();

  const navItems = [
    { href: '/', label: t.nav.home, icon: Home },
    { href: '/sell', label: t.nav.sell, icon: PlusCircle, special: true },
    { href: '/messages', label: t.nav.messages, icon: MessageSquare },
    { href: '/my-listings', label: t.nav.myListings, icon: List },
    { href: '/profile', label: t.nav.profile, icon: User },
  ];

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      {/* Desktop Header */}
      <header className="hidden md:flex h-16 items-center justify-between px-8 bg-card border-b sticky top-0 z-50 shadow-sm">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-xl">S</div>
          <span className="font-display font-bold text-2xl tracking-tight text-foreground">Sellify</span>
        </Link>
        <nav className="flex items-center gap-8">
          {navItems.filter(i => !i.special).map(item => (
            <Link key={item.href} href={item.href} className={cn("text-sm font-medium transition-colors hover:text-primary", location === item.href ? "text-primary" : "text-muted-foreground")}>
              {item.label}
            </Link>
          ))}
          <Show when="signed-out">
            <Link href="/sign-in" className="text-sm font-medium px-4 py-2 rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors">
              {t.nav.signIn}
            </Link>
          </Show>
          <Show when="signed-in">
            <Link href="/sell" className="text-sm font-medium px-5 py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm hover:shadow active:scale-95 flex items-center gap-2">
              <PlusCircle className="w-4 h-4" />
              {t.nav.sell}
            </Link>
          </Show>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-16 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-2 z-50 pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        {navItems.map(item => {
          const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
          
          if (item.special) {
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center w-16 h-full relative -top-3">
                <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-95 transition-transform hover:shadow-xl">
                  <item.icon className="w-7 h-7" />
                </div>
                <span className="text-[10px] font-medium mt-1 text-foreground">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link key={item.href} href={item.href} className={cn("flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors", isActive ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
              <item.icon className={cn("w-6 h-6", isActive && "fill-primary/20")} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
