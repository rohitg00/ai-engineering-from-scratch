# The state file

`INTERVIEW-LEARNING.md` sits in the current folder. The `interview-prep`
skill owns it. No other skill writes to it, and this skill writes to no other
state file.

## Rules

1. Append only. Add rows at the end of a table. Do not edit, move or delete a
   row.
2. To change a fact, add a new row and put the id of the old row in its
   `Supersedes` cell. The current value is the newest row that no later row
   supersedes.
3. Give each row an id: `P-` for Profile, `A-` for Attempts and `G-` for Gaps,
   then a number with four digits that counts up in its table.
4. Write dates as `YYYY-MM-DD`.
5. Write the learner's words only in the `Note` cells, and keep each note to
   one line.
6. If the learner asks to start over, rename the file to
   `INTERVIEW-LEARNING-<YYYY-MM-DD>.md` after they confirm. If that name
   exists, use `INTERVIEW-LEARNING-<YYYY-MM-DD>-2.md`, then `-3`, and so on.
   Never overwrite an archive. Then run Setup.

## Template

```markdown
# Interview Practice
<!-- Managed by the interview-prep skill. Append only: add rows, never edit them.
     Repo: https://github.com/rohitg00/ai-engineering-from-scratch -->

## Profile
| Id | Date | Role | Level | Session | Supersedes | Note |
|----|------|------|-------|---------|------------|------|

## Attempts
| Id | Date | Item | Mode | Level | Grade | Hints | Gaps | Supersedes | Note |
|----|------|------|------|-------|-------|-------|------|------------|------|

## Gaps
| Id | Date | Item | Gap | Targets | Status | Due | Supersedes |
|----|------|------|-----|---------|--------|-----|------------|
```

## Columns

| Column | Value |
|--------|-------|
| Role | a role id from `interviews/roles.yaml` |
| Level | 1 to 4 |
| Session | the number of items, or the minutes, for one session |
| Item | `<card-id>/<id>`, `scenarios/<id>`, or either form with `#f<N>` for a follow-up |
| Mode | `question`, `scenario`, `loop:<role-id>` or `review` |
| Grade | `missed`, `partial`, `working` or `strong` |
| Hints | the number of hints that the learner asked for |
| Gaps | the `G-` ids that this attempt opened or closed, or `none` |
| Gap | a short name of the missing claim, in plain words |
| Targets | one to three repo paths from the item, split with a comma |
| Status | `open` or `closed` |
| Due | the date to ask about the gap again |

## Example

```markdown
| A-0007 | 2026-11-03 | inference-serving/<id> | question | 2 | partial | 0 | G-0004 | | named the cache, not the order |
| G-0004 | 2026-11-03 | inference-serving/<id> | why order decides reuse | phases/17-infrastructure-and-production/06-sglang-radixattention | open | 2026-11-04 | |
| G-0005 | 2026-11-04 | inference-serving/<id> | why order decides reuse | phases/17-infrastructure-and-production/06-sglang-radixattention | closed | | G-0004 |
```

Row `G-0005` closes the gap. Row `G-0004` stays in the file as history.

## Read the current state

1. For each table, drop each row whose id is in a later `Supersedes` cell.
2. The open gaps are the Gaps rows that remain with `open`.
3. A gap is due when its `Due` date is today or earlier.
4. The last grade of an item is the newest Attempts row for that item.
