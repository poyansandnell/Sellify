import { Router, type IRouter, type Request, type Response } from "express";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
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
  GetSearchPriceStatisticsQueryParams,
  GetSearchPriceStatisticsResponse,
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

function approvedExternalSourceConditions() {
  const conditions = [
    eq(externalSources.enabled, true),
    eq(externalSources.legalStatus, "APPROVED"),
    eq(externalSources.legalApproval, true),
    isNotNull(externalSources.legalApprovalReference),
    isNotNull(externalSources.legalApprovedAt),
    or(
      eq(externalSources.partnershipRequired, false),
      eq(externalSources.partnershipApproved, true),
    )!,
    ne(externalSources.sourceType, "DISABLED"),
    ne(externalSources.sourceType, "PARTNERSHIP_REQUIRED"),
  ];
  conditions.push(
    or(
      and(
        eq(externalSources.sourceType, "API"),
        or(
          eq(externalSources.id, "tradera"),
          eq(externalSources.id, "ebay"),
        )!,
      ),
      and(
        eq(externalSources.sourceType, "FEED"),
        isNotNull(externalSources.feedUrl),
        isNotNull(externalSources.feedFormat),
      ),
      and(
        eq(externalSources.sourceType, "INDEX"),
        isNotNull(externalSources.feedUrl),
        isNotNull(externalSources.feedFormat),
        eq(externalSources.robotsAllowsIndexing, true),
        isNotNull(externalSources.robotsCheckedAt),
      ),
    )!,
  );
  if (!process.env.TRADERA_APP_ID || !process.env.TRADERA_APP_KEY) {
    conditions.push(ne(externalSources.id, "tradera"));
  }
  if (
    !process.env.EBAY_CLIENT_ID ||
    !process.env.EBAY_CLIENT_SECRET ||
    !process.env.EBAY_MARKETPLACE_ID
  ) {
    conditions.push(ne(externalSources.id, "ebay"));
  }
  return conditions;
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

  const sourceVisibilityConditions = approvedExternalSourceConditions();
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
              sourceLegalApprovalReference: externalSources.legalApprovalReference,
              sourceLegalApprovedAt: externalSources.legalApprovedAt,
              sourcePartnershipRequired: externalSources.partnershipRequired,
              sourcePartnershipApproved: externalSources.partnershipApproved,
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
        legalApprovalReference: listing.sourceLegalApprovalReference,
        legalApprovedAt: listing.sourceLegalApprovedAt,
        partnershipRequired: listing.sourcePartnershipRequired,
        partnershipApproved: listing.sourcePartnershipApproved,
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

router.get(
  "/search/price-statistics",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = GetSearchPriceStatisticsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { q, categoryId, country, condition } = parsed.data;
    const pattern = q?.trim()
      ? `%${escapeLikePattern(q.trim())}%`
      : undefined;

    const sellifyConditions = [
      eq(listings.status, "active"),
      isNull(listings.removedAt),
      isNotNull(listings.price),
      isNotNull(listings.currency),
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
    if (country?.trim()) {
      sellifyConditions.push(eq(listings.country, country.trim().toUpperCase()));
    }
    if (condition?.trim()) {
      sellifyConditions.push(eq(listings.condition, condition.trim()));
    }

    const externalConditions = [
      eq(externalListings.status, "ACTIVE"),
      isNotNull(externalListings.price),
      isNotNull(externalListings.currency),
      ...approvedExternalSourceConditions(),
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
    if (country?.trim()) {
      externalConditions.push(
        eq(externalListings.country, country.trim().toUpperCase()),
      );
    }
    if (condition?.trim()) {
      externalConditions.push(eq(externalListings.condition, condition.trim()));
    }

    const sellifyWhere = and(...sellifyConditions)!;
    const externalWhere = and(...externalConditions)!;
    const result = await db.execute(sql`
      SELECT
        currency,
        COUNT(*)::int AS listing_count,
        COUNT(*) FILTER (WHERE source_type = 'sellify')::int AS sellify_count,
        COUNT(*) FILTER (WHERE source_type = 'external')::int AS external_count,
        COUNT(DISTINCT source_id)::int AS source_count,
        MIN(price)::double precision AS minimum,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY price)::double precision AS median,
        AVG(price)::double precision AS average,
        MAX(price)::double precision AS maximum
      FROM (
        SELECT
          UPPER(${listings.currency}) AS currency,
          ${listings.price}::double precision AS price,
          'sellify'::text AS source_id,
          'sellify'::text AS source_type
        FROM ${listings}
        WHERE ${sellifyWhere}
        UNION ALL
        SELECT
          UPPER(${externalListings.currency}) AS currency,
          ${externalListings.price}::double precision AS price,
          ${externalListings.sourceId} AS source_id,
          'external'::text AS source_type
        FROM ${externalListings}
        INNER JOIN ${externalSources}
          ON ${externalSources.id} = ${externalListings.sourceId}
        WHERE ${externalWhere}
      ) AS combined_prices
      GROUP BY currency
      ORDER BY listing_count DESC, currency ASC
    `);
    const response = {
      groups: result.rows.map((row) => ({
        currency: String(row.currency),
        listingCount: Number(row.listing_count),
        sellifyCount: Number(row.sellify_count),
        externalCount: Number(row.external_count),
        sourceCount: Number(row.source_count),
        minimum: Number(row.minimum),
        median: Number(row.median),
        average: Number(row.average),
        maximum: Number(row.maximum),
      })),
    };
    res.json(GetSearchPriceStatisticsResponse.parse(response));
  },
);

export default router;