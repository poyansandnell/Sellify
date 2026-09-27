import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { externalSources } from "./externalSources";

export const externalListings = pgTable(
  "external_listings",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => externalSources.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    originalUrl: text("original_url").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    categoryId: integer("category_id"),
    category: text("category"),
    subcategory: text("subcategory"),
    brand: text("brand"),
    model: text("model"),
    color: text("color"),
    condition: text("condition"),
    price: numeric("price", { precision: 12, scale: 2 }),
    currency: text("currency"),
    country: text("country"),
    region: text("region"),
    city: text("city"),
    postalCode: text("postal_code"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    sellerName: text("seller_name"),
    sellerType: text("seller_type"),
    shippingAvailable: boolean("shipping_available"),
    auction: boolean("auction").notNull().default(false),
    auctionEnd: timestamp("auction_end", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text("status").notNull().default("UNKNOWN"),
    imageUrls: jsonb("image_urls").$type<string[]>().notNull().default([]),
    rawDataHash: text("raw_data_hash"),
    productFingerprint: text("product_fingerprint"),
    normalizationConfidence: doublePrecision("normalization_confidence"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("external_listings_source_external_idx").on(
      table.sourceId,
      table.externalId,
    ),
    uniqueIndex("external_listings_original_url_idx").on(table.originalUrl),
    index("external_listings_status_published_idx").on(
      table.status,
      table.publishedAt,
    ),
    index("external_listings_category_idx").on(table.categoryId),
    index("external_listings_product_fingerprint_idx").on(
      table.productFingerprint,
    ),
  ],
);

export type ExternalListing = typeof externalListings.$inferSelect;
export type InsertExternalListing = typeof externalListings.$inferInsert;