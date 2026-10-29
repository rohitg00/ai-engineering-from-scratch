# Skills · AI Engineering from Scratch

Canonical page: https://aiengineeringfromscratch.com/skills.html

Install every skill: `npx skills add rohitg00/ai-engineering-from-scratch`. One skill: add `--skill <name>`. Works with Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md.

## 01 Start

Use these once, on your first day with the course.

### start-learning (v1.0.0)

Asks about your goals and time, runs the placement quiz, and writes a study plan the other skills follow.

- Say: "start learning", "set up the course"
- Writes: LEARNING.md
- Install: `npx skills add rohitg00/ai-engineering-from-scratch --skill start-learning`
- Source: https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/skills/start-learning/SKILL.md

### find-your-level (v1.0.0)

A short adaptive quiz that tells you which phase to start in and which lessons you can skip.

- Say: "find my level", "where should I start"
- Writes: Nothing. It prints a starting point.
- Install: `npx skills add rohitg00/ai-engineering-from-scratch --skill find-your-level`
- Source: https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/skills/find-your-level/SKILL.md

### course-guide (v1.0.0)

Give it a topic, a question, or an error. It names the lessons that teach it and the next command to run.

- Say: "which lesson covers RAG", "I am stuck on attention"
- Writes: Nothing. It points you to lessons.
- Install: `npx skills add rohitg00/ai-engineering-from-scratch --skill course-guide`
- Source: https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/skills/course-guide/SKILL.md

## 02 Learn and practise

Use these every session. They read and update your plan.

### learn (v1.0.0)

Teaches your next lesson section by section in the terminal, asks questions, and records what you finished.

- Say: "/learn", "teach me the next lesson"
- Writes: LEARNING.md
- Install: `npx skills add rohitg00/ai-engineering-from-scratch --skill learn`
- Source: https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/skills/learn/SKILL.md

### lesson-screen (v1.0.0)

Opens a screen in your browser next to the terminal. It shows the lesson figure for each step and traces the code with real values. It also builds a figure for your lesson while you learn, from a blueprint to a 3D model. After the quiz, it writes a practice page with a timed drill and spaced review. Without a local browser, it gives you the lesson page instead.

- Say: "open the lesson screen", "build a figure for this lesson"
- Writes: A .lesson-screen folder with each screen it showed
- Install: `npx skills add rohitg00/ai-engineering-from-scratch --skill lesson-screen`
- Source: https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/skills/lesson-screen/SKILL.md

### check-understanding (v1.0.0)

Quizzes you on a phase and tells you which lessons to read again before you move on.

- Say: "quiz me on phase 3", "check my understanding"
- Writes: Nothing. It prints your score and what to review.
- Install: `npx skills add rohitg00/ai-engineering-from-scratch --skill check-understanding`
- Source: https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/skills/check-understanding/SKILL.md

### build-project (v1.0.0)

Guides one stage of a course project per session. It gives hints only. You write the code and run the stage grader.

- Say: "build a project", "continue my project"
- Writes: PROJECTS-LEARNING.md
- Install: `npx skills add rohitg00/ai-engineering-from-scratch --skill build-project`
- Source: https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/skills/build-project/SKILL.md

## 03 Focused paths

Use these to study one topic lesson by lesson.

### learn-mcp (v1.0.0)

One lesson at a time through the Model Context Protocol path: clients, servers, transports, security, gateways, and conformance.

- Say: "teach me MCP", "continue the MCP path"
- Writes: MCP-LEARNING.md
- Install: `npx skills add rohitg00/ai-engineering-from-scratch --skill learn-mcp`
- Source: https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/skills/learn-mcp/SKILL.md

### learn-agent-skills (v1.0.0)

One lesson at a time through the Agent Skills path: write, find, run, secure, test, package, and port skills.

- Say: "teach me agent skills", "continue the skills path"
- Writes: AGENT-SKILLS-LEARNING.md
- Install: `npx skills add rohitg00/ai-engineering-from-scratch --skill learn-agent-skills`
- Source: https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/skills/learn-agent-skills/SKILL.md

### learn-reverse-engineering (v1.0.0)

One lesson at a time through the Reverse Engineering path: read a compiled program you built, decode it, lift it, record evidence, and prove a rebuild equal.

- Say: "teach me reverse engineering", "continue the reverse engineering path"
- Writes: REVERSE-ENGINEERING-LEARNING.md
- Install: `npx skills add rohitg00/ai-engineering-from-scratch --skill learn-reverse-engineering`
- Source: https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/skills/learn-reverse-engineering/SKILL.md

## 04 Certification prep

Use these to prepare for an exam with lessons, labs, and timed practice.

### claude-certification (v1.0.0)

Tutor for the four independent Claude certification tracks: choose a track, learn lesson by lesson, run labs, and take practice exams.

- Say: "prepare for the Claude certification", "resume my certification"
- Writes: CLAUDE-CERTIFICATION.md
- Install: `npx skills add rohitg00/ai-engineering-from-scratch --skill claude-certification`
- Source: https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/skills/claude-certification/SKILL.md

### mcpa-certification (v1.0.0)

Tutor for the Model Context Protocol Associate exam: lessons, practical labs, and practice questions with feedback.

- Say: "prepare for MCPA", "MCPA practice exam"
- Writes: MCPA-CERTIFICATION.md
- Install: `npx skills add rohitg00/ai-engineering-from-scratch --skill mcpa-certification`
- Source: https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/skills/mcpa-certification/SKILL.md

## 05 Make figures and manuals

Use these to make figures and manuals that match this site.

### course-style (v1.0.0)

Colours for light and dark, fonts, figure labels, and the plain technical English rules. The other skills in this group read it.

- Say: "use the course style", "check this text for plain English"
- Writes: Nothing. Other skills read it.
- Install: `npx skills add rohitg00/ai-engineering-from-scratch --skill course-style`
- Source: https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/skills/course-style/SKILL.md

### blueprint-figure (v1.0.0)

Static SVG figures for lessons, READMEs, and manuals. It has nine figure kinds, colour rules, and checks for label size and overlap.

- Say: "draw a figure of the request path", "make FIG_012 for this lesson"
- Writes: An SVG file
- Install: `npx skills add rohitg00/ai-engineering-from-scratch --skill blueprint-figure`
- Source: https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/skills/blueprint-figure/SKILL.md

### motion-figure (v1.1.0)

Animated and interactive figures: SVG animations, slider widgets, figures with controls and a computed result, and dither bands like the one at the top of this page.

- Say: "animate this concept", "show how this system works"
- Writes: A lesson figure, a standalone figure, or a dither band
- Install: `npx skills add rohitg00/ai-engineering-from-scratch --skill motion-figure`
- Source: https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/skills/motion-figure/SKILL.md

### isometric-explainer (v1.0.0)

An interactive isometric machine that shows a process step by step. A tested state model drives it. Controls let you break a part and see what fails.

- Say: "explain how a cache evicts entries as a machine", "make an isometric explainer for this lesson"
- Writes: A standalone HTML page and its source
- Install: `npx skills add rohitg00/ai-engineering-from-scratch --skill isometric-explainer`
- Source: https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/skills/isometric-explainer/SKILL.md

### write-manual (v1.0.0)

A long manual about one tool at one pinned version, with sources, a table of contents, offline captures of every listing, figures, and an audit.

- Say: "write a manual for this tool", "start a 101 manual"
- Writes: A manual folder: manual.json, sections, figures, captures
- Install: `npx skills add rohitg00/ai-engineering-from-scratch --skill write-manual`
- Source: https://github.com/rohitg00/ai-engineering-from-scratch/blob/main/skills/write-manual/SKILL.md

## 06 Lesson artifacts

409 skills and 100 prompts live under `phases/**/outputs/`. Install with `python3 scripts/install_skills.py <target> --phase <n>` or `--tag <tag>`.
