import { Router, type IRouter, type Request, type Response } from "express";
import { clerkClient } from "@clerk/express";
import { desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  conversations,
  favorites,
  listings,
  messages,
  profiles,
  pushTokens,
} from "@workspace/db/schema";
import { SavePushTokenBody, UpdateMeBody } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { toListingDtos } from "../lib/listingUtils";

const router: IRouter = Router();

export async function ensureProfile(userId: string) {
  const [existing] = await db.select().from(profiles).where(eq(profiles.id, userId));
  if (existing) return existing;
  let displayName = "Sellify user";
  let avatarUrl: string | null = null;
  try {
    const u = await clerkClient.users.getUser(userId);
    displayName =
      [u.firstName, u.lastName].filter(Boolean).join(" ") ||
      u.username ||
      u.emailAddresses[0]?.emailAddress?.split("@")[0] ||
      displayName;
    avatarUrl = u.imageUrl ?? null;
  } catch {
    // keep defaults if Clerk lookup fails
  }
  const [created] = await db
    .insert(profiles)
    .values({ id: userId, displayName, avatarUrl })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [row] = await db.select().from(profiles).where(eq(profiles.id, userId));
  return row;
}

async function profileDto(userId: string) {
  const p = await ensureProfile(userId);
  const [counts] = await db
    .select({
      active: sql<number>`count(*) filter (where ${listings.status} = 'active')::int`,
      sold: sql<number>`count(*) filter (where ${listings.status} = 'sold')::int`,
    })
    .from(listings)
    .where(eq(listings.sellerId, userId));
  return {
    id: p.id,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    city: p.city,
    country: p.country,
    language: p.language,
    currency: p.currency,
    memberSince: p.createdAt.toISOString(),
    activeListingCount: counts?.active ?? 0,
    soldListingCount: counts?.sold ?? 0,
  };
}

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  res.json(await profileDto((req as AuthedRequest).userId));
});

router.patch("/me", requireAuth, async (req: Request, res: Response) => {
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = (req as AuthedRequest).userId;
  await ensureProfile(userId);
  const d = parsed.data;
  await db
    .update(profiles)
    .set({
      ...(d.displayName !== undefined && { displayName: d.displayName }),
      ...(d.avatarUrl !== undefined && { avatarUrl: d.avatarUrl }),
      ...(d.city !== undefined && { city: d.city }),
      ...(d.country !== undefined && { country: d.country }),
      ...(d.language !== undefined && { language: d.language }),
      ...(d.currency !== undefined && { currency: d.currency }),
    })
    .where(eq(profiles.id, userId));
  res.json(await profileDto(userId));
});

router.get("/me/listings", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const rows = await db
    .select()
    .from(listings)
    .where(eq(listings.sellerId, userId))
    .orderBy(desc(listings.createdAt));
  res.json(await toListingDtos(rows, userId));
});

router.get("/me/favorites", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const favs = await db
    .select({ listingId: favorites.listingId })
    .from(favorites)
    .where(eq(favorites.userId, userId));
  if (!favs.length) {
    res.json([]);
    return;
  }
  const rows = await db
    .select()
    .from(listings)
    .where(inArray(listings.id, favs.map((f) => f.listingId)))
    .orderBy(desc(listings.createdAt));
  res.json(await toListingDtos(rows, userId));
});

// Permanently delete the user's account: all app data + the Clerk user.
// Apple requires in-app account deletion for apps with account creation.
router.post("/me/delete", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;

  // Delete the Clerk identity first: if this fails, nothing else has changed and
  // the client gets an honest error instead of a false "deleted" response.
  try {
    await clerkClient.users.deleteUser(userId);
  } catch (err) {
    console.error("Failed to delete Clerk user", userId, err);
    res.status(502).json({ error: { message: "Account deletion failed, please try again" } });
    return;
  }

  // Purge all app data atomically. If this throws after the Clerk user is gone,
  // the account can no longer sign in; the orphaned rows are logged for cleanup.
  try {
    await db.transaction(async (tx) => {
      const convs = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(or(eq(conversations.buyerId, userId), eq(conversations.sellerId, userId)));
      const convIds = convs.map((c) => c.id);
      if (convIds.length > 0) {
        await tx.delete(messages).where(inArray(messages.conversationId, convIds));
        await tx.delete(conversations).where(inArray(conversations.id, convIds));
      }

      const own = await tx
        .select({ id: listings.id })
        .from(listings)
        .where(eq(listings.sellerId, userId));
      const ownIds = own.map((l) => l.id);
      if (ownIds.length > 0) {
        await tx.delete(favorites).where(inArray(favorites.listingId, ownIds));
      }
      await tx.delete(favorites).where(eq(favorites.userId, userId));
      await tx.delete(listings).where(eq(listings.sellerId, userId));
      await tx.delete(pushTokens).where(eq(pushTokens.userId, userId));
      await tx.delete(profiles).where(eq(profiles.id, userId));
    });
  } catch (err) {
    console.error("Account data purge failed after Clerk deletion", userId, err);
    res.status(500).json({ error: { message: "Account deleted but data cleanup failed" } });
    return;
  }

  res.status(204).end();
});

router.post("/me/push-token", requireAuth, async (req: Request, res: Response) => {
  const parsed = SavePushTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = (req as AuthedRequest).userId;
  await db
    .insert(pushTokens)
    .values({ token: parsed.data.token, userId })
    .onConflictDoUpdate({
      target: pushTokens.token,
      set: { userId },
    });
  res.status(204).end();
});

export default router;
