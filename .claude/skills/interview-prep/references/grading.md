# Grading

Grade free text against the bank item. The learner never sees this file, the
words "rubric" or "score", or a number for the grade.

## Inputs

| Bank part | What you check |
|-----------|----------------|
| `Short answer` | the main claims. Each sentence holds one or two claims. |
| `Full answer` | the mechanism, the trade-offs and the numbers that support a claim |
| `Wrong answers` | the wrong steps. Each item quotes one wrong answer and gives the reason. |
| `Follow-ups` | the `Expected:` text, only when you grade a follow-up |
| front matter `level` | the depth that the item expects |

Before you grade, write the main claims of `Short answer` as a private list.
Do not show the list.

## The four grades

| Grade | Word | Rule |
|-------|------|------|
| 3 | strong | Every main claim is there, with a reason from `Full answer`. No wrong answer is matched. Each number is from the item or its sources. |
| 2 | working | The first main claim is there and the reason holds. One claim or one trade-off is missing, or each claim is there but a number is unsupported. No wrong answer is matched. |
| 1 | partial | The answer names the right area, but the first main claim is missing or only half right. |
| 0 | missed | The answer matches a wrong answer, or it has no main claim. |

A matched wrong answer caps the grade at 0, even when other parts are right.
Say which wrong answer it matched, then give its reason from the bank.

A hint lowers the grade by one, but never below 0.

At level 3 and 4, a strong answer also names what to measure and the trade-off
it accepts. Without that, the best grade is working.

## Match on meaning

A claim matches when the learner states the same idea in other words. It does
not match when the learner names a term but does not say what it does.

The examples below use a made-up item about a database index, so that no
bank text is in this file.

| Learner says | Claim in the item | Match |
|--------------|-------------------|-------|
| "The lookup reads a few pages of the tree, so it skips the full scan." | "an index lets a lookup skip the full table scan" | yes |
| "Add an index." | "an index lets a lookup skip the full table scan" | no, it names a tool without the mechanism |
| "An index makes every write faster too." | a wrong answer of the same meaning | wrong turn |

## Numbers

A number of 10 or more, or a number with a decimal point, must come from the
item or its named sources. If the learner gives such a number and you cannot
find it, put it in the Unsupported number bucket. Do not correct it from
memory. Say which source to check.

An estimate is not an unsupported number when the learner says it is an
estimate and shows the steps.

## Feedback shape

Use this order. Keep it under eight lines.

1. The level word.
2. Got it: one or two quotes from the learner.
3. Missing: each missing claim, in plain words.
4. Wrong turn: the matched wrong answer and its reason, if any.
5. The `Short answer` from the bank.
6. An offer to show the `Full answer`.

### Good

```text
Partial.
Got it: "the lookup reads a few pages of the tree".
Missing: what each extra index costs on a write.
Short answer: <the Short answer text>
Do you want the full answer, or the first follow-up?
```

### Bad

```text
2/3. Rubric: claim 1 yes, claim 2 no.
The full answer is: <the whole Full answer>
Next: <follow-up> Expected: <expected text>
```

The bad version shows a number, names the rubric, pastes the full answer and
leaks the next expected answer.

## Follow-ups

Grade each follow-up alone, against its `Expected:` text, with the same four
grades. A reply that gives a different cause, which the `Full answer` of the
item supports, is at most partial. Say that the point is valid, then ask for
the cause that the follow-up looks for. Record each follow-up as its own Attempts row, with the item id and
`#f<N>`, where N is its place in the list.
