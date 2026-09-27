import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const externalSources = pgTable(
  "external_sources",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    country: text("country").notNull(),
    baseUrl: text("base_url"),
    sourceType: text("source_type").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    legalStatus: text("legal_status").notNull().default("REVIEW_REQUIRED"),
    legalApproval: boolean("legal_approval").notNull().default(false),
    legalApprovalReference: text("legal_approval_reference"),
    legalApprovedAt: timestamp("legal_approved_at", { withTimezone: true }),
    legalApprovedBy: text("legal_approved_by"),
    termsUrl: text("terms_url"),
    robotsUrl: text("robots_url"),
    robotsAllowsIndexing: boolean("robots_allows_indexing"),
    robotsCheckedAt: timestamp("robots_checked_at", { withTimezone: true }),
    apiDocsUrl: text("api_docs_url"),
    apiKeyRequired: boolean("api_key_required").notNull().default(false),
    partnershipRequired: boolean("partnership_required")
      .notNull()
      .default(false),
    partnershipApproved: boolean("partnership_approved").notNull().default(false),
    feedUrl: text("feed_url"),
    feedFormat: text("feed_format"),
    fieldMap: jsonb("field_map").$type<Record<string, string> | null>(),
    imageMode: text("image_mode").notNull().default("NO_EXTERNAL_IMAGES"),
    refreshInterval: integer("refresh_interval"),
    rateLimit: integer("rate_limit"),
    lastSuccess: timestamp("last_success", { withTimezone: true }),
    lastFailure: timestamp("last_failure", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("external_sources_enabled_legal_idx").on(
      table.enabled,
      table.legalStatus,
      table.legalApproval,
    ),
    index("external_sources_country_idx").on(table.country),
  ],
);

export type ExternalSource = typeof externalSources.$inferSelect;
export type InsertExternalSource = typeof externalSources.$inferInsert;