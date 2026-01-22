import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user-123",
    email: "admin@numu.io",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createNonAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user-456",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUnauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Admin Dashboard API", () => {
  describe("dashboard.stats", () => {
    it("allows admin users to fetch dashboard stats", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.dashboard.stats();

      expect(result).toHaveProperty("totalRevenue");
      expect(result).toHaveProperty("activeMerchants");
      expect(result).toHaveProperty("totalOrders");
      expect(result).toHaveProperty("totalCustomers");
      expect(typeof result.totalRevenue).toBe("number");
      expect(typeof result.activeMerchants).toBe("number");
    });

    it("rejects non-admin users from fetching dashboard stats", async () => {
      const ctx = createNonAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.dashboard.stats()).rejects.toThrow();
    });

    it("rejects unauthenticated users from fetching dashboard stats", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.dashboard.stats()).rejects.toThrow();
    });
  });

  describe("merchants.list", () => {
    it("allows admin users to list merchants", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.merchants.list();

      expect(result).toHaveProperty("merchants");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.merchants)).toBe(true);
      expect(typeof result.total).toBe("number");
    });

    it("allows admin users to filter merchants by status", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.merchants.list({ status: "active" });

      expect(result).toHaveProperty("merchants");
      expect(result).toHaveProperty("total");
    });

    it("allows admin users to search merchants", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.merchants.list({ search: "test" });

      expect(result).toHaveProperty("merchants");
      expect(result).toHaveProperty("total");
    });

    it("rejects non-admin users from listing merchants", async () => {
      const ctx = createNonAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.merchants.list()).rejects.toThrow();
    });
  });

  describe("merchants.stats", () => {
    it("allows admin users to fetch merchant stats", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.merchants.stats();

      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("active");
      expect(result).toHaveProperty("pending");
      expect(result).toHaveProperty("suspended");
    });

    it("rejects non-admin users from fetching merchant stats", async () => {
      const ctx = createNonAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.merchants.stats()).rejects.toThrow();
    });
  });

  describe("orders.list", () => {
    it("allows admin users to list orders", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.orders.list();

      expect(result).toHaveProperty("orders");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.orders)).toBe(true);
    });

    it("allows admin users to filter orders by status", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.orders.list({ status: "pending" });

      expect(result).toHaveProperty("orders");
      expect(result).toHaveProperty("total");
    });

    it("rejects non-admin users from listing orders", async () => {
      const ctx = createNonAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.orders.list()).rejects.toThrow();
    });
  });

  describe("orders.stats", () => {
    it("allows admin users to fetch order stats", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.orders.stats();

      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("pending");
      expect(result).toHaveProperty("processing");
      expect(result).toHaveProperty("shipped");
      expect(result).toHaveProperty("delivered");
      expect(result).toHaveProperty("cancelled");
    });

    it("rejects non-admin users from fetching order stats", async () => {
      const ctx = createNonAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.orders.stats()).rejects.toThrow();
    });
  });

  describe("customers.list", () => {
    it("allows admin users to list customers", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.customers.list();

      expect(result).toHaveProperty("customers");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.customers)).toBe(true);
    });

    it("allows admin users to search customers", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.customers.list({ search: "test@example.com" });

      expect(result).toHaveProperty("customers");
      expect(result).toHaveProperty("total");
    });

    it("rejects non-admin users from listing customers", async () => {
      const ctx = createNonAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.customers.list()).rejects.toThrow();
    });
  });

  describe("customers.stats", () => {
    it("allows admin users to fetch customer stats", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.customers.stats();

      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("active");
    });

    it("rejects non-admin users from fetching customer stats", async () => {
      const ctx = createNonAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.customers.stats()).rejects.toThrow();
    });
  });

  describe("products.list", () => {
    it("allows admin users to list products", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.products.list();

      expect(result).toHaveProperty("products");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.products)).toBe(true);
    });

    it("allows admin users to filter products by status", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.products.list({ status: "active" });

      expect(result).toHaveProperty("products");
      expect(result).toHaveProperty("total");
    });

    it("rejects non-admin users from listing products", async () => {
      const ctx = createNonAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.products.list()).rejects.toThrow();
    });
  });
});

describe("Auth API", () => {
  describe("auth.me", () => {
    it("returns user info for authenticated users", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();

      expect(result).not.toBeNull();
      expect(result?.email).toBe("admin@numu.io");
      expect(result?.role).toBe("admin");
    });

    it("returns null for unauthenticated users", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();

      expect(result).toBeNull();
    });
  });
});
