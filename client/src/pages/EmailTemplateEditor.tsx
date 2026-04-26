/**
 * Email Template Editor (read-only viewer) - NUMU Admin Dashboard
 *
 * Displays the registry default for a single (event_type, language) pair.
 * For the MVP these are read-only — defaults live in
 * `email_template_registry.py`. Once the registry promotes to DB-stored
 * defaults this page can become editable.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getLoginUrl } from "@/const";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getAdminEmailDefault,
  listAdminEmailTemplateEvents,
  previewAdminEmailDefault,
  sendTestAdminEmail,
} from "@/services/emailTemplatesApi";
import { ArrowLeft, Info, Lock, Send } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Language = "en" | "ar";

interface EmailTemplateEditorProps {
  eventType: string;
  language: Language;
}

export default function EmailTemplateEditor({
  eventType,
  language,
}: EmailTemplateEditorProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const defaultQuery = useQuery({
    queryKey: ["admin", "email-templates", "default", eventType, language],
    queryFn: () => getAdminEmailDefault(eventType, language),
    enabled: isAuthenticated && Boolean(eventType) && Boolean(language),
  });

  const eventsQuery = useQuery({
    queryKey: ["admin", "email-templates", "events"],
    queryFn: listAdminEmailTemplateEvents,
    enabled: isAuthenticated,
  });

  const previewQuery = useQuery({
    queryKey: ["admin", "email-templates", "preview", eventType, language],
    queryFn: () => previewAdminEmailDefault(eventType, language),
    enabled: isAuthenticated && Boolean(eventType) && Boolean(language),
  });

  const sendTestMutation = useMutation({
    mutationFn: () => {
      if (!user?.email) {
        throw new Error("Admin email not available");
      }
      return sendTestAdminEmail(eventType, language, {
        recipient: user.email,
      });
    },
    onSuccess: (result) => {
      if (result.sent) {
        toast.success("Test email dispatched");
      } else {
        toast.warning("Email service did not confirm send");
      }
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

  const event =
    eventsQuery.data?.find((e) => e.event_type === eventType) ?? null;
  const defaultTemplate = defaultQuery.data ?? null;
  const previewSubject = previewQuery.data?.subject ?? "";
  const previewHtml = previewQuery.data?.html ?? "";
  const isLoadingData = defaultQuery.isLoading || previewQuery.isLoading;
  const fetchError =
    (defaultQuery.error as Error | null) ?? (previewQuery.error as Error | null);

  const variableEntries = Object.entries(event?.variables ?? {});

  return (
    <DashboardLayout
      title={event ? event.label_en : eventType}
      subtitle={`Registry default · ${language === "ar" ? "Arabic" : "English"}`}
    >
      {/* Header strip */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation("/email-templates")}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to email templates
        </Button>
        <div className="flex items-center gap-2 md:ml-2">
          <Badge className="bg-amber-100 text-amber-700 gap-1">
            <Lock className="w-3 h-3" />
            Default · read-only
          </Badge>
          <Badge className="bg-indigo-100 text-indigo-700 font-mono">
            {eventType}
          </Badge>
          <Badge className="bg-gray-100 text-gray-700 uppercase">
            {language}
          </Badge>
        </div>
      </div>

      {/* Read-only banner */}
      <div className="dashboard-card mb-6 flex items-start gap-3 border-l-4 border-indigo-400">
        <Info className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium">
            Defaults are managed in code (
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
              email_template_registry.py
            </code>
            ).
          </p>
          <p className="text-sm text-muted-foreground">
            When the registry promotes to DB-stored defaults, this page will
            become editable. For now, view-only.
          </p>
        </div>
      </div>

      {fetchError ? (
        <div className="dashboard-card text-center py-8 text-red-600">
          Failed to load template: {fetchError.message}
        </div>
      ) : isLoadingData ? (
        <div className="dashboard-card text-center py-8 text-muted-foreground">
          Loading template...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Source */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subject</CardTitle>
                <CardDescription>Default subject line (read-only)</CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  readOnly
                  value={defaultTemplate?.subject ?? ""}
                  className="font-mono text-sm"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">HTML body</CardTitle>
                <CardDescription>
                  Raw template source — Jinja2 with sandboxed rendering
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  readOnly
                  value={defaultTemplate?.html_body ?? ""}
                  className="font-mono text-xs h-[420px] resize-none"
                  spellCheck={false}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Variables</CardTitle>
                <CardDescription>
                  Allowed template variables for this event
                </CardDescription>
              </CardHeader>
              <CardContent>
                {variableEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No variables registered.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {variableEntries.map(([name, description]) => (
                      <div
                        key={name}
                        className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg"
                      >
                        <code className="font-mono text-xs bg-background border px-2 py-0.5 rounded mt-0.5">
                          {`{{ ${name} }}`}
                        </code>
                        <p className="text-sm text-muted-foreground flex-1">
                          {description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Send test</CardTitle>
                <CardDescription>
                  Sends the rendered default to your admin email. Recipient is
                  pinned by the backend — you cannot send to anyone else.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Recipient: </span>
                  <span className="font-medium">
                    {user?.email || (
                      <span className="text-red-600">
                        No admin email available
                      </span>
                    )}
                  </span>
                </div>
                <Button
                  onClick={() => sendTestMutation.mutate()}
                  disabled={sendTestMutation.isPending || !user?.email}
                >
                  <Send className="w-4 h-4 mr-1.5" />
                  {sendTestMutation.isPending
                    ? "Sending..."
                    : "Send to my admin email"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Preview */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subject preview</CardTitle>
                <CardDescription>
                  Rendered against sample data from the registry
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  readOnly
                  value={previewSubject}
                  className="font-medium"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">HTML preview</CardTitle>
                <CardDescription>
                  Sandboxed iframe — scripts disabled
                </CardDescription>
              </CardHeader>
              <CardContent>
                <iframe
                  title="Email HTML preview"
                  srcDoc={previewHtml}
                  sandbox=""
                  className="w-full h-[700px] border rounded-lg bg-white"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
