import { clerkClient } from "@clerk/express";
import { logger } from "./logger";

/**
 * One-time, idempotent seeding of an App Store review account.
 * Runs only when REVIEW_USER_EMAIL and REVIEW_USER_PASSWORD are set.
 * Backend-created users get a verified email, so no email code is needed.
 *
 * The account also gets `bypass_client_trust: true` so Clerk's Client Trust
 * check (email code on new devices) never blocks the Apple reviewer, who
 * cannot receive email for the review address.
 */
export async function seedReviewUser(): Promise<void> {
  const email = process.env["REVIEW_USER_EMAIL"];
  const password = process.env["REVIEW_USER_PASSWORD"];

  if (!email || !password) return;

  try {
    let userId: string;

    const existing = await clerkClient.users.getUserList({
      emailAddress: [email],
    });

    if (existing.totalCount > 0) {
      userId = existing.data[0]!.id;
      logger.info({ email, userId }, "Review user already exists");
    } else {
      const user = await clerkClient.users.createUser({
        emailAddress: [email],
        password,
        firstName: "Apple",
        lastName: "Review",
        skipPasswordChecks: true,
      });
      userId = user.id;
      logger.info({ email, userId }, "Review user created");
    }

    await ensureBypassClientTrust(userId, email);
  } catch (err) {
    logger.error({ err, email }, "Failed to seed review user");
  }
}

/**
 * Sets bypass_client_trust via the Clerk Backend REST API directly, since the
 * @clerk/express SDK may not yet expose the parameter.
 */
async function ensureBypassClientTrust(
  userId: string,
  email: string,
): Promise<void> {
  const secretKey = process.env["CLERK_SECRET_KEY"];
  if (!secretKey) {
    logger.warn("CLERK_SECRET_KEY missing; cannot set bypass_client_trust");
    return;
  }

  const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bypass_client_trust: true }),
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error(
      { email, userId, status: res.status, body },
      "Failed to set bypass_client_trust on review user",
    );
    return;
  }

  logger.info({ email, userId }, "bypass_client_trust enabled on review user");
}
