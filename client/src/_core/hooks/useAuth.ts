import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, logout as logoutApi, type AdminUser } from "@/services/authService";
import { getLoginUrl } from "@/const";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() ?? "" } =
    options ?? {};
  const queryClient = useQueryClient();

  const meQuery = useQuery<AdminUser | null>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        return await getMe();
      } catch {
        return null;
      }
    },
    retry: false,
    // Trust cache briefly so setQueryData after login isn't immediately
    // refetched, but short enough that returning to an idle tab fires a
    // fresh check. Combined with ``refetchOnWindowFocus``, this fixes
    // the idle-tab-404 case where the cached ``me`` still read
    // authenticated even after the cookie expired — the next API call
    // 401d and the apiClient redirected to ``/login`` without ever
    // re-syncing the React Query cache (so other components kept
    // rendering against stale state mid-flight).
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } finally {
      queryClient.setQueryData(["auth", "me"], null);
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    }
  }, [queryClient]);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading,
      error: meQuery.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [meQuery.data, meQuery.error, meQuery.isLoading]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;
    if (!redirectPath) return;

    window.location.href = redirectPath;
  }, [redirectOnUnauthenticated, redirectPath, meQuery.isLoading, state.user]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
