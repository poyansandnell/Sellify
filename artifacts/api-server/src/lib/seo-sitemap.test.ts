import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getListingSitemapPageCount,
  getListingSitemapPageOffset,
  getLocationSitemapPath,
  isLocationPageIndexable,
  isValidSitemapPage,
  SITEMAP_LISTINGS_PER_FILE,
} from "./seo-sitemap";

describe("listing sitemap pagination", () => {
  it("keeps each shard at or below the sitemap URL limit", () => {
    assert.equal(SITEMAP_LISTINGS_PER_FILE, 45_000);
    assert.equal(getListingSitemapPageCount(0), 0);
    assert.equal(getListingSitemapPageCount(1), 1);
    assert.equal(getListingSitemapPageCount(44_999), 1);
    assert.equal(getListingSitemapPageCount(45_000), 1);
    assert.equal(getListingSitemapPageCount(45_001), 2);
  });

  it("covers an estimated year of 1,000 active listings per day", () => {
    assert.equal(getListingSitemapPageCount(365_000), 9);
    assert.equal(getListingSitemapPageOffset(8), 360_000);
  });

  it("rejects invalid totals and page numbers", () => {
    for (const total of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => getListingSitemapPageCount(total), RangeError);
    }

    for (const page of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(isValidSitemapPage(page), false);
      assert.throws(() => getListingSitemapPageOffset(page), RangeError);
    }
    assert.equal(isValidSitemapPage(0), true);
  });
});

describe("location sitemap pages", () => {
  it("encodes city and region names into stable paths", () => {
    assert.equal(
      getLocationSitemapPath("us", "California", "San Francisco"),
      "/location/US/California/San%20Francisco",
    );
    assert.equal(
      getLocationSitemapPath("br", null, "São Paulo"),
      "/location/BR/_/S%C3%A3o%20Paulo",
    );
  });

  it("only indexes locations with enough active listings", () => {
    assert.equal(isLocationPageIndexable(4), false);
    assert.equal(isLocationPageIndexable(5), true);
    assert.equal(isLocationPageIndexable(Number.NaN), false);
  });
});