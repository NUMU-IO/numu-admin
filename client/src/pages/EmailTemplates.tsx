/**
 * Email Templates Page - NUMU Admin Dashboard
 *
 * Read-only listing of the registry's email-event catalog. Admins can:
 *  - Browse the registered events with their default subjects.
 *  - Open the read-only viewer for any event/language pair.
 *  - Send a test email of the registry default to their own admin inbox.
 *
 * Backed by `GET /api/v1/admin/email-templates/events` (read-only).
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getLoginUrl } from "@/const";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  listAdminEmailTemplateEvents,
  sendTestAdminEmail,
  type EmailTemplateEventInfo,
} from "@/services/emailTemplatesApi";
import { Eye, Mail, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Language = "en" | "ar";

export default function EmailTemplates() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [language, setLanguage] = useState<Language>("en");
  const [testEvent, setTestEvent] = useState<EmailTemplateEventInfo | null>(
    null,
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "email-templates", "events"],
    queryFn: listAdminEmailTemplateEvents,
    enabled: isAuthenticated,
  });

  const sendTestMutation = useMutation({
    mutationFn: ({
      eventType,
      recipient,
    }: {
      eventType: string;
      recipient: string;
    }) =>
      sendTestAdminEmail(eventType, language, { recipient }),
    onSuccess: (result) => {
      if (result.sent) {
        toast.success("Test email dispatched");
      } else {
        toast.warning("Email service did not confirm send");
      }
      setTestEvent(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to send test email");
    },
  });

  if (loading) return <DashboardLayoutSkeleton />;

  if (!isAuthenticated) {
    const loginUrl = getLoginUrl();
    if (loginUrl) {
      window.location.href = loginUrl;
      return <DashboardLayoutSkeleton />;
    }
  }

  const events = data ?? [];

  const handleView = (eventType: string) => {
    setLocation(`/email-templates/${eventType}/${language}`);
  };

  const handleSendTest = () => {
    if (!testEvent || !user?.email) return;
    sendTestMutation.mutate({
      eventType: testEvent.event_type,
      recipient: user.email,
    });
  };

  const getDefaultSubject = (event: EmailTemplateEventInfo) =>
    language === "ar" ? event.default_subject_ar : event.default_subject_en;

  const getLabel = (event: EmailTemplateEventInfo) =>
    language === "ar" ? event.label_ar : event.label_en;

  return (
    <DashboardLayout
      title="Email Templates"
      subtitle="Defaults — read-only registry of customer-facing emails"
    >
      {/* Filters */}
      <div className="dashboard-card mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Showing the registry-default subject in the selected language.
            </p>
          </div>
          <div className="md:ml-auto">
            <Select
              value={language}
              onValueChange={(v) => setLanguage(v as Language)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">Arabic</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="dashboard-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Default subject</TableHead>
              <TableHead className="w-32">Variables</TableHead>
              <TableHead className="w-56 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  Loading email events...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-8 text-red-600"
                >
                  Failed to load email events:{" "}
                  {(error as Error).message ?? "unknown error"}
                </TableCell>
              </TableRow>
            ) : events.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-8 text-muted-foreground"
                >
                  No email events registered.
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => {
                const variableCount = Object.keys(event.variables ?? {}).length;
                return (
                  <TableRow key={event.event_type}>
                    <TableCell>
                      <div>
                        <p className="font-medium font-mono text-sm">
                          {event.event_type}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {getLabel(event)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="truncate" title={getDefaultSubject(event)}>
                        {getDefaultSubject(event) || (
                          <span className="text-muted-foreground italic">
                            (none)
                          </span>
                        )}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-indigo-100 text-indigo-700">
                        {variableCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleView(event.event_type)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTestEvent(event)}
                        >
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                          Send test
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Send Test Dialog */}
      <Dialog
        open={testEvent !== null}
        onOpenChange={(open) => {
          if (!open) setTestEvent(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send test email</DialogTitle>
            <DialogDescription>
              The rendered registry default will be sent to your admin email
              address. Recipients are pinned by the backend — you cannot send
              to anyone else.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {testEvent && (
              <>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Event
                  </p>
                  <p className="font-mono text-sm">{testEvent.event_type}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Language
                  </p>
                  <p className="text-sm">
                    {language === "ar" ? "Arabic" : "English"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Recipient
                  </p>
                  <p className="text-sm">
                    {user?.email || (
                      <span className="text-red-600">
                        No admin email available
                      </span>
                    )}
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTestEvent(null)}
              disabled={sendTestMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendTest}
              disabled={sendTestMutation.isPending || !user?.email}
            >
              {sendTestMutation.isPending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
