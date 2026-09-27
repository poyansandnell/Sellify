import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  type InsertExternalListing,
} from "@workspace/db";
import {
  categories,
  externalListings,
  externalSources,
  type ExternalSource,
} from "@workspace/db/schema";
import {
  assertSourceMayIngest,
  type NormalizedExternalListing,
} from "./externalSources";
import {
  canonicalizeListingUrl,
  getExternalAdapterReadiness,
  getExternalSourceAdapter,
} from "./externalAdapters";
import { normalizeExternalListingsWithAi } from "./externalListingNormalization";
import { logger } from "./logger";

export type ExternalSourceSyncResult = {
  sourceId: string;
  received: number;
  inserted: number;
  updated: number;
  duplicates: number;
  rejected: number;
  normalized: number;
  normalizationSkipped: number;
  finishedAt: string;
};

function safeFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (
    /^(Tradera API|eBay OAuth|eBay Browse API|Approved feed|robots\.txt) returned HTTP \d{3}$/.test(
      message,
    )
  ) {
    return message;
  }
  return "External source sync failed. Check API/feed configuration and access rights.";
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function productFingerprint(listing: NormalizedExternalListing): string {
  const identity = [
    listing.categoryId ?? "",
    listing.brand ?? "",
    listing.model ?? "",
    listing.condition ?? "",
    listing.title.trim().toLocaleLowerCase(),
    listing.currency?.toUpperCase() ?? "",
  ]
    .map((part) => String(part).replace(/\s+/g, " ").trim())
    .join("|");
  return sha256(identity);
}

function toInsertValues(
  source: ExternalSource,
  listing: NormalizedExternalListing,
  now: Date,
  previous?: typeof externalListings.$inferSelect,
): InsertExternalListing {
  const canonicalUrl = canonicalizeListingUrl(listing.originalUrl);
  if (!canonicalUrl) throw new Error("Listing did not contain a safe HTTPS URL");
  const normalizedFields = {
    brand: listing.brand ?? previous?.brand ?? null,
    model: listing.model ?? previous?.model ?? null,
    color: listing.color ?? previous?.color ?? null,
    condition: listing.condition ?? previous?.condition ?? null,
    categoryId: listing.categoryId ?? previous?.categoryId ?? null,
  };
  return {
    sourceId: source.id,
    externalId: listing.externalId.trim(),
    originalUrl: canonicalUrl,
    title: listing.title.trim().slice(0, 240),
    description: listing.description?.slice(0, 12_000) ?? previous?.description ?? null,
    categoryId: normalizedFields.categoryId,
    category: listing.category ?? previous?.category ?? null,
    subcategory: listing.subcategory ?? previous?.subcategory ?? null,
    brand: normalizedFields.brand,
    model: normalizedFields.model,
    color: normalizedFields.color,
    condition: normalizedFields.condition,
    price: listing.price ?? previous?.price ?? null,
    currency: listing.currency?.trim().toUpperCase() ?? previous?.currency ?? null,
    country: listing.country?.trim().toUpperCase() ?? source.country,
    region: listing.region ?? previous?.region ?? null,
    city: listing.city ?? previous?.city ?? null,
    postalCode: listing.postalCode ?? previous?.postalCode ?? null,
    latitude: listing.latitude ?? previous?.latitude ?? null,
    longitude: listing.longitude ?? previous?.longitude ?? null,
    sellerName: listing.sellerName ?? previous?.sellerName ?? null,
    sellerType: listing.sellerType ?? previous?.sellerType ?? null,
    shippingAvailable: listing.shippingAvailable ?? previous?.shippingAvailable ?? null,
    auction: listing.auction ?? previous?.auction ?? false,
    auctionEnd: listing.auctionEnd ?? previous?.auctionEnd ?? null,
    publishedAt: listing.publishedAt ?? previous?.publishedAt ?? null,
    sourceUpdatedAt: listing.sourceUpdatedAt ?? previous?.sourceUpdatedAt ?? null,
    lastSeenAt: now,
    status: listing.status ?? "ACTIVE",
    imageUrls: listing.imageUrls ?? previous?.imageUrls ?? [],
    rawDataHash: sha256(JSON.stringify(listing)),
    productFingerprint:
      listing.productFingerprint ??
      previous?.productFingerprint ??
      productFingerprint(listing),
    normalizationConfidence:
      listing.normalizationConfidence ??
      previous?.normalizationConfidence ??
      null,
    updatedAt: now,
  };
}

function needsNormalization(listing: NormalizedExternalListing): boolean {
  return (
    !listing.brand ||
    !listing.model ||
    !listing.color ||
    !listing.condition ||
    listing.categoryId == null
  );
}

export async function syncExternalSource(
  source: ExternalSource,
  options: { query?: string; limit: number },
): Promise<ExternalSourceSyncResult> {
  const readiness = getExternalAdapterReadiness(source);
  const adapter = getExternalSourceAdapter(source);
  if (!adapter) throw new Error(`Source ${source.id} has no available adapter`);
  assertSourceMayIngest(source, {
    hasApiCredential: readiness.integrationConfigured,
  });
  if (!readiness.integrationConfigured) {
    throw new Error(`Source ${source.id} is missing integration configuration`);
  }
  if (source.sourceType === "API" && !options.query?.trim()) {
    throw new Error("A search term is required for marketplace API sync");
  }

  try {
    const receivedListings = await adapter.fetchListings(source, {
      query: options.query,
      limit: Math.max(1, Math.min(20, options.limit)),
    });
    const [currentSource] = await db
      .select()
      .from(externalSources)
      .where(eq(externalSources.id, source.id))
      .limit(1);
    if (!currentSource) throw new Error("External source no longer exists");
    const currentReadiness = getExternalAdapterReadiness(currentSource);
    assertSourceMayIngest(currentSource, {
      hasApiCredential: currentReadiness.integrationConfigured,
    });

    const categoryOptions = await db
      .select({
        id: categories.id,
        slug: categories.slug,
        nameEn: categories.nameEn,
        nameSv: categories.nameSv,
      })
      .from(categories);
    let normalizedListings = receivedListings;
    let normalized = 0;
    let normalizationSkipped = 0;
    let normalizationWarning: string | null = null;
    if (receivedListings.some(needsNormalization)) {
      try {
        const result = await normalizeExternalListingsWithAi(
          receivedListings,
          categoryOptions,
        );
        normalizedListings = result.listings;
        normalized = result.normalized;
        normalizationSkipped = result.skipped;
      } catch (error) {
        normalizationSkipped = receivedListings.filter(needsNormalization).length;
        normalizationWarning = "AI normalization was skipped for this sync.";
        logger.warn(
          { sourceId: source.id },
          "External listing AI normalization failed; source data will be retained",
        );
      }
    }

    let inserted = 0;
    let updated = 0;
    let duplicates = 0;
    let rejected = 0;
    const finishedAt = new Date();
    await db.transaction(async (tx) => {
      const [lockedSource] = await tx
        .select()
        .from(externalSources)
        .where(eq(externalSources.id, source.id))
        .for("update");
      if (!lockedSource) throw new Error("External source no longer exists");
      const lockedReadiness = getExternalAdapterReadiness(lockedSource);
      assertSourceMayIngest(lockedSource, {
        hasApiCredential: lockedReadiness.integrationConfigured,
      });
      for (const listing of normalizedListings) {
        const canonicalUrl = canonicalizeListingUrl(listing.originalUrl);
        if (
          !listing.externalId?.trim() ||
          !listing.title?.trim() ||
          !canonicalUrl
        ) {
          rejected += 1;
          continue;
        }
        const [existingByProvider] = await tx
          .select()
          .from(externalListings)
          .where(
            and(
              eq(externalListings.sourceId, lockedSource.id),
              eq(externalListings.externalId, listing.externalId.trim()),
            ),
          )
          .limit(1);
        const [existingByUrl] = await tx
          .select({
            id: externalListings.id,
            sourceId: externalListings.sourceId,
            externalId: externalListings.externalId,
          })
          .from(externalListings)
          .where(eq(externalListings.originalUrl, canonicalUrl))
          .limit(1);
        if (
          existingByUrl &&
          (existingByUrl.sourceId !== lockedSource.id ||
            existingByUrl.externalId !== listing.externalId.trim())
        ) {
          duplicates += 1;
          continue;
        }
        const values = toInsertValues(
          lockedSource,
          listing,
          finishedAt,
          existingByProvider,
        );
        if (existingByProvider) {
          await tx
            .update(externalListings)
            .set(values)
            .where(eq(externalListings.id, existingByProvider.id));
          updated += 1;
        } else {
          const [created] = await tx
            .insert(externalListings)
            .values(values)
            .onConflictDoNothing()
            .returning({ id: externalListings.id });
          if (created) inserted += 1;
          else duplicates += 1;
        }
      }
      await tx
        .update(externalSources)
        .set({
          lastSuccess: finishedAt,
          lastError: normalizationWarning,
          updatedAt: finishedAt,
        })
        .where(eq(externalSources.id, lockedSource.id));
    });
    return {
      sourceId: currentSource.id,
      received: receivedListings.length,
      inserted,
      updated,
      duplicates,
      rejected,
      normalized,
      normalizationSkipped,
      finishedAt: finishedAt.toISOString(),
    };
  } catch (error) {
    await db
      .update(externalSources)
      .set({
        lastFailure: new Date(),
        lastError: safeFailureMessage(error),
        updatedAt: new Date(),
      })
      .where(eq(externalSources.id, source.id));
    throw error;
  }
}