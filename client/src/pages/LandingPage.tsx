/**
 * Landing Page Management - NUMU Admin Dashboard
 *
 * Features:
 * - Toggle visibility of landing page sections
 * - Save configuration to backend
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  Eye,
  EyeOff,
  Globe,
  GripVertical,
  Layout,
  Save,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const SECTION_DEFS = [
  { id: "hero", label: "Hero", description: "Main headline, CTA buttons, and trust badges", icon: "\u{1F3E0}" },
  { id: "preview", label: "Dashboard Preview", description: "Interactive chart and stats preview", icon: "\u{1F4CA}" },
  { id: "features", label: "Features", description: "Platform feature cards grid", icon: "\u26A1" },
  { id: "import-showcase", label: "Import Showcase", description: "Animated Instagram/Facebook import demo", icon: "\u{1F4F1}" },
  { id: "ai-showcase", label: "AI Showcase", description: "AI product description generation demo", icon: "\u{1F916}" },
  { id: "multichannel-showcase", label: "Multi-Channel Showcase", description: "Multi-channel selling dashboard demo", icon: "\u{1F4F2}" },
  { id: "integrations", label: "Integrations", description: "Connected services orbital visualization", icon: "\u{1F517}" },
  { id: "testimonials", label: "Testimonials", description: "Customer success stories", icon: "\u{1F4AC}" },
  { id: "cta", label: "Call to Action", description: "Final conversion prompt with trial button", icon: "\u{1F680}" },
  { id: "footer", label: "Footer", description: "Navigation links, social icons, copyright", icon: "\u{1F4CB}" },
];

type SectionsConfig = Record<string, { visible: boolean; order: number }>;

export default function LandingPage() {
  const { loading, isAuthenticated } = useAuth();

  const configQuery = trpc.landingPage.getConfig.useQuery();
  const updateMutation = trpc.landingPage.updateConfig.useMutation();
  const utils = trpc.useUtils();

  const [localSections, setLocalSections] = useState<SectionsConfig | null>(null);

  // Initialize local state from server data
  useEffect(() => {
    if (configQuery.data?.sections && localSections === null) {
      setLocalSections(configQuery.data.sections);
    }
  }, [configQuery.data, localSections]);

  // Track whether there are unsaved changes
  const hasChanges = useMemo(() => {
    if (!localSections || !configQuery.data?.sections) return false;
    return JSON.stringify(localSections) !== JSON.stringify(configQuery.data.sections);
  }, [localSections, configQuery.data]);

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

  const handleToggle = (sectionId: string, checked: boolean) => {
    setLocalSections((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [sectionId]: { ...prev[sectionId], visible: checked },
      };
    });
  };

  const handleSave = async () => {
    if (!localSections) return;
    try {
      await updateMutation.mutateAsync({ sections: localSections });
      await utils.landingPage.getConfig.invalidate();
      toast.success("Landing page configuration saved successfully");
    } catch {
      toast.error("Failed to save landing page configuration");
    }
  };

  const sections = localSections ?? configQuery.data?.sections ?? {};

  return (
    <DashboardLayout
      title="Landing Page"
      subtitle="Control which sections are visible on the marketing landing page"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layout className="w-5 h-5" />
              Section Visibility
            </CardTitle>
            <CardDescription>
              Toggle sections on or off. Changes apply to the public landing page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {SECTION_DEFS.map((def, index) => {
              const config = sections[def.id];
              const isVisible = config?.visible ?? true;
              const isHero = def.id === "hero";

              return (
                <div key={def.id}>
                  {index > 0 && <Separator className="my-3" />}
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-muted-foreground/40" />
                      <span className="text-lg">{def.icon}</span>
                      <div>
                        <p className="font-medium">{def.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {def.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={isVisible ? "default" : "secondary"}
                        className={
                          isVisible
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {isVisible ? (
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            Visible
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <EyeOff className="w-3 h-3" />
                            Hidden
                          </span>
                        )}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={isVisible}
                          onCheckedChange={(checked) => handleToggle(def.id, checked)}
                          disabled={isHero}
                        />
                        {isHero && (
                          <span className="text-xs text-muted-foreground">(Always visible)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
