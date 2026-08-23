export const CONTENT_REJECTED_CODE = "content_not_allowed";
export const CONTENT_REJECTED_MESSAGE =
  "This content cannot be posted because it violates Sellify's safety rules.";

export function normalizeModerationText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/[13!]/g, "i")
    .replace(/0/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const prohibitedPatterns = [
  /\b(kill yourself|go die|i will kill|jag ska doda|doda dig|valdtakt)\b/,
  /\b(nigger|faggot|retard|hora|blatte)\b/,
  /\b(child porn|barnporr|underage sex|minderarig sex)\b/,
  /\b(cocaine|kokain|heroin|meth|amfetamin|ecstasy|fentanyl)\b/,
  /\b(gun for sale|sell weapon|vapen till salu|skjutvapen)\b/,
];

export function findContentSafetyViolation(value: string): string | null {
  const normalized = normalizeModerationText(value);
  if (prohibitedPatterns.some((pattern) => pattern.test(normalized))) return CONTENT_REJECTED_CODE;
  const urls = value.match(/(?:https?:\/\/|www\.)\S+/gi) ?? [];
  if (urls.length >= 2 || /(bit\.ly|t\.me|wa\.me|telegram\.me)/i.test(value)) return CONTENT_REJECTED_CODE;
  if (/(.)\1{7,}/.test(normalized) || /\b(buy now|kop nu)\b.*\b(buy now|kop nu)\b/.test(normalized))
    return CONTENT_REJECTED_CODE;
  return null;
}

export function contentIsSafe(...values: Array<string | null | undefined>): boolean {
  return !values.some((value) => value && findContentSafetyViolation(value));
}

export function listingContentIsSafe(listing: Record<string, unknown>): boolean {
  const values: Array<string | null | undefined> = [];
  for (const key of ["title", "description", "shortDescription", "brand", "model", "color", "material", "seoTitle", "seoDescription", "city", "region", "country", "postalCode"]) {
    const value = listing[key];
    if (typeof value === "string") values.push(value);
  }
  if (Array.isArray(listing.keywords)) values.push(...listing.keywords.filter((v): v is string => typeof v === "string"));
  if (Array.isArray(listing.specifications)) {
    for (const spec of listing.specifications) {
      if (spec && typeof spec === "object") {
        const item = spec as { label?: unknown; value?: unknown };
        if (typeof item.label === "string") values.push(item.label);
        if (typeof item.value === "string") values.push(item.value);
      }
    }
  }
  return contentIsSafe(...values);
}