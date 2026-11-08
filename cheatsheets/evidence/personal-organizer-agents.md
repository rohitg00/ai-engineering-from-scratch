# Evidence: cheatsheets/personal-organizer-agents.md

Abbreviations. BP = projects/bookmark-path-organizer. CF = projects/calendar-focus-planner. DF = projects/download-folder-sort-desk. FN = projects/field-notes-map-builder. CR = projects/catalog-record-linker.

## Front matter
- id, title, sources: cheatsheets/topics.yaml:1558-1566

## Node projects side by side (comparison)
- Builds: BP/README.md:5, CF/README.md:5, FN/README.md:5
- Input: BP/solution/cli.ts:26-28, CF/solution/cli.ts:8,11, FN/solution/cli.ts:26-27
- Outputs: BP/solution/cli.ts:30,36,37. CF/solution/cli.ts:19-21. FN/solution/cli.ts:30-32
- Review file: BP/README.md:16, BP/solution/cli.ts:11,29. CF/solution/cli.ts:11 (no review argument). FN/solution/cli.ts:11,28, FN/solution/main.ts:201 (group-review.json download)
- Never does: BP/README.md:48. CF/README.md:45. FN/README.md:48

## Python projects side by side (comparison)
- Builds: DF/README.md:3, CR/README.md:3
- Input: DF/README.md:31, DF/solution/cli.py:13,19. CR/README.md:31, CR/solution/cli.py:12-14
- Outputs: DF/solution/cli.py:23-24,31. CR/solution/cli.py:22-23,31
- Review file: DF/README.md:31, CR/README.md:31
- Never does: DF/README.md:37. CR/README.md:37

## Run the reference (command-table)
- node cli.ts sample.json output: BP/README.md:13, FN/README.md:13
- review as third argument: BP/README.md:16, BP/solution/cli.ts:13
- node cli.ts sample.ics tasks.json 2026-10-14 output 10: CF/README.md:13, buffer argument CF/solution/cli.ts:8,11
- python3 cli.py samples/input.json --output demo-output: DF/README.md:27, CR/README.md:27
- --decisions decisions.json: DF/README.md:31, CR/README.md:31
- --all --solution --strict: BP/README.md:45, CF/README.md:42, DF/README.md:25, CR/README.md:25, FN/README.md:45

## Calendar planner steps (flow)
- 09:00 to 17:00 UTC window: CF/solution/cli.ts:13, CF/README.md:45
- UID, DTSTART, DTEND required: CF/solution/main.ts:46. Skip CANCELLED, TRANSPARENT: CF/solution/main.ts:51
- buffer, merge overlaps, gaps: CF/solution/main.ts:75-93
- sort by priority then id: CF/solution/main.ts:105
- earliest gap long enough: CF/solution/main.ts:106-110
- unscheduled reason: CF/solution/main.ts:107
- exportCalendar to focus.ics: CF/solution/cli.ts:19, CF/README.md:5

## Download sort desk (architecture)
- input.json folder, occupied: DF/solution/samples/input.json:2-5, DF/solution/cli.py:13,19
- inventory() path, size, sha256: DF/solution/main.py:20-27
- categorize() scores, evidence: DF/solution/main.py:51-55
- plan_moves() destination, duplicate_groups: DF/solution/main.py:71-85
- review_plan() fingerprint, approved: DF/solution/main.py:94-121
- moves.json for a file manager: DF/solution/cli.py:23, DF/API.md:39

## Scoring rules (concepts)
- title 3, notes 1: BP/solution/main.ts:107-109
- fragment removed, query kept: BP/solution/main.ts:65,79, BP/README.md:48
- extension 3, workshop/handout 1: DF/API.md:19
- -2, -3 case-insensitive: DF/API.md:27
- 0.8 title, 0.2 creator Jaccard: CR/API.md:19
- distanceMeters, 6371008.8: FN/solution/main.ts:58-74, spherical earth FN/README.md:48
- connected components: FN/solution/main.ts:86-97, FN/README.md:48

## Defaults and limits (defaults)
- buffer 10, range 0 to 120: CF/solution/cli.ts:11, CF/solution/main.ts:74
- output focus-output: CF/solution/cli.ts:11
- max 100 tasks, 5 to 480 minutes, priority 1 to 5: CF/solution/main.ts:97,100
- threshold 0.25, finite in [0,1]: CR/API.md:16,19
- folder nesting 32: BP/solution/main.ts:29
- radius 0..1000000: FN/solution/main.ts:80-85
- approved False: DF/solution/main.py:77
- schema_version 1: DF/solution/main.py:80, CR/solution/main.py:145 (cli.py:23 writes both)

## Error messages and fixes (troubleshooting)
- Expand recurrence and timezone values...: CF/solution/main.ts:60
- Event needs UID, DTSTART and DTEND, DURATION outside subset: CF/solution/main.ts:46, CF/README.md:45
- stale approval...: DF/solution/main.py:97-98
- output must be outside the input folder: DF/solution/cli.py:15-16
- Progress order must contain every current id exactly once: BP/solution/main.ts:140-150. Third argument optional: BP/solution/cli.ts:11,17-19
- one-to-one match violated: CR/solution/main.py:87-88

## Write a review file (task-table)
- Split a map group, keep-separate: FN/solution/main.ts:134,141
- Keep a map group, keep-group: FN/solution/main.ts:134
- Save reading order, order and completed: BP/solution/main.ts:19-23
- Approve file moves, approved array of source paths: DF/README.md:31
- Accept a catalog pair, match and values: CR/API.md:27
- Version a Node review, schemaVersion 1: FN/solution/main.ts:124, BP/solution/main.ts:142

## Worked examples (qa)
- events 09:30-10:15 and 10:00-11:00 overlap: CF/solution/sample.ics:5-6,11-12. Buffer padding: CF/solution/main.ts:78. Busy 09:20-11:10 computed in memory with schedule()
- deep 120 minutes unscheduled: CF/solution/tasks.json:5, CF/solution/main.ts:107 (computed in memory)
- map-1 and map-2 URLs: BP/solution/sample.json:9,15, BP/solution/main.ts:61-66
- documents/handout.txt occupied, -2: DF/solution/samples/input.json:4, DF/API.md:27
- left:map-1 and right:r-7: CR/README.md:35

## Tips (tips)
- DTEND;VALUE=DATE exclusive, 20261015: CF/README.md:45
- recheck identity, not a transaction: DF/README.md:37
- ready meaning: CR/README.md:37
- longitude/latitude order: FN/README.md:48
- JSON folder tree, not browser HTML: BP/README.md:48
- test a new input: CF/README.md:47
