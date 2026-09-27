import { isIP } from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";
import { XMLParser } from "fast-xml-parser";
import type { ExternalSource } from "@workspace/db/schema";
import {
  SourceIntegrationNotConfiguredError,
  type ExternalFeedFormat,
  type NormalizedExternalListing,
} from "./externalSources";

const MAX_FEED_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 12_000;
const XML = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
});

export type ExternalAdapterReadiness = {
  adapterAvailable: boolean;
  integrationConfigured: boolean;
};

export type ExternalSourceAdapter = {
  isConfigured(source: ExternalSource): boolean;
  fetchListings(
    source: ExternalSource,
    options: { query?: string; limit: number },
  ): Promise<NormalizedExternalListing[]>;
};

type DataRecord = Record<string, unknown>;

function asRecord(value: unknown): DataRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as DataRecord)
    : null;
}

function readPath(value: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((current, segment) => {
    if (Array.isArray(current)) current = current[0];
    const object = asRecord(current);
    return object?.[segment];
  }, value);
}

function firstValue(record: DataRecord, paths: string[]): unknown {
  for (const path of paths) {
    const candidate = readPath(record, path);
    if (candidate !== undefined && candidate !== null && candidate !== "") {
      return candidate;
    }
  }
  return undefined;
}

function textValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function numberValue(value: unknown): string | null {
  let cleaned =
    typeof value === "number"
      ? String(value)
      : typeof value === "string"
        ? value.replace(/[^\d,.-]/g, "")
        : "";
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else {
    cleaned = cleaned.replace(",", ".");
  }
  const raw = Number(cleaned);
  return Number.isFinite(raw) && raw >= 0 ? raw.toFixed(2) : null;
}

function dateValue(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function boolValue(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (["true", "yes", "1", "available", "ship"].includes(normalized)) {
      return true;
    }
    if (["false", "no", "0", "pickup"].includes(normalized)) return false;
  }
  return null;
}

function currencyValue(value: unknown): string | null {
  return textValue(value)?.toUpperCase() ?? null;
}

function safeHttpsUrl(value: unknown): string | null {
  const text = textValue(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      isIP(url.hostname) ||
      ["localhost", "localhost.localdomain"].includes(url.hostname.toLowerCase()) ||
      /\.(localhost|local|internal|test|invalid)$/i.test(url.hostname)
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function canonicalizeListingUrl(value: unknown): string | null {
  const safeUrl = safeHttpsUrl(value);
  if (!safeUrl) return null;
  const url = new URL(safeUrl);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (
      key.toLowerCase().startsWith("utm_") ||
      ["ref", "referrer", "campaign", "tracking", "trackingid", "sid"].includes(
        key.toLowerCase(),
      )
    ) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  return url.toString();
}

function imageList(value: unknown): string[] {
  const candidates = Array.isArray(value) ? value : value == null ? [] : [value];
  return candidates
    .map((entry) => {
      if (typeof entry === "string") return safeHttpsUrl(entry);
      const object = asRecord(entry);
      return safeHttpsUrl(
        object?.url ??
          object?.contentUrl ??
          object?.imageUrl ??
          object?.["@_url"],
      );
    })
    .filter((url): url is string => Boolean(url))
    .slice(0, 8);
}

function statusValue(value: unknown): NormalizedExternalListing["status"] {
  const normalized = textValue(value)?.toLowerCase().split("/").pop();
  if (!normalized) return "ACTIVE";
  if (["instock", "limitedavailability", "preorder"].includes(normalized)) {
    return "ACTIVE";
  }
  if (
    [
      "sold",
      "ended",
      "closed",
      "completed",
      "inactive",
      "outofstock",
      "soldout",
    ].includes(normalized)
  ) {
    return "SOLD";
  }
  if (["removed", "deleted", "withdrawn"].includes(normalized)) return "REMOVED";
  if (["active", "available", "published", "live"].includes(normalized)) {
    return "ACTIVE";
  }
  return "UNKNOWN";
}

function normalizeGenericRecord(
  source: ExternalSource,
  value: unknown,
): NormalizedExternalListing | null {
  const record = asRecord(value);
  if (!record) return null;
  const fieldMap = source.fieldMap ?? {};
  const from = (key: string, alternatives: string[]) =>
    readPath(record, fieldMap[key]) ?? firstValue(record, alternatives);
  const externalId =
    textValue(from("externalId", ["id", "guid", "itemId", "sku", "productId"])) ??
    textValue(from("originalUrl", ["url", "link", "itemUrl", "itemLink"]));
  const originalUrl = canonicalizeListingUrl(
    from("originalUrl", ["url", "link", "itemUrl", "itemLink", "guid"]),
  );
  const title = textValue(from("title", ["title", "name", "headline", "productName"]));
  if (!externalId || !originalUrl || !title) return null;

  const priceRaw = from("price", ["price.value", "price.amount", "price"]);
  const imageRaw = from("imageUrls", [
    "image",
    "imageUrl",
    "images",
    "image.url",
    "thumbnail",
  ]);
  const offer = asRecord(readPath(record, "offers")) ?? asRecord(readPath(record, "offer"));
  const address =
    asRecord(readPath(record, "address")) ??
    asRecord(readPath(record, "itemLocation")) ??
    {};

  return {
    externalId,
    originalUrl,
    title,
    description: textValue(from("description", ["description", "summary", "content"])),
    category: textValue(from("category", ["category", "categoryName", "category.name"])),
    subcategory: textValue(from("subcategory", ["subcategory", "subCategory"])),
    brand: textValue(from("brand", ["brand.name", "brand"])),
    model: textValue(from("model", ["model", "modelName"])),
    color: textValue(from("color", ["color", "colour"])),
    condition: textValue(from("condition", ["condition", "itemCondition"])),
    price: numberValue(
      asRecord(priceRaw)?.value ?? asRecord(priceRaw)?.amount ?? priceRaw,
    ),
    currency:
      currencyValue(from("currency", ["price.currency", "currency"])) ??
      currencyValue(offer?.priceCurrency),
    country:
      textValue(from("country", ["country", "address.addressCountry"])) ??
      textValue(address.addressCountry) ??
      source.country,
    region: textValue(from("region", ["region", "state", "address.addressRegion"])),
    city:
      textValue(from("city", ["city", "address.addressLocality"])) ??
      textValue(address.addressLocality),
    postalCode: textValue(from("postalCode", ["postalCode", "address.postalCode"])),
    sellerName: textValue(from("sellerName", ["seller.name", "sellerName"])),
    sellerType: textValue(from("sellerType", ["sellerType"])),
    shippingAvailable: boolValue(from("shippingAvailable", ["shippingAvailable"])),
    auction: boolValue(from("auction", ["auction", "isAuction"])) ?? false,
    auctionEnd: dateValue(from("auctionEnd", ["auctionEnd", "endDate"])),
    publishedAt: dateValue(from("publishedAt", ["publishedAt", "datePublished", "pubDate"])),
    sourceUpdatedAt: dateValue(
      from("sourceUpdatedAt", ["updatedAt", "dateModified", "lastUpdated"]),
    ),
    imageUrls: imageList(imageRaw),
    status: statusValue(from("status", ["status", "availability"])),
  };
}

function extractRecords(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const object = asRecord(value);
  if (!object) return [];
  for (const key of [
    "items",
    "itemSummaries",
    "results",
    "listings",
    "ads",
    "products",
    "entries",
    "offers",
    "data",
    "searchResults",
    "searchResultItems",
    "item",
    "listing",
    "url",
    "sitemap",
  ]) {
    const candidate = object[key];
    if (Array.isArray(candidate)) return candidate;
    const nested = asRecord(candidate);
    if (nested) {
      const found = extractRecords(nested);
      if (found.length) return found;
    }
  }
  for (const key of ["result", "searchResult", "response", "feed", "channel"]) {
    const nested = object[key];
    if (nested) {
      const found = extractRecords(nested);
      if (found.length) return found;
    }
  }
  if (
    (object.url || object.link || object.itemUrl || object.itemLink || object["@id"]) &&
    (object.title || object.name || object.headline)
  ) {
    return [object];
  }
  return [];
}

function jsonLdObjects(html: string): unknown[] {
  const output: unknown[] = [];
  const scriptPattern =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    try {
      const parsed: unknown = JSON.parse(match[1] ?? "");
      if (Array.isArray(parsed)) output.push(...parsed);
      else {
        const object = asRecord(parsed);
        const graph = object?.["@graph"];
        if (Array.isArray(graph)) output.push(...graph);
        else if (object) output.push(object);
      }
    } catch {
      // Ignore malformed JSON-LD blocks; other blocks may still be valid.
    }
  }
  return output;
}

function sitemapUrls(xml: string): string[] {
  const parsed = XML.parse(xml) as unknown;
  const object = asRecord(parsed);
  const container = asRecord(object?.urlset ?? object?.sitemapindex);
  const nodes = container?.url ?? container?.sitemap;
  const records = Array.isArray(nodes) ? nodes : nodes ? [nodes] : [];
  return records
    .map((record) =>
      textValue(
        asRecord(record)?.loc ??
          asRecord(record)?.["@_loc"],
      ),
    )
    .filter((url): url is string => Boolean(url))
    .slice(0, 50);
}

function normalizeTraderaItem(
  source: ExternalSource,
  value: unknown,
): NormalizedExternalListing | null {
  const item = asRecord(value);
  if (!item) return null;
  const id = textValue(item.id ?? item.itemId);
  const originalUrl = canonicalizeListingUrl(item.itemLink ?? item.url ?? item.itemUrl);
  const title = textValue(item.title ?? item.name);
  if (!id || !originalUrl || !title) return null;

  const seller = asRecord(item.seller);
  const priceValue =
    item.currentPrice ??
    item.price ??
    item.maxBid ??
    item.buyItNowPrice ??
    item.openingBid;
  const price =
    asRecord(priceValue)?.price ??
    asRecord(priceValue)?.value ??
    priceValue;
  const images = [
    ...(Array.isArray(item.imageLinks) ? item.imageLinks : []),
    ...(Array.isArray(item.detailedImageLinks) ? item.detailedImageLinks : []),
  ];
  return {
    externalId: id,
    originalUrl,
    title,
    description: textValue(item.shortDescription ?? item.longDescription),
    category: textValue(item.categoryName ?? item.category),
    brand: textValue(item.brand),
    model: textValue(item.model),
    condition: textValue(item.condition ?? item.conditionName),
    price: numberValue(price),
    currency: currencyValue(item.currency) ?? "SEK",
    country: source.country,
    city: textValue(item.city ?? seller?.city),
    sellerName: textValue(seller?.alias ?? seller?.name),
    auction: boolValue(item.auction) ?? Boolean(item.itemType),
    auctionEnd: dateValue(item.endDate ?? item.auctionEnd),
    publishedAt: dateValue(item.startDate ?? item.publishedAt),
    sourceUpdatedAt: dateValue(item.updatedAt),
    imageUrls: imageList(images),
    status: statusValue(item.status ?? item.statusName),
  };
}

function normalizeEbayItem(value: unknown): NormalizedExternalListing | null {
  const item = asRecord(value);
  if (!item) return null;
  const id = textValue(item.itemId);
  const originalUrl = canonicalizeListingUrl(item.itemWebUrl ?? item.itemAffiliateWebUrl);
  const title = textValue(item.title);
  if (!id || !originalUrl || !title) return null;
  const price = asRecord(item.price);
  const itemLocation = asRecord(item.itemLocation);
  const seller = asRecord(item.seller);
  const image = asRecord(item.image);
  const buyingOptions = Array.isArray(item.buyingOptions) ? item.buyingOptions : [];
  return {
    externalId: id,
    originalUrl,
    title,
    description: textValue(item.shortDescription),
    category: textValue(item.categoryPath ?? item.categoryName),
    condition: textValue(item.condition ?? item.conditionId),
    price: numberValue(price?.value),
    currency: currencyValue(price?.currency),
    country: textValue(itemLocation?.country) ?? null,
    city: textValue(itemLocation?.city),
    postalCode: textValue(itemLocation?.postalCode),
    sellerName: textValue(seller?.username),
    sellerType: seller?.feedbackPercentage ? "business-or-individual" : null,
    shippingAvailable: Array.isArray(item.shippingOptions)
      ? item.shippingOptions.length > 0
      : null,
    auction: buyingOptions.some((option) => String(option).toLowerCase() === "auction"),
    auctionEnd: dateValue(item.itemEndDate),
    publishedAt: dateValue(item.itemStartDate),
    sourceUpdatedAt: dateValue(item.itemCreationDate),
    imageUrls: imageList([image?.imageUrl, ...(Array.isArray(item.additionalImages) ? item.additionalImages : [])]),
    status: statusValue(item.itemStatus),
  };
}

function isPrivateOrReservedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b !== undefined && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b !== undefined && b >= 64 && b <= 127) ||
      (a !== undefined && a >= 224)
    );
  }
  if (family === 6) {
    const normalized = address.toLowerCase().split("%")[0] ?? "";
    if (normalized.startsWith("::ffff:")) {
      const mappedIpv4 = normalized.slice("::ffff:".length);
      if (isIP(mappedIpv4) === 4) return isPrivateOrReservedAddress(mappedIpv4);
    }
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith("ff") ||
      normalized.startsWith("2001:db8:")
    );
  }
  return true;
}

async function assertPublicHttpsUrl(value: string): Promise<URL> {
  const safe = safeHttpsUrl(value);
  if (!safe) throw new Error("Feed URL must be a public HTTPS URL");
  const url = new URL(safe);
  const addresses = await dnsLookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateOrReservedAddress(address))) {
    throw new Error("Feed URL must resolve only to public IP addresses");
  }
  return url;
}

export function isSafeExternalUrl(value: string): boolean {
  return Boolean(safeHttpsUrl(value));
}

async function fetchText(url: string, expectedHost?: string): Promise<{
  status: number;
  text: string;
  contentType: string;
}> {
  const parsed = await assertPublicHttpsUrl(url);
  if (expectedHost && parsed.hostname.toLowerCase() !== expectedHost.toLowerCase()) {
    throw new Error("Index URL host must match the approved source host");
  }
  const response = await fetch(parsed, {
    headers: { Accept: "application/json, application/xml, text/xml, text/html, */*;q=0.5" },
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_FEED_BYTES) {
    throw new Error("Feed exceeded the maximum allowed size");
  }
  const reader = response.body?.getReader();
  if (!reader) return { status: response.status, text: "", contentType: response.headers.get("content-type") ?? "" };
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_FEED_BYTES) {
      await reader.cancel();
      throw new Error("Feed exceeded the maximum allowed size");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return {
    status: response.status,
    text: new TextDecoder().decode(bytes),
    contentType: response.headers.get("content-type") ?? "",
  };
}

export function robotsAllowsPath(robotsText: string, path: string): boolean {
  const lines = robotsText.split(/\r?\n/);
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; path: string }> }> = [];
  let group: (typeof groups)[number] | null = null;
  let sawRule = false;
  for (const rawLine of lines) {
    const line = rawLine.split("#", 1)[0]?.trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === "user-agent") {
      if (!group || sawRule) {
        group = { agents: [], rules: [] };
        groups.push(group);
        sawRule = false;
      }
      group.agents.push(value.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && group) {
      if (value) group.rules.push({ allow: key === "allow", path: value });
      sawRule = true;
    }
  }
  const matchesPath = (rulePath: string): boolean => {
    const anchoredAtEnd = rulePath.endsWith("$");
    const pattern = anchoredAtEnd ? rulePath.slice(0, -1) : rulePath;
    const expression = pattern
      .split("*")
      .map((segment) => segment.replace(/[|\\{}()[\]^$+?.]/g, "\\$&"))
      .join(".*");
    return new RegExp(`^${expression}${anchoredAtEnd ? "$" : ""}`).test(path);
  };
  const specificity = (rulePath: string) => rulePath.replace(/[*$]/g, "").length;
  const rules = groups
    .filter((candidate) => candidate.agents.includes("*"))
    .flatMap((candidate) => candidate.rules)
    .filter((rule) => matchesPath(rule.path))
    .sort((left, right) => specificity(right.path) - specificity(left.path));
  if (!rules.length) return true;
  const longest = rules.filter(
    (rule) => specificity(rule.path) === specificity(rules[0]!.path),
  );
  return longest.some((rule) => rule.allow);
}

async function getRobotsText(origin: string, expectedHost: string): Promise<string> {
  const robotsUrl = new URL("/robots.txt", origin).toString();
  const result = await fetchText(robotsUrl, expectedHost);
  if (result.status === 404 || result.status === 410) return "";
  if (!result.status || result.status < 200 || result.status >= 300) {
    throw new Error(`robots.txt returned HTTP ${result.status}`);
  }
  return result.text;
}

export async function checkExternalSourceRobots(
  source: ExternalSource,
): Promise<{ robotsUrl: string; allowed: boolean }> {
  const sourceUrlText = source.feedUrl ?? source.baseUrl;
  if (!sourceUrlText) {
    throw new Error("Source needs a public feed URL before robots can be checked");
  }
  const sourceUrl = await assertPublicHttpsUrl(sourceUrlText);
  const robotsUrl = source.robotsUrl
    ? await assertPublicHttpsUrl(source.robotsUrl)
    : new URL("/robots.txt", sourceUrl.origin);
  if (robotsUrl.hostname.toLowerCase() !== sourceUrl.hostname.toLowerCase()) {
    throw new Error("robots.txt must use the approved source host");
  }
  const result = await fetchText(robotsUrl.toString(), sourceUrl.hostname);
  if (result.status === 404 || result.status === 410) {
    return { robotsUrl: robotsUrl.toString(), allowed: true };
  }
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`robots.txt returned HTTP ${result.status}`);
  }
  return {
    robotsUrl: robotsUrl.toString(),
    allowed: robotsAllowsPath(result.text, sourceUrl.pathname + sourceUrl.search),
  };
}

function parseFeedRecords(source: ExternalSource, text: string): unknown[] {
  const format = source.feedFormat as ExternalFeedFormat | null;
  if (format === "JSON") return extractRecords(JSON.parse(text));
  if (format === "SCHEMA_ORG") return jsonLdObjects(text);
  if (format === "RSS" || format === "XML" || format === "SITEMAP") {
    const parsed = XML.parse(text) as unknown;
    if (format === "SITEMAP") return sitemapUrls(text);
    const object = asRecord(parsed);
    return extractRecords(object?.rss ?? object?.feed ?? object?.channel ?? parsed);
  }
  throw new SourceIntegrationNotConfiguredError(source.id);
}

function schemaOrgRecordToGeneric(record: unknown): DataRecord {
  const object = asRecord(record) ?? {};
  const offer = Array.isArray(object.offers)
    ? asRecord(object.offers[0])
    : asRecord(object.offers);
  const brand = asRecord(object.brand);
  const image = Array.isArray(object.image) ? object.image : object.image;
  return {
    ...object,
    id: object.sku ?? object.productID ?? object["@id"] ?? object.url,
    url: object.url ?? object["@id"],
    title: object.name,
    description: object.description,
    brand: brand?.name ?? object.brand,
    price: offer?.price,
    currency: offer?.priceCurrency,
    status: offer?.availability,
    image,
    category: object.category,
  };
}

class TraderaAdapter implements ExternalSourceAdapter {
  isConfigured(): boolean {
    return Boolean(process.env.TRADERA_APP_ID && process.env.TRADERA_APP_KEY);
  }

  async fetchListings(
    source: ExternalSource,
    options: { query?: string; limit: number },
  ): Promise<NormalizedExternalListing[]> {
    const appId = process.env.TRADERA_APP_ID;
    const appKey = process.env.TRADERA_APP_KEY;
    if (!appId || !appKey) throw new SourceIntegrationNotConfiguredError(source.id);
    if (!options.query?.trim()) throw new Error("A search term is required for Tradera sync");
    const url = new URL("https://api.tradera.com/v4/search");
    url.searchParams.set("query", options.query.trim());
    url.searchParams.set("pageNumber", "0");
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-App-Id": appId,
        "X-App-Key": appKey,
      },
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Tradera API returned HTTP ${response.status}`);
    const payload: unknown = await response.json();
    return extractRecords(payload)
      .map((item) => normalizeTraderaItem(source, item))
      .filter((item): item is NormalizedExternalListing => item !== null)
      .slice(0, options.limit);
  }
}

let ebayTokenCache:
  | { token: string; expiresAt: number; environment: "production" | "sandbox" }
  | undefined;

function ebayApiRoot(): {
  root: string;
  environment: "production" | "sandbox";
} {
  const environment = process.env.EBAY_API_ENVIRONMENT === "sandbox"
    ? "sandbox"
    : "production";
  return {
    root:
      environment === "sandbox"
        ? "https://api.sandbox.ebay.com"
        : "https://api.ebay.com",
    environment,
  };
}

async function getEbayAccessToken(): Promise<string> {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new SourceIntegrationNotConfiguredError("ebay");
  }
  const { root, environment } = ebayApiRoot();
  if (
    ebayTokenCache &&
    ebayTokenCache.environment === environment &&
    ebayTokenCache.expiresAt > Date.now() + 60_000
  ) {
    return ebayTokenCache.token;
  }
  const authorization = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${root}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`eBay OAuth returned HTTP ${response.status}`);
  const payload = (await response.json()) as {
    access_token?: unknown;
    expires_in?: unknown;
  };
  if (typeof payload.access_token !== "string" || !payload.access_token) {
    throw new Error("eBay OAuth response did not include an access token");
  }
  const expiresIn =
    typeof payload.expires_in === "number" && payload.expires_in > 0
      ? payload.expires_in
      : 3600;
  ebayTokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
    environment,
  };
  return payload.access_token;
}

class EbayAdapter implements ExternalSourceAdapter {
  isConfigured(): boolean {
    return Boolean(
      process.env.EBAY_CLIENT_ID &&
        process.env.EBAY_CLIENT_SECRET &&
        process.env.EBAY_MARKETPLACE_ID,
    );
  }

  async fetchListings(
    source: ExternalSource,
    options: { query?: string; limit: number },
  ): Promise<NormalizedExternalListing[]> {
    const marketplaceId = process.env.EBAY_MARKETPLACE_ID;
    if (!marketplaceId) throw new SourceIntegrationNotConfiguredError(source.id);
    if (!options.query?.trim()) throw new Error("A search term is required for eBay sync");
    const { root } = ebayApiRoot();
    const token = await getEbayAccessToken();
    const url = new URL(`${root}/buy/browse/v1/item_summary/search`);
    url.searchParams.set("q", options.query.trim());
    url.searchParams.set("limit", String(Math.min(options.limit, 50)));
    url.searchParams.set("fieldgroups", "EXTENDED");
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
      },
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`eBay Browse API returned HTTP ${response.status}`);
    const payload: unknown = await response.json();
    return extractRecords(payload)
      .map(normalizeEbayItem)
      .filter((item): item is NormalizedExternalListing => item !== null)
      .slice(0, options.limit);
  }
}

class GenericFeedAdapter implements ExternalSourceAdapter {
  isConfigured(source: ExternalSource): boolean {
    return Boolean(
      source.feedUrl &&
        source.feedFormat &&
        ["JSON", "XML", "RSS", "SCHEMA_ORG", "SITEMAP"].includes(source.feedFormat),
    );
  }

  async fetchListings(
    source: ExternalSource,
    options: { query?: string; limit: number },
  ): Promise<NormalizedExternalListing[]> {
    if (!source.feedUrl || !this.isConfigured(source)) {
      throw new SourceIntegrationNotConfiguredError(source.id);
    }
  const feedUrl = await assertPublicHttpsUrl(source.feedUrl);
    const feedHost = feedUrl.hostname;
    const payload = await fetchText(feedUrl.toString(), feedHost);
    if (payload.status < 200 || payload.status >= 300) {
      throw new Error(`Approved feed returned HTTP ${payload.status}`);
    }
    const format = source.feedFormat as ExternalFeedFormat;
    if (format !== "SITEMAP") {
      const records = parseFeedRecords(source, payload.text)
        .map((record) =>
          format === "SCHEMA_ORG"
            ? schemaOrgRecordToGeneric(record)
            : record,
        )
        .map((record) => normalizeGenericRecord(source, record))
        .filter((record): record is NormalizedExternalListing => record !== null);
      return records.slice(0, options.limit);
    }

    const robotsText = await getRobotsText(feedUrl.origin, feedHost);
    const targetUrls = parseFeedRecords(source, payload.text)
      .map(textValue)
      .filter((url): url is string => Boolean(url))
      .map((url) => safeHttpsUrl(url))
      .filter((url): url is string => Boolean(url))
      .filter((url) => new URL(url).hostname.toLowerCase() === feedHost.toLowerCase())
      .filter((url) => {
        const parsed = new URL(url);
        return robotsAllowsPath(robotsText, parsed.pathname + parsed.search);
      })
      .slice(0, Math.min(options.limit, 20));
    const listings: NormalizedExternalListing[] = [];
    for (const targetUrl of targetUrls) {
      const page = await fetchText(targetUrl, feedHost);
      if (page.status < 200 || page.status >= 300) continue;
      const schemaObjects = jsonLdObjects(page.text);
      for (const schemaObject of schemaObjects) {
        const listing = normalizeGenericRecord(
          source,
          schemaOrgRecordToGeneric(schemaObject),
        );
        if (listing) {
          listings.push(listing);
          break;
        }
      }
      if (listings.length >= options.limit) break;
    }
    return listings;
  }
}

const traderaAdapter = new TraderaAdapter();
const ebayAdapter = new EbayAdapter();
const genericFeedAdapter = new GenericFeedAdapter();

export function getExternalAdapterReadiness(
  source: ExternalSource,
): ExternalAdapterReadiness {
  const adapter = getExternalSourceAdapter(source);
  return {
    adapterAvailable: Boolean(adapter),
    integrationConfigured: adapter?.isConfigured(source) ?? false,
  };
}

export function getExternalSourceAdapter(
  source: ExternalSource,
): ExternalSourceAdapter | null {
  if (source.partnershipRequired && !source.partnershipApproved) return null;
  if (source.sourceType === "API" && source.id === "tradera") return traderaAdapter;
  if (source.sourceType === "API" && source.id === "ebay") return ebayAdapter;
  if (source.sourceType === "FEED" || source.sourceType === "INDEX") {
    return genericFeedAdapter;
  }
  return null;
}

export function normalizeGenericFeedItem(
  source: ExternalSource,
  value: unknown,
): NormalizedExternalListing | null {
  return normalizeGenericRecord(source, value);
}

export function normalizeTraderaSearchItem(
  source: ExternalSource,
  value: unknown,
): NormalizedExternalListing | null {
  return normalizeTraderaItem(source, value);
}

export function normalizeEbaySearchItem(
  value: unknown,
): NormalizedExternalListing | null {
  return normalizeEbayItem(value);
}

export function parseExternalFeedRecords(
  source: ExternalSource,
  text: string,
): unknown[] {
  return parseFeedRecords(source, text);
}

export function parseExternalFeed(
  source: ExternalSource,
  text: string,
): unknown[] {
  return parseFeedRecords(source, text);
}