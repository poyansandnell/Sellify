---
name: Artifact path routing
description: Route-prefix behavior for API artifact services behind Replit's shared proxy.
---

Declare exact XML routes and sibling route families separately in an API artifact's service `paths` list. A service entry `/sitemap` did not receive `/sitemap.xml`; the proxy sent that request to the web SPA instead. The explicit `/sitemap.xml`, `/sitemap-static.xml`, and `/sitemap-listings` entries routed correctly.

**Why:** An apparently reasonable shorter prefix caused valid sitemap requests to return the Vite app shell with `text/html`, even though Express had matching handlers.

**How to apply:** For API route families, list each exact dotted path and each collection prefix, then restart the managed service and verify through the shared proxy on port 80—not the service's local port.