import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, desc, eq, ne, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { conversations, listings, messages, profiles } from "@workspace/db/schema";
import { SendMessageBody, StartConversationBody } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { sendPushToUser } from "../lib/push";
import { ensureProfile } from "./me";

async function notifyNewMessage(
  recipientId: string,
  senderId: string,
  conversationId: number,
  content: string,
) {
  try {
    const [sender] = await db.select().from(profiles).where(eq(profiles.id, senderId));
    await sendPushToUser(recipientId, {
      title: sender?.displayName ?? "Sellify",
      body: content.length > 140 ? `${content.slice(0, 137)}...` : content,
      data: { conversationId },
    });
  } catch {
    // Push is best-effort — never let it affect the message request.
  }
}

const router: IRouter = Router();

async function conversationDto(convId: number, viewerId: string) {
  const [c] = await db.select().from(conversations).where(eq(conversations.id, convId));
  if (!c) return null;
  const otherId = c.buyerId === viewerId ? c.sellerId : c.buyerId;
  const [[listing], [other], [last], [{ unread }]] = await Promise.all([
    db.select().from(listings).where(eq(listings.id, c.listingId)),
    db.select().from(profiles).where(eq(profiles.id, otherId)),
    db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, c.id))
      .orderBy(desc(messages.createdAt))
      .limit(1),
    db
      .select({ unread: sql<number>`count(*)::int` })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, c.id),
          eq(messages.read, false),
          ne(messages.senderId, viewerId),
        ),
      ),
  ]);
  return {
    id: c.id,
    listingId: c.listingId,
    listingTitle: listing?.title ?? null,
    listingImage: listing?.images?.[0] ?? null,
    listingPrice: listing ? Number(listing.price) : null,
    listingCurrency: listing?.currency ?? null,
    listingStatus: listing?.status ?? null,
    buyerId: c.buyerId,
    sellerId: c.sellerId,
    otherPartyName: other?.displayName ?? null,
    otherPartyAvatarUrl: other?.avatarUrl ?? null,
    lastMessage: last?.content ?? null,
    lastMessageAt: c.lastMessageAt.toISOString(),
    unreadCount: unread,
  };
}

router.get("/conversations", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).userId;
  const rows = await db
    .select()
    .from(conversations)
    .where(or(eq(conversations.buyerId, userId), eq(conversations.sellerId, userId)))
    .orderBy(desc(conversations.lastMessageAt));
  const dtos = await Promise.all(rows.map((r) => conversationDto(r.id, userId)));
  res.json(dtos.filter(Boolean));
});

router.post("/conversations", requireAuth, async (req: Request, res: Response) => {
  const parsed = StartConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = (req as AuthedRequest).userId;
  await ensureProfile(userId);
  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, parsed.data.listingId));
  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (listing.sellerId === userId) {
    res.status(400).json({ error: "Cannot message your own listing" });
    return;
  }
  let [conv] = await db
    .select()
    .from(conversations)
    .where(
      and(eq(conversations.listingId, listing.id), eq(conversations.buyerId, userId)),
    );
  if (!conv) {
    [conv] = await db
      .insert(conversations)
      .values({ listingId: listing.id, buyerId: userId, sellerId: listing.sellerId })
      .returning();
  }
  await db.insert(messages).values({
    conversationId: conv.id,
    senderId: userId,
    content: parsed.data.message,
  });
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversations.id, conv.id));
  void notifyNewMessage(listing.sellerId, userId, conv.id, parsed.data.message);
  res.status(201).json(await conversationDto(conv.id, userId));
});

async function loadConversation(req: Request, res: Response) {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, Number(req.params.id)));
  const userId = (req as AuthedRequest).userId;
  if (!conv || (conv.buyerId !== userId && conv.sellerId !== userId)) {
    res.status(404).json({ error: "Conversation not found" });
    return null;
  }
  return conv;
}

router.get("/conversations/:id/messages", requireAuth, async (req: Request, res: Response) => {
  const conv = await loadConversation(req, res);
  if (!conv) return;
  const userId = (req as AuthedRequest).userId;
  await db
    .update(messages)
    .set({ read: true })
    .where(and(eq(messages.conversationId, conv.id), ne(messages.senderId, userId)));
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(asc(messages.createdAt));
  res.json(
    rows.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      content: m.content,
      imageUrl: m.imageUrl,
      createdAt: m.createdAt.toISOString(),
      read: m.read,
    })),
  );
});

router.post("/conversations/:id/messages", requireAuth, async (req: Request, res: Response) => {
  const conv = await loadConversation(req, res);
  if (!conv) return;
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = (req as AuthedRequest).userId;
  const [m] = await db
    .insert(messages)
    .values({
      conversationId: conv.id,
      senderId: userId,
      content: parsed.data.content,
      imageUrl: parsed.data.imageUrl ?? null,
    })
    .returning();
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversations.id, conv.id));
  const recipientId = conv.buyerId === userId ? conv.sellerId : conv.buyerId;
  void notifyNewMessage(recipientId, userId, conv.id, parsed.data.content);
  res.status(201).json({
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    content: m.content,
    imageUrl: m.imageUrl,
    createdAt: m.createdAt.toISOString(),
    read: m.read,
  });
});

export default router;
