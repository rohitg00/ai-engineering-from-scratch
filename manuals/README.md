# Manuals

A manual takes one subject at one pinned version and explains it from the first idea down to the wire or the bytes. Lessons teach a concept and move on. A manual stays with one system until you can predict what it does in a case the manual never showed.

Every manual follows the same rules:

- The title page pins the version, the source commit, and the date the facts were verified.
- Every record you see came from a run. A capture kit in each manual drives the subject offline, with no network and no keys, and every listing names the file it was cut from.
- Every claim traces to a ranked source, and every section ends with the files it was written from.
- Figures use one colour code and one arrow grammar, so a colour or a dashed line means the same thing on every page.

Each manual has a web edition at `aiengineeringfromscratch.com/manual-<id>.html` and a PDF attached to every release as `aiefs-manual-<id>.pdf`.

## Writing a manual

Read [AUTHORING.md](AUTHORING.md) first. It defines the shape of a manual and of a section, the markdown subset, the figure kinds and colours, the capture kit, and the prose limits the audit enforces.

```bash
node --test site/test_manuals.js
node site/build-manuals.js
node scripts/audit_manuals.js --manual <id>
```
