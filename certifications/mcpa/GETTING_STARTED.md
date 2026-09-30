# Learn the MCPA Certification From GitHub

The repository and the website are equal learning surfaces. The website adds
interactive figures and browser progress. GitHub gives your AI coding harness
the lesson source, scenario code, tests, artifacts, quizzes, diagnostics, and
route order it needs to teach you step by step.

## Start With an AI Tutor

Clone the repository so the tutor can run every lab and test:

```bash
git clone https://github.com/rohitg00/ai-engineering-from-scratch.git
cd ai-engineering-from-scratch
```

Claude Code discovers the repository tutor automatically. Start with:

```text
/mcpa-certification
```

For Codex, Cursor, or another local agent that reads `SKILL.md`, install the
portable course skills:

```bash
npx skills add rohitg00/ai-engineering-from-scratch
```

Then invoke `/mcpa-certification`. For ChatGPT or any harness that does not
install local skills or support slash commands, attach or open this
repository and paste this prompt:

```text
Read skills/mcpa-certification/SKILL.md completely. Use it to prepare me for
the MCPA certification, create my learning plan, and teach me one lesson at a
time with the real labs, artifacts, quizzes, and remediation in this repo.
```

The tutor asks about your MCP experience, your pace, and whether you want the
diagnostic now. It writes `MCPA-CERTIFICATION.md`, then resumes from that file
in later sessions. Each lesson requires you to:

1. explain the decision in your own words;
2. predict and manipulate the lesson scenario;
3. run the checked-in lab and tests;
4. build or defend your own artifact;
5. pass the lesson quiz;
6. remediate weak exam domains before advancing.

Your work belongs under `learning-artifacts/mcpa/`, separate from the
completed reference artifacts in each lesson.

## The Track

MCPA is one track, not a menu of options.

| Field | Value |
|-------|-------|
| Exam code | MCPA |
| Credential | Model Context Protocol Associate |
| Provider | Agentic AI Foundation, via Linux Foundation Training and Certification |
| Level | Beginner, vendor-neutral |
| Protocol revision | 2026-07-28, the stateless core, summarized with sources in [the protocol brief](research/mcp-2026-07-28-brief.md) |
| Route | [34-lesson route](tracks/mcpa-f.json) |
| Diagnostic | a 30-question diagnostic at `assessments/mcpa-f/diagnostic.json` |
| Full mocks | three 60-question original mocks, `mock-01.json`, `mock-02.json`, and `mock-03.json` in `assessments/mcpa-f/` |

The track JSON is the machine-readable source for route order, domain
weights, and the assessment paths it declares. The tutor reads it instead of
guessing from a generic study plan.

## Use Guided No-Code Mode for MCPA

MCPA does not require software-development experience; it is a knowledge
exam. Its lessons still ship Python because a deterministic mock and
validator make the protocol behavior, schema, lifecycle, and consent rubrics
testable. The tutor can run that code for you; you are not required to write
it.

Paste this after installing or opening the tutor:

```text
Start me on MCPA in guided no-code mode. Run the local mocks and validators
for me, teach every scenario interactively, and help me create each
learner-owned artifact from my decisions. Do not skip the practical work or
quizzes, and do not require me to write Python.
```

You will still predict outcomes, manipulate scenarios, defend choices, revise
failed artifacts, and take the original assessments. The interface changes;
the evidence standard does not.

## Learn One Lesson Manually

Every certification lesson has the same GitHub contract:

```text
certifications/mcpa/lessons/NN-lesson/
├── docs/en.md          full lesson and interactive-lab reasoning
├── code/main.py        scenario runner, simulator, scorer, or validator
├── code/tests/         deterministic verification
├── outputs/            completed reference artifact
└── quiz.json           six grounded questions with explanations
```

Open the next lesson path from the route. Read `docs/en.md`, predict the
scenario result, then run:

```bash
LESSON=certifications/mcpa/lessons/14-multi-round-trip-requests-and-elicitation
python3 "$LESSON/code/main.py"
python3 -m unittest discover -s "$LESSON/code/tests" -v
```

Lesson 14 is a multi round-trip example: a deploy tool answers with
`input_required`, asks a human to confirm through elicitation, and only
deploys when the retry arrives with a new request id and the server's
`requestState` echoed intact. Its runner also shows a tampered, expired,
replayed, and retargeted `requestState` each being refused. It does not add
artificial provider code to a conceptual topic. Other lessons ship schema
validators, a discovery and caching runner, error-channel and lifecycle
mocks, an OAuth flow model, an audit-chain checker, and a full capstone
exchange verifier.

Use `outputs/` as the completed example. Create your own version in
`learning-artifacts/mcpa/<lesson-slug>/`, run the validator against a copy
when supported, and record the evidence in `MCPA-CERTIFICATION.md`.

## Run the Whole Local Verification Suite

From the repository root:

```bash
python3 scripts/audit_certifications.py

find certifications/mcpa/lessons -path '*/code/main.py' -print0 \
  | xargs -0 -n1 python3

find certifications/mcpa/lessons -path '*/code/tests/test_*.py' -print0 \
  | xargs -0 -n1 python3

python3 scripts/check_mcpa_wire.py
```

The wire checker imports every lesson's transcript and flags any message
that lacks the 2026-07-28 shape: a request without its protocol version and
client capabilities in `_meta`, a result without `resultType`, a legacy
method such as `initialize` presented as current, or an error code the
specification does not define.

Every MCPA lab is an offline standard-library mock. None of them call a
network API or need a key, and none has a live-wire mode. The suite is fully
local and credential-free by design.

## Take Assessments From GitHub

The `mcpa-f` track declares one diagnostic and three original full mocks.
Each mock leans on a different skill: operational scenarios, wire-level
messages, and design and security trade-offs. Use a mock you have not seen
for each retake. An AI tutor can read the JSON and administer it one
question at a time:

- answer `single` questions with one letter;
- answer `multiple` questions with the full set of letters;
- use exact-set scoring with no partial credit;
- keep answers and explanations hidden until submission;
- report raw percentage and per-domain results;
- follow internal lesson references for every miss.

Practice percentages are course scores. They are not official MCPA scores,
credentials, or guarantees of passing, and the official item count and
passing score are not published, so practice results cannot predict an
official outcome.

## Use the Website Too

The same curriculum is available on the website at
[aiengineeringfromscratch.com/certification?id=mcpa-f](https://aiengineeringfromscratch.com/certification?id=mcpa-f).
Use it for direct-manipulation figures, local browser progress, timers, and
visual assessment remediation. GitHub remains the better surface when you want
an AI tutor to run code, inspect artifacts, and preserve a detailed learning
plan.

For a local website preview:

```bash
node site/build.js
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/site/certification.html?id=mcpa-f`.

## Independence and Publishing Boundary

This is independent community preparation. It is not affiliated with,
endorsed by, sponsored by, or authorized by the Agentic AI Foundation or the
Linux Foundation. It derives its objectives from the published domain and
sub-competency names and the MCP specification, uses original scenarios, does
not contain live exam questions, and does not issue a credential or guarantee
a passing result. Check the current official page and eligibility rules
before registering.

Certification content is published through GitHub and the website. It is
intentionally not included in the repository's EPUB/PDF book workflow because
the labs, assessments, route state, and interactive mechanisms are the
course.
