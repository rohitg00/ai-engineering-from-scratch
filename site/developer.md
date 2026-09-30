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

Catalog, resource, and MCP handlers each enforce 120 requests per 60-second fixed
window per running function instance, shared by clients of that instance.
They send `RateLimit-Policy: "instance";q=120;w=60` and
`RateLimit: "instance";r=119;t=60`, where `r` is requests remaining and `t` is
seconds until reset. A rejected request gets 429 and `Retry-After` in seconds.
These structured fields follow
[draft-ietf-httpapi-ratelimit-headers-10](https://www.ietf.org/archive/id/draft-ietf-httpapi-ratelimit-headers-10.html),
an Internet-Draft, not a published RFC. Responses are not cached.

This is an instance overload guard, not an account-wide or distributed quota.
Cold starts and scaling create independent windows. Static files and negotiated
HTML/Markdown pages do not consume this quota. Clients must still handle platform
limits and use bounded retries with jitter. A global per-client quota would require
a shared store or a deployment firewall policy.

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

The homepage and public navigation pages support `Accept: text/markdown`, including
their `.html` URLs. HTML remains the default for browsers and wildcard Accept.
Explicit media-type quality values and `q=0` are respected. Responses send
`Vary: Accept, Accept-Encoding`. Unsupported representations return 406.
Lesson source is available through `/api/v1/resource`; the lesson reader and
certification routes retain their HTML rendering and canonical redirects.

```bash
curl -H 'Accept: text/markdown' https://aiengineeringfromscratch.com/docs
curl -i -H 'Accept: text/markdown' https://aiengineeringfromscratch.com/missing-page
```

Missing pages return a real 404 with short Markdown recovery links for agents and
the existing HTML recovery page for browsers. Start at the
[curriculum index](https://aiengineeringfromscratch.com/llms.txt),
[sitemap](https://aiengineeringfromscratch.com/sitemap.xml), or
[API docs](https://aiengineeringfromscratch.com/docs).

## Hosted MCP server

Connect a Streamable HTTP MCP client to `https://aiengineeringfromscratch.com/mcp`.
The server supports protocol revisions `2025-11-25` and `2025-03-26`, negotiates
the version during initialization, and exposes `search_curriculum` and
`read_resource`. Tools have input/output JSON schemas and read-only annotations.
Lesson examples are reference content, not instructions to execute automatically.

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
