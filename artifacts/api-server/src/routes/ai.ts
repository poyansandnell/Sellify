import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { categories } from "@workspace/db/schema";
import { AnalyzeImagesBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../lib/auth";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

async function imageToDataUrl(pathOrUrl: string): Promise<string | null> {
  try {
    if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
    const file = await objectStorage.getObjectEntityFile(
      pathOrUrl.startsWith("/objects/") ? pathOrUrl : `/objects/${pathOrUrl}`,
    );
    const [meta] = await file.getMetadata();
    const [buf] = await file.download();
    const contentType = meta.contentType || "image/jpeg";
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

router.post("/ai/analyze", requireAuth, async (req: Request, res: Response) => {
  const parsed = AnalyzeImagesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { images, locale, city, country, currency } = parsed.data;

  const imageUrls = (
    await Promise.all(images.slice(0, 5).map(imageToDataUrl))
  ).filter((u): u is string => u !== null);
  if (imageUrls.length === 0) {
    res.status(400).json({ error: "No readable images provided" });
    return;
  }

  const cats = await db.select().from(categories);
  const catList = cats.map((c) => `${c.id}:${c.slug} (${c.nameEn}/${c.nameSv})`).join(", ");
  const lang = locale?.startsWith("sv") ? "Swedish" : "English";
  const cur = currency || "SEK";

  const systemPrompt = `You are an expert second-hand marketplace listing writer. Analyze the product photos and produce a complete, honest, sales-optimized listing in ${lang}. The seller is located in ${city || "unknown city"}, ${country || "SE"}. Prices in ${cur}. Available categories (id:slug): ${catList}.
Respond ONLY with JSON matching this shape:
{"title": string (max 70 chars, include brand/model if visible),
"description": string (3-6 short paragraphs, honest condition notes),
"shortDescription": string (max 160 chars),
"categoryId": number|null (one of the given ids),
"categorySlug": string|null,
"brand": string|null, "model": string|null, "color": string|null, "material": string|null,
"condition": "new"|"like_new"|"good"|"fair"|"worn",
"suggestedPrice": number, "priceRangeLow": number, "priceRangeHigh": number,
"currency": "${cur}",
"specifications": [{"label": string, "value": string}],
"keywords": [string] (5-10 search keywords),
"seoTitle": string (max 60 chars), "seoDescription": string (max 155 chars),
"uncertainFields": [string] (field names above you are unsure about, e.g. "brand","suggestedPrice")}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-terra",
      max_completion_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Create the listing from these photos." },
            ...imageUrls.map((url) => ({
              type: "image_url" as const,
              image_url: { url },
            })),
          ],
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("Empty AI response");
    const draft = JSON.parse(raw);
    if (draft.categoryId != null && !cats.some((c) => c.id === draft.categoryId)) {
      draft.categoryId = null;
    }
    res.json({
      title: String(draft.title ?? ""),
      description: String(draft.description ?? ""),
      shortDescription: String(draft.shortDescription ?? ""),
      categoryId: draft.categoryId ?? null,
      categorySlug: draft.categorySlug ?? null,
      brand: draft.brand ?? null,
      model: draft.model ?? null,
      color: draft.color ?? null,
      material: draft.material ?? null,
      condition: ["new", "like_new", "good", "fair", "worn"].includes(draft.condition)
        ? draft.condition
        : "good",
      suggestedPrice: Number(draft.suggestedPrice) || 0,
      priceRangeLow: draft.priceRangeLow != null ? Number(draft.priceRangeLow) : null,
      priceRangeHigh: draft.priceRangeHigh != null ? Number(draft.priceRangeHigh) : null,
      currency: String(draft.currency || cur),
      specifications: Array.isArray(draft.specifications) ? draft.specifications : [],
      keywords: Array.isArray(draft.keywords) ? draft.keywords : [],
      seoTitle: draft.seoTitle ?? null,
      seoDescription: draft.seoDescription ?? null,
      uncertainFields: Array.isArray(draft.uncertainFields) ? draft.uncertainFields : [],
    });
  } catch (error) {
    req.log.error({ err: error }, "AI analyze failed");
    res.status(502).json({ error: "AI analysis failed, please try again" });
  }
});

export default router;
