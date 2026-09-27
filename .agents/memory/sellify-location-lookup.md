---
name: Sellify location lookup
description: Project decisions for user-controlled locality entry and reverse geocoding.
---

Manual city, region, postal code, and country entry is the default for Sellify search and listing creation. Device location may be read only after the user explicitly taps the location button; exact coordinates must not be stored by Sellify.

**Why:** The user chose manual location first and GPS only on tap. The public Nominatim service is low-volume only, forbids autocomplete and systematic queries, and requires attribution. Web reverse lookups therefore happen only after a user action, with visible OpenStreetMap attribution and privacy disclosure.

**How to apply:** Keep manual fields usable without location permission. Do not add automatic GPS prompts, location autocomplete, or bulk geocoding. If lookup volume grows, replace the public endpoint with a provider or service intended for production traffic.