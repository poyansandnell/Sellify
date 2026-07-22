import { useI18n } from '@/lib/i18n';
import { useGetMessages, useSendMessage, useStartConversation, useListConversations, getGetMessagesQueryKey, getListConversationsQueryKey } from '@workspace/api-client-react';
import { useRoute, Link, useLocation } from 'wouter';
import { ChevronLeft, Send, Image as ImageIcon } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { joinApi } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useUser } from '@clerk/react';

export default function Thread() {
  const [, params] = useRoute('/messages/:id');
  const [, setLocation] = useLocation();
  const id = params?.id || '';
  const { user } = useUser();
  const [text, setText] = useState('');
  
  // Handlers for "new" flow based on query params
  const isNew = id === 'new';
  const urlParams = new URLSearchParams(window.location.search);
  const listingId = urlParams.get('listingId');

  const startConversation = useStartConversation();
  const sendMessage = useSendMessage();

  const { data: messagesData, isLoading, refetch } = useGetMessages(Number(id), { 
    query: { 
      enabled: !isNew && !!id, 
      refetchInterval: 5000,
      queryKey: getGetMessagesQueryKey(Number(id))
    } 
  });

  const { data: convs } = useListConversations({ query: { enabled: !isNew, queryKey: getListConversationsQueryKey() } });
  const conversation = convs?.find(c => c.id === Number(id));
  const messages = messagesData || [];

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    
    const content = text;
    setText('');

    try {
      if (isNew && listingId) {
        const conv = await startConversation.mutateAsync({
          data: { listingId: Number(listingId), message: content }
        });
        setLocation(`/messages/${conv.id}`);
      } else {
        await sendMessage.mutateAsync({
          id: Number(id),
          data: { content }
        });
        refetch();
      }
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] md:h-[calc(100dvh-64px)] max-w-3xl mx-auto w-full bg-background border-x">
      {/* Header */}
      <div className="h-16 bg-card border-b flex items-center px-4 sticky top-0 z-40 shrink-0 gap-3">
        <Link href="/messages" className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        {conversation ? (
          <>
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
              {conversation.otherPartyName?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold truncate">{conversation.otherPartyName}</h2>
              {conversation.listingTitle && (
                <p className="text-xs text-muted-foreground truncate">{conversation.listingTitle}</p>
              )}
            </div>
          </>
        ) : (
          <div className="font-bold">Ny konversation</div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {isLoading ? (
          <div className="flex flex-col gap-4">
             <div className="self-end"><Skeleton className="h-10 w-48 rounded-2xl rounded-tr-sm" /></div>
             <div className="self-start"><Skeleton className="h-10 w-64 rounded-2xl rounded-tl-sm" /></div>
          </div>
        ) : messages.map((msg) => {
          const isMeMsg = conversation ? msg.senderId !== (conversation.buyerId === user?.id ? conversation.sellerId : conversation.buyerId) : true;

          return (
            <div key={msg.id} className={cn("flex flex-col max-w-[80%]", isMeMsg ? "self-end items-end" : "self-start items-start")}>
              <div className={cn(
                "px-4 py-2.5 rounded-3xl",
                isMeMsg 
                  ? "bg-primary text-primary-foreground rounded-tr-sm" 
                  : "bg-muted text-foreground rounded-tl-sm"
              )}>
                {msg.content}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 px-1">
                {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-card border-t shrink-0 mb-safe">
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <button type="button" className="w-12 h-12 shrink-0 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors">
            <ImageIcon className="w-6 h-6" />
          </button>
          <div className="flex-1 bg-muted rounded-3xl flex items-center relative">
            <input 
              type="text" 
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Skriv ett meddelande..."
              className="w-full min-h-[48px] bg-transparent px-4 py-3 focus:outline-none"
            />
          </div>
          <button 
            type="submit" 
            disabled={!text.trim()}
            className="w-12 h-12 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 disabled:active:scale-100 transition-all active:scale-95"
          >
            <Send className="w-5 h-5 ml-1" />
          </button>
        </form>
      </div>
    </div>
  );
}
