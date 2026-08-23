import { and, eq, or } from "drizzle-orm";
import { db } from "@workspace/db";
import { userBlocks } from "@workspace/db/schema";

export async function usersAreBlocked(firstUserId: string, secondUserId: string): Promise<boolean> {
  const rows = await db
    .select({ id: userBlocks.id })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, firstUserId), eq(userBlocks.blockedId, secondUserId)),
        and(eq(userBlocks.blockerId, secondUserId), eq(userBlocks.blockedId, firstUserId)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function filterBlockedSellerRows<T extends { sellerId: string }>(
  rows: T[],
  viewerId: string | null,
): Promise<T[]> {
  if (!viewerId) return rows;
  const results = await Promise.all(rows.map(async (row) => !(await usersAreBlocked(viewerId, row.sellerId))));
  return rows.filter((_, index) => results[index]);
}