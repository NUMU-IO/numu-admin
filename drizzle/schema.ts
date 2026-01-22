import { bigint, decimal, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * NUMU Admin Backoffice Database Schema
 * 
 * This schema supports the admin dashboard for managing:
 * - Platform users (admins)
 * - Merchants (store owners)
 * - Orders (across all merchants)
 * - Customers (across all merchants)
 * - Products (across all merchants)
 */

// ============================================
// USERS TABLE (Admin Authentication)
// ============================================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================
// MERCHANTS TABLE
// ============================================
export const merchants = mysqlTable("merchants", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique merchant identifier */
  merchantId: varchar("merchantId", { length: 64 }).notNull().unique(),
  /** Store name */
  name: varchar("name", { length: 255 }).notNull(),
  /** Business email */
  email: varchar("email", { length: 320 }).notNull(),
  /** Store domain/subdomain */
  domain: varchar("domain", { length: 255 }),
  /** Store logo URL */
  logoUrl: text("logoUrl"),
  /** Merchant status */
  status: mysqlEnum("status", ["active", "pending", "suspended", "inactive"]).default("pending").notNull(),
  /** Subscription plan */
  plan: mysqlEnum("plan", ["free", "basic", "pro", "enterprise"]).default("free").notNull(),
  /** Country code */
  country: varchar("country", { length: 2 }),
  /** Business category */
  category: varchar("category", { length: 100 }),
  /** Total revenue generated (in cents) */
  totalRevenue: bigint("totalRevenue", { mode: "number" }).default(0),
  /** Total orders count */
  totalOrders: int("totalOrders").default(0),
  /** Total products count */
  totalProducts: int("totalProducts").default(0),
  /** Store settings JSON */
  settings: json("settings"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Merchant = typeof merchants.$inferSelect;
export type InsertMerchant = typeof merchants.$inferInsert;

// ============================================
// ORDERS TABLE
// ============================================
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique order identifier */
  orderId: varchar("orderId", { length: 64 }).notNull().unique(),
  /** Reference to merchant */
  merchantId: varchar("merchantId", { length: 64 }).notNull(),
  /** Reference to customer */
  customerId: varchar("customerId", { length: 64 }),
  /** Customer email */
  customerEmail: varchar("customerEmail", { length: 320 }),
  /** Customer name */
  customerName: varchar("customerName", { length: 255 }),
  /** Order status */
  status: mysqlEnum("status", ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"]).default("pending").notNull(),
  /** Payment status */
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "failed", "refunded"]).default("pending").notNull(),
  /** Order subtotal (in cents) */
  subtotal: bigint("subtotal", { mode: "number" }).notNull(),
  /** Tax amount (in cents) */
  tax: bigint("tax", { mode: "number" }).default(0),
  /** Shipping cost (in cents) */
  shipping: bigint("shipping", { mode: "number" }).default(0),
  /** Discount amount (in cents) */
  discount: bigint("discount", { mode: "number" }).default(0),
  /** Total amount (in cents) */
  total: bigint("total", { mode: "number" }).notNull(),
  /** Currency code */
  currency: varchar("currency", { length: 3 }).default("USD"),
  /** Shipping address JSON */
  shippingAddress: json("shippingAddress"),
  /** Billing address JSON */
  billingAddress: json("billingAddress"),
  /** Order items JSON */
  items: json("items"),
  /** Order notes */
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// ============================================
// CUSTOMERS TABLE
// ============================================
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique customer identifier */
  customerId: varchar("customerId", { length: 64 }).notNull().unique(),
  /** Reference to merchant */
  merchantId: varchar("merchantId", { length: 64 }).notNull(),
  /** Customer email */
  email: varchar("email", { length: 320 }).notNull(),
  /** Customer name */
  name: varchar("name", { length: 255 }),
  /** Phone number */
  phone: varchar("phone", { length: 32 }),
  /** Customer status */
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  /** Total orders count */
  totalOrders: int("totalOrders").default(0),
  /** Total spent (in cents) */
  totalSpent: bigint("totalSpent", { mode: "number" }).default(0),
  /** Default shipping address JSON */
  defaultAddress: json("defaultAddress"),
  /** Customer tags */
  tags: json("tags"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// ============================================
// PRODUCTS TABLE
// ============================================
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique product identifier */
  productId: varchar("productId", { length: 64 }).notNull().unique(),
  /** Reference to merchant */
  merchantId: varchar("merchantId", { length: 64 }).notNull(),
  /** Product name */
  name: varchar("name", { length: 255 }).notNull(),
  /** Product description */
  description: text("description"),
  /** Product SKU */
  sku: varchar("sku", { length: 100 }),
  /** Product price (in cents) */
  price: bigint("price", { mode: "number" }).notNull(),
  /** Compare at price (in cents) */
  compareAtPrice: bigint("compareAtPrice", { mode: "number" }),
  /** Cost per item (in cents) */
  costPerItem: bigint("costPerItem", { mode: "number" }),
  /** Currency code */
  currency: varchar("currency", { length: 3 }).default("USD"),
  /** Product status */
  status: mysqlEnum("status", ["active", "draft", "archived"]).default("draft").notNull(),
  /** Inventory quantity */
  inventory: int("inventory").default(0),
  /** Product category */
  category: varchar("category", { length: 100 }),
  /** Product images JSON */
  images: json("images"),
  /** Product variants JSON */
  variants: json("variants"),
  /** Product tags */
  tags: json("tags"),
  /** Total sales count */
  totalSales: int("totalSales").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ============================================
// PLATFORM STATS TABLE (Aggregated metrics)
// ============================================
export const platformStats = mysqlTable("platform_stats", {
  id: int("id").autoincrement().primaryKey(),
  /** Date for the stats */
  date: timestamp("date").notNull(),
  /** Total revenue (in cents) */
  totalRevenue: bigint("totalRevenue", { mode: "number" }).default(0),
  /** Total orders */
  totalOrders: int("totalOrders").default(0),
  /** New merchants */
  newMerchants: int("newMerchants").default(0),
  /** New customers */
  newCustomers: int("newCustomers").default(0),
  /** Active merchants */
  activeMerchants: int("activeMerchants").default(0),
  /** Conversion rate (percentage * 100) */
  conversionRate: int("conversionRate").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PlatformStats = typeof platformStats.$inferSelect;
export type InsertPlatformStats = typeof platformStats.$inferInsert;
