import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { pushTokens } from "@workspace/db/schema";
import { logger } from "./logger";

/**
 * Send a push notification to all of a user's registered devices via
 * Expo's push API. Fire-and-forget: never throws, logs failures, and
 * removes tokens Expo reports as no longer registered.
 */
export async function sendPushToUser(
  userId: string,
  notification: { title: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(pushTokens)
      .where(eq(pushTokens.userId, userId));
    if (rows.length === 0) return;

    const messages = rows.map((r) => ({
      to: r.token,
      title: notification.title,
      body: notification.body,
      data: notification.data ?? {},
      sound: "default",
    }));

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "expo push send failed");
      return;
    }
    const json = (await res.json()) as {
      data?: Array<{ status: string; details?: { error?: string } }>;
    };
    const dead = (json.data ?? [])
      .map((ticket, i) =>
        ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered"
          ? rows[i].token
          : null,
      )
      .filter((t): t is string => t !== null);
    if (dead.length > 0) {
      await db.delete(pushTokens).where(inArray(pushTokens.token, dead));
    }
  } catch (err) {
    logger.warn({ err }, "expo push send error");
  }
}
