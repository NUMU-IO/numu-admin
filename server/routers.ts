import { COOKIE_NAME, SESSION_DURATION_MS } from "@shared/const";
import axios from "axios";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
// Import from the new NUMU data layer (with API fallback to local DB)
import {
  getCustomers,
  getCustomerStats,
  getDashboardStats,
  getLandingConfig,
  getMerchantById,
  getMerchants,
  getMerchantStats,
  getOrderById,
  getOrders,
  getOrderStats,
  getProducts,
  getRecentOrders,
  getRevenueByMonth,
  getTopMerchants,
  updateLandingConfig,
  updateMerchantStatus,
  updateOrderStatus,
} from "./numuDataLayer";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const numuApiUrl = process.env.NUMU_API_URL;

        if (!numuApiUrl) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "NUMU_API_URL is not configured" });
        }

        try {
          const res = await axios.post(`${numuApiUrl}/api/v1/auth/login`, {
            email: input.email,
            password: input.password,
          });
          const user = res.data?.data?.user;
          if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Invalid response from NUMU API" });

          const allowedRoles = ["admin", "super_admin"];
          const userRole = user.role?.toLowerCase().trim();
          if (!allowedRoles.includes(userRole)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
          }

          // Sync user into local admin DB (best-effort — skip if DB unavailable)
          try {
            await db.upsertUser({
              openId: user.id,
              name: user.full_name ?? user.name ?? null,
              email: user.email ?? null,
              loginMethod: "email",
              lastSignedIn: new Date(),
            });
          } catch (dbErr) {
            console.warn("[Auth] Could not sync user to local DB (non-fatal):", dbErr);
          }

          const sessionToken = await sdk.createSessionToken(user.id, {
            name: user.full_name ?? user.name ?? "",
            expiresInMs: SESSION_DURATION_MS,
          });
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_DURATION_MS });

          return { success: true as const, name: user.full_name ?? user.name ?? "", email: user.email, role: user.role };
        } catch (e: unknown) {
          if (e instanceof TRPCError) throw e;
          const err = e as { response?: { status?: number; data?: unknown }; message?: string };
          const status = err?.response?.status;
          console.error("[Auth] Login error — status:", status, "message:", err?.message, "response:", err?.response?.data);
          if (status === 401 || status === 400 || status === 422) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
          }
          const detail = err?.message ?? "unknown error";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Login failed: ${detail}` });
        }
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ============================================
  // DASHBOARD (Admin Only)
  // ============================================
  dashboard: router({
    stats: adminProcedure.query(async () => {
      return getDashboardStats();
    }),
    
    revenueByMonth: adminProcedure
      .input(z.object({ months: z.number().min(1).max(24).default(12) }).optional())
      .query(async ({ input }) => {
        return getRevenueByMonth(input?.months ?? 12);
      }),
    
    topMerchants: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(20).default(5) }).optional())
      .query(async ({ input }) => {
        return getTopMerchants(input?.limit ?? 5);
      }),
    
    recentOrders: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(10) }).optional())
      .query(async ({ input }) => {
        return getRecentOrders(input?.limit ?? 10);
      }),
  }),

  // ============================================
  // MERCHANTS (Admin Only)
  // ============================================
  merchants: router({
    list: adminProcedure
      .input(
        z.object({
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
          status: z.enum(["active", "pending_approval", "suspended", "inactive"]).optional(),
          search: z.string().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return getMerchants({
          limit: input?.limit ?? 20,
          offset: input?.offset ?? 0,
          status: input?.status,
          search: input?.search,
        });
      }),

    getById: adminProcedure
      .input(z.object({ merchantId: z.string() }))
      .query(async ({ input }) => {
        return getMerchantById(input.merchantId);
      }),

    updateStatus: adminProcedure
      .input(
        z.object({
          merchantId: z.string(),
          status: z.enum(["active", "pending_approval", "suspended", "inactive"]),
          reason: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return updateMerchantStatus(input.merchantId, input.status, input.reason);
      }),

    stats: adminProcedure.query(async () => {
      return getMerchantStats();
    }),
  }),

  // ============================================
  // ORDERS (Admin Only)
  // ============================================
  orders: router({
    list: adminProcedure
      .input(
        z.object({
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
          status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled", "refunded"]).optional(),
          merchantId: z.string().optional(),
          search: z.string().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return getOrders({
          limit: input?.limit ?? 20,
          offset: input?.offset ?? 0,
          status: input?.status,
          merchantId: input?.merchantId,
          search: input?.search,
          startDate: input?.startDate,
          endDate: input?.endDate,
        });
      }),

    getById: adminProcedure
      .input(z.object({ orderId: z.string() }))
      .query(async ({ input }) => {
        return getOrderById(input.orderId);
      }),

    updateStatus: adminProcedure
      .input(
        z.object({
          orderId: z.string(),
          status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled", "refunded"]),
        })
      )
      .mutation(async ({ input }) => {
        return updateOrderStatus(input.orderId, input.status);
      }),

    stats: adminProcedure.query(async () => {
      return getOrderStats();
    }),
  }),

  // ============================================
  // CUSTOMERS (Admin Only)
  // ============================================
  customers: router({
    list: adminProcedure
      .input(
        z.object({
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
          merchantId: z.string().optional(),
          search: z.string().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return getCustomers({
          limit: input?.limit ?? 20,
          offset: input?.offset ?? 0,
          merchantId: input?.merchantId,
          search: input?.search,
        });
      }),

    stats: adminProcedure.query(async () => {
      return getCustomerStats();
    }),
  }),

  // ============================================
  // PRODUCTS (Admin Only)
  // ============================================
  products: router({
    list: adminProcedure
      .input(
        z.object({
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
          merchantId: z.string().optional(),
          status: z.enum(["active", "draft", "archived"]).optional(),
          search: z.string().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return getProducts({
          limit: input?.limit ?? 20,
          offset: input?.offset ?? 0,
          merchantId: input?.merchantId,
          status: input?.status,
          search: input?.search,
        });
      }),
  }),

  // ============================================
  // LANDING PAGE CONFIG (Admin Only)
  // ============================================
  landingPage: router({
    getConfig: adminProcedure.query(async () => {
      return getLandingConfig();
    }),
    updateConfig: adminProcedure
      .input(z.object({
        sections: z.record(z.string(), z.object({
          visible: z.boolean(),
          order: z.number(),
        })),
      }))
      .mutation(async ({ input }) => {
        return updateLandingConfig(input);
      }),
  }),
});

export type AppRouter = typeof appRouter;
