import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(), // Clerk user id
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  city: text("city"),
  country: text("country"),
  language: text("language").default("sv"),
  currency: text("currency").default("SEK"),
  termsAcceptedVersion: text("terms_accepted_version"),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  isModerator: boolean("is_moderator").notNull().default(false),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  suspensionReason: text("suspension_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nameSv: text("name_sv").notNull(),
  nameEn: text("name_en").notNull(),
  icon: text("icon").notNull().default("tag"),
});

export const listings = pgTable(
  "listings",
  {
    id: serial("id").primaryKey(),
    sellerId: text("seller_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    shortDescription: text("short_description"),
    categoryId: integer("category_id"),
    brand: text("brand"),
    model: text("model"),
    color: text("color"),
    material: text("material"),
    condition: text("condition").notNull().default("good"), // new|like_new|good|fair|worn
    status: text("status").notNull().default("draft"), // draft|active|sold
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("SEK"),
    priceType: text("price_type").default("fixed"),
    city: text("city").notNull().default(""),
    region: text("region"),
    country: text("country").notNull().default("SE"),
    postalCode: text("postal_code"),
    shipping: text("shipping").notNull().default("pickup"), // pickup|ship|both
    images: jsonb("images").$type<string[]>().notNull().default([]),
    slug: text("slug").notNull(),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    keywords: jsonb("keywords").$type<string[]>(),
    specifications: jsonb("specifications").$type<{ label: string; value: string }[]>(),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
    removalReason: text("removal_reason"),
  },
  (t) => [
    uniqueIndex("listings_slug_idx").on(t.slug),
    index("listings_status_idx").on(t.status),
    index("listings_category_idx").on(t.categoryId),
    index("listings_seller_idx").on(t.sellerId),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    listingId: integer("listing_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("favorites_user_listing_idx").on(t.userId, t.listingId)],
);

export const conversations = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id").notNull(),
    buyerId: text("buyer_id").notNull(),
    sellerId: text("seller_id").notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("conversations_listing_buyer_idx").on(t.listingId, t.buyerId)],
);

export const pushTokens = pgTable(
  "push_tokens",
  {
    token: text("token").primaryKey(),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_tokens_user_idx").on(t.userId)],
);

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull(),
    senderId: text("sender_id").notNull(),
    content: text("content").notNull(),
    imageUrl: text("image_url"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId)],
);

export const userBlocks = pgTable(
  "user_blocks",
  {
    id: serial("id").primaryKey(),
    blockerId: text("blocker_id").notNull(),
    blockedId: text("blocked_id").notNull(),
    sourceListingId: integer("source_listing_id"),
    sourceConversationId: integer("source_conversation_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("user_blocks_blocker_blocked_idx").on(t.blockerId, t.blockedId),
    index("user_blocks_blocker_idx").on(t.blockerId),
    index("user_blocks_blocked_idx").on(t.blockedId),
  ],
);

export const contentReports = pgTable(
  "content_reports",
  {
    id: serial("id").primaryKey(),
    reporterId: text("reporter_id").notNull(),
    reportedUserId: text("reported_user_id").notNull(),
    targetType: text("target_type").notNull(),
    listingId: integer("listing_id"),
    messageId: integer("message_id"),
    conversationId: integer("conversation_id"),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by"),
    moderatorNotes: text("moderator_notes"),
    moderatorActions: jsonb("moderator_actions").$type<string[]>().notNull().default([]),
  },
  (t) => [
    index("content_reports_status_due_idx").on(t.status, t.dueAt),
    index("content_reports_reported_user_idx").on(t.reportedUserId),
  ],
);

export const moderationEvents = pgTable(
  "moderation_events",
  {
    id: serial("id").primaryKey(),
    actorId: text("actor_id"),
    eventType: text("event_type").notNull(),
    targetUserId: text("target_user_id"),
    listingId: integer("listing_id"),
    reportId: integer("report_id"),
    conversationId: integer("conversation_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("moderation_events_created_idx").on(t.createdAt)],
);
