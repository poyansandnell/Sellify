import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { categories, listings, profiles } from "@workspace/db/schema";
import { getUserId } from "../lib/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const PRODUCTION_ORIGIN = "https://attached-assets-poyansandnell.replit.app";
const CATEGORY_INDEX_THRESHOLD = 5;
const SITEMAP_LISTING_LIMIT = 50_000;

type ListingSeoRow = {
  listing: typeof listings.$inferSelect;
  categoryNameSv: string | null;
  categorySlug: string | null;
  sellerSuspendedAt: Date | null;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character];
  });
}

function siteOrigin(req: Request): string {
  const configuredOrigin = process.env.SELLIFY_SITE_ORIGIN;
  if (configuredOrigin) {
    try {
      const parsed = new URL(configuredOrigin);
      if (parsed.protocol === "https:") return parsed.origin;
    } catch {
      // Ignore invalid optional configuration and use the request host.
    }
  }

  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.get("host");
  if (host && /^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
    const forwardedProtocol = req
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim()
      .toLowerCase();
    const isLocalHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
    const protocol =
      forwardedProtocol === "http" || forwardedProtocol === "https"
        ? forwardedProtocol
        : isLocalHost
          ? "http"
          : "https";
    return `${protocol}://${host}`;
  }

  return PRODUCTION_ORIGIN;
}

function formatPrice(price: string, currency: string): string {
  try {
    return new Intl.NumberFormat("sv-SE", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(price));
  } catch {
    return `${price} ${currency}`;
  }
}

function clip(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  const shortened = normalized.slice(0, limit - 1).replace(/\s+\S*$/, "");
  return `${shortened || normalized.slice(0, limit - 1)}…`;
}

function conditionLabel(condition: string): string {
  const labels: Record<string, string> = {
    new: "ny",
    like_new: "nästan nyskick",
    good: "begagnad",
    fair: "använt skick",
    worn: "slitet skick",
  };
  return labels[condition] ?? "begagnad";
}

function absoluteImageUrl(value: string, origin: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/objects/")) {
    return new URL(`/api/storage${value}`, origin).toString();
  }
  return new URL(value.replace(/^\/+/, ""), `${origin}/`).toString();
}

function safeStoreUrl(
  value: string | undefined,
  expectedHost: "apps.apple.com" | "play.google.com",
): string | null {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== expectedHost ||
      (expectedHost === "play.google.com" &&
        !parsed.pathname.startsWith("/store/apps/details")) ||
      (expectedHost === "apps.apple.com" &&
        !parsed.pathname.startsWith("/"))
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function storeLinksMarkup(): string {
  const appStoreUrl = safeStoreUrl(
    process.env.SELLIFY_IOS_APP_URL,
    "apps.apple.com",
  );
  const googlePlayUrl = safeStoreUrl(
    process.env.SELLIFY_ANDROID_APP_URL,
    "play.google.com",
  );
  const links = [
    appStoreUrl
      ? `<a class="store-button" href="${escapeHtml(appStoreUrl)}" rel="noopener noreferrer">App Store</a>`
      : "",
    googlePlayUrl
      ? `<a class="store-button" href="${escapeHtml(googlePlayUrl)}" rel="noopener noreferrer">Google Play</a>`
      : "",
  ].filter(Boolean);

  if (links.length) return links.join("");

  return `<p class="store-pending">Officiella länkar till appbutikerna visas här när Sellify har publicerats där.</p>`;
}

function pageStyles(): string {
  return `
    :root{color-scheme:light;--ink:#17172f;--muted:#68687d;--brand:#5548e8;--line:#e8e8f0;--surface:#f7f7fb}
    *{box-sizing:border-box}
    body{margin:0;background:#fff;color:var(--ink);font:16px/1.6 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
    a{color:inherit}
    .site-header{border-bottom:1px solid var(--line);background:#fff}
    .header-inner,.container{width:min(1120px,calc(100% - 40px));margin-inline:auto}
    .header-inner{min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:24px}
    .brand{font-weight:800;font-size:22px;letter-spacing:-.05em;text-decoration:none;color:var(--brand)}
    .nav{display:flex;align-items:center;gap:22px;font-size:14px}
    .nav a{text-decoration:none;color:var(--muted)}
    .nav a:hover,.text-link:hover{color:var(--brand)}
    main{padding:26px 0 64px}
    .breadcrumbs{display:flex;gap:9px;align-items:center;color:var(--muted);font-size:13px;margin-bottom:22px}
    .breadcrumbs a{text-decoration:none}
    .product-layout{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(300px,.9fr);gap:48px;align-items:start}
    .product-image{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:24px;background:var(--surface)}
    .image-placeholder{aspect-ratio:1/1;border-radius:24px;background:var(--surface);display:grid;place-items:center;color:var(--muted)}
    h1{font-size:clamp(30px,4vw,44px);letter-spacing:-.04em;line-height:1.12;margin:0 0 12px}
    h2{font-size:22px;letter-spacing:-.02em;margin:34px 0 10px}
    .price{font-size:28px;font-weight:800;margin:12px 0}
    .details{color:var(--muted);margin:0 0 22px}
    .badge{display:inline-flex;border-radius:999px;padding:5px 11px;background:#f0efff;color:#4c43c6;font-size:13px;font-weight:700}
    .sold{background:#fff0f0;color:#a43e3e}
    .button,.store-button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 18px;border-radius:14px;background:var(--brand);color:#fff;text-decoration:none;font-weight:700}
    .button:hover,.store-button:hover{filter:brightness(.94)}
    .text-link{font-weight:700;color:var(--brand);text-decoration:none}
    .description{white-space:pre-wrap;overflow-wrap:anywhere}
    .specifications{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0;padding:0;list-style:none}
    .specifications li{padding:12px 14px;background:var(--surface);border-radius:12px}
    .specifications strong{display:block;font-size:12px;color:var(--muted);font-weight:500}
    .app-cta{margin-top:38px;padding:26px;border-radius:22px;background:#f1f0ff;border:1px solid #e3e1ff}
    .app-cta h2{margin:0 0 8px}
    .app-cta p{margin:0 0 16px;color:var(--muted)}
    .store-links{display:flex;gap:10px;flex-wrap:wrap}
    .store-button{background:#17172f}
    .store-pending{font-size:14px}
    .category-intro{max-width:720px;margin:0 0 26px;color:var(--muted)}
    .listing-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}
    .listing-card{text-decoration:none;min-width:0}
    .listing-card img,.listing-card .image-placeholder{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:16px;background:var(--surface)}
    .listing-card h2{font-size:16px;line-height:1.3;margin:10px 0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .listing-card p{margin:0;color:var(--muted);font-size:14px}
    .listing-card .card-price{font-weight:800;color:var(--ink);font-size:16px}
    .empty-state{padding:24px;background:var(--surface);border-radius:18px;color:var(--muted)}
    footer{border-top:1px solid var(--line);padding:24px 0;color:var(--muted);font-size:13px}
    .footer-inner{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
    @media(max-width:800px){.product-layout{grid-template-columns:1fr;gap:24px}.listing-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.header-inner,.container{width:min(100% - 28px,1120px)}.nav{gap:14px}.nav a:nth-child(2){display:none}}
  `;
}

function htmlDocument(options: {
  title: string;
  description: string;
  canonical: string;
  body: string;
  image?: string;
  robots?: string;
  jsonLd?: unknown;
}): string {
  const imageMetadata = options.image
    ? `<meta property="og:image" content="${escapeHtml(options.image)}"><meta name="twitter:image" content="${escapeHtml(options.image)}">`
    : "";
  const jsonLd = options.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(options.jsonLd).replace(/</g, "\\u003c")}</script>`
    : "";

  return `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(options.title)}</title>
    <meta name="description" content="${escapeHtml(options.description)}">
    <meta name="robots" content="${escapeHtml(options.robots ?? "index, follow")}">
    <link rel="canonical" href="${escapeHtml(options.canonical)}">
    <meta property="og:title" content="${escapeHtml(options.title)}">
    <meta property="og:description" content="${escapeHtml(options.description)}">
    <meta property="og:url" content="${escapeHtml(options.canonical)}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="${options.image ? "summary_large_image" : "summary"}">
    <meta name="twitter:title" content="${escapeHtml(options.title)}">
    <meta name="twitter:description" content="${escapeHtml(options.description)}">
    ${imageMetadata}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>${pageStyles()}</style>
    ${jsonLd}
  </head>
  <body>
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="/" aria-label="Sellify startsida">Sellify</a>
        <nav class="nav" aria-label="Huvudmeny">
          <a href="/">Annonser</a>
          <a href="/search">Sök</a>
          <a href="/sign-in">Logga in</a>
        </nav>
      </div>
    </header>
    ${options.body}
    <footer><div class="container footer-inner"><span>Sellify – köp och sälj begagnat.</span><span><a href="/support">Support</a> · <a href="/privacy">Integritet</a> · <a href="/terms">Villkor</a></span></div></footer>
  </body>
</html>`;
}

function notFoundPage(req: Request): string {
  const origin = siteOrigin(req);
  return htmlDocument({
    title: "Annonsen hittades inte | Sellify",
    description: "Annonsen finns inte längre tillgänglig på Sellify.",
    canonical: `${origin}${req.path}`,
    robots: "noindex, nofollow",
    body: `<main class="container"><h1>Annonsen hittades inte</h1><p class="details">Den här annonsen är inte längre tillgänglig.</p><a class="button" href="/">Se andra annonser</a></main>`,
  });
}

function renderListingPage(
  row: ListingSeoRow,
  origin: string,
  viewerId: string | null,
): string {
  const listing = row.listing;
  const canonical = `${origin}/listing/${encodeURIComponent(listing.slug)}`;
  const image = listing.images?.[0]
    ? absoluteImageUrl(listing.images[0], origin)
    : undefined;
  const price = formatPrice(String(listing.price), listing.currency);
  const indexable = listing.status === "active";
  const isOwnerDraft = listing.status === "draft" && viewerId === listing.sellerId;
  const pageTitle = clip(
    `${listing.seoTitle?.trim() || listing.title} · ${listing.city || "Sverige"} | Sellify #${listing.id}`,
    68,
  );
  const descriptionSource =
    listing.seoDescription?.trim() ||
    listing.shortDescription?.trim() ||
    listing.description;
  const description = clip(
    `${descriptionSource} Pris ${price}${listing.city ? `, i ${listing.city}` : ""}.`,
    160,
  );
  const condition = conditionLabel(listing.condition);
  const categoryLabel = row.categoryNameSv;
  const categoryHref = row.categorySlug
    ? `/category/${encodeURIComponent(row.categorySlug)}`
    : null;
  const detailParts = [
    condition,
    listing.city,
    categoryLabel,
  ].filter(Boolean);
  const statusBadge =
    listing.status === "sold"
      ? `<span class="badge sold">Såld</span>`
      : isOwnerDraft
        ? `<span class="badge sold">Utkast – visas bara för dig</span>`
        : `<span class="badge">${escapeHtml(condition)}</span>`;
  const imageMarkup = image
    ? `<img class="product-image" src="${escapeHtml(image)}" alt="${escapeHtml(listing.title)}" width="1200" height="1200">`
    : `<div class="image-placeholder" role="img" aria-label="Ingen bild tillgänglig">Ingen bild</div>`;
  const specifications = listing.specifications ?? [];
  const specificationsMarkup = specifications.length
    ? `<section aria-labelledby="specifications-title"><h2 id="specifications-title">Detaljer</h2><ul class="specifications">${specifications
        .map(
          (specification) =>
            `<li><strong>${escapeHtml(specification.label)}</strong>${escapeHtml(specification.value)}</li>`,
        )
        .join("")}</ul></section>`
    : "";
  const contactCta =
    listing.status === "active"
      ? `<a class="button" href="/sign-in">Logga in för att kontakta säljaren</a>`
      : `<a class="button" href="/">Se aktuella annonser</a>`;
  const body = `<main class="container">
    <nav class="breadcrumbs" aria-label="Brödsmulor">
      <a href="/">Annonser</a>${categoryLabel && categoryHref ? ` <span aria-hidden="true">›</span> <a href="${escapeHtml(categoryHref)}">${escapeHtml(categoryLabel)}</a>` : ""}
      <span aria-hidden="true">›</span><span>${escapeHtml(listing.title)}</span>
    </nav>
    <article class="product-layout">
      <div>${imageMarkup}</div>
      <div>
        ${statusBadge}
        <h1>${escapeHtml(listing.title)}</h1>
        <p class="price">${escapeHtml(price)}</p>
        <p class="details">${escapeHtml(detailParts.join(" · "))}</p>
        ${contactCta}
        <h2>Om annonsen</h2>
        <div class="description">${escapeHtml(listing.description)}</div>
      </div>
    </article>
    ${specificationsMarkup}
    <section class="app-cta" aria-labelledby="app-cta-title">
      <h2 id="app-cta-title">Använd Sellify på mobilen</h2>
      <p>Få tillgång till annonser och meddelanden när du är på språng.</p>
      <div class="store-links">${storeLinksMarkup()}</div>
    </section>
  </main>`;
  const jsonLd =
    indexable || listing.status === "sold"
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: listing.title,
          description: clip(descriptionSource, 500),
          image: image ? [image] : undefined,
          category: categoryLabel ?? undefined,
          itemCondition:
            listing.condition === "new"
              ? "https://schema.org/NewCondition"
              : "https://schema.org/UsedCondition",
          offers: {
            "@type": "Offer",
            url: canonical,
            price: String(listing.price),
            priceCurrency: listing.currency,
            availability:
              listing.status === "active"
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            itemCondition:
              listing.condition === "new"
                ? "https://schema.org/NewCondition"
                : "https://schema.org/UsedCondition",
          },
        }
      : undefined;

  return htmlDocument({
    title: pageTitle,
    description,
    canonical,
    body,
    image,
    robots: indexable ? "index, follow" : "noindex, follow",
    jsonLd,
  });
}

router.get("/listing/:slug", async (req: Request, res: Response) => {
  try {
    const [joinedRow] = await db
      .select({
        listing: listings,
        categoryNameSv: categories.nameSv,
        categorySlug: categories.slug,
        sellerSuspendedAt: profiles.suspendedAt,
      })
      .from(listings)
      .leftJoin(categories, eq(categories.id, listings.categoryId))
      .leftJoin(profiles, eq(profiles.id, listings.sellerId))
      .where(eq(listings.slug, String(req.params.slug)))
      .limit(1);

    const viewerId = getUserId(req);
    if (
      !joinedRow ||
      joinedRow.listing.removedAt ||
      joinedRow.sellerSuspendedAt ||
      !["active", "sold"].includes(joinedRow.listing.status) &&
        !(joinedRow.listing.status === "draft" &&
          viewerId === joinedRow.listing.sellerId)
    ) {
      res.status(404).type("html").send(notFoundPage(req));
      return;
    }

    const row: ListingSeoRow = {
      listing: joinedRow.listing,
      categoryNameSv: joinedRow.categoryNameSv,
      categorySlug: joinedRow.categorySlug,
      sellerSuspendedAt: joinedRow.sellerSuspendedAt,
    };
    const indexable = row.listing.status === "active";
    res
      .status(200)
      .type("html")
      .set("Cache-Control", indexable ? "public, max-age=60, s-maxage=300" : "private, no-store")
      .send(renderListingPage(row, siteOrigin(req), viewerId));
  } catch (error) {
    logger.error({ err: error }, "Could not render listing SEO page");
    res.status(500).type("html").send("Det gick inte att visa annonsen just nu.");
  }
});

router.get("/category/:slug", async (req: Request, res: Response) => {
  try {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, String(req.params.slug)))
      .limit(1);

    if (!category) {
      res.status(404).type("html").send(notFoundPage(req));
      return;
    }

    const rows = await db
      .select({ listing: listings })
      .from(listings)
      .leftJoin(profiles, eq(profiles.id, listings.sellerId))
      .where(
        and(
          eq(listings.categoryId, category.id),
          eq(listings.status, "active"),
          isNull(listings.removedAt),
          isNull(profiles.suspendedAt),
        ),
      )
      .orderBy(desc(listings.publishedAt))
      .limit(60);

    const origin = siteOrigin(req);
    const canonical = `${origin}/category/${encodeURIComponent(category.slug)}`;
    const description = clip(
      `Köp och sälj begagnat inom ${category.nameSv.toLowerCase()} på Sellify. Se ${rows.length} aktuella annonser från säljare i Sverige.`,
      160,
    );
    const cards = rows
      .map(({ listing }) => {
        const image = listing.images?.[0]
          ? absoluteImageUrl(listing.images[0], origin)
          : null;
        const href = `/listing/${encodeURIComponent(listing.slug)}`;
        return `<a class="listing-card" href="${href}">
          ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(listing.title)}" width="600" height="600" loading="lazy">` : `<div class="image-placeholder" role="img" aria-label="Ingen bild tillgänglig">Ingen bild</div>`}
          <h2>${escapeHtml(listing.title)}</h2>
          <p class="card-price">${escapeHtml(formatPrice(String(listing.price), listing.currency))}</p>
          <p>${escapeHtml(listing.city || "Sverige")}</p>
        </a>`;
      })
      .join("");
    const indexable = rows.length >= CATEGORY_INDEX_THRESHOLD;
    const body = `<main class="container">
      <nav class="breadcrumbs" aria-label="Brödsmulor"><a href="/">Annonser</a><span aria-hidden="true">›</span><span>${escapeHtml(category.nameSv)}</span></nav>
      <h1>Begagnat inom ${escapeHtml(category.nameSv.toLowerCase())}</h1>
      <p class="category-intro">Upptäck aktuella annonser inom ${escapeHtml(category.nameSv.toLowerCase())}. Kontakta säljaren direkt via Sellify och hitta begagnade favoriter.</p>
      ${cards ? `<section class="listing-grid" aria-label="Aktuella annonser">${cards}</section>` : `<p class="empty-state">Det finns inga aktiva annonser i den här kategorin ännu.</p>`}
      <section class="app-cta" aria-labelledby="app-cta-title"><h2 id="app-cta-title">Använd Sellify på mobilen</h2><p>Få tillgång till annonser och meddelanden när du är på språng.</p><div class="store-links">${storeLinksMarkup()}</div></section>
    </main>`;

    res
      .status(200)
      .type("html")
      .set("Cache-Control", "public, max-age=60, s-maxage=300")
      .send(
        htmlDocument({
          title: clip(
            `Begagnat ${category.nameSv.toLowerCase()} till salu | Sellify`,
            65,
          ),
          description,
          canonical,
          body,
          robots: indexable ? "index, follow" : "noindex, follow",
          jsonLd: {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `Begagnat ${category.nameSv.toLowerCase()} på Sellify`,
            description,
            url: canonical,
          },
        }),
      );
  } catch (error) {
    logger.error({ err: error }, "Could not render category SEO page");
    res.status(500).type("html").send("Det gick inte att visa kategorin just nu.");
  }
});

router.get("/sitemap.xml", async (req: Request, res: Response) => {
  try {
    const origin = siteOrigin(req);
    const [activeListings, activeCategories] = await Promise.all([
      db
        .select({
          slug: listings.slug,
          lastModified: listings.publishedAt,
        })
        .from(listings)
        .leftJoin(profiles, eq(profiles.id, listings.sellerId))
        .where(
          and(
            eq(listings.status, "active"),
            isNull(listings.removedAt),
            isNull(profiles.suspendedAt),
          ),
        )
        .orderBy(desc(listings.publishedAt))
        .limit(SITEMAP_LISTING_LIMIT),
      db
        .select({
          slug: categories.slug,
          listingCount: sql<number>`count(${listings.id})::int`,
        })
        .from(categories)
        .leftJoin(
          listings,
          and(
            eq(listings.categoryId, categories.id),
            eq(listings.status, "active"),
            isNull(listings.removedAt),
          ),
        )
        .leftJoin(profiles, eq(profiles.id, listings.sellerId))
        .where(isNull(profiles.suspendedAt))
        .groupBy(categories.id)
        .having(gte(sql`count(${listings.id})`, CATEGORY_INDEX_THRESHOLD)),
    ]);

    const fixedPages = ["/", "/support", "/terms", "/privacy"];
    const urls = [
      ...fixedPages.map(
        (path) =>
          `<url><loc>${escapeXml(`${origin}${path}`)}</loc><changefreq>weekly</changefreq></url>`,
      ),
      ...activeCategories.map(
        (category) =>
          `<url><loc>${escapeXml(`${origin}/category/${encodeURIComponent(category.slug)}`)}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`,
      ),
      ...activeListings.map(({ slug, lastModified }) => {
        const lastmod = lastModified
          ? `<lastmod>${lastModified.toISOString()}</lastmod>`
          : "";
        return `<url><loc>${escapeXml(`${origin}/listing/${encodeURIComponent(slug)}`)}</loc>${lastmod}<changefreq>weekly</changefreq><priority>0.6</priority></url>`;
      }),
    ];

    res
      .status(200)
      .type("application/xml")
      .set("Cache-Control", "public, max-age=300")
      .send(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`,
      );
  } catch (error) {
    logger.error({ err: error }, "Could not generate sitemap");
    res.status(500).type("text/plain").send("Sitemap generation failed");
  }
});

router.get("/robots.txt", (req: Request, res: Response) => {
  const origin = siteOrigin(req);
  res
    .status(200)
    .type("text/plain")
    .set("Cache-Control", "public, max-age=3600")
    .send(`User-agent: *\nAllow: /\nDisallow: /sign-in\nDisallow: /sign-up\nSitemap: ${origin}/sitemap.xml\n`);
});

export default router;