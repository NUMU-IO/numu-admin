import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import {
  getCustomers,
  getCustomerStats,
  getDashboardStats,
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
  updateMerchantStatus,
  updateOrderStatus,
} from "./db";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
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
          status: z.enum(["active", "pending", "suspended", "inactive"]).optional(),
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
          status: z.enum(["active", "pending", "suspended", "inactive"]),
        })
      )
      .mutation(async ({ input }) => {
        return updateMerchantStatus(input.merchantId, input.status);
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
});

export type AppRouter = typeof appRouter;
