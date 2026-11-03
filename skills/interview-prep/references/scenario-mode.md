# Scenario mode

A scenario is an incident from a measured run. The learner reads the evidence
one listing at a time, as in a debugging round. The learner commits to a
cause before the bank shows the cause.

## Read first

Read the whole `interviews/scenarios/<id>/README.md` and every file in its
`evidence/` folder. The front matter key `system` gives the version, the
model and the hardware. Show `system` with the `Situation`.

| Section | When the learner sees it |
|---------|--------------------------|
| `Situation` | step 1 |
| `Evidence` | one listing per step, in the list order |
| `Questions` | one at a time, after the step that they need |
| `Walkthrough` | after the committed hypothesis |
| `Resolution` | after the committed hypothesis |
| `Wrong turns` | after the grade, and only the ones that the learner took |
| `Generalize` | at the close of the scenario |
| `Taught in` | with the gap routes |

## Steps

### 1. Situation

Show the `system` values and the `Situation` text. Then ask: "What is your
first hypothesis, and what do you want to see first?" Stop.

If question 1 of `Questions` asks for causes before the evidence, ask it here
in place of the question above. Grade it in step 3 with the other questions.

Done when: the learner has named a hypothesis and a thing to check.

### 2. Evidence, one listing at a time

Show the next listing from the `Evidence` list. Give its `title` and its
`note` header, then the listing in a fenced block with its `lang`. Do not
skip a listing. Do not show two listings in one reply. Do not change a line
of a listing.

After each listing, ask: "What does this show, and does it change your
hypothesis?" Stop.

When the learner asks for a listing that is later in the list, say that the
listing is not open yet and show the next one.

Done when: each listing has a reply from the learner, and you have recorded
each change of hypothesis.

### 3. Questions

Ask the numbered `Questions` one at a time. If you asked question 1 in step
1, do not ask it again: grade the step 1 reply and start at question 2. Ask a
question after the listing that it needs. If a question needs no listing, ask it after the last one.
Grade each reply with [grading](grading.md), against the parts of
`Walkthrough` and `Resolution` that answer it.

### 4. Commit

Before you show the cause, ask: "State the cause in one sentence, and the
measurement that proves the fix." Stop. Record the reply as written.

Done when: the learner has stated one cause and one measurement.

### 5. Grade and reveal

Grade the committed cause against `Resolution`, and the path against
`Walkthrough`. Then show the `Resolution`. Show the `Walkthrough` when the
learner asks for it. Show each item from `Wrong turns` that the learner took,
with its reason.

### 6. Generalize

Ask: "Where else does this rule apply?" Stop. Then show `Generalize`, and
route the gaps with [routing](routing.md).

## Hypothesis log

Keep a short private log for the session:

```text
step 1  hypothesis: <words>  wants: <check>
step 2  listing: <name>  reading: <words>  change: yes or no
commit  cause: <words>  proof: <measurement>
```

Write one Attempts row with mode `scenario` and the grade of the committed
cause. Put the number of hypothesis changes in the `Note` cell.

## Good and bad steps

| Bad | Good |
|-----|------|
| Shows all the evidence files in one reply. | Shows the first listing and stops. |
| "Look at line 4, where the cap is too low." | Gives the `note` header as written and asks what the listing shows. |
| Shows the `Resolution` when the learner seems stuck. | Asks which listing they want to read again. |
| Shortens a long log line to fit. | Shows the listing byte for byte. |
