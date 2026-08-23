import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useBlockUser } from '@workspace/api-client-react';
import { toast } from 'sonner';

export function BlockDialog({
  userId,
  userName,
  sourceListingId,
  sourceConversationId,
  children,
  onSuccess
}: {
  userId: string;
  userName: string;
  sourceListingId?: number;
  sourceConversationId?: number;
  children: React.ReactNode;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const blockMutation = useBlockUser();

  const handleBlock = () => {
    if (blockMutation.isPending) return;

    blockMutation.mutate({
      data: {
        userId,
        sourceListingId,
        sourceConversationId
      }
    }, {
      onSuccess: () => {
        setOpen(false);
        toast.success(`You have blocked ${userName}.`);
        if (onSuccess) onSuccess();
      },
      onError: (err: any) => {
        toast.error(err?.error || 'Failed to block user');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val && blockMutation.isPending) return;
      setOpen(val);
    }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Block {userName}?</DialogTitle>
          <DialogDescription>
            They will no longer be able to message you or see your listings. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={handleBlock}
            disabled={blockMutation.isPending}
            variant="destructive"
            data-testid="button-confirm-block"
          >
            {blockMutation.isPending ? 'Blocking...' : 'Block User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}