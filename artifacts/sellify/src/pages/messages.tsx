import { useI18n } from '@/lib/i18n';
import { useListConversations } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { formatRelativeTime } from '@/lib/utils';
import { MessageSquare, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Messages() {
  const { t, language } = useI18n();
  const { data: conversations, isLoading } = useListConversations();

  return (
    <div className="max-w-3xl mx-auto w-full p-4 md:p-8">
      <h1 className="text-3xl font-display font-bold mb-6">{t.messages.title}</h1>

      <div className="bg-card border rounded-3xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex flex-col divide-y">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 flex gap-4"><Skeleton className="w-12 h-12 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-4 w-1/2" /></div></div>
            ))}
          </div>
        ) : !conversations || conversations.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-4 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare className="w-8 h-8 opacity-50" />
            </div>
            <p>{t.messages.noMessages}</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y">
            {conversations.map(conv => (
              <Link key={conv.id} href={`/messages/${conv.id}`} className="p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors group">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-xl uppercase shrink-0">
                  {conv.otherPartyName?.[0] || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-bold truncate">{conv.otherPartyName || 'Anonym'}</h3>
                    {conv.lastMessageAt && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {formatRelativeTime(conv.lastMessageAt, language === 'sv' ? 'sv-SE' : 'en-US')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {conv.listingTitle && <span className="font-medium text-foreground mr-2">{conv.listingTitle}</span>}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
