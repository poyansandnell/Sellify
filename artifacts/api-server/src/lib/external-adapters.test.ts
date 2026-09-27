import assert from "node:assert/strict";
import test from "node:test";
import type { ExternalSource } from "@workspace/db/schema";
import {
  canonicalizeListingUrl,
  isSafeExternalUrl,
  normalizeEbaySearchItem,
  normalizeGenericFeedItem,
  normalizeTraderaSearchItem,
  parseExternalFeedRecords,
  robotsAllowsPath,
} from "./externalAdapters";
import { validateExternalAiNormalization } from "./externalListingNormalization";
import {
  assertSourceMayIngest,
  isExternalSourceSearchable,
  type NormalizedExternalListing,
} from "./externalSources";

function feedSource(feedFormat: string): ExternalSource {
  return {
    id: "test-feed",
    country: "SE",
    feedFormat,
    fieldMap: null,
  } as ExternalSource;
}

function approvedSource(overrides: Partial<ExternalSource> = {}): ExternalSource {
  return {
    id: "test-source",
    enabled: true,
    legalStatus: "APPROVED",
    legalApproval: true,
    legalApprovalReference: "review-123",
    legalApprovedAt: new Date("2026-01-01T00:00:00Z"),
    partnershipRequired: false,
    partnershipApproved: false,
    sourceType: "API",
    apiKeyRequired: false,
    feedUrl: null,
    feedFormat: null,
    robotsAllowsIndexing: null,
    robotsCheckedAt: null,
    ...overrides,
  } as ExternalSource;
}

test("external source approval and ingestion gates fail closed", () => {
  const approved = approvedSource();
  assert.equal(isExternalSourceSearchable(approved), true);
  assert.equal(
    isExternalSourceSearchable(
      approvedSource({ legalApprovalReference: null }),
    ),
    false,
  );
  assert.equal(
    isExternalSourceSearchable(
      approvedSource({ partnershipRequired: true, partnershipApproved: false }),
    ),
    false,
  );

  assert.throws(() => assertSourceMayIngest(approvedSource({ enabled: false })));
  assert.throws(() =>
    assertSourceMayIngest(approvedSource({ apiKeyRequired: true })),
  );
  assert.throws(() =>
    assertSourceMayIngest(approvedSource({ sourceType: "FEED" })),
  );
  assert.throws(() =>
    assertSourceMayIngest(
      approvedSource({
        sourceType: "INDEX",
        feedUrl: "https://market.example/sitemap.xml",
        feedFormat: "SITEMAP",
      }),
    ),
  );
  assert.doesNotThrow(() =>
    assertSourceMayIngest(
      approvedSource({
        sourceType: "INDEX",
        feedUrl: "https://market.example/sitemap.xml",
        feedFormat: "SITEMAP",
        robotsAllowsIndexing: true,
        robotsCheckedAt: new Date("2026-01-01T00:00:00Z"),
      }),
    ),
  );
});

test("canonicalizes listing links and strips known tracking parameters", () => {
  assert.equal(
    canonicalizeListingUrl(
      "https://market.example/item/1?utm_source=newsletter&z=2&a=1#photos",
    ),
    "https://market.example/item/1?a=1&z=2",
  );
  assert.equal(canonicalizeListingUrl("http://market.example/item/1"), null);
  assert.equal(canonicalizeListingUrl("https://127.0.0.1/item/1"), null);
  assert.equal(canonicalizeListingUrl("https://localhost/item/1"), null);
  assert.equal(isSafeExternalUrl("https://market.example/feed.json"), true);
  assert.equal(isSafeExternalUrl("file:///etc/passwd"), false);
});

test("robots rules use the longest match and allow wins ties", () => {
  const robots = [
    "User-agent: *",
    "Disallow: /private",
    "Allow: /private/public",
    "Disallow: /catalog",
    "Allow: /catalog",
  ].join("\n");
  assert.equal(robotsAllowsPath(robots, "/private/hidden"), false);
  assert.equal(robotsAllowsPath(robots, "/private/public/item/1"), true);
  assert.equal(robotsAllowsPath(robots, "/catalog"), true);
  assert.equal(robotsAllowsPath("User-agent: OtherBot\nDisallow: /", "/"), true);
  assert.equal(
    robotsAllowsPath("User-agent: *\nDisallow: /*.pdf$", "/manuals/guide.pdf"),
    false,
  );
  assert.equal(
    robotsAllowsPath(
      "User-agent: *\nDisallow: /*.pdf$",
      "/manuals/guide.pdf?download=1",
    ),
    true,
  );
  assert.equal(
    robotsAllowsPath(
      "User-agent: *\nDisallow: /search?private=*",
      "/search?private=1",
    ),
    false,
  );
});

test("JSON and RSS feeds extract listing records", () => {
  const jsonRecords = parseExternalFeedRecords(
    feedSource("JSON"),
    JSON.stringify({
      listings: [{ id: "json-1", title: "Camera", url: "https://market.example/camera" }],
    }),
  );
  assert.equal(jsonRecords.length, 1);

  const rssRecords = parseExternalFeedRecords(
    feedSource("RSS"),
    `<?xml version="1.0"?><rss><channel><title>Inventory</title><item><title>Bike</title><guid>rss-1</guid><link>https://market.example/bike</link></item></channel></rss>`,
  );
  assert.equal(rssRecords.length, 1);
  assert.equal((rssRecords[0] as { guid: string }).guid, "rss-1");
});

test("Schema.org JSON-LD and sitemap feeds are parsed", () => {
  const schemaRecords = parseExternalFeedRecords(
    feedSource("SCHEMA_ORG"),
    `<html><script type="application/ld+json">{"@type":"Product","name":"Desk lamp","sku":"lamp-1","url":"https://market.example/lamp"}</script></html>`,
  );
  assert.equal(schemaRecords.length, 1);
  assert.equal((schemaRecords[0] as { name: string }).name, "Desk lamp");

  const sitemapRecords = parseExternalFeedRecords(
    feedSource("SITEMAP"),
    `<?xml version="1.0"?><urlset><url><loc>https://market.example/lamp</loc></url><url><loc>https://market.example/chair</loc></url></urlset>`,
  );
  assert.deepEqual(sitemapRecords, [
    "https://market.example/lamp",
    "https://market.example/chair",
  ]);
});

test("generic feed mapping normalizes locale prices and rejects unsafe images", () => {
  const listing = normalizeGenericFeedItem(
    feedSource("JSON"),
    {
      id: "listing-1",
      title: "Vintage camera",
      url: "https://market.example/camera?utm_campaign=spring",
      price: "1.234,50 SEK",
      currency: "sek",
      image: [
        "https://images.example/camera.jpg",
        "http://images.example/insecure.jpg",
      ],
    },
  );
  assert.equal(listing?.originalUrl, "https://market.example/camera");
  assert.equal(listing?.price, "1234.50");
  assert.equal(listing?.currency, "SEK");
  assert.deepEqual(listing?.imageUrls, ["https://images.example/camera.jpg"]);
});

test("official marketplace response adapters produce the normalized shape", () => {
  const tradera = normalizeTraderaSearchItem(
    feedSource("JSON"),
    {
      id: "tradera-1",
      itemLink: "https://www.tradera.com/item/1",
      title: "Vintage camera",
      currentPrice: { price: 250, currency: "SEK" },
      seller: { alias: "seller" },
    },
  );
  assert.equal(tradera?.externalId, "tradera-1");
  assert.equal(tradera?.price, "250.00");

  const ebay = normalizeEbaySearchItem({
    itemId: "v1|ebay-1|0",
    itemWebUrl: "https://www.ebay.com/itm/1",
    title: "Vintage camera",
    price: { value: "29.99", currency: "USD" },
    buyingOptions: ["FIXED_PRICE"],
  });
  assert.equal(ebay?.externalId, "v1|ebay-1|0");
  assert.equal(ebay?.currency, "USD");
  assert.equal(ebay?.auction, false);
});

test("AI normalization accepts only values supported by exact source evidence", () => {
  const listing = {
    externalId: "ai-1",
    originalUrl: "https://market.example/item/1",
    title: "Nike Air Max red shoes",
    description: "A good pair in size 10.",
  } as NormalizedExternalListing;
  const updates = validateExternalAiNormalization(
    listing,
    {
      brand: { value: "Nike", evidence: "Nike Air Max", confidence: 0.95 },
      model: { value: "Air Max", evidence: "Nike Air Max", confidence: 0.92 },
      color: { value: "red", evidence: "red shoes", confidence: 0.91 },
      condition: { value: "new", evidence: "new condition", confidence: 0.99 },
      categoryId: { value: 5, evidence: "shoes", confidence: 0.9 },
    },
    [{ id: 5, slug: "shoes", nameEn: "Shoes", nameSv: "Skor" }],
  );
  assert.equal(updates.brand, "Nike");
  assert.equal(updates.model, "Air Max");
  assert.equal(updates.color, "red");
  assert.equal(updates.condition, null);
  assert.equal(updates.categoryId, 5);
});