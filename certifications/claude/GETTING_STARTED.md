# Learn Claude Certifications From GitHub

The repository and the website are equal learning surfaces. The website adds
interactive figures and browser progress. GitHub gives your AI coding harness
the lesson source, scenario code, tests, artifacts, quizzes, diagnostics, and
track order it needs to teach you step by step.

## Start With an AI Tutor

Clone the repository so the tutor can run every lab and test:

```bash
git clone https://github.com/rohitg00/ai-engineering-from-scratch.git
cd ai-engineering-from-scratch
```

Claude Code discovers the repository tutor automatically. Start with:

```text
/claude-certification
```

For Codex, Cursor, or another local agent that reads `SKILL.md`, install the
portable course skills:

```bash
npx skills add rohitg00/ai-engineering-from-scratch
```

Then invoke `/claude-certification`. For ChatGPT or any harness that does not
install local skills or support slash commands, attach or open this repository
and paste this prompt:

```text
Read skills/claude-certification/SKILL.md completely. Use it to choose my
Claude certification track, create my learning plan, and teach me one lesson
at a time with the real labs, artifacts, quizzes, and remediation in this repo.
```

The tutor asks about your goal, experience, pace, and whether you want the
track diagnostic. It writes `CLAUDE-CERTIFICATION.md`, then resumes from that
file in later sessions. Each lesson requires you to:

1. explain the decision in your own words;
2. predict and manipulate the lesson scenario;
3. run the checked-in lab and tests;
4. build or defend your own artifact;
5. pass the lesson quiz;
6. remediate weak exam domains before advancing.

Your work belongs under `learning-artifacts/claude/`, separate from the
completed reference artifacts in each lesson.

## Choose a Route

| Track | Best fit | Route | Diagnostic | Full mock |
|-------|----------|-------|------------|-----------|
| CCAO-F | Knowledge work, analysis, validation, and responsible Claude use | [9-lesson route](tracks/ccao-f.json) | [16 questions](assessments/ccao-f/diagnostic.json) | [60 questions](assessments/ccao-f/mock-01.json) |
| CCDV-F | Engineers building and securing Claude applications | [15-lesson route](tracks/ccdv-f.json) | [16 questions](assessments/ccdv-f/diagnostic.json) | [53 questions](assessments/ccdv-f/mock-01.json) |
| CCAR-F | Builders defending Claude Code, Agent SDK, API, MCP, and orchestration choices | [21-lesson route](tracks/ccar-f.json) | [15 questions](assessments/ccar-f/diagnostic.json) | [60 questions](assessments/ccar-f/mock-01.json) |
| CCAR-P | Senior engineers and architects owning discovery through operations | [25-lesson route](tracks/ccar-p.json) | [14 questions](assessments/ccar-p/diagnostic.json) | [63 questions](assessments/ccar-p/mock-01.json) |

The track JSON is the machine-readable source for route order, prerequisite
coverage, domain weights, study plans, and assessment paths. The tutor reads it
instead of guessing from a generic study plan.

## Use Guided No-Code Mode for Associate

CCAO-F does not require software-development experience. Its lessons still ship
Python because a deterministic validator makes the policy, evidence, workflow,
and review rubrics testable. The tutor can run that code for you; you are not
required to write it.

Paste this after installing or opening the tutor:

```text
Start me on CCAO-F in guided no-code mode. Run the local validators for me,
teach every scenario interactively, and help me create each learner-owned
workflow, policy, evidence, or review artifact from my decisions. Do not skip
the practical work or quizzes, and do not require me to write Python.
```

You will still predict outcomes, manipulate scenarios, defend choices, revise
failed artifacts, and take the original assessments. The interface changes;
the evidence standard does not.

## Learn One Lesson Manually

Every certification lesson has the same GitHub contract:

```text
certifications/claude/lessons/NN-lesson/
├── docs/en.md          full lesson and interactive-lab reasoning
├── code/main.py        scenario runner, simulator, scorer, or validator
├── code/tests/         deterministic verification
├── outputs/            completed reference artifact
└── quiz.json           six grounded questions with explanations
```

Open the next lesson path from your selected track. Read `docs/en.md`, predict
the scenario result, then run:

```bash
LESSON=certifications/claude/lessons/27-enterprise-governance-compliance-and-hitl
python3 "$LESSON/code/main.py"
python3 -m unittest discover -s "$LESSON/code/tests" -v
```

Lesson 27 is a governance example: its runnable work validates a policy and
human-review packet. It does not add artificial provider code to a conceptual
topic. Other lessons ship threat models, ADRs, approval flows, evidence
bundles, tool-loop simulators, RAG reports, API lifecycle labs, and capstone
verifiers.

Use `outputs/` as the completed example. Create your own version in
`learning-artifacts/claude/<exam-code>/<lesson-slug>/`, run the validator
against a copy when supported, and record the evidence in
`CLAUDE-CERTIFICATION.md`.

## Run the Whole Local Verification Suite

From the repository root:

```bash
python3 scripts/audit_certifications.py

find certifications/claude/lessons -path '*/code/main.py' -print0 \
  | xargs -0 -n1 env -u ANTHROPIC_API_KEY -u ANTHROPIC_MODEL python3

find certifications/claude/lessons -path '*/code/tests/test_*.py' -print0 \
  | xargs -0 -n1 env -u ANTHROPIC_API_KEY -u ANTHROPIC_MODEL python3
```

The lesson 30 live Messages API test skips unless credentials are explicitly
provided. The default curriculum is local and credential-free. For the
optional wire check, use environment variables only and follow that lesson's
instructions. Never put an API key in source, a prompt, or a learning-state
file.

## Take Assessments From GitHub

Each track declares one diagnostic and one original full mock. An AI tutor can
read the JSON and administer it one question at a time:

- answer `single` questions with one letter;
- answer `multiple` questions with the full set of letters;
- use exact-set scoring with no partial credit;
- keep answers and explanations hidden until submission;
- report raw percentage and per-domain results;
- follow internal lesson references for every miss.

Practice percentages are course scores. They are not Anthropic scaled scores,
credentials, or guarantees of passing.

## Use the Website Too

The same curriculum remains available at
[aiengineeringfromscratch.com/certifications.html](https://aiengineeringfromscratch.com/certifications.html).
Use it for direct-manipulation figures, local browser progress, timers, and
visual assessment remediation. GitHub remains the better surface when you want
an AI tutor to run code, inspect artifacts, and preserve a detailed learning
plan.

For a local website preview:

```bash
node site/build.js
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/site/certifications.html`.

## Independence and Publishing Boundary

This is independent community preparation. It is not affiliated with,
endorsed by, sponsored by, or authorized by Anthropic. It uses public
objectives and original scenarios, does not contain live exam questions, and
does not issue a credential or guarantee a passing result. Check the current
official guide and eligibility rules before registering.

Certification content is published through GitHub and the website. It is
intentionally not included in the repository's EPUB/PDF book workflow because
the labs, assessments, route state, and interactive mechanisms are the course.
