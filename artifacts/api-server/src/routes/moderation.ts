import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  conversations,
  contentReports,
  externalListings,
  externalSources,
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
  ListModerationSearchSourcesResponse,
  ListSeoLocationNodesResponse,
  RemoveModerationListingBody,
  SyncModerationSearchSourceBody,
  SuspendModerationUserBody,
  UpdateModerationReportBody,
  UpdateModerationSearchSourceBody,
} from "@workspace/api-zod";
import { requireAuth, requireAuthAllowUnacceptedTerms, type AuthedRequest } from "../lib/auth";
import { ensureProfile } from "../lib/profile";
import { CURRENT_TERMS_VERSION } from "../lib/terms";
import { getLocationSitemapPath } from "../lib/seo-sitemap";
import {
  checkExternalSourceRobots,
  getExternalAdapterReadiness,
  getExternalSourceAdapter,
  isSafeExternalUrl,
} from "../lib/externalAdapters";
import { assertSourceMayIngest } from "../lib/externalSources";
import { syncExternalSource } from "../lib/externalSourceSync";

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
function sourceOperationalStatus(
  source: typeof externalSources.$inferSelect,
  readiness: ReturnType<typeof getExternalAdapterReadiness>,
) {
  if (source.sourceType === "DISABLED") return "DISABLED";
  const legalReady =
    source.legalStatus === "APPROVED" &&
    source.legalApproval &&
    Boolean(source.legalApprovalReference?.trim()) &&
    Boolean(source.legalApprovedAt);
  if (!legalReady) return "NEEDS_LEGAL_APPROVAL";
  if (source.partnershipRequired && !source.partnershipApproved) {
    return "NEEDS_PARTNERSHIP";
  }
  if (!readiness.adapterAvailable) return "DISABLED";
  if (source.apiKeyRequired && !readiness.integrationConfigured) {
    return "NEEDS_CREDENTIALS";
  }
  if (
    (source.sourceType === "FEED" || source.sourceType === "INDEX") &&
    !readiness.integrationConfigured
  ) {
    return "NEEDS_FEED_URL";
  }
  if (
    source.sourceType === "INDEX" &&
    (!source.robotsAllowsIndexing || !source.robotsCheckedAt)
  ) {
    return "NEEDS_ROBOTS_CHECK";
  }
  if (!source.enabled) return "READY";
  return source.lastFailure &&
    source.lastFailure.getTime() > (source.lastSuccess?.getTime() ?? 0)
    ? "SYNC_ERROR"
    : "ACTIVE";
}

function searchSourceAdminDto(
  source: typeof externalSources.$inferSelect,
  externalListingCount: number,
) {
  const readiness = getExternalAdapterReadiness(source);
  const operationalStatus = sourceOperationalStatus(source, readiness);
  return {
    id: source.id,
    name: source.name,
    country: source.country,
    baseUrl: source.baseUrl,
    sourceType: source.sourceType,
    enabled: source.enabled,
    legalStatus: source.legalStatus,
    legalApproval: source.legalApproval,
    legalApprovalReference: source.legalApprovalReference,
    legalApprovedAt: source.legalApprovedAt?.toISOString() ?? null,
    legalApprovedBy: source.legalApprovedBy,
    termsUrl: source.termsUrl,
    robotsUrl: source.robotsUrl,
    robotsAllowsIndexing: source.robotsAllowsIndexing,
    robotsCheckedAt: source.robotsCheckedAt?.toISOString() ?? null,
    apiDocsUrl: source.apiDocsUrl,
    apiKeyRequired: source.apiKeyRequired,
    partnershipRequired: source.partnershipRequired,
    partnershipApproved: source.partnershipApproved,
    feedUrl: source.feedUrl,
    feedFormat: source.feedFormat,
    fieldMap: source.fieldMap,
    imageMode: source.imageMode,
    refreshInterval: source.refreshInterval,
    rateLimit: source.rateLimit,
    lastSuccess: source.lastSuccess?.toISOString() ?? null,
    lastFailure: source.lastFailure?.toISOString() ?? null,
    lastError: source.lastError,
    adapterAvailable: readiness.adapterAvailable,
    integrationConfigured: readiness.integrationConfigured,
    canEnable: operationalStatus === "READY",
    operationalStatus,
    externalListingCount,
  };
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
router.get("/moderation/seo-locations", requireAuth, async (req: Request, res: Response) => {
  if (!(await requireModerator(req, res))) return;
  const rows = await db
    .select({
      country: listings.country,
      region: listings.region,
      city: listings.city,
      listingCount: sql<number>`count(*)::int`,
    })
    .from(listings)
    .leftJoin(profiles, eq(profiles.id, listings.sellerId))
    .where(
      and(
        eq(listings.status, "active"),
        isNull(listings.removedAt),
        isNull(profiles.suspendedAt),
        sql`trim(${listings.city}) <> ''`,
      ),
    )
    .groupBy(listings.country, listings.region, listings.city)
    .orderBy(asc(listings.country), asc(listings.region), asc(listings.city));
  const nodes = rows.map((row) => ({
    ...row,
    path: getLocationSitemapPath(row.country, row.region, row.city),
  }));
  res.json(ListSeoLocationNodesResponse.parse(nodes));
});
router.get("/moderation/search-sources", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!(await requireModerator(req, res))) return;
  const [sources, counts] = await Promise.all([
    db
      .select()
      .from(externalSources)
      .orderBy(asc(externalSources.country), asc(externalSources.name)),
    db
      .select({
        sourceId: externalListings.sourceId,
        count: sql<number>`count(*)::int`,
      })
      .from(externalListings)
      .where(eq(externalListings.status, "ACTIVE"))
      .groupBy(externalListings.sourceId),
  ]);
  const countBySource = new Map(counts.map((row) => [row.sourceId, row.count]));
  const response = sources.map((source) =>
    searchSourceAdminDto(source, countBySource.get(source.id) ?? 0),
  );
  res.json(ListModerationSearchSourcesResponse.parse(response));
});
router.patch(
  "/moderation/search-sources/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!(await requireModerator(req, res))) return;
    const parsed = UpdateModerationSearchSourceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const id = String(req.params.id);
    const [source] = await db
      .select()
      .from(externalSources)
      .where(eq(externalSources.id, id))
      .limit(1);
    if (!source) {
      res.status(404).json({ error: "Search source not found" });
      return;
    }
    const data = parsed.data;
    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "At least one source field must be changed" });
      return;
    }

    if (data.termsUrl !== undefined && data.termsUrl !== null && !isSafeExternalUrl(data.termsUrl)) {
      res.status(400).json({ error: "Terms URL must be a public HTTPS URL" });
      return;
    }
    if (
      (data.feedUrl !== undefined || data.feedFormat !== undefined) &&
      source.enabled
    ) {
      res.status(400).json({ error: "Disable the source before changing feed configuration" });
      return;
    }
    if (
      (data.feedUrl !== undefined || data.feedFormat !== undefined || data.fieldMap !== undefined) &&
      source.sourceType !== "FEED" &&
      source.sourceType !== "INDEX"
    ) {
      res.status(400).json({ error: "Feed configuration is only supported for feed and index sources" });
      return;
    }
    if (data.feedUrl && !isSafeExternalUrl(data.feedUrl)) {
      res.status(400).json({ error: "Feed URL must be a public HTTPS URL" });
      return;
    }
    if (data.fieldMap && data.fieldMap !== null) {
      const allowedFieldNames = new Set([
        "externalId", "originalUrl", "title", "description", "category",
        "subcategory", "brand", "model", "color", "condition", "price",
        "currency", "country", "region", "city", "postalCode", "sellerName",
        "sellerType", "shippingAvailable", "auction", "auctionEnd",
        "publishedAt", "sourceUpdatedAt", "imageUrls", "status",
      ]);
      const validMapping = Object.entries(data.fieldMap).every(
        ([key, path]) =>
          allowedFieldNames.has(key) &&
          path.length <= 200 &&
          /^[\w@:-]+(?:\.[\w@:-]+)*$/.test(path),
      );
      if (!validMapping || Object.keys(data.fieldMap).length > 30) {
        res.status(400).json({ error: "Feed field mapping contains unsupported fields or paths" });
        return;
      }
    }

    const now = new Date();
    const legalApprovalReference =
      data.legalApprovalReference !== undefined
        ? data.legalApprovalReference?.trim() || null
        : source.legalApprovalReference;
    let legalStatus = data.legalStatus ?? source.legalStatus;
    let legalApproval = data.legalApproval ?? source.legalApproval;
    if (data.legalApproval === false && data.legalStatus === undefined) {
      legalStatus = "REVIEW_REQUIRED";
    }
    if (legalStatus !== "APPROVED") legalApproval = false;
    if (
      (legalStatus === "APPROVED" && !legalApproval) ||
      (data.legalApproval === true && legalStatus !== "APPROVED")
    ) {
      res.status(400).json({ error: "Record legal approval and its approved status together" });
      return;
    }
    if (legalApproval && !legalApprovalReference) {
      res.status(400).json({ error: "A legal approval reference is required" });
      return;
    }
    const approvalChanged =
      legalApproval &&
      (data.legalApproval === true ||
        !source.legalApprovedAt ||
        legalApprovalReference !== source.legalApprovalReference);
    if (legalApproval && !source.legalApprovedAt && data.legalApproval !== true) {
      res.status(400).json({ error: "Confirm legal approval to record its reviewer and date" });
      return;
    }
    const nextPartnershipApproved =
      data.partnershipApproved ?? source.partnershipApproved;
    if (
      source.partnershipRequired &&
      nextPartnershipApproved &&
      (!legalApproval || legalStatus !== "APPROVED")
    ) {
      res.status(400).json({ error: "Partnership approval requires documented legal approval" });
      return;
    }
    const legalApprovedAt = legalApproval
      ? approvalChanged
        ? now
        : source.legalApprovedAt
      : null;
    const legalApprovedBy = legalApproval
      ? approvalChanged
        ? userId(req)
        : source.legalApprovedBy
      : null;
    const candidate = {
      ...source,
      legalStatus,
      legalApproval,
      legalApprovalReference,
      legalApprovedAt,
      legalApprovedBy,
      partnershipApproved: nextPartnershipApproved,
      feedUrl: data.feedUrl !== undefined ? data.feedUrl : source.feedUrl,
      feedFormat: data.feedFormat !== undefined ? data.feedFormat : source.feedFormat,
      fieldMap: data.fieldMap !== undefined ? data.fieldMap : source.fieldMap,
      termsUrl: data.termsUrl !== undefined ? data.termsUrl : source.termsUrl,
      enabled: false,
    };
    const readiness = getExternalAdapterReadiness(candidate);
    const requestedEnabled = data.enabled ?? source.enabled;
    if (requestedEnabled && sourceOperationalStatus(candidate, readiness) !== "READY") {
      res.status(409).json({
        error: `Source cannot be enabled until readiness checks pass (${sourceOperationalStatus(candidate, readiness)})`,
      });
      return;
    }
    const enabled =
      requestedEnabled &&
      legalStatus === "APPROVED" &&
      legalApproval &&
      Boolean(legalApprovalReference) &&
      Boolean(legalApprovedAt) &&
      (!source.partnershipRequired || nextPartnershipApproved);
    const setValues = {
      enabled,
      legalStatus,
      legalApproval,
      legalApprovalReference,
      legalApprovedAt,
      legalApprovedBy,
      partnershipApproved: nextPartnershipApproved,
      termsUrl: candidate.termsUrl,
      feedUrl: candidate.feedUrl,
      feedFormat: candidate.feedFormat,
      fieldMap: candidate.fieldMap,
      updatedAt: now,
    };
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(externalSources)
        .set(setValues)
        .where(eq(externalSources.id, id))
        .returning();
      if (row) {
        await event(userId(req), "external_source_updated", {
          metadata: {
            sourceId: id,
            enabled,
            legalStatus,
            approvalChanged: Boolean(approvalChanged),
            feedConfigurationChanged:
              data.feedUrl !== undefined ||
              data.feedFormat !== undefined ||
              data.fieldMap !== undefined,
          },
        }, tx);
      }
      return row;
    });
    if (!updated) {
      res.status(404).json({ error: "Search source not found" });
      return;
    }
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(externalListings)
      .where(
        and(
          eq(externalListings.sourceId, id),
          eq(externalListings.status, "ACTIVE"),
        ),
      );
    const response = searchSourceAdminDto(updated, countRow?.count ?? 0);
    const [validated] = ListModerationSearchSourcesResponse.parse([response]);
    res.json(validated);
  },
);
router.post(
  "/moderation/search-sources/:id/sync",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!(await requireModerator(req, res))) return;
    const parsed = SyncModerationSearchSourceBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const id = String(req.params.id);
    const [source] = await db
      .select()
      .from(externalSources)
      .where(eq(externalSources.id, id))
      .limit(1);
    if (!source) {
      res.status(404).json({ error: "Search source not found" });
      return;
    }
    if (source.sourceType === "API" && !parsed.data.query?.trim()) {
      res.status(400).json({ error: "Enter a search term before syncing this marketplace" });
      return;
    }
    const readiness = getExternalAdapterReadiness(source);
    try {
      if (!getExternalSourceAdapter(source)) {
        throw new Error("This source does not have an available adapter");
      }
      assertSourceMayIngest(source, {
        hasApiCredential: readiness.integrationConfigured,
      });
      if (!readiness.integrationConfigured) {
        throw new Error("The API or feed configuration is incomplete");
      }
    } catch (error) {
      res.status(409).json({
        error: error instanceof Error ? error.message : "Source is not ready to sync",
      });
      return;
    }
    try {
      const result = await syncExternalSource(source, {
        query: parsed.data.query,
        limit: parsed.data.limit ?? 20,
      });
      res.json(result);
    } catch (error) {
      req.log.error({ err: error, sourceId: id }, "External source sync failed");
      res.status(502).json({ error: "External source sync failed; check source status and credentials" });
    }
  },
);
router.post(
  "/moderation/search-sources/:id/check-robots",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!(await requireModerator(req, res))) return;
    const id = String(req.params.id);
    const [source] = await db
      .select()
      .from(externalSources)
      .where(eq(externalSources.id, id))
      .limit(1);
    if (!source) {
      res.status(404).json({ error: "Search source not found" });
      return;
    }
    if (
      source.sourceType !== "INDEX" ||
      source.legalStatus !== "APPROVED" ||
      !source.legalApproval ||
      !source.legalApprovalReference?.trim() ||
      !source.legalApprovedAt ||
      (source.partnershipRequired && !source.partnershipApproved)
    ) {
      res.status(409).json({ error: "Only legally approved index sources can be checked" });
      return;
    }
    try {
      const result = await checkExternalSourceRobots(source);
      const checkedAt = new Date();
      await db.transaction(async (tx) => {
        await tx
          .update(externalSources)
          .set({
            robotsUrl: result.robotsUrl,
            robotsAllowsIndexing: result.allowed,
            robotsCheckedAt: checkedAt,
            ...(!result.allowed ? { enabled: false } : {}),
            updatedAt: checkedAt,
          })
          .where(eq(externalSources.id, id));
        await event(userId(req), "external_source_robots_checked", {
          metadata: { sourceId: id, allowed: result.allowed },
        }, tx);
      });
      res.json({
        sourceId: id,
        robotsUrl: result.robotsUrl,
        allowed: result.allowed,
        checkedAt: checkedAt.toISOString(),
      });
    } catch (error) {
      req.log.warn({ sourceId: id }, "External source robots check failed");
      await db
        .update(externalSources)
        .set({
          robotsAllowsIndexing: false,
          robotsCheckedAt: new Date(),
          enabled: false,
          lastError: "robots.txt could not be verified",
          updatedAt: new Date(),
        })
        .where(eq(externalSources.id, id));
      res.status(502).json({ error: "robots.txt could not be verified" });
    }
  },
);
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