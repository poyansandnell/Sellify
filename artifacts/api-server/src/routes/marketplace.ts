import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { categories, listings, profiles } from "@workspace/db/schema";
import { getUserId } from "../lib/auth";
import { toListingDtos } from "../lib/listingUtils";
import { filterBlockedSellerRows, usersAreBlocked } from "../lib/blocking";

const router: IRouter = Router();

router.get("/home", async (req: Request, res: Response) => {
  const viewerId = getUserId(req);
  const { city, country, region, postalCode } = req.query as Record<
    string,
    string | undefined
  >;

  const [newest, cats, [{ totalActive }]] = await Promise.all([
    db
      .select()
      .from(listings)
      .where(and(eq(listings.status, "active"), isNull(listings.removedAt)))
      .orderBy(desc(listings.publishedAt))
      .limit(12),
    db
      .select({
        id: categories.id,
        slug: categories.slug,
        nameSv: categories.nameSv,
        nameEn: categories.nameEn,
        icon: categories.icon,
        listingCount: sql<number>`(select count(*)::int from ${listings} where ${listings.categoryId} = ${categories.id} and ${listings.status} = 'active' and ${listings.removedAt} is null)`,
      })
      .from(categories)
      .orderBy(categories.id),
    db
      .select({ totalActive: sql<number>`count(*)::int` })
      .from(listings)
      .where(and(eq(listings.status, "active"), isNull(listings.removedAt))),
  ]);

  let nearby: typeof newest = [];
  const locationConditions = [];
  if (city?.trim())
    locationConditions.push(sql`lower(${listings.city}) = ${city.trim().toLowerCase()}`);
  if (region?.trim())
    locationConditions.push(sql`lower(${listings.region}) = ${region.trim().toLowerCase()}`);
  if (postalCode?.trim())
    locationConditions.push(sql`lower(${listings.postalCode}) = ${postalCode.trim().toLowerCase()}`);
  if (country?.trim())
    locationConditions.push(eq(listings.country, country.trim().toUpperCase()));
  if (locationConditions.length) {
    nearby = await db
      .select()
      .from(listings)
      .where(
        and(
          eq(listings.status, "active"),
          isNull(listings.removedAt),
          ...locationConditions,
        ),
      )
      .orderBy(desc(listings.publishedAt))
      .limit(8);
  }

  res.json({
    newest: await toListingDtos(await filterBlockedSellerRows(newest, viewerId), viewerId),
    nearby: await toListingDtos(await filterBlockedSellerRows(nearby, viewerId), viewerId),
    categories: cats,
    totalActive,
  });
});

router.get("/sellers/:id", async (req: Request, res: Response) => {
  const [p] = await db.select().from(profiles).where(eq(profiles.id, String(req.params.id)));
  if (!p) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }
  const viewerId = getUserId(req);
  if (viewerId && viewerId !== p.id && await usersAreBlocked(viewerId, p.id)) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }
  const [counts] = await db
    .select({
      active: sql<number>`count(*) filter (where ${listings.status} = 'active')::int`,
      sold: sql<number>`count(*) filter (where ${listings.status} = 'sold')::int`,
    })
    .from(listings)
    .where(eq(listings.sellerId, p.id));
  const rows = await db
    .select()
    .from(listings)
    .where(and(eq(listings.sellerId, p.id), eq(listings.status, "active"), isNull(listings.removedAt)))
    .orderBy(desc(listings.publishedAt));
  res.json({
    id: p.id,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    city: p.city,
    memberSince: p.createdAt.toISOString(),
    activeListingCount: counts?.active ?? 0,
    soldListingCount: counts?.sold ?? 0,
    listings: await toListingDtos(rows, viewerId),
  });
});

export default router;
