/**
 * Settings Page - NUMU Admin Dashboard
 * 
 * Features:
 * - Platform settings management
 * - Admin user management
 * - System configuration
 */

import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getLoginUrl } from "@/const";
import {
  listAdmins,
  inviteAdmin,
  revokeAdmin,
  type AdminUserItem,
} from "@/services/adminUsersApi";
import {
  getPlatformSettings,
  updatePlatformSettings,
  type PlatformSettings,
} from "@/services/platformSettingsApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Building2,
  Copy,
  CreditCard,
  Globe,
  Key,
  Loader2,
  Mail,
  Shield,
  Trash2,
  User,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const DEFAULT_SETTINGS: PlatformSettings = {
  platform_name: "NUMU",
  support_email: "support@numueg.app",
  default_currency: "USD",
  enable_new_merchant_signups: true,
  require_email_verification: true,
  enable_two_factor_auth: false,
  maintenance_mode: false,
  session_timeout_minutes: 60,
  max_login_attempts: 5,
};

export default function Settings() {
  const { user, loading, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // ── Admin Users ─────────────────────────────────────────────────────────
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const adminsQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: listAdmins,
    enabled: isAuthenticated,
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      inviteAdmin({
        email: inviteEmail.trim(),
        first_name: inviteFirstName.trim(),
        last_name: inviteLastName.trim(),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      if (data.email_sent) {
        toast.success(`Invite sent to ${data.user.email}`);
        setInviteOpen(false);
        resetInvite();
      } else if (data.temporary_password) {
        // No email sent — keep dialog open and surface the password so the
        // admin can copy it to the invitee out-of-band.
        setTempPassword(data.temporary_password);
        toast.message("Admin created — email couldn't be sent, copy the password");
      } else {
        toast.success("Admin created");
        setInviteOpen(false);
        resetInvite();
      }
    },
    onError: (err) => toast.error((err as Error).message || "Invite failed"),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeAdmin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Admin access revoked");
    },
    onError: (err) => toast.error((err as Error).message || "Revoke failed"),
  });

  const resetInvite = () => {
    setInviteEmail("");
    setInviteFirstName("");
    setInviteLastName("");
    setTempPassword(null);
  };

  const copyPassword = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  };

  // Platform settings — fetched from /admin/platform-settings, edited
  // locally, saved via a mutation. `draft` is the in-progress edit state;
  // we seed it from the query result once on first load.
  const settingsQuery = useQuery({
    queryKey: ["platform-settings"],
    queryFn: getPlatformSettings,
    enabled: isAuthenticated,
  });

  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Seed draft the first time we receive server data. Subsequent server
  // refetches won't clobber in-progress edits.
  if (draft === null && settingsQuery.data) {
    // Safe: React tolerates setState during render when it ends the render
    // immediately and re-renders with the new state.
    setDraft(settingsQuery.data);
  }

  const platformSettings = draft ?? settingsQuery.data ?? DEFAULT_SETTINGS;

  const setField = <K extends keyof PlatformSettings>(
    key: K,
    value: PlatformSettings[K],
  ) => {
    setDraft((prev) => {
      const base = prev ?? settingsQuery.data ?? DEFAULT_SETTINGS;
      return { ...base, [key]: value };
    });
    setIsDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: (patch: Partial<PlatformSettings>) =>
      updatePlatformSettings(patch),
    onSuccess: (saved) => {
      queryClient.setQueryData(["platform-settings"], saved);
      setDraft(saved);
      setIsDirty(false);
      toast.success("Settings saved");
    },
    onError: (err) =>
      toast.error((err as Error).message || "Failed to save settings"),
  });

  const handleSave = () => {
    if (!draft) return;
    // Send only changed fields — smaller payload + lets the server ignore
    // unchanged values.
    const original = settingsQuery.data ?? DEFAULT_SETTINGS;
    const patch: Partial<PlatformSettings> = {};
    (Object.keys(draft) as (keyof PlatformSettings)[]).forEach((k) => {
      if (draft[k] !== original[k]) {
        (patch as Record<string, unknown>)[k] = draft[k];
      }
    });
    if (Object.keys(patch).length === 0) {
      toast.message("Nothing to save");
      return;
    }
    saveMutation.mutate(patch);
  };
  const saving = saveMutation.isPending;

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState({
    newMerchantSignup: true,
    newOrder: true,
    orderStatusChange: false,
    paymentReceived: true,
    disputeOpened: true,
    systemAlerts: true,
  });

  // Show loading skeleton while checking auth
  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    const loginUrl = getLoginUrl();
    if (loginUrl) {
      window.location.href = loginUrl;
      return <DashboardLayoutSkeleton />;
    }
    // No OAuth configured (local dev) — render page with empty data
  }

  return (
    <DashboardLayout
      title="Settings"
      subtitle="Configure platform settings and preferences"
    >
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-card border">
          <TabsTrigger value="general" className="gap-2">
            <Building2 className="w-4 h-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="admins" className="gap-2">
            <Users className="w-4 h-4" />
            Admin Users
          </TabsTrigger>
          <TabsTrigger value="meta" className="gap-2">
            <Zap className="w-4 h-4" />
            Meta Credentials
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Platform Settings
                </CardTitle>
                <CardDescription>
                  Configure general platform settings and branding
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="platformName">Platform Name</Label>
                    <Input
                      id="platformName"
                      value={platformSettings.platform_name}
                      onChange={(e) => setField("platform_name", e.target.value)}
                      disabled={settingsQuery.isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supportEmail">Support Email</Label>
                    <Input
                      id="supportEmail"
                      type="email"
                      value={platformSettings.support_email}
                      onChange={(e) => setField("support_email", e.target.value)}
                      disabled={settingsQuery.isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultCurrency">Default Currency</Label>
                  <Input
                    id="defaultCurrency"
                    value={platformSettings.default_currency}
                    onChange={(e) =>
                      setField(
                        "default_currency",
                        e.target.value.toUpperCase().slice(0, 3),
                      )
                    }
                    className="w-32"
                    disabled={settingsQuery.isLoading}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable New Merchant Signups</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow new merchants to register on the platform
                      </p>
                    </div>
                    <Switch
                      checked={platformSettings.enable_new_merchant_signups}
                      onCheckedChange={(checked) =>
                        setField("enable_new_merchant_signups", checked)
                      }
                      disabled={settingsQuery.isLoading}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Require Email Verification</Label>
                      <p className="text-sm text-muted-foreground">
                        Require merchants to verify their email before activating
                      </p>
                    </div>
                    <Switch
                      checked={platformSettings.require_email_verification}
                      onCheckedChange={(checked) =>
                        setField("require_email_verification", checked)
                      }
                      disabled={settingsQuery.isLoading}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-amber-600">Maintenance Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Put the platform in maintenance mode (merchants cannot access)
                      </p>
                    </div>
                    <Switch
                      checked={platformSettings.maintenance_mode}
                      onCheckedChange={(checked) =>
                        setField("maintenance_mode", checked)
                      }
                      disabled={settingsQuery.isLoading}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-3">
              {isDirty && (
                <span className="text-xs text-amber-600">Unsaved changes</span>
              )}
              <Button
                onClick={handleSave}
                disabled={saving || !isDirty || settingsQuery.isLoading}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Email Notifications
              </CardTitle>
              <CardDescription>
                Configure which events trigger email notifications to admins
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries({
                newMerchantSignup: { label: "New Merchant Signup", desc: "When a new merchant registers" },
                newOrder: { label: "New Order", desc: "When a new order is placed on any store" },
                orderStatusChange: { label: "Order Status Change", desc: "When an order status is updated" },
                paymentReceived: { label: "Payment Received", desc: "When a payment is successfully processed" },
                disputeOpened: { label: "Dispute Opened", desc: "When a customer opens a dispute" },
                systemAlerts: { label: "System Alerts", desc: "Critical system alerts and warnings" },
              }).map(([key, { label, desc }]) => (
                <div key={key} className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <Label>{label}</Label>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={notificationSettings[key as keyof typeof notificationSettings]}
                    onCheckedChange={(checked) =>
                      setNotificationSettings((s) => ({ ...s, [key]: checked }))
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Settings
                </CardTitle>
                <CardDescription>
                  Configure security and authentication settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">
                      Require 2FA for all admin accounts
                    </p>
                  </div>
                  <Switch
                    checked={platformSettings.enable_two_factor_auth}
                    onCheckedChange={(checked) =>
                      setField("enable_two_factor_auth", checked)
                    }
                    disabled={settingsQuery.isLoading}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Session Settings</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Session Timeout (minutes)</Label>
                      <Input
                        type="number"
                        min={5}
                        max={1440}
                        value={platformSettings.session_timeout_minutes}
                        onChange={(e) =>
                          setField(
                            "session_timeout_minutes",
                            Math.max(5, Math.min(1440, Number(e.target.value) || 60)),
                          )
                        }
                        className="w-32"
                        disabled={settingsQuery.isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Login Attempts</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={platformSettings.max_login_attempts}
                        onChange={(e) =>
                          setField(
                            "max_login_attempts",
                            Math.max(1, Math.min(100, Number(e.target.value) || 5)),
                          )
                        }
                        className="w-32"
                        disabled={settingsQuery.isLoading}
                      />
                    </div>
                  </div>
                </div>
                {isDirty && (
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <span className="text-xs text-amber-600">Unsaved changes</span>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={saving || settingsQuery.isLoading}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  API Keys
                </CardTitle>
                <CardDescription>
                  Manage API keys for external integrations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">Production API Key</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        numu_live_••••••••••••••••
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Regenerate
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">Test API Key</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        numu_test_••••••••••••••••
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Regenerate
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Billing Settings */}
        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Billing Configuration
              </CardTitle>
              <CardDescription>
                Configure payment processing and billing settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Platform Fee (%)</Label>
                  <Input type="number" defaultValue={2.9} step={0.1} className="w-32" />
                  <p className="text-sm text-muted-foreground">
                    Percentage fee charged on each transaction
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Fixed Fee (cents)</Label>
                  <Input type="number" defaultValue={30} className="w-32" />
                  <p className="text-sm text-muted-foreground">
                    Fixed fee per transaction in cents
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Payment Providers</h4>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Zap className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium">Stripe</p>
                        <p className="text-sm text-muted-foreground">Connected</p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">PayPal</p>
                        <p className="text-sm text-muted-foreground">Not connected</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Connect
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Admin Users */}
        <TabsContent value="admins">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Admin Users
                </CardTitle>
                <CardDescription>
                  Manage admin access to the platform
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => { resetInvite(); setInviteOpen(true); }}>
                <Mail className="w-4 h-4 mr-2" />
                Invite Admin
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {adminsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : adminsQuery.isError ? (
                  <div className="py-6 text-sm text-red-600">
                    Couldn't load admin users: {(adminsQuery.error as Error).message}.
                    Make sure the backend build with the admin-users endpoint is deployed.
                  </div>
                ) : (
                  (adminsQuery.data ?? []).map((a: AdminUserItem) => {
                    const isMe = a.email === user?.email;
                    return (
                      <div
                        key={a.id}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          isMe
                            ? "bg-primary/5 border-primary/20"
                            : "bg-card border-border/60"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center shrink-0">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {a.first_name} {a.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">{a.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={`${
                              a.status === "active"
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {isMe ? "Owner" : a.status === "active" ? "Admin" : a.status}
                          </Badge>
                          {isMe ? (
                            <span className="text-sm text-muted-foreground">You</span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (
                                  confirm(
                                    `Revoke admin access for ${a.email}? They will no longer be able to sign in to the admin panel.`,
                                  )
                                ) {
                                  revokeMutation.mutate(a.id);
                                }
                              }}
                              disabled={revokeMutation.isPending}
                              title="Revoke admin access"
                            >
                              <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-600" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {adminsQuery.data && adminsQuery.data.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No admin users yet</p>
                    <p className="text-sm">Invite team members to help manage the platform</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Invite dialog */}
          <Dialog open={inviteOpen} onOpenChange={(open) => { setInviteOpen(open); if (!open) resetInvite(); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite an admin</DialogTitle>
                <DialogDescription>
                  They'll get an email with a temporary password and a link to the
                  admin panel. Ask them to change the password after their first
                  sign-in.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-first">First name</Label>
                    <Input
                      id="invite-first"
                      value={inviteFirstName}
                      onChange={(e) => setInviteFirstName(e.target.value)}
                      placeholder="Yahia"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-last">Last name</Label>
                    <Input
                      id="invite-last"
                      value={inviteLastName}
                      onChange={(e) => setInviteLastName(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="name@company.com"
                  />
                </div>

                {tempPassword && (
                  <div className="rounded-md border border-amber-300 bg-amber-50/60 p-3 text-sm">
                    <p className="font-medium text-amber-900 mb-1">
                      Copy this temporary password
                    </p>
                    <p className="text-amber-900/70 text-xs mb-2">
                      We couldn't send the welcome email, so share this with the
                      new admin yourself.
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-xs bg-white rounded px-2 py-1 border border-amber-200 break-all">
                        {tempPassword}
                      </code>
                      <Button size="sm" variant="outline" onClick={copyPassword}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => { setInviteOpen(false); resetInvite(); }}
                  disabled={inviteMutation.isPending}
                >
                  {tempPassword ? "Done" : "Cancel"}
                </Button>
                {!tempPassword && (
                  <Button
                    onClick={() => inviteMutation.mutate()}
                    disabled={
                      inviteMutation.isPending ||
                      !inviteEmail.trim() ||
                      !inviteFirstName.trim()
                    }
                  >
                    {inviteMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4 mr-2" />
                    )}
                    Send invite
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Meta Credentials */}
        <TabsContent value="meta">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Meta App Credentials
              </CardTitle>
              <CardDescription>
                Configure Facebook, Instagram, and WhatsApp integration credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="metaAppId">META_APP_ID</Label>
                  <Input
                    id="metaAppId"
                    placeholder="Enter your Meta App ID"
                    value={platformSettings.platformName}
                    onChange={(e) =>
                      setPlatformSettings((s) => ({ ...s, platformName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metaAppSecret">META_APP_SECRET</Label>
                  <Input
                    id="metaAppSecret"
                    type="password"
                    placeholder="Enter your Meta App Secret"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhookVerifyToken">META_WEBHOOK_VERIFY_TOKEN</Label>
                  <Input
                    id="webhookVerifyToken"
                    placeholder="Enter webhook verify token"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loginConfigId">META_LOGIN_CONFIG_ID</Label>
                  <Input
                    id="loginConfigId"
                    placeholder="Enter Login Config ID"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-4">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Credentials"}
                </Button>
                <Button variant="outline" onClick={() => toast.info("Test connection coming soon")}>
                  Test Connection
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                These credentials are used for Meta (Facebook, Instagram, WhatsApp) OAuth flows and webhook verification.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
