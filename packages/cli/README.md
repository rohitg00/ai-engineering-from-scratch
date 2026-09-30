# AI Engineering from Scratch CLI

Read-only client for the [public curriculum API](https://aiengineeringfromscratch.com/docs).
Requires Node.js 20 or newer. No runtime dependencies or API key.

From a repository clone:

```bash
node packages/cli/bin/aiefs.js search attention --kind lesson --limit 3
node packages/cli/bin/aiefs.js read phases/00-setup-and-tooling/01-dev-environment
node packages/cli/bin/aiefs.js read projects/dataset-split-auditor --json
node packages/cli/bin/aiefs.js schema
```

Search and schema print JSON to stdout. Read prints the original Markdown, or a
JSON object with metadata when `--json` is supplied. Errors print to stderr and
exit nonzero. Requests time out after 15 seconds and are never silently retried.
For a 429, wait for the reported Retry-After interval before retrying.

`--base-url https://your-preview.vercel.app` selects a preview deployment. HTTP
is accepted only on loopback for local development. Credentials in URLs are rejected.
The CLI never runs content, writes progress, or invokes lesson tools.

## Package and release

The intended npm package is `@rohitg00/aiefs`, with executable `aiefs`.
This source tree does not imply an npm release already exists. A maintainer with
publish access to the scope must perform the release after reviewing the PR:

```bash
cd packages/cli
npm test
npm pack --dry-run
npm publish --access public
```

After that release is verified, install with `npm install -g @rohitg00/aiefs`.
Until then, use the source command or install the locally packed tarball.
