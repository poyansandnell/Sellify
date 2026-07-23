import type { Listing } from '@workspace/api-client-react';

// Simple hand-off store: "create similar listing" sets this before
// navigating to the sell tab, which consumes it once on focus.
let pending: Listing | null = null;

export function setCopyListing(listing: Listing) {
  pending = listing;
}

export function takeCopyListing(): Listing | null {
  const l = pending;
  pending = null;
  return l;
}
