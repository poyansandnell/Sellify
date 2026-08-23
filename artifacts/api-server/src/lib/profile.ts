import { clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { profiles } from "@workspace/db/schema";

export async function ensureProfile(userId: string) {
  const [existing] = await db.select().from(profiles).where(eq(profiles.id, userId));
  if (existing) return existing;
  let displayName = "Sellify user";
  let avatarUrl: string | null = null;
  try {
    const user = await clerkClient.users.getUser(userId);
    displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.username || user.emailAddresses[0]?.emailAddress?.split("@")[0] || displayName;
    avatarUrl = user.imageUrl ?? null;
  } catch {
    // A profile can safely use defaults while Clerk is temporarily unavailable.
  }
  const [created] = await db.insert(profiles).values({ id: userId, displayName, avatarUrl })
    .onConflictDoNothing().returning();
  if (created) return created;
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId));
  return profile!;
}