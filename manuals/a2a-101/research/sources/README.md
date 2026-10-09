# Vendored sources

These files come from the A2A project at tag `v1.0.1` (commit `3303592588e388e62e0f69f701af531d2f4e3991`, 2026-05-28), https://github.com/a2aproject/A2A. They are distributed under the Apache License 2.0 in [LICENSE](LICENSE).

| File | Upstream |
|---|---|
| `specification.md` | `docs/specification.md`, copied without changes |
| `a2a.proto` | `specification/a2a.proto`, copied without changes |
| `specification-main.md` | `docs/specification.md` at main, commit `679ab3afc6f95ef47bb969d511053d0f63bca2a2` (2026-10-05), copied without changes. The manual quotes it only for rules added after v1.0.1, and labels them as unreleased. |
| `docs.md` | fourteen documentation pages joined in one file, each copied without changes after a comment that names its path: `README.md`, `docs/topics/what-is-a2a.md`, `key-concepts.md`, `life-of-a-task.md`, `agent-discovery.md`, `streaming-and-async.md`, `enterprise-ready.md`, `a2a-and-mcp.md`, `extensions.md`, `docs/whats-new-v1.md`, `docs/announcing-1.0.md`, `docs/topics/multi-tenancy.md`, `custom-protocol-bindings.md`, and `extension-and-binding-governance.md` |

The manual's audit checks every quoted rule against these files, word for word. Update them only together with the manual's `pin` in `manual.json`.
