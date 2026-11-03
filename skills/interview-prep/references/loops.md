# Loops

A loop is a set of rounds for one role, in one session or across a few
sessions. Use it when the learner asks for a full loop, a practice day or the
loop of a named role.

## Find the loop

1. If `interviews/loops/<role-id>.md` exists, use it. Its front matter has
   `role`, `title`, `minutes` and `updated`. Its body lists the rounds. Each
   round names one value from `rounds`, its minutes and a card README.
2. If it does not exist, build a default loop from the role in
   `interviews/roles.yaml`, as below. Tell the learner that the loop is a
   default.

## Default loop

Use the cards of the role in their `roles.yaml` order. Pick one item for
each round from those cards.

| Round | Item rule | Mode |
|-------|-----------|------|
| screen | level 1 or 2, kind `concept`, from the first card of the role | Question |
| ml-depth | the learner's level, from the next card that has items | Question |
| system-design | kind `design` or `tradeoff`, from `system-design` or another card of the role | Question |
| debugging | one scenario, when the role lists `scenarios` | Scenario |
| behavioral | one item from `behavioral` | Question |

Skip a round when no card of the role has an item for it. Say which round
you skipped and why.

## Rounds without an item

A loop file can give a round as a task with no item, such as a design task
with a load and a latency target. Look for an item on the card of that round
first. If no item fits, tell the learner that the bank has no item for the
round, and skip it. Do not grade a round that has no bank sections.

## Coding rounds

The `coding` card links to practice tasks under `practice/`. Give the
learner the task id and its path, and tell them to run the task grader. Do
not grade the code yourself. Record the result that the grader prints, with
mode `loop:<role-id>`.

The grader ends with the line `N of M checks pass.` Map it to the Grade
column: all checks pass is `strong`, some checks pass is `partial`, and no
check passes, or the code does not load, is `missed`. A check with `ERROR`
or `SKIP` does not pass.

## Run the loop

1. Give the plan: each round, its minutes and its mode. Do not give the item
   titles.
2. Run each round with its mode. Keep the core rule in each round.
3. Between rounds, give the level word for the round that ended, in one line.
   Keep the gap routes for the end.
4. At the end, use Score and close for the whole loop. Write one Attempts
   row for each round that ran, with mode `loop:<role-id>`. Do not write a
   row for a skipped round.

Done when: each round that ran has an Attempts row, and the close lists the
open gaps by round and the rounds that you skipped.

## Behavioral rounds

A behavioral item has no single right claim. Grade the shape of the story
against the item: the situation, the decision that the learner made, the
measured result, and what they changed after. A story with no measured
result is at most partial. Do not judge the person. Judge the evidence in
the story.

## Time

If the host can show the time, give the minutes left at the start of each
round. If the learner goes over the minutes of a round, finish the current
step, then go on. Record `over time` in the `Note` cell.
