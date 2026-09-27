import assert from "node:assert/strict";

const baseUrl = new URL(
  process.env.SELLIFY_SEO_CHECK_URL || "http://localhost:80",
);
const maxUrlChecks = Number(process.env.SELLIFY_SEO_URL_CHECK_LIMIT ?? 1000);
assert(
  Number.isSafeInteger(maxUrlChecks) && maxUrlChecks >= 0,
  "SELLIFY_SEO_URL_CHECK_LIMIT must be a non-negative integer",
);

function decodeXml(value) {
  const entities = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
  };
  return value.replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => entities[name]);
}

function extractLocations(xml) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].map((match) =>
    decodeXml(match[1]),
  );
}

function toLocalPath(location) {
  const url = new URL(location, baseUrl);
  assert.equal(
    url.origin,
    baseUrl.origin,
    `Expected sitemap URL on ${baseUrl.origin}, received ${url.origin}`,
  );
  return `${url.pathname}${url.search}`;
}

async function request(path) {
  const response = await fetch(new URL(path, baseUrl), {
    headers: { "user-agent": "Sellify SEO smoke check" },
  });
  return {
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    body: await response.text(),
  };
}

const indexResponse = await request("/sitemap.xml");
assert.equal(indexResponse.status, 200, "sitemap.xml must return HTTP 200");
assert.match(indexResponse.contentType, /xml/i, "sitemap index must be XML");
assert.match(indexResponse.body, /<sitemapindex\b/, "sitemap.xml must be an index");

const sitemapLocations = extractLocations(indexResponse.body);
assert.ok(sitemapLocations.length > 0, "sitemap index must contain shard URLs");

const sitemapUrls = [];
for (const location of sitemapLocations) {
  const shardPath = toLocalPath(location);
  const shardResponse = await request(shardPath);
  assert.equal(shardResponse.status, 200, `${shardPath} must return HTTP 200`);
  assert.match(shardResponse.contentType, /xml/i, `${shardPath} must be XML`);
  assert.match(shardResponse.body, /<urlset\b/, `${shardPath} must be a URL set`);

  for (const url of extractLocations(shardResponse.body)) {
    sitemapUrls.push({ path: toLocalPath(url), location: url });
  }
}

assert.ok(sitemapUrls.length > 0, "sitemap shards must contain page URLs");

function pickUrls(urls, limit) {
  if (limit === 0 || urls.length <= limit) return urls;
  if (limit === 1) return [urls[0]];

  const indexes = new Set();
  for (let index = 0; index < limit; index += 1) {
    indexes.add(Math.round((index * (urls.length - 1)) / (limit - 1)));
  }
  return [...indexes].map((index) => urls[index]);
}

const selectedUrls = pickUrls(sitemapUrls, maxUrlChecks);
for (const { path } of selectedUrls) {
  const pageResponse = await request(path);
  assert.equal(pageResponse.status, 200, `Sitemap URL ${path} must return HTTP 200`);
}

const robotsResponse = await request("/robots.txt");
assert.equal(robotsResponse.status, 200, "robots.txt must return HTTP 200");
assert.match(robotsResponse.body, /Sitemap:\s+\S+\/sitemap\.xml/i);

const missingListing = await request(
  "/listing/__seo_smoke_missing_listing_7d018a__",
);
assert.equal(missingListing.status, 404);
assert.match(
  missingListing.body,
  /såld eller inte längre tillgänglig/i,
  "missing listing must explain that it sold or is unavailable",
);
assert.match(
  missingListing.body,
  /<meta name="robots" content="noindex, nofollow">/i,
  "missing listing must not be indexed",
);

const missingCategory = await request(
  "/category/__seo_smoke_missing_category_7d018a__",
);
assert.equal(missingCategory.status, 404);
assert.match(missingCategory.body, /kategorin hittades inte/i);

const listingCount = sitemapUrls.filter(({ path }) =>
  path.startsWith("/listing/"),
).length;
const categoryCount = sitemapUrls.filter(({ path }) =>
  path.startsWith("/category/"),
).length;
const checkedDescription =
  selectedUrls.length === sitemapUrls.length
    ? `all ${selectedUrls.length}`
    : `${selectedUrls.length} of ${sitemapUrls.length} sampled across all shards`;

console.log(
  `SEO smoke check passed: ${sitemapLocations.length} sitemap shards; ${checkedDescription} URLs checked (${listingCount} listings, ${categoryCount} categories); robots and unavailable-page fallbacks passed.`,
);