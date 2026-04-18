/**
 * Merchants Page - NUMU Admin Dashboard
 *
 * Features:
 * - List all merchants with search and filters
 * - View merchant details
 * - Update merchant status (active/pending_approval/suspended/inactive)
 * - View merchant analytics
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMerchants, getMerchantStats, updateMerchantStatus, impersonateMerchant } from "@/services/merchantService";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  LogIn,
  MoreHorizontal,
  Search,
  ShoppingCart,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending_approval: "bg-amber-100 text-amber-700",
  suspended: "bg-red-100 text-red-700",
  inactive: "bg-gray-100 text-gray-700",
};

const statusLabels: Record<string, string> = {
  active: "Active",
  pending_approval: "Pending",
  suspended: "Suspended",
  inactive: "Inactive",
};

const planColors: Record<string, string> = {
  free: "bg-gray-100 text-gray-700",
  demo: "bg-orange-100 text-orange-700",
  basic: "bg-blue-100 text-blue-700",
  starter: "bg-blue-100 text-blue-700",
  pro: "bg-purple-100 text-purple-700",
  enterprise: "bg-indigo-100 text-indigo-700",
};

export default function Merchants() {
  const { user, loading, isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selectedMerchant, setSelectedMerchant] = useState<any>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");

  const limit = 10;

  const queryClient = useQueryClient();

  const queryParams = {
    limit,
    offset: page * limit,
    status: statusFilter !== "all" ? statusFilter : undefined,
    search: search || undefined,
  };

  // Fetch merchants
  const { data, isLoading } = useQuery({
    queryKey: ["merchants", "list", queryParams],
    queryFn: () => getMerchants(queryParams),
    enabled: isAuthenticated,
  });

  // Fetch merchant stats
  const { data: stats } = useQuery({
    queryKey: ["merchants", "stats"],
    queryFn: getMerchantStats,
    enabled: isAuthenticated,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ merchantId, status }: { merchantId: string; status: string }) =>
      updateMerchantStatus(merchantId, status),
    onSuccess: () => {
      toast.success("Merchant status updated successfully");
      setShowStatusDialog(false);
      setSelectedMerchant(null);
      queryClient.invalidateQueries({ queryKey: ["merchants"] });
    },
    onError: () => {
      toast.error("Failed to update merchant status");
    },
  });

  // Impersonate mutation — mints merchant-hub cookies for the store's owner
  // and opens the hub in a new tab logged in as them.
  const impersonateMutation = useMutation({
    mutationFn: (merchantId: string) => impersonateMerchant(merchantId),
    onSuccess: (data) => {
      toast.success(`Opening hub as ${data.owner_email}`);
      window.open(data.dashboard_url, "_blank", "noopener,noreferrer");
    },
    onError: (err) => {
      toast.error((err as Error).message || "Failed to impersonate");
    },
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

  const merchants = data?.merchants ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  const handleStatusChange = () => {
    if (selectedMerchant && newStatus) {
      updateStatusMutation.mutate({
        merchantId: selectedMerchant.merchantId,
        status: newStatus as any,
      });
    }
  };

  return (
    <DashboardLayout
      title="Merchants"
      subtitle="Manage all merchants on the platform"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="dashboard-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Merchants</p>
            <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
          </div>
        </div>
        <div className="dashboard-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Users className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-emerald-600">{stats?.active ?? 0}</p>
          </div>
        </div>
        <div className="dashboard-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
            <Clock className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Pending Approval</p>
            <p className="text-2xl font-bold text-amber-600">{stats?.pending_approval ?? 0}</p>
          </div>
        </div>
        <div className="dashboard-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
            <ShoppingCart className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Suspended</p>
            <p className="text-2xl font-bold text-red-600">{stats?.suspended ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="dashboard-card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search merchants by name, email, or subdomain..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="pl-10"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending_approval">Pending Approval</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Merchants Table */}
      <div className="dashboard-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Merchant</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading merchants...
                </TableCell>
              </TableRow>
            ) : merchants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No merchants found
                </TableCell>
              </TableRow>
            ) : (
              merchants.map((merchant) => (
                <TableRow key={merchant.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary">
                          {merchant.name.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{merchant.name}</p>
                        <p className="text-sm text-muted-foreground">{merchant.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {merchant.domain ? (
                      <a
                        href={`https://${merchant.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        {merchant.domain}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[merchant.status] || "bg-gray-100 text-gray-700"}>
                      {statusLabels[merchant.status] || merchant.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={planColors[merchant.plan]}>
                      {merchant.plan}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(merchant.totalRevenue ?? 0)}
                  </TableCell>
                  <TableCell>{merchant.totalOrders ?? 0}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(merchant.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Log in as merchant"
                        onClick={() => impersonateMutation.mutate(merchant.merchantId)}
                        disabled={impersonateMutation.isPending}
                      >
                        <LogIn className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedMerchant(merchant);
                          setNewStatus(merchant.status);
                          setShowStatusDialog(true);
                        }}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total} merchants
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Status Update Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Merchant Status</DialogTitle>
            <DialogDescription>
              Change the status for {selectedMerchant?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">
                  {selectedMerchant?.status === "pending_approval" ? "Approve (Active)" : "Active"}
                </SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStatusChange}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
