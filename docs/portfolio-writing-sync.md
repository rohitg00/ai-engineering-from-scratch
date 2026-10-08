# Blogs and guides sync

The `/blogs` collection and `/blog/<slug>/` and `/guides/<slug>/` readers render full published articles on AI Engineering from Scratch. Interactive figures and inline article scripts are preserved. Related articles, collection navigation, and search stay on the course site. Each article retains its original `https://rohitghumare.com/...` canonical URL; the collection has its own course canonical.

## Publishing

Publish and edit content in `rohitg00/portfolio` using its normal sitemap and page metadata workflow. Its public `/api/content` endpoint derives the collection from published pages. The course fetches this feed and the original article HTML on demand. No second content list, scheduled commit, webhook secret, or course rebuild is required.

Both services cache for five minutes, so changes propagate over several minutes rather than immediately. The course coalesces concurrent requests and bounds article response sizes and its in-process cache. A warm process can serve previously validated content during a source outage for up to 24 hours, with a shorter CDN cache. Cold starts return an uncached 503 recovery page when the source is unavailable. Removed items return 404 after the feed refreshes.

Only published, validated feed entries from the fixed portfolio origin may be requested. The reader rejects noindex pages, redirects, and canonical mismatches. The original HTML supplies article styling and animations. Relative assets resolve to the original asset URLs; those assets must remain publicly available. The reader adapts site navigation without rewriting executable inline scripts.

## Deployment order

Deploy the portfolio change exposing `/api/content` first. Then deploy the course change. Both repositories use their existing Git-connected Vercel deployments. Until the feed exists, the course reader returns 503 rather than an empty successful listing.

## Verification

```bash
node --test site/test_portfolio_sync.js site/test_writing_mirror.js
node site/build.js
node site/build-projects.js --strict
node site/build-manuals.js
node site/version-assets.js
node scripts/preview-writing.js /path/to/portfolio
```

The local preview uses the portfolio checkout's real feed handler and full article HTML over loopback HTTP. It serves the course collection and readers at `http://127.0.0.1:4178/blogs`. Use a checkout that contains the feed implementation. External images, fonts, and dither script still load from their original public URLs.

Check collection filters and search, follow both blog and guide links, drive an article figure, and inspect mobile/desktop screenshots in both themes. Check the response HTML for the original article canonical and full content with JavaScript disabled. Plain static servers cannot execute these reader routes.

Generated build outputs and asset-version rewrites are not committed. Production uses the existing build pipeline and explicitly bundles the collection template with the server function.
