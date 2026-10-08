# Vendored primary sources for "Docker Sandboxes and Docker Agent 101"

Fetched on 2026-10-08 (docs pages, GitHub files, and API reads all that day; commit SHAs re-read at 11:11Z) for the manual at manuals/docker-sandboxes-101. The goal is that the audit can check every quote word for word against a local copy.

How the files are built:

- `docs-*.md` files hold the raw markdown that docs.docker.com serves at each page URL with `.md` appended. Every page starts with the line `<!-- page: <url> fetched 2026-10-08 -->`, followed by the page text as served (each page text begins with its own `# Title` heading). Page text is not edited.
- GitHub files were fetched from raw.githubusercontent.com at the pinned commit SHA named below, not from a moving branch. Single-file vendors (`agent-schema.json`, `SPEC-v3.md`, CHANGELOG, READMEs) are byte-for-byte copies of the repository file. For docker/docker-agent and docker/sandbox-kit-spec every downloaded file was checked against the byte size in the git tree listing (0 mismatches); the other READMEs were not size-checked.
- The main-branch commit SHAs of all seven repositories were re-read at the end of the run; none had moved.
- Local copies of per-page files, tree listings, and raw API responses are kept outside this directory (session scratchpad, aiefs-docker-sources-work-20261008) and are not part of the deliverable. `manifest/` keeps the URL and file lists and the per-page fetch status (252 pages: 252 OK, 0 failed, 0 HTML fallback).
- `SHA256SUMS.txt` has a checksum of every file in this directory.

## Commit SHAs and versions at fetch time

| Item | Value |
|---|---|
| docker/docs main | `2c8a358489b56cd24069cc9e3a3d9a7b376dcfe7` (2026-10-08T07:18:51Z); the docs index page was served with last-modified 2026-10-08T07:22:35Z (the exact site build commit is not known) |
| docker/docker-agent main | `7a69c316f03c635d8d1951bc4677c59b47beedc7` (2026-10-08T09:35:36Z); latest release v1.149.0 (2026-10-07) |
| docker/sandbox-kit-spec main | `4be7f4dff4d647f10c51dcdb392ce3fa18dc3e96` (2026-10-07T17:26:27Z); latest tag v3.0.0-m.8 (pre-release, 2026-10-02, tag commit `129be2ff45e8f9463450eb3cf04ddcb52c2b76e5`); all 8 tags are m.1 to m.8 pre-releases, no stable v3.0.0 exists |
| docker/sbx-releases main | `2329d12106fee653c0890152947fdd827e00cfd0` (2026-10-05T14:36:51Z); latest stable v0.47.0 (2026-10-05), latest rc v0.48.0-rc4 (2026-10-08) |
| docker/mcp-gateway main | `a34df45d4ec0e941a9853ad768c4f6cd818966b3` (2026-09-16T18:47:05Z) |
| docker/model-runner main | `ed3e67a8205b8d068b9c65b30d3708132a231bba` (2026-10-08T09:10:52Z) |
| docker/compose-for-agents main | `bfd4fe952591495af757a1a737c7eacc78c75c15` (2026-09-02T19:09:37Z) |
| sbx binary used for help text | v0.47.0 0411f50ee4700fe7bd37e6e7e3aced563e850ca9 |
| docker-agent binary used for help text | v1.149.0, Commit: Homebrew |
| Docker Desktop release notes | newest entry 4.94.0 |

## Files

| File | Origin (URL or command) | Commit, tag, or version | Lines | Fetch date | License |
|---|---|---|---|---|---|
| `docs-sandboxes.md` | 79 pages, every page under https://docs.docker.com/ai/sandboxes/ (list from https://docs.docker.com/sitemap.xml; each page fetched as `<page URL without trailing slash>.md`; list in manifest/pages-sandboxes.txt) | site served 2026-10-08 (index page last-modified header 2026-10-08T07:22:35Z); source repo docker/docs main at fetch time 2c8a358489b56cd24069cc9e3a3d9a7b376dcfe7 | 15279 | 2026-10-08 | Apache-2.0 (docker/docs) |
| `docs-docker-agent.md` | 108 pages, every page under https://docs.docker.com/ai/docker-agent/ (manifest/pages-docker-agent.txt) | same as above | 21284 | 2026-10-08 | Apache-2.0 (docker/docs) |
| `docs-model-runner.md` | 8 pages, every page under https://docs.docker.com/ai/model-runner/ (manifest/pages-model-runner.txt) | same as above | 2414 | 2026-10-08 | Apache-2.0 (docker/docs) |
| `docs-mcp.md` | 10 pages under https://docs.docker.com/ai/mcp-catalog-and-toolkit/ (MCP Toolkit, MCP Gateway, MCP Catalog; manifest/pages-mcp-catalog-and-toolkit.txt). The sandbox-side MCP gateway page /ai/sandboxes/mcp-gateway is in docs-sandboxes.md | same as above | 2302 | 2026-10-08 | Apache-2.0 (docker/docs) |
| `docs-compose-models.md` | 3 pages: https://docs.docker.com/ai/compose/models-and-compose/ , https://docs.docker.com/reference/compose-file/models/ , https://docs.docker.com/compose/how-tos/provider-services/ (manifest/pages-compose-models.txt) | same as above | 547 | 2026-10-08 | Apache-2.0 (docker/docs) |
| `docs-desktop-release-notes.md` | https://docs.docker.com/desktop/release-notes.md (the `/index.md` form returns 404); whole file, newest entry 4.94.0 | same as above | 5994 | 2026-10-08 | Apache-2.0 (docker/docs) |
| `docs-sandboxes-api.md` | EXTRA (not in the capture list): 44 pages under https://docs.docker.com/ai/sandboxes-api/ (manifest/pages-sandboxes-api.txt) | same as above | 5036 | 2026-10-08 | Apache-2.0 (docker/docs) |
| `agent-schema.json` | https://raw.githubusercontent.com/docker/docker-agent/7a69c316f03c635d8d1951bc4677c59b47beedc7/agent-schema.json (path agent-schema.json confirmed in the repository tree); verbatim | docker/docker-agent main = 7a69c316f03c635d8d1951bc4677c59b47beedc7 (committed 2026-10-08T09:35:36Z) | 3664 | 2026-10-08 | Apache-2.0 |
| `docker-agent-CHANGELOG.md` | CHANGELOG.md at repository root of docker/docker-agent; verbatim; newest entry v1.149.0 (2026-10-07); there is no v1.146.0 entry | docker/docker-agent main = 7a69c316f03c635d8d1951bc4677c59b47beedc7 | 6867 | 2026-10-08 | Apache-2.0 |
| `docker-agent-releases.md` | https://api.github.com/repos/docker/docker-agent/releases?per_page=40; 40 releases v1.149.0 (2026-10-07) back to v1.110.0 (2026-07-15), tag, date, body; the API list has no v1.146.0 | API read 2026-10-08 | 2395 | 2026-10-08 | Apache-2.0 (release notes of an Apache-2.0 project) |
| `docker-agent-README.md` | README.md at repository root of docker/docker-agent; verbatim | docker/docker-agent main = 7a69c316f03c635d8d1951bc4677c59b47beedc7 | 100 | 2026-10-08 | Apache-2.0 |
| `docs-docker-agent-repo.md` | README.md plus 126 markdown files under docs/ plus 3 non-markdown files (docs/data/nav.yml, docs/configuration/sandbox/kit/docker-agent.yaml, docs/configuration/sandbox/kit/docker-agent.dockerfile) of docker/docker-agent, 130 file sections with `<!-- file: ... -->` markers (manifest/files-docker-agent-repo.txt). Not vendored from docs/: images, gifs, mp4, svg, and site theme files (layouts, css, js, hugo.yaml, lint config) | docker/docker-agent main = 7a69c316f03c635d8d1951bc4677c59b47beedc7 | 26932 | 2026-10-08 | Apache-2.0 |
| `SPEC-v3.md` | docs/spec/SPEC-v3.md of docker/sandbox-kit-spec (path found in the repository tree; there is no SPEC-v3.md at the repository root); verbatim, main branch | docker/sandbox-kit-spec main = 4be7f4dff4d647f10c51dcdb392ce3fa18dc3e96 (committed 2026-10-07T17:26:27Z). Latest tag: v3.0.0-m.8 (pre-release, 2026-10-02, tag commit 129be2ff45e8f9463450eb3cf04ddcb52c2b76e5). Main is ahead of the tag. | 1145 | 2026-10-08 | Apache-2.0 |
| `SPEC-v3-at-v3.0.0-m.8.md` | EXTRA: docs/spec/SPEC-v3.md at the latest tag v3.0.0-m.8; verbatim. It differs from SPEC-v3.md on main by 29 changed lines (main adds the capability `agent-interactive-sessions@1`; the tag text does not name it) | tag v3.0.0-m.8 = 129be2ff45e8f9463450eb3cf04ddcb52c2b76e5 | 1138 | 2026-10-08 | Apache-2.0 |
| `kit-capabilities.md` | 20 capability pages: docs/spec/capabilities/com.docker.sandbox/*.md of docker/sandbox-kit-spec, with `<!-- page: ... -->` markers (names: agent-context@1, agent-interactive-sessions@1, agent-sessions@1, agent-skill@1, agent-skills@1, credential@1, git-identity@1, host-mount@1, kit-registry@1, lifecycle@1, long-running@1, network-policy@1, network-policy@2, port@1, privileged@1, resources@1, sbx@1, ssh-agent@1, usb-device@1, volume@1) | docker/sandbox-kit-spec main = 4be7f4dff4d647f10c51dcdb392ce3fa18dc3e96 | 1976 | 2026-10-08 | Apache-2.0 |
| `kit-spec-extras.md` | EXTRA: README.md, docs/kit-intro.md, docs/spec/conformance.md, docs/agent-context-placement.md, RELEASES.md, GOVERNANCE.md, NOTICE, MAINTAINERS of docker/sandbox-kit-spec, with file markers | docker/sandbox-kit-spec main = 4be7f4dff4d647f10c51dcdb392ce3fa18dc3e96 | 1412 | 2026-10-08 | Apache-2.0 |
| `kit.schema.json` | EXTRA: schema/kit.schema.json of docker/sandbox-kit-spec; verbatim (the per-capability schemas under schema/capabilities/ are not vendored) | docker/sandbox-kit-spec main = 4be7f4dff4d647f10c51dcdb392ce3fa18dc3e96 | 827 | 2026-10-08 | Apache-2.0 |
| `sbx-releases.md` | https://api.github.com/repos/docker/sbx-releases/releases?per_page=100, pages 1 to 3 (100 + 100 + 5), 205 releases, newest first by published date. Mix: 32 stable tags (v0.21.0 on 2026-03-31 to v0.47.0 on 2026-10-05), 54 release candidates, 11 nightly builds, 108 dev builds (tag `dev-<sha>`). Newest stable: v0.47.0; newest rc: v0.48.0-rc4 (2026-10-08) | API read 2026-10-08; repo docker/sbx-releases main = 2329d12106fee653c0890152947fdd827e00cfd0 | 6343 | 2026-10-08 | Proprietary, Docker Inc. (release notes are Docker text, quoted as release notes) |
| `mcp-gateway-README.md` | README.md of docker/mcp-gateway; verbatim | docker/mcp-gateway main = a34df45d4ec0e941a9853ad768c4f6cd818966b3 | 343 | 2026-10-08 | MIT |
| `model-runner-README.md` | README.md of docker/model-runner; verbatim | docker/model-runner main = ed3e67a8205b8d068b9c65b30d3708132a231bba | 501 | 2026-10-08 | Apache-2.0 |
| `compose-for-agents-README.md` | README.md of docker/compose-for-agents; verbatim | docker/compose-for-agents main = bfd4fe952591495af757a1a737c7eacc78c75c15 | 72 | 2026-10-08 | Apache-2.0 OR MIT (dual license, user chooses) |
| `help-sbx.md` | copied from /Users/rohitghumare/.cache/aiefs-manuals-wip/docker-research/cli/sbx.md; full `sbx --help` tree (program output, captured 2026-10-08) | sbx v0.47.0 0411f50ee4700fe7bd37e6e7e3aced563e850ca9 (Homebrew cask) | 4989 | 2026-10-08 | Program output of the proprietary sbx binary |
| `help-sbx-cloud.md` | copied from .../docker-research/cli/sbx-cloud.md; `sbx --cloud --help` | sbx v0.47.0 | 55 | 2026-10-08 | Program output of the proprietary sbx binary |
| `help-docker-agent.md` | copied from .../docker-research/cli/docker-agent.md; full `docker-agent --help` tree | docker-agent v1.149.0, Commit: Homebrew | 1734 | 2026-10-08 | Program output of the Apache-2.0 docker-agent binary |
| `help-legacy-docker-sandbox.md` | copied from .../docker-research/cli/sandbox.md; `docker sandbox --help` of the legacy Docker CLI plugin | plugin Client Version v0.12.0 f13b3c1a96a8be40b06473bb3db0c26dbfe1878c (from cli/versions.txt) | 394 | 2026-10-08 | Program output of a Docker CLI plugin; license not checked (plugin binary, not a repository) |
| `help-legacy-docker-agent.md` | copied from .../docker-research/cli/agent.md; `docker agent --help` of the legacy Docker CLI plugin | plugin v1.32.4, Commit bd55840ec12b55874dd9fccf88912f9b6bb3e3f3 (from cli/versions.txt) | 468 | 2026-10-08 | Program output of the docker-agent plugin build (docker/docker-agent is Apache-2.0) |
| `probes/` | copied from .../docker-research/cli/probes/ (sbx-*.txt read-only probes, docker-agent-*.txt probes; each starts with the command line and a timestamp, ends with the exit code; captured 2026-10-08 between 06:57Z and 06:58Z). They contain local paths of the capture machine (user name in paths) and no secret values | sbx v0.47.0; docker-agent v1.149.0 | 206 | 2026-10-08 | sbx-*: proprietary binary output; docker-agent-*: Apache-2.0 binary output |
| `LICENSES.md` | written from the LICENSE, NOTICE, and README files of the repositories above | see file | 283 | 2026-10-08 | not applicable |
| `README.md` | this file | not applicable | (this file) | 2026-10-08 | not applicable |
| `manifest/` | URL lists, repository file lists, per-page fetch status | not applicable | 692 | 2026-10-08 | not applicable |
| `SHA256SUMS.txt` | `shasum -a 256` of every file here | not applicable | (generated) | 2026-10-08 | not applicable |

## License findings (read from the repository LICENSE files, details and full texts in LICENSES.md)

- docker/docs (source of all docs-*.md): Apache-2.0. LICENSE appendix says "Copyright 2016 Docker, Inc."; README.md says "Copyright 2013-2026 Docker, Inc., released under the Apache 2.0 license".
- docker/docker-agent: Apache-2.0. The LICENSE keeps the unfilled template line "Copyright [yyyy] [name of copyright owner]". No NOTICE file.
- docker/sandbox-kit-spec: Apache-2.0. LICENSE ends with "Copyright 2026 Docker, Inc."; NOTICE says "Copyright 2026 Docker, Inc.".
- docker/model-runner: Apache-2.0, "Copyright 2025 Docker, Inc.".
- docker/compose-for-agents: dual, Apache-2.0 or MIT at the user's choice; LICENSE.MIT says "Copyright (c) 2025 Docker Inc.".
- docker/mcp-gateway: MIT, not Apache-2.0 ("Copyright (c) 2025 Docker"). This differs from the assumption in the task brief.
- docker/sbx-releases: proprietary. LICENSE reads "Copyright © 2026 Docker Inc. All rights reserved." and README.md says "Proprietary — Docker Inc.". The sbx binary and its help output follow that status. Quote the release notes and help text as short quotations only.

## Findings that matter for the audit

- The Sandbox Kit v3 specification is a pre-release (tags v3.0.0-m.1 to m.8); `SPEC-v3.md` on main differs from the m.8 tag (main names `agent-interactive-sessions@1`, the tag does not). Decide which one the manual quotes and name it.
- The legacy `docker sandbox` plugin (v0.12.0) and `docker agent` plugin (v1.32.4) are far behind the current `sbx` (v0.47.0) and `docker-agent` (v1.149.0); the help-legacy-* files are kept for comparison, not as current behavior.
- docker-agent has no v1.146.0 in the CHANGELOG or in the releases API list (v1.145.0 is followed by v1.147.0).
- sbx-releases mixes stable, rc, nightly, and dev builds; the docs release-notes page (in docs-sandboxes.md) lists only recent stable releases.

## Not fetched

Every requested item was fetched. No curl was refused by the sandbox proxy and no URL needed a retry with an added host. The following were not vendored on purpose (outside the capture list) or are absent:

- https://docs.docker.com/ai/ (the bare section URL): not requested; the research notes record it as HTTP 404.
- Other /ai/ sections: /ai/gordon (9 pages) and /ai/skills (2 pages) are not vendored. The single /ai/compose page is in docs-compose-models.md.
- Pages outside /ai/: /reference/cli/sbx (about 115 generated reference pages), /reference/cli/docker/mcp/*, /reference/cli/docker/model/*, /offload, /agentic-platform, /compose/bridge/use-model-runner/. The sbx and docker-agent help trees (help-sbx.md, help-docker-agent.md) cover the CLI surface instead.
- sandbox-kit-spec: per-capability JSON schemas (schema/capabilities/*), examples/, skills/, tck/, and Go sources.
- docker-agent repository: Go sources, and the images, gifs, mp4, svg, and site theme files under docs/. Root files AGENTS.md, SECURITY.md, golang_developer.yaml were fetched during the run but are not part of the deliverable.
- docs.docker.com page `.md` fallbacks: not needed; `docs-html/` was not created because no page needed the HTML fallback.

## Trimmed on 2026-10-08

- agent-schema.json and docker-agent-CHANGELOG.md are now the copies at tag v1.149.0 (commit bf4169cdd31229d52385410c52c3dcc59b497858), which is the pin; the main copies differed by 22 and 55 diff lines.
- sbx-releases.md keeps the stable releases only; rc, nightly, and dev builds were removed.
- docs-docker-agent-repo.md and docker-agent-releases.md were removed: the first duplicates docs-docker-agent.md, the second duplicates the CHANGELOG.
- Quotes from the Kit Spec use SPEC-v3-at-v3.0.0-m.8.md (the pinned tag); SPEC-v3.md is the main copy, cited only for unreleased changes.
- sbx help text and release notes are Docker's proprietary program output and release text. The CLI reference pages under docs.docker.com/reference/cli/sbx publish the same help text under Apache-2.0.
