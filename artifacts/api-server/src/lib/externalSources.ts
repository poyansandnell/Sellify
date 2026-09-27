import { db } from "@workspace/db";
import {
  externalSources,
  type ExternalSource,
  type InsertExternalSource,
} from "@workspace/db/schema";
import { logger } from "./logger";

export type ExternalSourceType =
  | "API"
  | "FEED"
  | "INDEX"
  | "PARTNERSHIP_REQUIRED"
  | "DISABLED";

export type ExternalLegalStatus =
  | "APPROVED"
  | "REVIEW_REQUIRED"
  | "PARTNERSHIP_REQUIRED"
  | "DISABLED";

export type ExternalImageMode =
  | "IMAGE_PROXY_ALLOWED"
  | "IMAGE_URL_ONLY"
  | "NO_EXTERNAL_IMAGES";

export const externalSourceCatalog = [
  {
    id: "tradera",
    name: "Tradera",
    country: "SE",
    baseUrl: "https://www.tradera.com",
    sourceType: "API",
    enabled: false,
    legalStatus: "REVIEW_REQUIRED",
    legalApproval: false,
    termsUrl: "https://www.tradera.com/support/gb/terms/terms-and-conditions",
    robotsUrl: "https://www.tradera.com/robots.txt",
    robotsAllowsIndexing: null,
    robotsCheckedAt: null,
    apiDocsUrl: "https://api.tradera.com/documentation",
    apiKeyRequired: true,
    partnershipRequired: false,
    imageMode: "NO_EXTERNAL_IMAGES",
  },
  {
    id: "blocket",
    name: "Blocket",
    country: "SE",
    baseUrl: "https://www.blocket.se",
    sourceType: "PARTNERSHIP_REQUIRED",
    enabled: false,
    legalStatus: "PARTNERSHIP_REQUIRED",
    legalApproval: false,
    termsUrl: "https://www.blocket.se/villkor/villkor-privat/anvandarvillkor",
    robotsUrl: "https://www.blocket.se/robots.txt",
    robotsAllowsIndexing: null,
    apiDocsUrl: null,
    apiKeyRequired: false,
    partnershipRequired: true,
    imageMode: "NO_EXTERNAL_IMAGES",
  },
  {
    id: "wayke",
    name: "Wayke",
    country: "SE",
    baseUrl: "https://www.wayke.se",
    sourceType: "FEED",
    enabled: false,
    legalStatus: "PARTNERSHIP_REQUIRED",
    legalApproval: false,
    termsUrl: null,
    robotsUrl: "https://www.wayke.se/robots.txt",
    robotsAllowsIndexing: null,
    apiDocsUrl: null,
    apiKeyRequired: false,
    partnershipRequired: true,
    imageMode: "NO_EXTERNAL_IMAGES",
  },
  {
    id: "swedish-car-dealers",
    name: "Swedish car dealers",
    country: "SE",
    baseUrl: null,
    sourceType: "FEED",
    enabled: false,
    legalStatus: "REVIEW_REQUIRED",
    legalApproval: false,
    termsUrl: null,
    robotsUrl: null,
    robotsAllowsIndexing: null,
    apiDocsUrl: null,
    apiKeyRequired: false,
    partnershipRequired: false,
    imageMode: "NO_EXTERNAL_IMAGES",
  },
  {
    id: "swedish-real-estate-agents",
    name: "Swedish real-estate agents",
    country: "SE",
    baseUrl: null,
    sourceType: "INDEX",
    enabled: false,
    legalStatus: "REVIEW_REQUIRED",
    legalApproval: false,
    termsUrl: null,
    robotsUrl: null,
    robotsAllowsIndexing: null,
    robotsCheckedAt: null,
    apiDocsUrl: null,
    apiKeyRequired: false,
    partnershipRequired: false,
    imageMode: "NO_EXTERNAL_IMAGES",
  },
  {
    id: "hemnet",
    name: "Hemnet",
    country: "SE",
    baseUrl: "https://www.hemnet.se",
    sourceType: "PARTNERSHIP_REQUIRED",
    enabled: false,
    legalStatus: "PARTNERSHIP_REQUIRED",
    legalApproval: false,
    termsUrl: null,
    robotsUrl: "https://www.hemnet.se/robots.txt",
    robotsAllowsIndexing: null,
    apiDocsUrl: null,
    apiKeyRequired: false,
    partnershipRequired: true,
    imageMode: "NO_EXTERNAL_IMAGES",
  },
  {
    id: "swedish-auction-houses",
    name: "Swedish auction houses",
    country: "SE",
    baseUrl: null,
    sourceType: "FEED",
    enabled: false,
    legalStatus: "REVIEW_REQUIRED",
    legalApproval: false,
    termsUrl: null,
    robotsUrl: null,
    robotsAllowsIndexing: null,
    apiDocsUrl: null,
    apiKeyRequired: false,
    partnershipRequired: false,
    imageMode: "NO_EXTERNAL_IMAGES",
  },
  {
    id: "swedish-secondhand-retailers",
    name: "Swedish second-hand stores and retailers",
    country: "SE",
    baseUrl: null,
    sourceType: "FEED",
    enabled: false,
    legalStatus: "REVIEW_REQUIRED",
    legalApproval: false,
    termsUrl: null,
    robotsUrl: null,
    robotsAllowsIndexing: null,
    apiDocsUrl: null,
    apiKeyRequired: false,
    partnershipRequired: false,
    imageMode: "NO_EXTERNAL_IMAGES",
  },
  {
    id: "ebay",
    name: "eBay",
    country: "US",
    baseUrl: "https://www.ebay.com",
    sourceType: "API",
    enabled: false,
    legalStatus: "REVIEW_REQUIRED",
    legalApproval: false,
    termsUrl: "https://developer.ebay.com/join/api-license-agreement",
    robotsUrl: "https://www.ebay.com/robots.txt",
    robotsAllowsIndexing: null,
    apiDocsUrl: "https://developer.ebay.com/api-docs/buy/browse/overview.html",
    apiKeyRequired: true,
    partnershipRequired: false,
    imageMode: "NO_EXTERNAL_IMAGES",
  },
  {
    id: "craigslist",
    name: "Craigslist",
    country: "US",
    baseUrl: "https://www.craigslist.org",
    sourceType: "PARTNERSHIP_REQUIRED",
    enabled: false,
    legalStatus: "PARTNERSHIP_REQUIRED",
    legalApproval: false,
    termsUrl: "https://www.craigslist.org/about/terms",
    robotsUrl: "https://www.craigslist.org/robots.txt",
    robotsAllowsIndexing: null,
    apiDocsUrl: null,
    apiKeyRequired: false,
    partnershipRequired: true,
    imageMode: "NO_EXTERNAL_IMAGES",
  },
  {
    id: "cars-com",
    name: "Cars.com",
    country: "US",
    baseUrl: "https://www.cars.com",
    sourceType: "PARTNERSHIP_REQUIRED",
    enabled: false,
    legalStatus: "PARTNERSHIP_REQUIRED",
    legalApproval: false,
    termsUrl: null,
    robotsUrl: "https://www.cars.com/robots.txt",
    robotsAllowsIndexing: null,
    apiDocsUrl: null,
    apiKeyRequired: false,
    partnershipRequired: true,
    imageMode: "NO_EXTERNAL_IMAGES",
  },
  {
    id: "autotrader",
    name: "Autotrader",
    country: "US",
    baseUrl: "https://www.autotrader.com",
    sourceType: "FEED",
    enabled: false,
    legalStatus: "PARTNERSHIP_REQUIRED",
    legalApproval: false,
    termsUrl: null,
    robotsUrl: "https://www.autotrader.com/robots.txt",
    robotsAllowsIndexing: null,
    apiDocsUrl: null,
    apiKeyRequired: false,
    partnershipRequired: true,
    imageMode: "NO_EXTERNAL_IMAGES",
  },
  {
    id: "zillow",
    name: "Zillow",
    country: "US",
    baseUrl: "https://www.zillow.com",
    sourceType: "PARTNERSHIP_REQUIRED",
    enabled: false,
    legalStatus: "PARTNERSHIP_REQUIRED",
    legalApproval: false,
    termsUrl: null,
    robotsUrl: "https://www.zillow.com/robots.txt",
    robotsAllowsIndexing: null,
    apiDocsUrl: null,
    apiKeyRequired: false,
    partnershipRequired: true,
    imageMode: "NO_EXTERNAL_IMAGES",
  },
  {
    id: "redfin",
    name: "Redfin",
    country: "US",
    baseUrl: "https://www.redfin.com",
    sourceType: "PARTNERSHIP_REQUIRED",
    enabled: false,
    legalStatus: "PARTNERSHIP_REQUIRED",
    legalApproval: false,
    termsUrl: null,
    robotsUrl: "https://www.redfin.com/robots.txt",
    robotsAllowsIndexing: null,
    apiDocsUrl: null,
    apiKeyRequired: false,
    partnershipRequired: true,
    imageMode: "NO_EXTERNAL_IMAGES",
  },
  {
    id: "realtor-com",
    name: "Realtor.com",
    country: "US",
    baseUrl: "https://www.realtor.com",
    sourceType: "PARTNERSHIP_REQUIRED",
    enabled: false,
    legalStatus: "PARTNERSHIP_REQUIRED",
    legalApproval: false,
    termsUrl: null,
    robotsUrl: "https://www.realtor.com/robots.txt",
    robotsAllowsIndexing: null,
    apiDocsUrl: null,
    apiKeyRequired: false,
    partnershipRequired: true,
    imageMode: "NO_EXTERNAL_IMAGES",
  },
  {
    id: "mls",
    name: "MLS licensed feeds",
    country: "US",
    baseUrl: null,
    sourceType: "FEED",
    enabled: false,
    legalStatus: "PARTNERSHIP_REQUIRED",
    legalApproval: false,
    termsUrl: null,
    robotsUrl: null,
    robotsAllowsIndexing: null,
    apiDocsUrl: null,
    apiKeyRequired: false,
    partnershipRequired: true,
    imageMode: "NO_EXTERNAL_IMAGES",
  },
] satisfies InsertExternalSource[];

export async function seedExternalSourceCatalog(): Promise<void> {
  try {
    await db.insert(externalSources).values(externalSourceCatalog).onConflictDoNothing();
    logger.info(
      { sourceCount: externalSourceCatalog.length },
      "External source catalog initialized",
    );
  } catch (err) {
    logger.error({ err }, "Failed to initialize external source catalog");
    throw err;
  }
}

export function isExternalSourceSearchable(
  source: Pick<
    ExternalSource,
    "enabled" | "legalStatus" | "legalApproval" | "sourceType"
  >,
): boolean {
  return (
    source.enabled &&
    source.legalStatus === "APPROVED" &&
    source.legalApproval &&
    source.sourceType !== "DISABLED"
  );
}

export function assertSourceMayIngest(
  source: ExternalSource,
  options: { hasApiCredential?: boolean } = {},
): void {
  if (!source.enabled || source.legalStatus !== "APPROVED" || !source.legalApproval) {
    throw new Error(`Source ${source.id} is not legally approved and enabled`);
  }
  if (source.sourceType === "DISABLED") {
    throw new Error(`Source ${source.id} is disabled`);
  }
  if (source.apiKeyRequired && !options.hasApiCredential) {
    throw new Error(`Source ${source.id} requires an API credential`);
  }
  if (
    source.sourceType === "INDEX" &&
    (!source.robotsAllowsIndexing || !source.robotsCheckedAt)
  ) {
    throw new Error(`Source ${source.id} has no approved robots.txt check`);
  }
}

export type NormalizedExternalListing = {
  externalId: string;
  originalUrl: string;
  title: string;
  description?: string | null;
  categoryId?: number | null;
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  condition?: string | null;
  price?: string | null;
  currency?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sellerName?: string | null;
  sellerType?: string | null;
  shippingAvailable?: boolean | null;
  auction?: boolean;
  auctionEnd?: Date | null;
  publishedAt?: Date | null;
  sourceUpdatedAt?: Date | null;
  imageUrls?: string[];
  rawDataHash?: string | null;
  productFingerprint?: string | null;
  normalizationConfidence?: number | null;
};

export type SourceAdapter = {
  sourceId: string;
  sourceName: string;
  country: string;
  sourceType: ExternalSourceType;
  enabled: boolean;
  requiresApiKey: boolean;
  requiresPartnership: boolean;
  fetchListings(options?: { cursor?: string }): Promise<NormalizedExternalListing[]>;
  fetchListing(externalId: string): Promise<NormalizedExternalListing | null>;
  normalizeListing(rawListing: unknown): NormalizedExternalListing;
  refreshListing(externalId: string): Promise<NormalizedExternalListing | null>;
  markUnavailable(externalId: string): Promise<void>;
  getOriginalUrl(externalId: string): string;
};

export class SourceIntegrationNotConfiguredError extends Error {
  readonly code = "SOURCE_INTEGRATION_NOT_CONFIGURED";

  constructor(sourceId: string) {
    super(`The ${sourceId} adapter is a placeholder and cannot fetch listings`);
    this.name = "SourceIntegrationNotConfiguredError";
  }
}

function placeholderAdapter(
  source: (typeof externalSourceCatalog)[number],
): SourceAdapter {
  const unavailable = (): never => {
    throw new SourceIntegrationNotConfiguredError(source.id);
  };

  return {
    sourceId: source.id,
    sourceName: source.name,
    country: source.country,
    sourceType: source.sourceType as ExternalSourceType,
    enabled: false,
    requiresApiKey: source.apiKeyRequired,
    requiresPartnership: source.partnershipRequired,
    fetchListings: async () => unavailable(),
    fetchListing: async () => unavailable(),
    normalizeListing: () => unavailable(),
    refreshListing: async () => unavailable(),
    markUnavailable: async () => unavailable(),
    getOriginalUrl: () => unavailable(),
  };
}

export const sourceAdapters: ReadonlyMap<string, SourceAdapter> = new Map(
  externalSourceCatalog.map((source) => [source.id, placeholderAdapter(source)]),
);