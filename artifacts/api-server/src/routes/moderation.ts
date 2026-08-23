import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  conversations,
  contentReports,
  listings,
  messages,
  moderationEvents,
  profiles,
  userBlocks,
} from "@workspace/db/schema";
import {
  AcceptTermsBody,
  BlockUserBody,
  CreateContentReportBody,
  RemoveModerationListingBody,
  SuspendModerationUserBody,
  UpdateModerationReportBody,
} from "@workspace/api-zod";
import { requireAuth, requireAuthAllowUnacceptedTerms, type AuthedRequest } from "../lib/auth";
import { ensureProfile } from "../lib/profile";
import { CURRENT_TERMS_VERSION } from "../lib/terms";

const router: IRouter = Router();
const userId = (req: Request) => (req as AuthedRequest).userId;

function reportDto(row: typeof contentReports.$inferSelect) {
  return { ...row, createdAt: row.createdAt.toISOString(), dueAt: row.dueAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null,
    overdue: ["open", "in_review"].includes(row.status) && row.dueAt.getTime() < Date.now() };
}
async function reportContext(row: typeof contentReports.$inferSelect) {
  const [[reporter], [reported], [listing]] = await Promise.all([
    db.select({ displayName: profiles.displayName }).from(profiles).where(eq(profiles.id, row.reporterId)),
    db.select({ displayName: profiles.displayName }).from(profiles).where(eq(profiles.id, row.reportedUserId)),
    row.listingId == null ? Promise.resolve([]) : db.select({ title: listings.title }).from(listings).where(eq(listings.id, row.listingId)),
  ]);
  return { ...reportDto(row), reporterName: reporter?.displayName ?? null, reportedUserName: reported?.displayName ?? null, listingTitle: listing?.title ?? null };
}
async function event(actorId: string | null, eventType: string, values: {
  targetUserId?: string; listingId?: number; reportId?: number; conversationId?: number; metadata?: Record<string, unknown>;
}, executor: any = db) {
  await executor.insert(moderationEvents).values({ actorId, eventType, ...values, metadata: values.metadata ?? {} });
}
async function requireModerator(req: Request, res: Response): Promise<boolean> {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId(req)));
  if (!profile?.isModerator) { res.status(403).json({ error: "Moderator access required" }); return false; }
  return true;
}
async function validateReportTarget(reporterId: string, data: { reportedUserId: string; targetType: string; listingId?: number | null; messageId?: number | null; conversationId?: number | null }) {
  if (data.targetType === "listing") {
    if (data.listingId == null || data.messageId != null || data.conversationId != null) return false;
    const [row] = await db.select().from(listings).where(eq(listings.id, data.listingId));
    return row?.sellerId === data.reportedUserId;
  }
  if (data.targetType === "message") {
    if (data.messageId == null) return false;
    const [row] = await db.select().from(messages).where(eq(messages.id, data.messageId));
    if (!row || row.senderId !== data.reportedUserId || (data.conversationId != null && row.conversationId !== data.conversationId)) return false;
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, row.conversationId));
    return Boolean(conversation && [conversation.buyerId, conversation.sellerId].includes(reporterId) && [conversation.buyerId, conversation.sellerId].includes(data.reportedUserId));
  }
  if (data.targetType !== "user") return false;
  const [profile] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, data.reportedUserId));
  if (!profile) return false;
  if (data.listingId != null) {
    if (data.messageId != null || data.conversationId != null) return false;
    const [listing] = await db.select().from(listings).where(eq(listings.id, data.listingId));
    return listing?.sellerId === data.reportedUserId;
  }
  if (data.messageId != null) return validateReportTarget(reporterId, { ...data, targetType: "message" });
  if (data.conversationId != null) {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, data.conversationId));
    return Boolean(conversation && [conversation.buyerId, conversation.sellerId].includes(reporterId) && [conversation.buyerId, conversation.sellerId].includes(data.reportedUserId));
  }
  return true;
}

router.get("/me/terms", requireAuthAllowUnacceptedTerms, async (req: Request, res: Response) => {
  await ensureProfile(userId(req));
  const [p] = await db.select().from(profiles).where(eq(profiles.id, userId(req)));
  res.json({ currentVersion: CURRENT_TERMS_VERSION, acceptedVersion: p?.termsAcceptedVersion ?? null, acceptedAt: p?.termsAcceptedAt?.toISOString() ?? null });
});
router.post("/me/terms", requireAuthAllowUnacceptedTerms, async (req: Request, res: Response) => {
  const parsed = AcceptTermsBody.safeParse(req.body);
  if (!parsed.success || parsed.data.version !== CURRENT_TERMS_VERSION) { res.status(400).json({ error: "Please accept the current terms version" }); return; }
  const now = new Date();
  await ensureProfile(userId(req));
  await db.transaction(async (tx) => {
    await tx.update(profiles).set({ termsAcceptedVersion: CURRENT_TERMS_VERSION, termsAcceptedAt: now }).where(eq(profiles.id, userId(req)));
    await event(userId(req), "terms_accepted", { targetUserId: userId(req), metadata: { version: CURRENT_TERMS_VERSION } }, tx);
  });
  res.json({ currentVersion: CURRENT_TERMS_VERSION, acceptedVersion: CURRENT_TERMS_VERSION, acceptedAt: now.toISOString() });
});
router.post("/me/reports", requireAuth, async (req: Request, res: Response) => {
  const parsed = CreateContentReportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  if (data.reportedUserId === userId(req)) { res.status(400).json({ error: "You cannot report yourself" }); return; }
  if (!(await validateReportTarget(userId(req), data))) { res.status(400).json({ error: "Report target does not match the reported user" }); return; }
  const now = new Date();
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(contentReports).values({ ...data, reporterId: userId(req), dueAt: new Date(now.getTime() + 86_400_000), createdAt: now, updatedAt: now }).returning();
    await event(userId(req), "report_created", { targetUserId: data.reportedUserId, listingId: data.listingId ?? undefined, reportId: created.id }, tx);
    return created;
  });
  res.status(201).json(reportDto(row));
});
router.get("/me/blocks", requireAuth, async (req: Request, res: Response) => {
  const rows = await db.select().from(userBlocks).where(eq(userBlocks.blockerId, userId(req))).orderBy(desc(userBlocks.createdAt));
  res.json(rows.map((r) => ({ id: r.id, blockedUserId: r.blockedId, sourceListingId: r.sourceListingId, sourceConversationId: r.sourceConversationId, createdAt: r.createdAt.toISOString() })));
});
router.post("/me/blocks", requireAuth, async (req: Request, res: Response) => {
  const parsed = BlockUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  if (data.userId === userId(req)) { res.status(400).json({ error: "You cannot block yourself" }); return; }
  if (data.sourceListingId != null) {
    const [source] = await db.select().from(listings).where(eq(listings.id, data.sourceListingId));
    if (!source || source.sellerId !== data.userId) { res.status(400).json({ error: "Block listing source does not match this user" }); return; }
  }
  if (data.sourceConversationId != null) {
    const [source] = await db.select().from(conversations).where(eq(conversations.id, data.sourceConversationId));
    if (!source || ![source.buyerId, source.sellerId].includes(userId(req)) || ![source.buyerId, source.sellerId].includes(data.userId)) {
      res.status(400).json({ error: "Block conversation source does not match this user" }); return;
    }
  }
  const [profile] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, data.userId));
  if (!profile) { res.status(404).json({ error: "User not found" }); return; }
  const block = await db.transaction(async (tx) => {
    const [created] = await tx.insert(userBlocks).values({ blockerId: userId(req), blockedId: data.userId, sourceListingId: data.sourceListingId ?? null, sourceConversationId: data.sourceConversationId ?? null }).onConflictDoNothing().returning();
    if (!created) {
      const existing = (await tx.select().from(userBlocks).where(and(eq(userBlocks.blockerId, userId(req)), eq(userBlocks.blockedId, data.userId))))[0];
      let [report] = await tx.select().from(contentReports).where(and(eq(contentReports.reporterId, userId(req)), eq(contentReports.reportedUserId, data.userId), eq(contentReports.targetType, "block")));
      if (!report) {
        const now = new Date();
        [report] = await tx.insert(contentReports).values({ reporterId: userId(req), reportedUserId: data.userId, targetType: "block", reason: "blocked_user", createdAt: now, updatedAt: now, dueAt: new Date(now.getTime() + 86_400_000) }).returning();
      }
      const [audit] = await tx.select({ id: moderationEvents.id }).from(moderationEvents).where(and(eq(moderationEvents.reportId, report.id), eq(moderationEvents.eventType, "user_blocked")));
      if (!audit) await event(userId(req), "user_blocked", { targetUserId: data.userId, reportId: report.id }, tx);
      return existing;
    }
    const now = new Date();
    const [report] = await tx.insert(contentReports).values({ reporterId: userId(req), reportedUserId: data.userId, targetType: "block", reason: "blocked_user", details: data.details ?? null, createdAt: now, updatedAt: now, dueAt: new Date(now.getTime() + 86_400_000) }).returning();
    await event(userId(req), "user_blocked", { targetUserId: data.userId, reportId: report.id }, tx);
    return created;
  });
  res.status(201).json({ id: block.id, blockedUserId: block.blockedId, sourceListingId: block.sourceListingId, sourceConversationId: block.sourceConversationId, createdAt: block.createdAt.toISOString() });
});
router.delete("/me/blocks/:userId", requireAuth, async (req: Request, res: Response) => {
  await db.transaction(async (tx) => {
    const deleted = await tx.delete(userBlocks)
      .where(and(eq(userBlocks.blockerId, userId(req)), eq(userBlocks.blockedId, String(req.params.userId))))
      .returning({ id: userBlocks.id });
    if (deleted.length > 0) {
      await event(userId(req), "user_unblocked", { targetUserId: String(req.params.userId) }, tx);
    }
  }); res.status(204).end();
});
router.get("/moderation/reports", requireAuth, async (req: Request, res: Response) => {
  if (!(await requireModerator(req, res))) return;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const rows = await db.select().from(contentReports).where(status ? eq(contentReports.status, status) : undefined).orderBy(desc(contentReports.createdAt));
  res.json(await Promise.all(rows.map(reportContext)));
});
router.patch("/moderation/reports/:id", requireAuth, async (req: Request, res: Response) => {
  if (!(await requireModerator(req, res))) return;
  const parsed = UpdateModerationReportBody.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data; const resolved = d.status === "resolved" || d.status === "dismissed";
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx.update(contentReports).set({ ...d, updatedAt: new Date(), ...(resolved && { resolvedAt: new Date(), resolvedBy: userId(req) }) }).where(eq(contentReports.id, Number(req.params.id))).returning();
    if (updated) await event(userId(req), "report_updated", { reportId: updated.id, targetUserId: updated.reportedUserId }, tx);
    return updated;
  });
  if (!row) { res.status(404).json({ error: "Report not found" }); return; }
  res.json(await reportContext(row));
});
router.get("/moderation/events", requireAuth, async (req: Request, res: Response) => {
  if (!(await requireModerator(req, res))) return;
  const rows = await db.select().from(moderationEvents).orderBy(desc(moderationEvents.createdAt)).limit(200);
  res.json(await Promise.all(rows.map(async (r) => {
    const [[actor], [target], [listing]] = await Promise.all([
      r.actorId == null ? Promise.resolve([]) : db.select({ displayName: profiles.displayName }).from(profiles).where(eq(profiles.id, r.actorId)),
      r.targetUserId == null ? Promise.resolve([]) : db.select({ displayName: profiles.displayName }).from(profiles).where(eq(profiles.id, r.targetUserId)),
      r.listingId == null ? Promise.resolve([]) : db.select({ title: listings.title }).from(listings).where(eq(listings.id, r.listingId)),
    ]);
    return { ...r, createdAt: r.createdAt.toISOString(), actorName: actor?.displayName ?? null, targetUserName: target?.displayName ?? null, listingTitle: listing?.title ?? null };
  })));
});
router.post("/moderation/listings/:id/remove", requireAuth, async (req: Request, res: Response) => {
  if (!(await requireModerator(req, res))) return; const p = RemoveModerationListingBody.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx.update(listings).set({ removedAt: new Date(), removedBy: userId(req), removalReason: p.data.reason }).where(eq(listings.id, Number(req.params.id))).returning();
    if (updated) await event(userId(req), "listing_removed", { listingId: updated.id, targetUserId: updated.sellerId, metadata: { reason: p.data.reason } }, tx);
    return updated;
  });
  if (!row) { res.status(404).json({ error: "Listing not found" }); return; } res.status(204).end();
});
router.post("/moderation/users/:id/suspend", requireAuth, async (req: Request, res: Response) => {
  if (!(await requireModerator(req, res))) return; const p = SuspendModerationUserBody.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const target = String(req.params.id); const row = await db.transaction(async (tx) => {
    const [updated] = await tx.update(profiles).set({ suspendedAt: new Date(), suspensionReason: p.data.reason }).where(eq(profiles.id, target)).returning();
    if (updated) await event(userId(req), "user_suspended", { targetUserId: target, metadata: { reason: p.data.reason } }, tx);
    return updated;
  });
  if (!row) { res.status(404).json({ error: "User not found" }); return; } res.status(204).end();
});
router.delete("/moderation/users/:id/suspend", requireAuth, async (req: Request, res: Response) => {
  if (!(await requireModerator(req, res))) return; const target = String(req.params.id); const row = await db.transaction(async (tx) => {
    const [updated] = await tx.update(profiles).set({ suspendedAt: null, suspensionReason: null }).where(eq(profiles.id, target)).returning();
    if (updated) await event(userId(req), "user_unsuspended", { targetUserId: target }, tx);
    return updated;
  });
  if (!row) { res.status(404).json({ error: "User not found" }); return; } res.status(204).end();
});
export default router;