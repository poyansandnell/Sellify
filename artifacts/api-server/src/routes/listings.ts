import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, asc, gte, ilike, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { conversations, favorites, listings, messages } from "@workspace/db/schema";
import { CreateListingBody, UpdateListingBody } from "@workspace/api-zod";
import { requireAuth, getUserId, type AuthedRequest } from "../lib/auth";
import { slugify, toListingDto, toListingDtos } from "../lib/listingUtils";

const router: IRouter = Router();

router.get("/listings", async (req: Request, res: Response) => {
  const {
    q,
    categoryId,
    city,
    country,
    minPrice,
    maxPrice,
    condition,
    sellerId,
    sort,
  } = req.query as Record<string, string | undefined>;
  const limit = Math.min(Number(req.query.limit) || 40, 100);
  const offset = Number(req.query.offset) || 0;

  const conds = [eq(listings.status, "active")];
  if (q)
    conds.push(
      or(
        ilike(listings.title, `%${q}%`),
        ilike(listings.description, `%${q}%`),
        ilike(listings.brand, `%${q}%`),
      )!,
    );
  if (categoryId) conds.push(eq(listings.categoryId, Number(categoryId)));
  if (city) conds.push(ilike(listings.city, city));
  if (country) conds.push(eq(listings.country, country));
  if (minPrice) conds.push(gte(listings.price, minPrice));
  if (maxPrice) conds.push(lte(listings.price, maxPrice));
  if (condition) conds.push(eq(listings.condition, condition));
  if (sellerId) conds.push(eq(listings.sellerId, sellerId));

  const where = and(...conds);
  const orderBy =
    sort === "price_asc"
      ? asc(listings.price)
      : sort === "price_desc"
        ? desc(listings.price)
        : desc(listings.publishedAt);

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(listings).where(where).orderBy(orderBy).limit(limit).offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(listings).where(where),
  ]);

  res.json({ items: await toListingDtos(rows, getUserId(req)), total });
});

router.post("/listings", requireAuth, async (req: Request, res: Response) => {
  const parsed = CreateListingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const status = d.status === "active" ? "active" : "draft";
  const [row] = await db
    .insert(listings)
    .values({
      sellerId: (req as AuthedRequest).userId,
      title: d.title,
      description: d.description,
      shortDescription: d.shortDescription ?? null,
      categoryId: d.categoryId ?? null,
      brand: d.brand ?? null,
      model: d.model ?? null,
      color: d.color ?? null,
      material: d.material ?? null,
      condition: d.condition,
      status,
      price: String(d.price),
      currency: d.currency,
      priceType: d.priceType ?? "fixed",
      city: d.city,
      region: d.region ?? null,
      country: d.country,
      postalCode: d.postalCode ?? null,
      shipping: d.shipping,
      images: d.images,
      slug: slugify(d.title),
      seoTitle: d.seoTitle ?? null,
      seoDescription: d.seoDescription ?? null,
      keywords: d.keywords ?? null,
      specifications: d.specifications ?? null,
      publishedAt: status === "active" ? new Date() : null,
    })
    .returning();
  res.status(201).json(await toListingDto(row, (req as AuthedRequest).userId));
});

router.get("/listings/slug/:slug", async (req: Request, res: Response) => {
  const [row] = await db.select().from(listings).where(eq(listings.slug, String(req.params.slug)));
  if (!row) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  const viewerId = getUserId(req);
  if (row.status !== "active" && viewerId !== row.sellerId && row.status !== "sold") {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (viewerId !== row.sellerId) {
    await db
      .update(listings)
      .set({ viewCount: sql`${listings.viewCount} + 1` })
      .where(eq(listings.id, row.id));
    row.viewCount += 1;
  }
  res.json(await toListingDto(row, viewerId));
});

router.get("/listings/:id", async (req: Request, res: Response) => {
  const [row] = await db.select().from(listings).where(eq(listings.id, Number(req.params.id)));
  const viewerId = getUserId(req);
  if (!row || (row.status === "draft" && viewerId !== row.sellerId)) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  res.json(await toListingDto(row, viewerId));
});

async function loadOwned(req: Request, res: Response) {
  const [row] = await db.select().from(listings).where(eq(listings.id, Number(req.params.id)));
  if (!row) {
    res.status(404).json({ error: "Listing not found" });
    return null;
  }
  if (row.sellerId !== (req as AuthedRequest).userId) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return row;
}

router.patch("/listings/:id", requireAuth, async (req: Request, res: Response) => {
  const row = await loadOwned(req, res);
  if (!row) return;
  const parsed = UpdateListingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const [updated] = await db
    .update(listings)
    .set({
      ...(d.title !== undefined && { title: d.title }),
      ...(d.description !== undefined && { description: d.description }),
      ...(d.shortDescription !== undefined && { shortDescription: d.shortDescription }),
      ...(d.categoryId !== undefined && { categoryId: d.categoryId }),
      ...(d.brand !== undefined && { brand: d.brand }),
      ...(d.model !== undefined && { model: d.model }),
      ...(d.color !== undefined && { color: d.color }),
      ...(d.material !== undefined && { material: d.material }),
      ...(d.condition !== undefined && { condition: d.condition }),
      ...(d.price !== undefined && { price: String(d.price) }),
      ...(d.currency !== undefined && { currency: d.currency }),
      ...(d.priceType !== undefined && { priceType: d.priceType }),
      ...(d.city !== undefined && { city: d.city }),
      ...(d.region !== undefined && { region: d.region }),
      ...(d.country !== undefined && { country: d.country }),
      ...(d.postalCode !== undefined && { postalCode: d.postalCode }),
      ...(d.shipping !== undefined && { shipping: d.shipping }),
      ...(d.images !== undefined && { images: d.images }),
      ...(d.seoTitle !== undefined && { seoTitle: d.seoTitle }),
      ...(d.seoDescription !== undefined && { seoDescription: d.seoDescription }),
      ...(d.keywords !== undefined && { keywords: d.keywords }),
      ...(d.specifications !== undefined && { specifications: d.specifications }),
    })
    .where(eq(listings.id, row.id))
    .returning();
  res.json(await toListingDto(updated, (req as AuthedRequest).userId));
});

router.delete("/listings/:id", requireAuth, async (req: Request, res: Response) => {
  const row = await loadOwned(req, res);
  if (!row) return;
  await db.delete(favorites).where(eq(favorites.listingId, row.id));
  await db.delete(listings).where(eq(listings.id, row.id));
  res.status(204).end();
});

router.post("/listings/:id/publish", requireAuth, async (req: Request, res: Response) => {
  const row = await loadOwned(req, res);
  if (!row) return;
  const [updated] = await db
    .update(listings)
    .set({ status: "active", publishedAt: row.publishedAt ?? new Date() })
    .where(eq(listings.id, row.id))
    .returning();
  res.json(await toListingDto(updated, (req as AuthedRequest).userId));
});

router.post("/listings/:id/sold", requireAuth, async (req: Request, res: Response) => {
  const row = await loadOwned(req, res);
  if (!row) return;
  const [updated] = await db
    .update(listings)
    .set({ status: "sold", soldAt: new Date() })
    .where(eq(listings.id, row.id))
    .returning();
  res.json(await toListingDto(updated, (req as AuthedRequest).userId));
});

router.post("/listings/:id/favorite", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const listingId = Number(req.params.id);
  const existing = await db
    .select()
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.listingId, listingId)));
  let favorited: boolean;
  if (existing.length) {
    await db
      .delete(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.listingId, listingId)));
    favorited = false;
  } else {
    await db.insert(favorites).values({ userId, listingId });
    favorited = true;
  }
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(favorites)
    .where(eq(favorites.listingId, listingId));
  res.json({ favorited, favoriteCount: count });
});

router.get("/listings/:id/similar", async (req: Request, res: Response) => {
  const [row] = await db.select().from(listings).where(eq(listings.id, Number(req.params.id)));
  if (!row) {
    res.json([]);
    return;
  }
  const conds = [eq(listings.status, "active"), ne(listings.id, row.id)];
  if (row.categoryId != null) conds.push(eq(listings.categoryId, row.categoryId));
  const rows = await db
    .select()
    .from(listings)
    .where(and(...conds))
    .orderBy(desc(listings.publishedAt))
    .limit(8);
  res.json(await toListingDtos(rows, getUserId(req)));
});

router.get("/listings/:id/stats", requireAuth, async (req: Request, res: Response) => {
  const row = await loadOwned(req, res);
  if (!row) return;
  const [[{ favCount }], [{ msgCount }]] = await Promise.all([
    db
      .select({ favCount: sql<number>`count(*)::int` })
      .from(favorites)
      .where(eq(favorites.listingId, row.id)),
    db
      .select({ msgCount: sql<number>`count(*)::int` })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(eq(conversations.listingId, row.id)),
  ]);
  const days = row.publishedAt
    ? Math.floor((Date.now() - row.publishedAt.getTime()) / 86_400_000)
    : 0;
  const suggestions: string[] = [];
  if (row.viewCount > 20 && favCount === 0)
    suggestions.push("many_views_no_favorites_consider_price");
  if (days > 14 && row.status === "active") suggestions.push("listing_old_consider_refresh");
  if ((row.images ?? []).length < 3) suggestions.push("add_more_photos");
  res.json({
    viewCount: row.viewCount,
    favoriteCount: favCount,
    messageCount: msgCount,
    daysSincePublished: days,
    suggestions,
  });
});

export default router;
