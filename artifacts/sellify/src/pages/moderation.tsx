import React, { useState } from 'react';
import { useGetMe, useListModerationReports, useUpdateModerationReport, useListModerationEvents, useRemoveModerationListing, useSuspendModerationUser, useUnsuspendModerationUser, getListModerationReportsQueryKey, getListModerationEventsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle, Clock, ShieldBan, Trash2, CheckCircle2, ListFilter, Activity } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatRelativeTime } from '@/lib/utils';
import { ContentReport, ListModerationReportsStatus } from '@workspace/api-client-react';
import { useI18n } from '@/lib/i18n';

export default function Moderation() {
  const { data: me, isLoading: meLoading, isError: meError } = useGetMe();
  const [statusFilter, setStatusFilter] = useState<ListModerationReportsStatus | 'all'>('all');
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

  const queryClient = useQueryClient();

  const isModerator = me?.isModerator === true;

  const { data: reports, isLoading: reportsLoading, isError: reportsIsError } = useListModerationReports(
    { status: statusFilter === 'all' ? undefined : statusFilter },
    {
      query: {
        enabled: isModerator,
        queryKey: getListModerationReportsQueryKey(statusFilter === 'all' ? undefined : { status: statusFilter })
      }
    }
  );

  const { data: events, isLoading: eventsLoading, isError: eventsIsError } = useListModerationEvents({
    query: {
      enabled: isModerator,
      queryKey: getListModerationEventsQueryKey()
    }
  });

  const updateReport = useUpdateModerationReport();
  const removeListing = useRemoveModerationListing();
  const suspendUser = useSuspendModerationUser();
  const unsuspendUser = useUnsuspendModerationUser();

  const handleUpdateStatus = (id: number, status: string, notes: string) => {
    updateReport.mutate({
      id,
      data: { status: status as any, moderatorNotes: notes }
    }, {
      onSuccess: () => {
        toast.success('Report updated');
        queryClient.invalidateQueries({ queryKey: getListModerationReportsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListModerationEventsQueryKey() });
      }
    });
  };

  const handleRemoveListing = (listingId: number, reason: string) => {
    removeListing.mutate({
      id: listingId,
      data: { reason }
    }, {
      onSuccess: () => {
        toast.success('Listing removed');
        queryClient.invalidateQueries({ queryKey: getListModerationReportsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListModerationEventsQueryKey() });
      }
    });
  };

  const handleSuspendUser = (userId: string, reason: string) => {
    suspendUser.mutate({
      id: userId,
      data: { reason }
    }, {
      onSuccess: () => {
        toast.success('User suspended');
        queryClient.invalidateQueries({ queryKey: getListModerationReportsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListModerationEventsQueryKey() });
      }
    });
  };

  const handleUnsuspendUser = (userId: string) => {
    unsuspendUser.mutate({
      id: userId
    }, {
      onSuccess: () => {
        toast.success('User unsuspended');
        queryClient.invalidateQueries({ queryKey: getListModerationReportsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListModerationEventsQueryKey() });
      }
    });
  };

  // 1. Explicit Access Denied for non-moderators and errors
  if (meError || (me && !isModerator) || reportsIsError || eventsIsError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-center p-4">
        <ShieldBan className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-display font-bold">Access Denied</h2>
        <p className="text-muted-foreground mt-2">You do not have permission to view the moderation queue.</p>
      </div>
    );
  }

  // 2. Loading Profile (must block here to know if they are a moderator)
  if (meLoading || !me) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedReport = reports?.find(r => r.id === selectedReportId);

  return (
    <div className="max-w-6xl mx-auto w-full p-4 md:p-8 flex flex-col md:flex-row gap-8">
      {/* Left: Queue */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><ListFilter className="w-6 h-6" /> Moderation Queue</h1>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-40" data-testid="select-mod-status">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {reportsLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="flex flex-col gap-3">
            {reports?.map(report => (
              <div
                key={report.id}
                className={`p-4 border rounded-xl cursor-pointer transition-colors ${selectedReportId === report.id ? 'border-primary bg-primary/5' : 'bg-card hover:border-primary/50'} ${report.overdue && report.status !== 'resolved' && report.status !== 'dismissed' ? 'border-destructive bg-destructive/5' : ''}`}
                onClick={() => setSelectedReportId(report.id)}
                data-testid={`card-report-${report.id}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-muted uppercase tracking-wider">{report.targetType}</span>
                    <span className="text-sm font-bold">{report.reason}</span>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-md ${report.status === 'open' ? 'bg-blue-100 text-blue-700' : report.status === 'in_review' ? 'bg-yellow-100 text-yellow-700' : report.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {report.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{report.details || 'No details provided.'}</p>
                <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                  <span>Reported: {new Date(report.createdAt).toLocaleDateString()}</span>
                  {report.overdue && report.status !== 'resolved' && report.status !== 'dismissed' && (
                    <span className="text-destructive flex items-center gap-1"><Clock className="w-3 h-3" /> Overdue</span>
                  )}
                </div>
              </div>
            ))}
            {reports?.length === 0 && (
              <div className="p-8 text-center text-muted-foreground bg-card border rounded-xl">No reports found for this filter.</div>
            )}
          </div>
        )}
      </div>

      {/* Right: Details / Events */}
      <div className="w-full md:w-[400px] flex flex-col gap-6">
        {selectedReport ? (
          <ReportDetail
            report={selectedReport}
            onUpdateStatus={(status, notes) => handleUpdateStatus(selectedReport.id, status, notes)}
            onRemoveListing={handleRemoveListing}
            onSuspendUser={handleSuspendUser}
          />
        ) : (
          <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col gap-4">
            <h2 className="font-display font-bold text-lg flex items-center gap-2"><Activity className="w-5 h-5" /> Recent Events</h2>
            <div className="flex flex-col gap-3">
              {eventsLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : (
                events?.slice(0, 10).map(event => (
                  <div key={event.id} className="text-sm border-b pb-2 last:border-0 last:pb-0">
                    <p><span className="font-semibold">{event.actorName || 'System'}</span> {event.eventType}</p>
                    <p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p>
                    {event.targetUserName && <p className="text-xs">Target: {event.targetUserName}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportDetail({
  report,
  onUpdateStatus,
  onRemoveListing,
  onSuspendUser
}: {
  report: ContentReport;
  onUpdateStatus: (status: string, notes: string) => void;
  onRemoveListing: (id: number, reason: string) => void;
  onSuspendUser: (id: string, reason: string) => void;
}) {
  const [notes, setNotes] = useState(report.moderatorNotes || '');
  const [listingReason, setListingReason] = useState('');
  const [suspendReason, setSuspendReason] = useState('');

  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col gap-4" data-testid="panel-report-details">
      <h2 className="font-display font-bold text-xl">Report Details</h2>

      <div className="text-sm space-y-2">
        <p><span className="font-semibold text-muted-foreground">Target Type:</span> {report.targetType}</p>
        <p><span className="font-semibold text-muted-foreground">Reported User:</span> {report.reportedUserName || report.reportedUserId}</p>
        {report.listingId && <p><span className="font-semibold text-muted-foreground">Listing ID:</span> {report.listingId} {report.listingTitle ? `(${report.listingTitle})` : ''}</p>}
        {report.messageId && <p><span className="font-semibold text-muted-foreground">Message ID:</span> {report.messageId}</p>}
        {report.conversationId && <p><span className="font-semibold text-muted-foreground">Conversation ID:</span> {report.conversationId}</p>}
        <p><span className="font-semibold text-muted-foreground">Reporter:</span> {report.reporterName || report.reporterId}</p>
      </div>

      <div className="bg-muted/50 p-3 rounded-lg text-sm">
        <p className="font-semibold mb-1">Details provided:</p>
        <p>{report.details || 'None'}</p>
      </div>

      <div className="h-px bg-border" />

      {/* Update Status */}
      <div className="flex flex-col gap-2">
        <h3 className="font-bold text-sm">Update Status</h3>
        <Textarea
          placeholder="Moderator notes..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="resize-none"
          data-testid="textarea-mod-notes"
        />
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" onClick={() => onUpdateStatus('in_review', notes)} data-testid="button-status-review">Review</Button>
          <Button size="sm" onClick={() => onUpdateStatus('resolved', notes)} data-testid="button-status-resolve">Resolve</Button>
          <Button size="sm" variant="secondary" onClick={() => onUpdateStatus('dismissed', notes)} data-testid="button-status-dismiss">Dismiss</Button>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <h3 className="font-bold text-sm">Actions</h3>

        {report.listingId && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" className="w-full justify-start" data-testid="button-action-remove-listing">
                <Trash2 className="w-4 h-4 mr-2" /> Remove Listing
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Remove Listing</DialogTitle></DialogHeader>
              <Input placeholder="Reason for removal..." value={listingReason} onChange={e => setListingReason(e.target.value)} />
              <DialogFooter>
                <Button variant="destructive" disabled={!listingReason} onClick={() => onRemoveListing(report.listingId!, listingReason)}>Confirm Remove</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm" className="w-full justify-start" data-testid="button-action-suspend-user">
              <ShieldBan className="w-4 h-4 mr-2" /> Suspend User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Suspend User</DialogTitle></DialogHeader>
            <Input placeholder="Reason for suspension..." value={suspendReason} onChange={e => setSuspendReason(e.target.value)} />
            <DialogFooter>
              <Button variant="destructive" disabled={!suspendReason} onClick={() => onSuspendUser(report.reportedUserId, suspendReason)}>Confirm Suspend</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

    </div>
  );
}
