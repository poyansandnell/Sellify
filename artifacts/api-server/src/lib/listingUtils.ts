import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { categories, favorites, listings, profiles } from "@workspace/db/schema";

export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/é/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "annons"}-${suffix}`;
}

type ListingRow = typeof listings.$inferSelect;

export async function toListingDtos(
  rows: ListingRow[],
  viewerId: string | null,
): Promise<Record<string, unknown>[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const sellerIds = [...new Set(rows.map((r) => r.sellerId))];
  const categoryIds = [...new Set(rows.map((r) => r.categoryId).filter((c): c is number => c != null))];

  const [favCounts, sellers, cats, myFavs] = await Promise.all([
    db
      .select({ listingId: favorites.listingId, count: sql<number>`count(*)::int` })
      .from(favorites)
      .where(inArray(favorites.listingId, ids))
      .groupBy(favorites.listingId),
    db.select().from(profiles).where(inArray(profiles.id, sellerIds)),
    categoryIds.length
      ? db.select().from(categories).where(inArray(categories.id, categoryIds))
      : Promise.resolve([]),
    viewerId
      ? db
          .select({ listingId: favorites.listingId })
          .from(favorites)
          .where(and(eq(favorites.userId, viewerId), inArray(favorites.listingId, ids)))
      : Promise.resolve([]),
  ]);

  const favMap = new Map(favCounts.map((f) => [f.listingId, f.count]));
  const sellerMap = new Map(sellers.map((s) => [s.id, s]));
  const catMap = new Map(cats.map((c) => [c.id, c]));
  const myFavSet = new Set(myFavs.map((f) => f.listingId));

  return rows.map((r) => {
    const seller = sellerMap.get(r.sellerId);
    const cat = r.categoryId != null ? catMap.get(r.categoryId) : undefined;
    return {
      id: r.id,
      sellerId: r.sellerId,
      sellerName: seller?.displayName ?? null,
      sellerAvatarUrl: seller?.avatarUrl ?? null,
      title: r.title,
      description: r.description,
      shortDescription: r.shortDescription,
      categoryId: r.categoryId,
      categoryNameSv: cat?.nameSv ?? null,
      categoryNameEn: cat?.nameEn ?? null,
      brand: r.brand,
      model: r.model,
      color: r.color,
      material: r.material,
      condition: r.condition,
      status: r.status,
      price: Number(r.price),
      currency: r.currency,
      priceType: r.priceType,
      city: r.city,
      region: r.region,
      country: r.country,
      postalCode: r.postalCode,
      shipping: r.shipping,
      images: r.images ?? [],
      slug: r.slug,
      seoTitle: r.seoTitle,
      seoDescription: r.seoDescription,
      keywords: r.keywords ?? null,
      specifications: r.specifications ?? null,
      viewCount: r.viewCount,
      favoriteCount: favMap.get(r.id) ?? 0,
      isFavorited: myFavSet.has(r.id),
      createdAt: r.createdAt.toISOString(),
      publishedAt: r.publishedAt?.toISOString() ?? null,
      soldAt: r.soldAt?.toISOString() ?? null,
    };
  });
}

export async function toListingDto(row: ListingRow, viewerId: string | null) {
  const [dto] = await toListingDtos([row], viewerId);
  return dto;
}
