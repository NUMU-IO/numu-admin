/**
 * Beta Program Page - NUMU Admin Dashboard
 *
 * Features:
 * - List all waitlist entries with status-based tab filtering
 * - Stats cards for Pending / Invited / Converted counts
 * - Send beta invites to pending entries
 * - Update priority score and notes per entry
 * - Copy invite codes for invited entries
 * - Pagination
 */

import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getLoginUrl } from "@/const";
import {
  getWaitlist,
  inviteWaitlistEntry,
  directInvite,
  updateWaitlistPriority,
  type WaitlistEntry,
} from "@/services/adminApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Check,
  Mail,
  Plus,
  Send,
  Star,
  UserCheck,
  Users,
} from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";

// ─── Status helpers ──────────────────────────────────────────────────────────

const statusBadgeStyles: Record<WaitlistEntry["status"], string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  invited: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  converted: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
};

const statusLabels: Record<WaitlistEntry["status"], string> = {
  pending: "Pending",
  invited: "Invited",
  converted: "Converted",
};

// ─── Types ──────────────────────────────────────────────────────────────────

type StatusFilter = "all" | WaitlistEntry["status"];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function BetaProgram() {
  const { loading, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Filters & pagination
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Priority dialog state
  const [priorityDialogOpen, setPriorityDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(
    null,
  );
  const [priorityValue, setPriorityValue] = useState<string>("");
  const [notesValue, setNotesValue] = useState<string>("");

  // Direct invite dialog state
  const [directInviteOpen, setDirectInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteCompany, setInviteCompany] = useState("");
  const [inviteNotes, setInviteNotes] = useState("");

  // Clipboard feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── Queries (must be before any conditional returns) ────────────────────

  // Main list query
  const listQueryParams = {
    page,
    page_size: pageSize,
    status: statusFilter !== "all" ? statusFilter : undefined,
  };

  const {
    data: listData,
    isLoading: listLoading,
    isError: listError,
  } = useQuery({
    queryKey: ["waitlist", "list", listQueryParams],
    queryFn: () => getWaitlist(listQueryParams),
    enabled: isAuthenticated,
  });

  // Stats: fetch all three statuses in parallel for card counts
  const { data: pendingData } = useQuery({
    queryKey: ["waitlist", "stats", "pending"],
    queryFn: () => getWaitlist({ status: "pending", page: 1, page_size: 1 }),
    enabled: isAuthenticated,
  });

  const { data: invitedData } = useQuery({
    queryKey: ["waitlist", "stats", "invited"],
    queryFn: () => getWaitlist({ status: "invited", page: 1, page_size: 1 }),
    enabled: isAuthenticated,
  });

  const { data: convertedData } = useQuery({
    queryKey: ["waitlist", "stats", "converted"],
    queryFn: () => getWaitlist({ status: "converted", page: 1, page_size: 1 }),
    enabled: isAuthenticated,
  });

  // ── Mutations ───────────────────────────────────────────────────────────

  const inviteMutation = useMutation({
    mutationFn: (entryId: string) => inviteWaitlistEntry(entryId),
    onSuccess: () => {
      toast.success("Beta invite sent successfully");
      queryClient.invalidateQueries({ queryKey: ["waitlist"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send invite");
    },
  });

  const priorityMutation = useMutation({
    mutationFn: ({
      entryId,
      priorityScore,
      notes,
    }: {
      entryId: string;
      priorityScore: number;
      notes?: string;
    }) => updateWaitlistPriority(entryId, priorityScore, notes),
    onSuccess: () => {
      toast.success("Priority updated");
      setPriorityDialogOpen(false);
      setSelectedEntry(null);
      queryClient.invalidateQueries({ queryKey: ["waitlist"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update priority");
    },
  });

  const directInviteMutation = useMutation({
    mutationFn: (data: { email: string; name?: string; company_name?: string; notes?: string }) =>
      directInvite(data),
    onSuccess: (entry) => {
      toast.success(`Invite sent to ${entry.email}`);
      setDirectInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteCompany("");
      setInviteNotes("");
      queryClient.invalidateQueries({ queryKey: ["waitlist"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send invite");
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────

  const openPriorityDialog = useCallback((entry: WaitlistEntry) => {
    setSelectedEntry(entry);
    setPriorityValue(String(entry.priority_score));
    setNotesValue(entry.notes ?? "");
    setPriorityDialogOpen(true);
  }, []);

  const handlePrioritySubmit = useCallback(() => {
    if (!selectedEntry) return;
    const score = parseInt(priorityValue, 10);
    if (isNaN(score) || score < 0) {
      toast.error("Priority score must be a non-negative number");
      return;
    }
    priorityMutation.mutate({
      entryId: selectedEntry.id,
      priorityScore: score,
      notes: notesValue.trim() || undefined,
    });
  }, [selectedEntry, priorityValue, notesValue, priorityMutation]);

  const handleCopyInviteCode = useCallback(
    async (entry: WaitlistEntry) => {
      if (!entry.invite_code) return;
      try {
        await navigator.clipboard.writeText(entry.invite_code);
        setCopiedId(entry.id);
        toast.success("Invite code copied to clipboard");
        setTimeout(() => setCopiedId(null), 2000);
      } catch {
        toast.error("Failed to copy invite code");
      }
    },
    [],
  );

  const handleTabChange = useCallback((value: string) => {
    setStatusFilter(value as StatusFilter);
    setPage(1);
  }, []);

  // ── Auth guard (after all hooks) ──────────────────────────────────────

  if (loading) return <DashboardLayoutSkeleton />;
  if (!isAuthenticated) {
    const loginUrl = getLoginUrl();
    if (loginUrl) {
      window.location.href = loginUrl;
    }
    return <DashboardLayoutSkeleton />;
  }

  // ── Derived values ──────────────────────────────────────────────────────

  const pendingCount = pendingData?.total ?? 0;
  const invitedCount = invitedData?.total ?? 0;
  const convertedCount = convertedData?.total ?? 0;

  const entries = listData?.items ?? [];
  const total = listData?.total ?? 0;
  const totalPages = listData?.total_pages ?? 1;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <DashboardLayout
      title="Beta Program"
      subtitle="Manage beta invites and waitlist"
    >
      {/* Create Invite Button */}
      <div className="flex justify-end mb-4">
        <Button onClick={() => setDirectInviteOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Invite
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="dashboard-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Clock className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-amber-500">{pendingCount}</p>
          </div>
        </div>
        <div className="dashboard-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Mail className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Invited</p>
            <p className="text-2xl font-bold text-blue-500">{invitedCount}</p>
          </div>
        </div>
        <div className="dashboard-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Converted</p>
            <p className="text-2xl font-bold text-emerald-500">
              {convertedCount}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Filter */}
      <div className="mb-4">
        <Tabs value={statusFilter} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="all">
              <Users className="w-4 h-4 mr-1" />
              All
            </TabsTrigger>
            <TabsTrigger value="pending">
              <Clock className="w-4 h-4 mr-1" />
              Pending
            </TabsTrigger>
            <TabsTrigger value="invited">
              <Mail className="w-4 h-4 mr-1" />
              Invited
            </TabsTrigger>
            <TabsTrigger value="converted">
              <UserCheck className="w-4 h-4 mr-1" />
              Converted
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Data Table */}
      <div className="dashboard-card">
        {listError ? (
          <div className="py-12 text-center">
            <p className="text-destructive font-medium">
              Failed to load waitlist entries
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Please try refreshing the page.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Referrals</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <span className="text-muted-foreground">
                      Loading waitlist entries...
                    </span>
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-12 text-muted-foreground"
                  >
                    {statusFilter === "all"
                      ? "No waitlist entries yet"
                      : `No ${statusFilter} entries`}
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id}>
                    {/* Name + email */}
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {entry.name || "Anonymous"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entry.email}
                        </p>
                      </div>
                    </TableCell>

                    {/* Company */}
                    <TableCell>
                      <span className="text-sm">
                        {entry.company_name || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </span>
                    </TableCell>

                    {/* Status badge */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusBadgeStyles[entry.status]}
                      >
                        {statusLabels[entry.status]}
                      </Badge>
                    </TableCell>

                    {/* Priority — clickable */}
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => openPriorityDialog(entry)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-sm font-mono font-medium hover:bg-muted transition-colors cursor-pointer"
                        title="Click to edit priority"
                      >
                        <Star className="w-3 h-3 text-amber-500" />
                        {entry.priority_score}
                      </button>
                    </TableCell>

                    {/* Source */}
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {entry.source || "-"}
                      </span>
                    </TableCell>

                    {/* Referral count */}
                    <TableCell>
                      <span className="text-sm font-mono">
                        {entry.referral_count}
                      </span>
                    </TableCell>

                    {/* Date */}
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(entry.created_at)}
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      {entry.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => inviteMutation.mutate(entry.id)}
                          disabled={
                            inviteMutation.isPending &&
                            inviteMutation.variables === entry.id
                          }
                          className="gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {inviteMutation.isPending &&
                          inviteMutation.variables === entry.id
                            ? "Sending..."
                            : "Send Invite"}
                        </Button>
                      )}
                      {entry.status === "invited" && entry.invite_code && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyInviteCode(entry)}
                          className="gap-1.5 font-mono text-xs"
                        >
                          {copiedId === entry.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          {entry.invite_code}
                        </Button>
                      )}
                      {entry.status === "converted" && (
                        <span className="text-xs text-muted-foreground">
                          {entry.converted_at
                            ? formatDate(entry.converted_at)
                            : "Converted"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * pageSize + 1} to{" "}
              {Math.min(page * pageSize, total)} of {total} entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Priority Edit Dialog */}
      <Dialog open={priorityDialogOpen} onOpenChange={setPriorityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Priority</DialogTitle>
            <DialogDescription>
              {selectedEntry
                ? `Set priority and notes for ${selectedEntry.name || selectedEntry.email}`
                : "Update entry priority"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="priority-score">Priority Score</Label>
              <Input
                id="priority-score"
                type="number"
                min={0}
                value={priorityValue}
                onChange={(e) => setPriorityValue(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority-notes">Notes (optional)</Label>
              <Textarea
                id="priority-notes"
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                placeholder="Add internal notes about this entry..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPriorityDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePrioritySubmit}
              disabled={priorityMutation.isPending}
            >
              {priorityMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Direct Invite Dialog */}
      <Dialog open={directInviteOpen} onOpenChange={setDirectInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Beta Invite</DialogTitle>
            <DialogDescription>
              Generate an invite code and send it via email immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="merchant@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-name">Name</Label>
              <Input
                id="invite-name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-company">Company</Label>
              <Input
                id="invite-company"
                value={inviteCompany}
                onChange={(e) => setInviteCompany(e.target.value)}
                placeholder="Company name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-notes">Notes</Label>
              <Textarea
                id="invite-notes"
                value={inviteNotes}
                onChange={(e) => setInviteNotes(e.target.value)}
                placeholder="Internal notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDirectInviteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!inviteEmail.trim()) {
                  toast.error("Email is required");
                  return;
                }
                directInviteMutation.mutate({
                  email: inviteEmail.trim(),
                  name: inviteName.trim() || undefined,
                  company_name: inviteCompany.trim() || undefined,
                  notes: inviteNotes.trim() || undefined,
                });
              }}
              disabled={directInviteMutation.isPending}
              className="gap-2"
            >
              {directInviteMutation.isPending ? (
                "Sending..."
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Invite
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
