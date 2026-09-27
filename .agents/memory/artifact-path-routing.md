---
name: Artifact path routing
description: Route-prefix behavior for API artifact services behind Replit's shared proxy.
---

Declare every server-rendered SEO route family in the API artifact service `paths` list, including `/location`, `/listing`, `/category`, and each exact XML route. A service entry `/sitemap` did not receive `/sitemap.xml`; the proxy sent that request to the web SPA instead.

**Why:** Missing a path prefix can make valid SEO URLs return the Vite app shell and its client-side 404 even though Express has a matching handler. API-only smoke tests do not prove shared-proxy routing.

**How to apply:** List each SEO route family and exact dotted path in the API service config, restart the managed service, then test the actual public/shared proxy for expected HTML, title, robots metadata, and content—not only the API's local port.