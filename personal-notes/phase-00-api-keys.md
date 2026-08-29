# Phase 00 — APIs & Keys

## Configuration

- Provider: Anthropic
- Model: Claude Sonnet 5
- SDK: Anthropic Python SDK
- Secret loading: `.env` through python-dotenv
- Workspace: `aiefs-learning`
- API key scope: Dedicated workspace
- Key expiration: October 29, 2026

## Verification

- SDK request completed successfully
- Raw HTTP request completed successfully
- Both responses included input and output token usage
- Invalid temporary key produced the expected HTTP 401 authentication error
- `.env` is excluded from Git

## SDK versus raw HTTP

The SDK automatically handles:

- Authentication and request construction
- JSON serialization and response parsing
- Typed response objects and API exceptions

Raw HTTP requires:

- API endpoint and HTTP method
- `x-api-key` and `anthropic-version` headers
- JSON encoding and response parsing
- Manual HTTP error handling

## Troubleshooting learned

An identity-linked, all-workspaces key returned HTTP 400 because an
`anthropic-workspace-id` header was required. Creating a dedicated
workspace-scoped key allowed the lesson code to work without additional
headers.

## Security rules

- Never hard-code or commit API keys
- Keep secrets in ignored `.env` files
- Use workspace-scoped credentials
- Set spending limits and expiration dates
- Revoke unused or compromised keys immediately
