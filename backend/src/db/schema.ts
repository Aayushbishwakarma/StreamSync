import { pgTable, serial, varchar, boolean, timestamp } from "drizzle-orm/pg-core";

export const otpCodes = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  verified: boolean("verified").default(false).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rooms = pgTable("rooms", {
  id: varchar("id", { length: 20 }).primaryKey(), // e.g. "room-abc123"
  hostEmail: varchar("host_email", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: varchar("description", { length: 1000 }).notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(), // active | ended
  createdAt: timestamp("created_at").defaultNow().notNull(),
});