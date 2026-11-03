---
id: gate-aggregation-table
title: Walk three requests through the gate's aggregator
card: safety
kind: code-reading
level: 3
roles: [agentic-ai-engineer, applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [coding, system-design]
tags: [safety-gate, aggregation, severity, streaming-filter, trace]
minutes: 12
lessons: [phases/19-capstone-projects/87-end-to-end-safety-gate]
manuals: []
practice: []
cheatsheet: [guardrails-moderation]
related: [safety/output-router-severity, safety/rule-needs-three-parts]
updated: 2026-11-03
---

Read the aggregation step of the safety gate below. Walk three requests through it: a prompt the detector flags above the block threshold, a benign prompt whose stream is cut early, and a benign prompt whose output trips a high severity rule. Then say what this table gets wrong by design.

```python
SEVERITY_RANK = {"none": 0, "low": 1, "medium": 2, "high": 3}

def _aggregate(self, pre, during, post):
    signals = []
    if pre.category != "benign":
        if pre.confidence >= self.block_confidence:
            signals.append(("pre", SEVERITY_RANK["high"]))
        elif pre.confidence >= self.note_confidence:
            signals.append(("pre", SEVERITY_RANK["medium"]))
        else:
            signals.append(("pre", SEVERITY_RANK["low"]))
    if during.terminated_early:
        signals.append(("during", SEVERITY_RANK["medium"]))
    if post is not None:
        signals.append(("post.classifier", SEVERITY_RANK.get(post.classifier_severity, 0)))
        if post.rules_max_severity:
            signals.append(("post.rules", SEVERITY_RANK.get(post.rules_max_severity, 0)))
    if not signals:
        return "allow"
    max_rank = max(rank for _, rank in signals)
    if max_rank >= SEVERITY_RANK["high"]:
        return "block"
    if max_rank >= SEVERITY_RANK["medium"]:
        return "redact"
    if max_rank >= SEVERITY_RANK["low"]:
        return "warn"
    return "allow"
```

## Short answer

The first request blocks before generation: a non benign category at or above the block confidence ranks high, and high maps to block. The second request redacts: early termination is a medium signal on its own, so the partial output ships through the redactors and the fixer. The third blocks: a high rule severity ranks the same as a high classifier severity. By design the table takes the maximum, so signals never add up; three low signals stay a warn, and a medium detector flag next to a medium classifier finding stays a redact.

## Full answer

### The thresholds

The gate sets the block confidence at 0.85 and the note confidence at 0.5. A non benign detector verdict at or above 0.85 is high and blocks before the model runs. Between 0.5 and 0.85 it is medium. Below 0.5 it is low. A benign verdict adds no signal at all.

### Request one: flagged prompt

The detector returns a non benign category above 0.85. The pre generation signal ranks high. The gate never calls the model; it returns a refusal and writes a trace with the detector verdict and no post generation section.

### Request two: benign prompt, stream cut

The detector says benign, so nothing from pre generation. The streaming filter buffers two chunks of four tokens and sweeps a regex of continuation phrases over the window; it matches, terminates the iterator and marks the output as terminated early. That is one medium signal. Post generation runs on the partial text; if the classifier and the rules return none, the maximum is medium and the action is redact: the classifier redactors and the rules fixer run on the partial output, which ships with the trace.

### Request three: benign prompt, high rule

No pre generation signal and no early termination. The classifier router returns none. The rules engine returns a high violation, for example an internal library name in the output. The rules signal ranks high and the action is block, the same as if a classifier had found something high.

### The limits the design accepts

- **No accumulation.** The maximum ignores how many signals fired. Several weak signals that together describe an attack still warn.
- **No weights.** A medium from the detector and a medium from the classifier carry the same weight whatever their track record.
- **A short window.** The streaming filter holds two chunks, so a continuation phrase split across more chunks escapes it; the post generation pass is the backstop, and a prefix injection that only shows after the fact survives a gate that looks only post hoc.
- **Fixed thresholds.** The capstone's exercise proposes a weighted score tripped at a threshold, tuned by sweeping it against the corpus and reading precision and recall per category.

The point of the gate is the per request trace with every checkpoint's verdict, the final action and the latency, not a perfect score on the corpus.

## Follow-ups

- **Level 3:** Why is early termination medium and not high? Expected: a regex match on a two chunk window is weaker evidence than a confirmed high classifier finding; the partial output still goes through redaction.
- **Level 3:** A low detector flag and a low rule violation arrive together. What ships? Expected: a warn with a soft notice; the maximum of two lows is low, and the table does not accumulate.
- **Level 4:** What would a weighted aggregator change, and what does it cost? Expected: signals would add toward a threshold so several weak signals could block; the cost is a tuned threshold, set by sweeping it against the corpus and reading precision and recall per category.
- **Level 4:** What does the two chunk buffer miss, and what catches it? Expected: a continuation phrase split across more chunks than the buffer holds; the post generation pass is the backstop.

## Wrong answers

- "Block whenever any layer fires." Low and medium signals exist so benign prompts with weak matches do not get refused; the table maps them to warn and redact.
- "Set the block threshold low to save model calls." A low threshold turns the detector's middling precision on role play into refusals of creative requests; the capstone blocks at 0.85.
- "The demo exits zero, so the gate caught every attack." The demo is self terminating by design; the trace is the deliverable, and the summary counts show what got through.

## Taught in

The [end to end safety gate capstone](../../../phases/19-capstone-projects/87-end-to-end-safety-gate/) gives the aggregation table, the three checkpoints and the trace.
