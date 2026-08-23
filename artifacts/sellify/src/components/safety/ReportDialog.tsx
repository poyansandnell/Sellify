import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCreateContentReport } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { ContentReportInputTargetType, ContentReportInputReason } from '@workspace/api-client-react';

export function ReportDialog({
  targetType,
  reportedUserId,
  listingId,
  messageId,
  conversationId,
  children,
  onSuccess
}: {
  targetType: ContentReportInputTargetType;
  reportedUserId: string;
  listingId?: number;
  messageId?: number;
  conversationId?: number;
  children: React.ReactNode;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ContentReportInputReason | ''>('');
  const [details, setDetails] = useState('');

  const reportMutation = useCreateContentReport();

  const handleReport = () => {
    if (!reason || reportMutation.isPending) return;

    reportMutation.mutate({
      data: {
        targetType,
        reportedUserId,
        reason: reason as ContentReportInputReason,
        details,
        listingId,
        messageId,
        conversationId
      }
    }, {
      onSuccess: () => {
        setOpen(false);
        setReason('');
        setDetails('');
        toast.success('Report submitted successfully.');
        if (onSuccess) onSuccess();
      },
      onError: (err: any) => {
        toast.error(err?.error || 'Failed to submit report');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val && reportMutation.isPending) return;
      setOpen(val);
    }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report Content</DialogTitle>
          <DialogDescription>
            Help us keep the marketplace safe. What's wrong with this content?
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <Select value={reason} onValueChange={(v) => setReason(v as ContentReportInputReason)}>
            <SelectTrigger data-testid="select-report-reason">
              <SelectValue placeholder="Select a reason..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inappropriate">Inappropriate content</SelectItem>
              <SelectItem value="fraud">Scam or fraud</SelectItem>
              <SelectItem value="prohibited_item">Prohibited item</SelectItem>
              <SelectItem value="spam">Spam</SelectItem>
              <SelectItem value="harassment">Harassment</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Textarea
            placeholder="Additional details (optional)..."
            value={details}
            onChange={e => setDetails(e.target.value)}
            data-testid="textarea-report-details"
            className="resize-none"
            rows={4}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={handleReport}
            disabled={!reason || reportMutation.isPending}
            variant="destructive"
            data-testid="button-submit-report"
          >
            {reportMutation.isPending ? 'Submitting...' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}