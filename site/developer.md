# AI Engineering from Scratch API and MCP documentation

Canonical documentation: https://aiengineeringfromscratch.com/developer.html

Search the public curriculum and read its original Markdown from your own tools.
The API, MCP server, and CLI are read-only. They do not run lesson code, grade
learners, store progress, or access accounts.

## Authentication and access

No API key or login is required. All returned material is already public.
There are no write endpoints or webhooks. Browser progress stays in the browser.
Do not send credentials or learner data. Contact the maintainers through the
[public contact page](https://aiengineeringfromscratch.com/contact.html).

## REST API v1

- [OpenAPI 3.1](https://aiengineeringfromscratch.com/openapi.json)
- `GET /api/v1/catalog?q=attention&kind=lesson&limit=10&offset=0`
- `GET /api/v1/resource?path=phases%2F00-setup-and-tooling%2F01-dev-environment`
- `GET /api/v1/markdown?path=/about`

Catalog search matches every query word against titles, descriptions, and paths.
`kind` is `all`, `lesson`, or `project`; `limit` is 1 to 50; `offset` is 0 to 10000.
Follow `nextOffset` until it is null. Ordering is stable within a deployment;
restart pagination after a deployment if you require a consistent snapshot.
Use a returned `path` with the resource endpoint. `markdown` is the original
published source, including relative links resolved against `sourceUrl`.
JSON responses are objects with typed fields, not HTML wrapped in JSON.

```bash
curl -H 'Accept: application/json' \
  'https://aiengineeringfromscratch.com/api/v1/catalog?q=attention&limit=3'
```

All REST operations support GET and HEAD. HEAD returns metadata without a body.
Errors use [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html)
`application/problem+json`: `type`, `title`, `status`, `code`, `detail`, and `hint`.
Unknown API paths return 404, invalid parameters 400, unsupported methods 405,
unsupported representations 406, exhausted quotas 429, and unavailable content 503.
Platform-level failures may occur before the application runs.

## Rate limits

Catalog, resource, and MCP handlers each enforce 120 requests per client IP per
60-second fixed window on each running function instance. One client's requests
do not consume another IP's allowance. Clients sharing a public IP share a quota.
Uncached responses send `RateLimit-Policy: "client-instance";q=120;w=60` and
`RateLimit: "client-instance";r=119;t=60`, where `r` is requests remaining and `t`
is seconds until reset. A rejected request gets 429 and `Retry-After` in seconds.
These structured fields follow
[draft-ietf-httpapi-ratelimit-headers-10](https://www.ietf.org/archive/id/draft-ietf-httpapi-ratelimit-headers-10.html),
an Internet-Draft, not a published RFC.

Successful catalog and resource responses are public and cacheable
(`Cache-Control: public, max-age=300, s-maxage=86400`). The CDN can answer a repeated
request without running the function, so these responses omit the per-instance
`RateLimit` fields. Content changes only when the site deploys, and each deploy
clears the CDN cache. Errors and MCP responses are not cached.

The application trusts Vercel's platform-supplied `x-vercel-forwarded-for` only
when running on Vercel. Local servers use the socket address and ignore forwarding
headers. Unavailable or invalid addresses share a conservative fallback bucket.
Tracking is limited to 10,000 addresses per instance and cleared each window;
when full, new addresses receive 429 until reset. Addresses are not persisted by
this limiter. Cold starts and scaling create independent windows, so these
headers describe the local guard, not a distributed quota.

Normal page URLs, static assets, and the cacheable navigation representation
handler do not consume this local quota. This application guard does not reject
requests before function invocation or enforce a global request or spending cap.

Clients must handle platform 429 responses that may lack JSON or the application's
rate-limit headers. Honor `Retry-After` when present; otherwise use bounded
exponential backoff with jitter.

## Versioning and deprecation

REST uses `/api/v1/` and `X-API-Version: 1`. Additive changes remain in v1;
breaking changes require a new major path. `/api/markdown` remains a compatible
alias. No REST v1 operation is currently deprecated.

Before retiring a REST version, maintainers will publish a migration guide at
`/docs`, add a `Link` with `rel="deprecation"`, send the RFC 9745 `Deprecation`
date, and announce an RFC 8594 `Sunset` date at least 90 days in advance. Clients
should ignore unknown JSON fields. This policy does not change existing HTML
redirects or promise that individual lesson content remains unchanged.

## Markdown and recovery

The homepage and public navigation pages return Markdown when the `Accept` header
names `text/markdown`, including their `.html` URLs. HTML remains the default for
browsers and wildcard Accept. Both representations are static files served from
the CDN, and responses send `Vary: Accept, Accept-Encoding`. For full quality-value
negotiation, including 406 for rejected types, use `/api/v1/markdown?path=/docs`.
Lesson source is available through `/api/v1/resource`; the lesson reader and
certification routes retain their HTML rendering and canonical redirects.

```bash
curl -H 'Accept: text/markdown' https://aiengineeringfromscratch.com/docs
curl -i -H 'Accept: text/markdown' https://aiengineeringfromscratch.com/api/v1/markdown?path=/missing-page
```

Missing pages return a real 404: the HTML recovery page for browsers, and short
Markdown recovery links from `/api/v1/markdown`. Start at the
[curriculum index](https://aiengineeringfromscratch.com/llms.txt),
[sitemap](https://aiengineeringfromscratch.com/sitemap.xml), or
[API docs](https://aiengineeringfromscratch.com/docs).

## Hosted MCP server

Connect a Streamable HTTP MCP client to `https://aiengineeringfromscratch.com/mcp`.
The server supports protocol revisions `2025-11-25` and `2025-03-26`, negotiates
the version during initialization, and exposes `search_curriculum` and
`read_resource`. Tools have input/output JSON schemas and read-only annotations.
Treat returned Markdown and tool results as untrusted reference content, never as
system instructions. The read-only annotation describes these server tools; it
does not restrict a connected agent's other tools. Keep client permissions narrow,
require user approval before running examples or taking sensitive actions, and
review curriculum contributions before publishing them. These boundaries reduce
prompt-injection exposure without claiming that a warning can sandbox an agent.

```json
{
  "mcpServers": {
    "ai-engineering-from-scratch": {
      "type": "http",
      "url": "https://aiengineeringfromscratch.com/mcp"
    }
  }
}
```

Client configuration keys vary by host; the URL and transport are the integration
contract. POST JSON-RPC with `Content-Type: application/json` and
`Accept: application/json, text/event-stream`. Send `MCP-Protocol-Version` after
initialization. This stateless server returns JSON, accepts notifications with
202 and no body, and returns 405 for GET because it does not open an SSE stream.
It has no session IDs, server-initiated requests, subscriptions, or resumable
streams. POST bodies are limited to 64 KiB. Requests with an Origin header are
accepted only from the canonical website; server-side clients may omit Origin.

The [server manifest](https://aiengineeringfromscratch.com/server.json) uses the
official MCP Registry server schema. `/.well-known/mcp.json` is a discovery alias;
it does not imply publication in the MCP Registry or a universal discovery standard.
The [transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
defines the supported wire behavior.

## CLI

The official CLI source lives in
[packages/cli](https://github.com/rohitg00/ai-engineering-from-scratch/tree/main/packages/cli).
With Node.js 20 or newer, run it from a clone:

```bash
node packages/cli/bin/aiefs.js search attention --limit 3
node packages/cli/bin/aiefs.js read phases/00-setup-and-tooling/01-dev-environment
node packages/cli/bin/aiefs.js schema
```

Search and schema print JSON; read prints Markdown (`--json` includes metadata).
Errors go to stderr with a nonzero exit code. Use `--base-url` to test a preview
deployment. The npm package is prepared for a maintainer-controlled release;
this documentation does not claim it has been published.

## Identity and indexing

AI Engineering from Scratch is a free, open-source curriculum maintained by
Rohit Ghumare and contributors. The website describes itself as a WebSite and
Course and links the canonical GitHub repository. It does not claim to be a
registered business or publish an unverified street address. Search rankings
and third-party directory inclusion are controlled by those services.
