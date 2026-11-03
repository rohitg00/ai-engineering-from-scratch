# Testing this skill

Run these checks after each change to `interview-prep`. A change passes when
the automated tests pass, the blind test passes and one dry run is recorded.

## Automated tests

`node --test site/test_skills_page.js` checks the skill with the other tutor
skills:

- The front matter has the name, a `version` of the form `N.N.N` and a
  description.
- `SKILL.md` has 320 lines or fewer.
- The prose follows the plain technical English rules: no em dash, no en
  dash, no semicolon, no "may" and no word from the banned list.
- Each relative link in the skill points to a real file.
- `agents/openai.yaml` names the skill in its default prompt.
- No span of 24 characters from an answer part of the bank appears in a skill
  file. The answer parts are the ones that the core rule lists.

`diff -r skills .claude/skills` must print nothing.

## Transcript checks

Read a transcript of one session and check each line below. A transcript
fails on the first check that fails.

1. Each reply that asks a question ends with that question.
2. No title, tag, lesson link or answer text comes before the learner's
   reply.
3. Each grade is a level word, and each finding names a bank section.
4. The follow-ups come one at a time, in the bank order.
5. Each gap goes to a target that the item names, with the next action in
   the host form.
6. The state file gets new rows only. No old row changes.
7. No prompt says "rubric", "score" or "points", and the close predicts no
   hire and no pass.

## Blind test

The blind test checks that the skill file alone gives the right behavior.

1. Start a new agent session with no other context. Give it this skill and a
   clone of the repository.
2. Play the learner from a script. Give three answers to the same item: one
   that has every claim, one that has the first claim only, and one that
   matches a wrong answer.
3. The agent must grade them strong, working or partial, and missed. A
   different grade fails the test.
4. Run the seven transcript checks on the session.

Do not tell the agent which answer is which. Do not show it this file.

## Dry run

Run one question and one scenario by hand against the example items in the
bank. Record for each one:

- The item id.
- The reply that asked, and whether it stopped there.
- The learner reply that you used, and the grade.
- The bank sections that each finding names.
- The rows that the run appended to `INTERVIEW-LEARNING.md`.
- Each problem, and the change to the skill that fixes it.
