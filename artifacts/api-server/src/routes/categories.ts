import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { categories, listings } from "@workspace/db/schema";

const router: IRouter = Router();

router.get("/categories", async (_req, res) => {
  const rows = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      nameSv: categories.nameSv,
      nameEn: categories.nameEn,
      icon: categories.icon,
      listingCount: sql<number>`(select count(*)::int from ${listings} where ${listings.categoryId} = ${categories.id} and ${listings.status} = 'active')`,
    })
    .from(categories)
    .orderBy(categories.id);
  res.json(rows);
});

export default router;
