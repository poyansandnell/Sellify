import { clerkClient } from "@clerk/express";
import { logger } from "./logger";

/**
 * One-time, idempotent seeding of an App Store review account.
 * Runs only when REVIEW_USER_EMAIL and REVIEW_USER_PASSWORD are set.
 * Backend-created users get a verified email, so no email code is needed.
 */
export async function seedReviewUser(): Promise<void> {
  const email = process.env["REVIEW_USER_EMAIL"];
  const password = process.env["REVIEW_USER_PASSWORD"];

  if (!email || !password) return;

  try {
    const existing = await clerkClient.users.getUserList({
      emailAddress: [email],
    });

    if (existing.totalCount > 0) {
      logger.info({ email }, "Review user already exists, skipping seed");
      return;
    }

    const user = await clerkClient.users.createUser({
      emailAddress: [email],
      password,
      firstName: "Apple",
      lastName: "Review",
      skipPasswordChecks: true,
    });

    logger.info({ email, userId: user.id }, "Review user created");
  } catch (err) {
    logger.error({ err, email }, "Failed to seed review user");
  }
}
