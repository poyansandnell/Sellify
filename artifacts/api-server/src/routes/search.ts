import { Router, type IRouter, type Request, type Response } from "express";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@workspace/db";
import {
  externalListings,
  externalSources,
  listings,
} from "@workspace/db/schema";
import {
  SearchAllListingsQueryParams,
  SearchAllListingsResponse,
} from "@workspace/api-zod";
import { filterBlockedSellerRows } from "../lib/blocking";
import { getUserId } from "../lib/auth";
import { isExternalSourceSearchable } from "../lib/externalSources";
import { toListingDtos } from "../lib/listingUtils";

const router: IRouter = Router();

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function safeHttpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function toIsoDate(value: unknown): string | null {
  const date =
    value instanceof Date || typeof value === "string" || typeof value === "number"
      ? new Date(value)
      : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

router.get("/search", async (req: Request, res: Response): Promise<void> => {
  const parsed = SearchAllListingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    q,
    categoryId,
    city,
    region,
    postalCode,
    country,
    minPrice,
    maxPrice,
    condition,
    sellerId,
    sort = "newest",
    limit: requestedLimit,
    offset: requestedOffset,
  } = parsed.data;
  const limit = requestedLimit ?? 40;
  const offset = requestedOffset ?? 0;
  const candidateLimit = limit + offset;
  const pattern = q?.trim() ? `%${escapeLikePattern(q.trim())}%` : undefined;

  const sellifyConditions = [
    eq(listings.status, "active"),
    isNull(listings.removedAt),
  ];
  if (pattern) {
    sellifyConditions.push(
      or(
        ilike(listings.title, pattern),
        ilike(listings.description, pattern),
        ilike(listings.brand, pattern),
        ilike(listings.model, pattern),
      )!,
    );
  }
  if (categoryId !== undefined) {
    sellifyConditions.push(eq(listings.categoryId, categoryId));
  }
  if (city?.trim()) {
    sellifyConditions.push(
      sql`lower(${listings.city}) = ${city.trim().toLowerCase()}`,
    );
  }
  if (region?.trim()) {
    sellifyConditions.push(
      sql`lower(${listings.region}) = ${region.trim().toLowerCase()}`,
    );
  }
  if (postalCode?.trim()) {
    sellifyConditions.push(
      sql`lower(${listings.postalCode}) = ${postalCode.trim().toLowerCase()}`,
    );
  }
  if (country?.trim()) {
    sellifyConditions.push(eq(listings.country, country.trim().toUpperCase()));
  }
  if (minPrice !== undefined) {
    sellifyConditions.push(gte(listings.price, String(minPrice)));
  }
  if (maxPrice !== undefined) {
    sellifyConditions.push(lte(listings.price, String(maxPrice)));
  }
  if (condition?.trim()) {
    sellifyConditions.push(eq(listings.condition, condition.trim()));
  }
  if (sellerId?.trim()) {
    sellifyConditions.push(eq(listings.sellerId, sellerId.trim()));
  }

  const sourceVisibilityConditions = [
    eq(externalSources.enabled, true),
    eq(externalSources.legalStatus, "APPROVED"),
    eq(externalSources.legalApproval, true),
    ne(externalSources.sourceType, "DISABLED"),
  ];
  const externalConditions = [
    eq(externalListings.status, "ACTIVE"),
    ...sourceVisibilityConditions,
  ];
  if (pattern) {
    externalConditions.push(
      or(
        ilike(externalListings.title, pattern),
        ilike(externalListings.description, pattern),
        ilike(externalListings.brand, pattern),
        ilike(externalListings.model, pattern),
      )!,
    );
  }
  if (categoryId !== undefined) {
    externalConditions.push(eq(externalListings.categoryId, categoryId));
  }
  if (city?.trim()) {
    externalConditions.push(
      sql`lower(${externalListings.city}) = ${city.trim().toLowerCase()}`,
    );
  }
  if (region?.trim()) {
    externalConditions.push(
      sql`lower(${externalListings.region}) = ${region.trim().toLowerCase()}`,
    );
  }
  if (postalCode?.trim()) {
    externalConditions.push(
      sql`lower(${externalListings.postalCode}) = ${postalCode.trim().toLowerCase()}`,
    );
  }
  if (country?.trim()) {
    externalConditions.push(
      eq(externalListings.country, country.trim().toUpperCase()),
    );
  }
  if (minPrice !== undefined) {
    externalConditions.push(
      gte(externalListings.price, String(minPrice)),
    );
  }
  if (maxPrice !== undefined) {
    externalConditions.push(
      lte(externalListings.price, String(maxPrice)),
    );
  }
  if (condition?.trim()) {
    externalConditions.push(
      eq(externalListings.condition, condition.trim()),
    );
  }

  const sellifyOrder =
    sort === "price_asc"
      ? [asc(listings.price)]
      : sort === "price_desc"
        ? [desc(listings.price)]
        : [desc(sql`COALESCE(${listings.publishedAt}, ${listings.createdAt})`)];
  const externalOrder =
    sort === "price_asc"
      ? [asc(externalListings.price)]
      : sort === "price_desc"
        ? [desc(sql`COALESCE(${externalListings.price}, -1)`)]
        : [
            desc(
              sql`COALESCE(${externalListings.publishedAt}, ${externalListings.lastSeenAt})`,
            ),
          ];

  const sellifyWhere = and(...sellifyConditions);
  const externalWhere = and(...externalConditions);
  const [sellifyRows, sellifyCountRows, externalRows, externalCountRows, sourceCountRows] =
    await Promise.all([
      db
        .select()
        .from(listings)
        .where(sellifyWhere)
        .orderBy(...sellifyOrder)
        .limit(candidateLimit),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(listings)
        .where(sellifyWhere),
      sellerId?.trim()
        ? Promise.resolve([])
        : db
            .select({
              id: externalListings.id,
              sourceId: externalSources.id,
              sourceName: externalSources.name,
              sourceEnabled: externalSources.enabled,
              sourceLegalStatus: externalSources.legalStatus,
              sourceLegalApproval: externalSources.legalApproval,
              sourceType: externalSources.sourceType,
              title: externalListings.title,
              price: externalListings.price,
              currency: externalListings.currency,
              city: externalListings.city,
              brand: externalListings.brand,
              model: externalListings.model,
              condition: externalListings.condition,
              imageUrls: externalListings.imageUrls,
              status: externalListings.status,
              originalUrl: externalListings.originalUrl,
              imageMode: externalSources.imageMode,
              publishedAt: externalListings.publishedAt,
              sourceUpdatedAt: externalListings.sourceUpdatedAt,
              lastSeenAt: externalListings.lastSeenAt,
            })
            .from(externalListings)
            .innerJoin(
              externalSources,
              eq(externalSources.id, externalListings.sourceId),
            )
            .where(externalWhere)
            .orderBy(...externalOrder)
            .limit(candidateLimit),
      sellerId?.trim()
        ? Promise.resolve([{ total: 0 }])
        : db
            .select({ total: sql<number>`count(*)::int` })
            .from(externalListings)
            .innerJoin(
              externalSources,
              eq(externalSources.id, externalListings.sourceId),
            )
            .where(externalWhere),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(externalSources)
        .where(and(...sourceVisibilityConditions)),
    ]);

  const viewerId = getUserId(req);
  const visibleSellifyRows = await filterBlockedSellerRows(
    sellifyRows,
    viewerId,
  );
  const sellifyDtos = await toListingDtos(visibleSellifyRows, viewerId);
  const internalItems = sellifyDtos.map((listing) => ({
    id: `sellify:${listing.id}`,
    sourceId: "sellify",
    sourceName: "Sellify",
    isExternal: false,
    title: listing.title,
    price: Number(listing.price),
    currency: listing.currency ?? null,
    city: listing.city ?? null,
    brand: listing.brand ?? null,
    model: listing.model ?? null,
    condition: listing.condition ?? null,
    images: listing.images ?? [],
    status: listing.status === "sold" ? "sold" : "active",
    slug: listing.slug ?? null,
    originalUrl: null,
    imageMode: "NO_EXTERNAL_IMAGES",
    publishedAt: toIsoDate(listing.publishedAt) ?? toIsoDate(listing.createdAt),
  }));

  const externalItems = externalRows
    .map((listing) => {
      const source = {
        enabled: listing.sourceEnabled,
        legalStatus: listing.sourceLegalStatus,
        legalApproval: listing.sourceLegalApproval,
        sourceType: listing.sourceType,
      };
      if (!isExternalSourceSearchable(source)) return null;
      const originalUrl = safeHttpsUrl(listing.originalUrl);
      if (!originalUrl) return null;
      const imageMode =
        listing.imageMode === "IMAGE_PROXY_ALLOWED" ||
        listing.imageMode === "IMAGE_URL_ONLY"
          ? listing.imageMode
          : "NO_EXTERNAL_IMAGES";
      const images =
        imageMode === "IMAGE_URL_ONLY"
          ? (listing.imageUrls ?? [])
              .map((url) => safeHttpsUrl(url))
              .filter((url): url is string => url !== null)
          : [];
      return {
        id: `external:${listing.sourceId}:${listing.id}`,
        sourceId: listing.sourceId,
        sourceName: listing.sourceName,
        isExternal: true,
        title: listing.title,
        price: listing.price === null ? null : Number(listing.price),
        currency: listing.currency ?? null,
        city: listing.city ?? null,
        brand: listing.brand ?? null,
        model: listing.model ?? null,
        condition: listing.condition ?? null,
        images,
        status: "active",
        slug: null,
        originalUrl,
        imageMode,
        publishedAt: listing.publishedAt
          ? listing.publishedAt.toISOString()
          : (listing.sourceUpdatedAt ?? listing.lastSeenAt).toISOString(),
      };
    })
    .filter((listing): listing is NonNullable<typeof listing> => listing !== null);

  const merged = [...internalItems, ...externalItems].sort((left, right) => {
    if (sort === "price_asc" || sort === "price_desc") {
      const leftPrice = left.price ?? (sort === "price_asc" ? Infinity : -Infinity);
      const rightPrice = right.price ?? (sort === "price_asc" ? Infinity : -Infinity);
      return sort === "price_asc"
        ? leftPrice - rightPrice
        : rightPrice - leftPrice;
    }
    return (
      Date.parse(right.publishedAt ?? "") -
      Date.parse(left.publishedAt ?? "")
    );
  });

  const sellifyCount = sellifyCountRows[0]?.total ?? 0;
  const externalCount = externalCountRows[0]?.total ?? 0;
  const response = {
    items: merged.slice(offset, offset + limit),
    total: sellifyCount + externalCount,
    sellifyCount,
    externalCount,
    activeExternalSources: sourceCountRows[0]?.total ?? 0,
  };

  res.json(SearchAllListingsResponse.parse(response));
});

export default router;