---
id: one-regex-is-not-a-detector
title: The injection defense is one regex
card: safety
kind: debug
level: 2
roles: [applied-ai-engineer, agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, design-review]
tags: [prompt-injection, detector, precision, recall]
minutes: 8
lessons: [phases/19-capstone-projects/83-prompt-injection-detector]
manuals: []
practice: []
cheatsheet: [guardrails-moderation]
related: [safety/six-jailbreak-categories]
updated: 2026-11-03
---

A colleague shipped a prompt injection defense last month: one regex that matches "ignore previous instructions". This week a prompt that said "disregard the prior guidance" went through. The colleague wants to add a second regex. What do you ask before anything ships, and what does a detector look like instead?

## Short answer

Ask for the precision and the recall per attack category on a labeled corpus; the current defense was never measured, so nobody knows what it covers. A detector is a function from a prompt to a confidence between zero and one and a best matching category. Build it as layers, a normalize pass, substring rules and token level regexes, with a category and a base score on every rule, and run it against the fixture corpus and a benign set on every change.

## Full answer

### Why the single regex is theater

Nobody knows its precision, its recall or which categories it covers. The next paraphrase misses, the team blames the model, and a second unmeasured patch follows the first. The honest version has measurable behavior.

### The detector shape

A list of rules. Each rule has a name, a category and a score function from prompt to a value in the unit range. A rule fires or it does not; when it fires, its score is its confidence. The aggregator returns a verdict: the highest scoring category and the maximum score in it. No rule firing gives zero and the label benign.

### Three layers, in order

1. **Normalize.** Strip zero width and bidirectional controls, lowercase a working copy, decode base64, rot13 and hex, map leet digits to letters. Keep the raw text next to the copy.
2. **Substring rules.** Hand written phrases such as "ignore previous", "as an unrestricted", "answer starting with", each with a category and a base score.
3. **Regex rules.** Token level patterns that catch families, such as a pattern over the stem of ignore followed by all, prior, previous or earlier. The paraphrase in the question falls to a family rule, not to a second literal.

### The measurement

The metrics runner reads the taxonomy corpus and a benign prompt list. For a category, a true positive is a fixture of that category with a verdict of that category; a false positive is a verdict of that category on a fixture of another category or on benign text; a false negative is a fixture of that category with another verdict or benign. It writes precision, recall and the raw counts per category, and it exposes where the detector is wrong on purpose, such as benign looking role play.

### Where it sits

The detector is one signal among several that a gate composes. It leans toward recall on encoding tricks and instruction override and accepts middling precision on role play, which blurs into creative writing and is handled with other signals.

## Follow-ups

- **Level 2:** Define a false positive for the category instruction override. Expected: the fixture category is something else, or the text is benign, and the verdict category is instruction override.
- **Level 2:** Why keep the rules as data rather than code? Expected: each rule is auditable with a name, a category and a score, and adding one does not change the engine.
- **Level 3:** Why does the detector tolerate more false fires in one category than in the others? Expected: role play attacks blur into legitimate creative requests; the gate adds other signals there while the detector leans toward recall on encoding and override.
- **Level 3:** How do you decide which rule to remove? Expected: count the true positives lost if the rule is removed, for every rule, and sort by that marginal contribution.

## Wrong answers

- "Add the second regex and move on." Unmeasured patches pile up; without precision and recall per category you cannot say what the pair covers.
- "Replace the rules with a model classifier." A classifier is one more signal; the rules are auditable and the metrics runner measures both the same way.
- "The model should have refused anyway." The detector exists so the gate does not depend on one layer; blaming the model is how the first regex got shipped.

## Taught in

The [prompt injection detector capstone](../../../phases/19-capstone-projects/83-prompt-injection-detector/) defines the detector as a measured function and gives the three layers and the per category metrics.
