import { and, count, desc, eq, gte, like, lte, or, sql, sum } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  adminMerchantAssignments,
  customers,
  InsertCustomer,
  InsertMerchant,
  InsertOrder,
  InsertProduct,
  InsertUser,
  merchants,
  merchantStatusEnum,
  orders,
  orderStatusEnum,
  platformStats,
  products,
  productStatusEnum,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

type MerchantStatus = (typeof merchantStatusEnum.enumValues)[number];
type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
type ProductStatus = (typeof productStatusEnum.enumValues)[number];

interface RevenueByMonthRow {
  month: string;
  revenue: string | null;
  order_count: string | number | null;
}

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const client = postgres(process.env.DATABASE_URL);
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================
// USER QUERIES
// ============================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    // Always bump updatedAt on upsert
    updateSet.updatedAt = new Date();

    if (Object.keys(updateSet).length === 1) {
      // Only updatedAt — also set lastSignedIn as fallback
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getAllAdmins() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(users).where(
    or(eq(users.role, "admin"), eq(users.role, "super_admin"))
  );
}

// ============================================
// ADMIN MERCHANT ASSIGNMENTS
// ============================================

export async function getMerchantAssignments(adminId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available — cannot resolve merchant assignments");

  const rows = await db
    .select({ merchantId: adminMerchantAssignments.merchantId })
    .from(adminMerchantAssignments)
    .where(eq(adminMerchantAssignments.adminId, adminId));

  return rows.map((r) => r.merchantId);
}

export async function assignMerchant(adminId: number, merchantId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .insert(adminMerchantAssignments)
    .values({ adminId, merchantId })
    .onConflictDoNothing();
}

export async function unassignMerchant(adminId: number, merchantId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(adminMerchantAssignments)
    .where(
      and(
        eq(adminMerchantAssignments.adminId, adminId),
        eq(adminMerchantAssignments.merchantId, merchantId)
      )
    );
}

// ============================================
// MERCHANT QUERIES
// ============================================

export async function getMerchants(params: {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return { merchants: [], total: 0 };

  const { limit = 20, offset = 0, status, search } = params;

  const conditions = [];
  if (status) {
    conditions.push(eq(merchants.status, status as MerchantStatus));
  }
  if (search) {
    conditions.push(
      or(
        like(merchants.name, `%${search}%`),
        like(merchants.email, `%${search}%`),
        like(merchants.merchantId, `%${search}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(merchants)
      .where(whereClause)
      .orderBy(desc(merchants.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(merchants)
      .where(whereClause),
  ]);

  return {
    merchants: data,
    total: countResult[0]?.count ?? 0,
  };
}

export async function getMerchantById(merchantId: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(merchants)
    .where(eq(merchants.merchantId, merchantId))
    .limit(1);

  return result[0] ?? null;
}

export async function updateMerchantStatus(merchantId: string, status: string) {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(merchants)
    .set({ status: status as MerchantStatus, updatedAt: new Date() })
    .where(eq(merchants.merchantId, merchantId));

  return true;
}

export async function getMerchantStats() {
  const db = await getDb();
  if (!db) return { total: 0, active: 0, pending: 0, suspended: 0 };

  const result = await db
    .select({
      status: merchants.status,
      count: count(),
    })
    .from(merchants)
    .groupBy(merchants.status);

  const stats = { total: 0, active: 0, pending: 0, suspended: 0, inactive: 0 };
  result.forEach((row) => {
    stats[row.status as keyof typeof stats] = row.count;
    stats.total += row.count;
  });

  return stats;
}

// ============================================
// ORDER QUERIES
// ============================================

export async function getOrders(params: {
  limit?: number;
  offset?: number;
  status?: string;
  merchantId?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const db = await getDb();
  if (!db) return { orders: [], total: 0 };

  const { limit = 20, offset = 0, status, merchantId, search, startDate, endDate } = params;

  const conditions = [];
  if (status) {
    conditions.push(eq(orders.status, status as OrderStatus));
  }
  if (merchantId) {
    conditions.push(eq(orders.merchantId, merchantId));
  }
  if (search) {
    conditions.push(
      or(
        like(orders.orderId, `%${search}%`),
        like(orders.customerEmail, `%${search}%`),
        like(orders.customerName, `%${search}%`)
      )
    );
  }
  if (startDate) {
    conditions.push(gte(orders.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(orders.createdAt, endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(orders)
      .where(whereClause),
  ]);

  return {
    orders: data,
    total: countResult[0]?.count ?? 0,
  };
}

export async function getOrderById(orderId: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(orders)
    .where(eq(orders.orderId, orderId))
    .limit(1);

  return result[0] ?? null;
}

export async function updateOrderStatus(orderId: string, status: string) {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(orders)
    .set({ status: status as OrderStatus, updatedAt: new Date() })
    .where(eq(orders.orderId, orderId));

  return true;
}

export async function getOrderStats() {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };

  const result = await db
    .select({
      status: orders.status,
      count: count(),
    })
    .from(orders)
    .groupBy(orders.status);

  const stats = { total: 0, pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, refunded: 0 };
  result.forEach((row) => {
    stats[row.status as keyof typeof stats] = row.count;
    stats.total += row.count;
  });

  return stats;
}

// ============================================
// CUSTOMER QUERIES
// ============================================

export async function getCustomers(params: {
  limit?: number;
  offset?: number;
  merchantId?: string;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return { customers: [], total: 0 };

  const { limit = 20, offset = 0, merchantId, search } = params;

  const conditions = [];
  if (merchantId) {
    conditions.push(eq(customers.merchantId, merchantId));
  }
  if (search) {
    conditions.push(
      or(
        like(customers.name, `%${search}%`),
        like(customers.email, `%${search}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(whereClause)
      .orderBy(desc(customers.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(customers)
      .where(whereClause),
  ]);

  return {
    customers: data,
    total: countResult[0]?.count ?? 0,
  };
}

export async function getCustomerStats() {
  const db = await getDb();
  if (!db) return { total: 0, active: 0 };

  const [totalResult, activeResult] = await Promise.all([
    db.select({ count: count() }).from(customers),
    db.select({ count: count() }).from(customers).where(eq(customers.status, "active")),
  ]);

  return {
    total: totalResult[0]?.count ?? 0,
    active: activeResult[0]?.count ?? 0,
  };
}

// ============================================
// PRODUCT QUERIES
// ============================================

export async function getProducts(params: {
  limit?: number;
  offset?: number;
  merchantId?: string;
  status?: string;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return { products: [], total: 0 };

  const { limit = 20, offset = 0, merchantId, status, search } = params;

  const conditions = [];
  if (merchantId) {
    conditions.push(eq(products.merchantId, merchantId));
  }
  if (status) {
    conditions.push(eq(products.status, status as ProductStatus));
  }
  if (search) {
    conditions.push(
      or(
        like(products.name, `%${search}%`),
        like(products.sku, `%${search}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(desc(products.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(products)
      .where(whereClause),
  ]);

  return {
    products: data,
    total: countResult[0]?.count ?? 0,
  };
}

// ============================================
// PLATFORM DASHBOARD STATS
// ============================================

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) {
    return {
      totalRevenue: 0,
      activeMerchants: 0,
      totalOrders: 0,
      totalCustomers: 0,
      revenueChange: 0,
      merchantsChange: 0,
      ordersChange: 0,
      customersChange: 0,
    };
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [revenueResult, merchantsResult, ordersResult, customersResult] = await Promise.all([
    db
      .select({ total: sum(orders.total) })
      .from(orders)
      .where(and(gte(orders.createdAt, thirtyDaysAgo), eq(orders.paymentStatus, "paid"))),
    db.select({ count: count() }).from(merchants).where(eq(merchants.status, "active")),
    db.select({ count: count() }).from(orders).where(gte(orders.createdAt, thirtyDaysAgo)),
    db.select({ count: count() }).from(customers),
  ]);

  const [prevRevenueResult, prevOrdersResult] = await Promise.all([
    db
      .select({ total: sum(orders.total) })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, sixtyDaysAgo),
          lte(orders.createdAt, thirtyDaysAgo),
          eq(orders.paymentStatus, "paid")
        )
      ),
    db
      .select({ count: count() })
      .from(orders)
      .where(and(gte(orders.createdAt, sixtyDaysAgo), lte(orders.createdAt, thirtyDaysAgo))),
  ]);

  const currentRevenue = Number(revenueResult[0]?.total ?? 0);
  const prevRevenue = Number(prevRevenueResult[0]?.total ?? 0);
  const currentOrders = ordersResult[0]?.count ?? 0;
  const prevOrders = prevOrdersResult[0]?.count ?? 0;

  const revenueChange = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;
  const ordersChange = prevOrders > 0 ? ((currentOrders - prevOrders) / prevOrders) * 100 : 0;

  return {
    totalRevenue: currentRevenue,
    activeMerchants: merchantsResult[0]?.count ?? 0,
    totalOrders: currentOrders,
    totalCustomers: customersResult[0]?.count ?? 0,
    revenueChange: Math.round(revenueChange * 10) / 10,
    merchantsChange: 0,
    ordersChange: Math.round(ordersChange * 10) / 10,
    customersChange: 0,
  };
}

export async function getRevenueByMonth(months: number = 12) {
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const result = await db.execute(
    sql`SELECT
      TO_CHAR(created_at, 'YYYY-MM') as month,
      SUM(total) as revenue,
      COUNT(*) as order_count
    FROM admin_orders
    WHERE created_at >= ${startDate} AND payment_status = 'paid'
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
    ORDER BY month`
  );

  return (result as unknown as RevenueByMonthRow[]).map((row) => ({
    month: row.month,
    revenue: Number(row.revenue ?? 0),
    orders: Number(row.order_count ?? 0),
  }));
}

export async function getTopMerchants(limit: number = 5) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(merchants)
    .orderBy(desc(merchants.totalRevenue))
    .limit(limit);
}

export async function getRecentOrders(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}
