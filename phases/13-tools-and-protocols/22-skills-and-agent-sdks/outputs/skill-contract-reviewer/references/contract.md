# Portable contract checklist

- The bundle is a directory containing a regular `SKILL.md` file.
- Frontmatter starts on the first line and has a closing delimiter.
- `name` is present, no longer than 64 characters, and uses lowercase letters, digits, and single hyphens.
- `name` matches the bundle directory.
- `description` is present, no longer than 1024 characters, and states when the skill is useful.
- Optional `compatibility` contains 1 to 500 characters when present.
- Optional `metadata` maps string keys to string values.
- Optional experimental `allowed-tools` is a non-empty space-separated string whose behavior is verified in the target host.
- Unknown runtime fields are separated from the portable package contract and handled by an explicit adapter.
- The Markdown body contains the procedure.
- Optional portable metadata and host-specific extensions remain distinguishable.

Passing this checklist makes the package structurally loadable. It does not grant filesystem, network, secret, subprocess, or tool authority.
