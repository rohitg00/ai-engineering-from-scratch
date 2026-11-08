---
id: personal-organizer-agents
title: Personal Organizer Agents
code: PO
subtitle: Five local organizer projects. What each builds, how to run it, its inputs, outputs, review files and checks.
hue: 152
sources: projects/bookmark-path-organizer, projects/calendar-focus-planner, projects/download-folder-sort-desk, projects/field-notes-map-builder, projects/catalog-record-linker
source_hash: 4017cd6c40080599
---

## Node projects side by side
type: comparison
span: 2
from: projects/bookmark-path-organizer/README.md, projects/bookmark-path-organizer/solution/cli.ts, projects/calendar-focus-planner/README.md, projects/calendar-focus-planner/solution/cli.ts, projects/field-notes-map-builder/README.md, projects/field-notes-map-builder/solution/cli.ts

| Factor | Bookmark Path Organizer | Calendar Focus Planner | Field Notes Map Builder |
|---|---|---|---|
| Builds | Reading path page | Focus plan and ICS proposals | GeoJSON and a schematic map |
| Input | `bookmarks` tree, `topics` | `sample.ics`, `tasks.json`, a day | `observations`, `radiusMeters` |
| Outputs | `bookmarks.json`, `progress.json`, `report.html` | `focus.ics`, `plan.json`, `plan.html` | `observations.geojson`, `groups.json`, `report.html` |
| Review file | third argument `progress.json` | none | third argument `group-review.json` |
| Never does | Fetch links | Change an account calendar | Download photos or tiles |

## Python projects side by side
type: comparison
from: projects/download-folder-sort-desk/README.md, projects/download-folder-sort-desk/solution/cli.py, projects/catalog-record-linker/README.md, projects/catalog-record-linker/solution/cli.py

| Factor | Download Folder Sort Desk | Catalog Record Linker |
|---|---|---|
| Builds | Filing plan and duplicate groups | Crosswalk and merged catalog |
| Input | `folder`, `occupied` | `left_csv`, `right_csv`, `threshold` |
| Outputs | `moves.json`, `duplicates.json`, `review.html` | `crosswalk.csv`, `merged-catalog.json`, `review.html` |
| Review file | `--decisions decisions.json` | `--decisions decisions.json` |
| Never does | Move a file | Merge on similarity alone |

## Run the reference
type: command-table
span: 2
from: projects/bookmark-path-organizer/README.md, projects/calendar-focus-planner/README.md, projects/calendar-focus-planner/solution/cli.ts, projects/download-folder-sort-desk/README.md, projects/catalog-record-linker/README.md, projects/field-notes-map-builder/README.md

| Command | What it does |
|---|---|
| `node cli.ts sample.json output` | Bookmark organizer or field notes map |
| `node cli.ts <input.json> <dir> <review.json>` | Runs again with your downloaded review |
| `node cli.ts sample.ics tasks.json 2026-10-14 output 10` | Calendar plan with a 10 minute buffer |
| `python3 cli.py samples/input.json --output demo-output` | Download sort desk or catalog linker |
| `python3 cli.py <input.json> --output <dir> --decisions decisions.json` | Applies your approvals |
| `python3 scripts/project_test.py <project> --all --solution --strict` | Grades the reference |

## Calendar planner steps
type: flow
from: projects/calendar-focus-planner/solution/main.ts, projects/calendar-focus-planner/solution/cli.ts, projects/calendar-focus-planner/README.md

1. **CLI**: sets the window from 09:00 to 17:00 UTC on the given day.
2. **parseCalendar**: needs `UID`, `DTSTART` and `DTEND`. It skips cancelled and transparent events.
3. **availableSlots**: adds the buffer around events, merges overlaps, then lists the gaps.
4. **schedule**: sorts tasks by priority, then by id.
5. **schedule**: puts each task in the earliest gap that is long enough.
6. **schedule**: lists a task that fits no gap as unscheduled with a reason.
7. **exportCalendar**: writes proposals to `focus.ics` for manual import.

## Download sort desk
type: architecture
from: projects/download-folder-sort-desk/solution/main.py, projects/download-folder-sort-desk/solution/cli.py, projects/download-folder-sort-desk/API.md

```arch
node | in | 1,1 | input.json | folder, occupied | client
node | inv | 2,1 | inventory() | path, size, sha256 | process
node | cat | 3,1 | categorize() | scores, evidence | process
node | plan | 3,2 | plan_moves() | destination, duplicate_groups | process
node | rev | 2,2 | review_plan() | fingerprint, approved | process
node | out | 1,2 | moves.json | for a file manager | store
edge | in | inv | folder
edge | inv | cat | records
edge | cat | plan | category
edge | plan | rev | plan
edge | rev | out | approved moves
```

## Scoring rules
type: concepts
from: projects/bookmark-path-organizer/solution/main.ts, projects/download-folder-sort-desk/API.md, projects/catalog-record-linker/API.md, projects/field-notes-map-builder/solution/main.ts, projects/field-notes-map-builder/README.md

- **Bookmark topic score**: a keyword in a title adds 3. A keyword in notes adds 1.
- **Bookmark duplicates**: same URL after the fragment is removed. Query strings stay significant.
- **File category**: a known extension adds 3. The words workshop and handout add 1 to documents.
- **File collisions**: a taken destination gets `-2`, `-3` before the suffix, case-insensitive.
- **Catalog pair score**: title Jaccard times 0.8 plus creator Jaccard times 0.2.
- **Nearby observations**: `distanceMeters()` uses a spherical earth of radius 6371008.8 m.
- **Map groups**: pairs within the radius join one connected component.

## Defaults and limits
type: defaults
from: projects/calendar-focus-planner/solution/cli.ts, projects/calendar-focus-planner/solution/main.ts, projects/catalog-record-linker/API.md, projects/bookmark-path-organizer/solution/main.ts, projects/field-notes-map-builder/solution/main.ts, projects/download-folder-sort-desk/solution/main.py

| Setting | Default | Note |
|---|---|---|
| Calendar buffer minutes | 10 | Allowed range 0 to 120 |
| Calendar output folder | `focus-output` | Fourth CLI argument |
| Max tasks | 100 | Minutes 5 to 480, priority 1 to 5 |
| `threshold` | 0.25 | Finite, from 0 to 1 |
| Folder nesting | 32 | Deeper bookmark trees fail |
| Radius | 0..1000000 | Meters |
| `approved` | `False` | Every planned move starts unapproved |
| `schema_version` | 1 | In `moves.json` and `merged-catalog.json` |

## Error messages and fixes
type: troubleshooting
from: projects/calendar-focus-planner/solution/main.ts, projects/calendar-focus-planner/README.md, projects/download-folder-sort-desk/solution/main.py, projects/download-folder-sort-desk/solution/cli.py, projects/bookmark-path-organizer/solution/main.ts, projects/catalog-record-linker/solution/main.py, projects/field-notes-map-builder/solution/main.ts

| Symptom | Cause | Fix |
|---|---|---|
| `Expand recurrence and timezone values to UTC before importing` | `RRULE` or `TZID` in the ICS | Expand events in the exporter first |
| `Event needs UID, DTSTART and DTEND` | Implicit end or `DURATION` | Write an explicit `DTEND` |
| `stale approval: source content or destination plan changed` | Files or plan changed after review | Use the new `decisions.json` |
| `output must be outside the input folder` | Output inside the scanned folder | Pick another output path |
| `Progress order must contain every current id exactly once` | Bookmarks changed after the download | Run without the third argument |
| `one-to-one match violated` | One record accepted twice | Accept each record in one pair only |

## Write a review file
type: task-table
from: projects/field-notes-map-builder/solution/main.ts, projects/bookmark-path-organizer/solution/main.ts, projects/download-folder-sort-desk/README.md, projects/catalog-record-linker/API.md

| Task | Code |
|---|---|
| Split a map group | `"decisions": {"<id>": "keep-separate"}` |
| Keep a map group | `"decisions": {"<id>": "keep-group"}` |
| Save reading order | `"order": [...], "completed": [...]` |
| Approve file moves | `"approved": ["<path>"]` |
| Accept a catalog pair | `"match": true, "values": {}` |
| Version a Node review | `"schemaVersion": 1` |

## Worked examples
type: qa
from: projects/calendar-focus-planner/solution/sample.ics, projects/calendar-focus-planner/solution/tasks.json, projects/calendar-focus-planner/solution/main.ts, projects/bookmark-path-organizer/solution/sample.json, projects/download-folder-sort-desk/README.md, projects/download-folder-sort-desk/solution/samples/input.json, projects/catalog-record-linker/README.md

- **Why is the sample busy from 09:20 to 11:10?** Two events overlap and the 10 minute buffer widens them.
- **Which task does not fit?** `deep` needs 120 minutes. No gap is that long.
- **Why do `map-1` and `map-2` group?** Both URLs give the same document after normalization.
- **Where does `handout.txt` go?** `documents/handout.txt` is occupied, so it gets `-2`.
- **Are `left:map-1` and `right:r-7` merged?** Only after you accept the pair. No record is discarded.

## Tips
type: tips
from: projects/calendar-focus-planner/README.md, projects/download-folder-sort-desk/README.md, projects/catalog-record-linker/README.md, projects/field-notes-map-builder/README.md, projects/bookmark-path-organizer/README.md

- An all-day `DTEND;VALUE=DATE` is exclusive. October 14 ends on `20261015`.
- A file manager must recheck identity right before a move. The plan is not a transaction.
- `ready` means accepted merges have no open conflicts. It does not mean every pair was read.
- GeoJSON uses longitude then latitude order.
- The bookmark importer reads the JSON folder tree, not browser HTML.
- Test at least one new input of your own before you integrate a tool.
