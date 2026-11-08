# Evidence: cheatsheets/ai-safety.md

P18 = phases/18-ethics-safety-alignment, P19 = phases/19-capstone-projects. C15 = P19/15-constitutional-safety-harness, C82 = P19/82-jailbreak-taxonomy, C83 = P19/83-prompt-injection-detector, C84 = P19/84-refusal-evaluation, C85 = P19/85-content-classifier-integration, C86 = P19/86-constitutional-rules-engine, C87 = P19/87-end-to-end-safety-gate. All doc paths are docs/en.md.

## Architecture: Three checkpoint safety gate (7 nodes)
- in "User prompt": C87/docs/en.md:24
- pre "Pre-gen detector, rules on prompt": C87/docs/en.md:14, 25; C87/code/safety_gate.py:117-119
- llm "Model stream, 4 token chunks": C87/docs/en.md:46; C87/code/mock_llm_stream.py:60
- dur "During-gen filter, 2 chunk buffer": C87/docs/en.md:46; C87/code/safety_gate.py:121-145
- post "Post-gen checks, classifier, rules engine": C87/docs/en.md:14, 29; C87/code/safety_gate.py:147-156
- agg "Aggregate, max severity": C87/docs/en.md:30, 34; C87/code/safety_gate.py:175
- out "Final action, RequestTrace": C87/docs/en.md:31, 44; C87/code/safety_gate.py:93-101
- edges pass, stream, complete, early stop: C87/docs/en.md:26-29, 46

## Flow: PAIR attack loop
1. A reads goal G and history: P18/12-red-teaming-pair-automated-attacks/docs/en.md:33
2. A emits p_k: P18/12-red-teaming-pair-automated-attacks/docs/en.md:34
3. T returns r_k: P18/12-red-teaming-pair-automated-attacks/docs/en.md:35
4. J scores (p_k, r_k): P18/12-red-teaming-pair-automated-attacks/docs/en.md:36
5. score at or above threshold halts: P18/12-red-teaming-pair-automated-attacks/docs/en.md:37
6. append and repeat up to budget K: P18/12-red-teaming-pair-automated-attacks/docs/en.md:30, 38

## Command table: Jailbreak taxonomy (6 rows)
- role-play: C82/docs/en.md:24
- instruction-override: C82/docs/en.md:25
- context-smuggling: C82/docs/en.md:26
- multi-turn-ramp: C82/docs/en.md:27
- encoding-trick: C82/docs/en.md:28
- prefix-injection: C82/docs/en.md:29

## Task table: Tasks in code
- python3 main.py: C82/docs/en.md:67 (same command in C83 to C87 Use It sections)
- detector rule dict: C83/code/rules.py:14
- self.detector.analyze(prompt): C87/code/safety_gate.py:118
- codecs.encode rot_13: C83/code/main.py:113
- classify_refusal(response): C84/code/main.py:54
- self.classifier_router.run(output): C87/code/safety_gate.py:148
- self.rules_fixer.apply: C87/code/safety_gate.py:193
- gate.handle(prompt): C87/code/main.py:68

## Annotated code: Aggregate the signals (14 lines)
- condensed from C87/code/safety_gate.py:160-179. Drops 159 (signals list), 165-166 (low else branch), 171-174 (rules signal, empty check). Second argument of SEVERITY_RANK.get written as 0, the value of SEVERITY_RANK["none"] at line 57.
- comment "return a refusal": C87/docs/en.md:44
- comment "then warn on low, else allow": C87/code/safety_gate.py:180-182

## Concepts: Metrics
- precision: C83/docs/en.md:79
- recall: C83/docs/en.md:80
- F1: C83/code/main.py:65
- under-refusal: C84/docs/en.md:69
- over-refusal: C84/docs/en.md:70
- accuracy: C84/docs/en.md:35
- ECE bins of tenths, weighted by bin size: C84/docs/en.md:37
- ASR with budget and judge: P18/12-red-teaming-pair-automated-attacks/docs/en.md:100

## Concepts: Alignment failure modes
- Goodhart: P18/02-reward-hacking-goodhart/docs/en.md:102
- over-optimization: P18/02-reward-hacking-goodhart/docs/en.md:105
- sycophancy: P18/04-sycophancy-rlhf-amplification/docs/en.md:116
- trigger persistence: P18/07-sleeper-agents-persistent-deception/docs/en.md:95
- alignment faking compliance gap: P18/09-alignment-faking/docs/en.md:99
- Constitutional AI: P18/05-constitutional-ai-rlaif/docs/en.md:102
- AI control trusted editing: P18/10-ai-control-subversion/docs/en.md:108-111
- PGR: P18/11-scalable-oversight-weak-to-strong/docs/en.md:102

## Defaults and numbers
- block_confidence 0.85: C87/code/safety_gate.py:110, 161
- note_confidence 0.5: C87/code/safety_gate.py:111, 163
- buffer_cap 2: C87/code/safety_gate.py:121
- n_bins 10: C84/code/main.py:89
- leakage threshold 0.55: C85/code/classifiers.py:179; trigram overlap C85/docs/en.md:16, 47
- max_words 800: C86/code/rules.yml:68
- PAIR budget K 20: P18/12-red-teaming-pair-automated-attacks/docs/en.md:30
- MSJ 256 shots: P18/13-many-shot-jailbreaking/docs/en.md:41

## Troubleshooting
- regex misses paraphrase, families, normalize, measure: C83/docs/en.md:12, 16, 28
- agent obeys an email, label untrusted, ratify: P18/15-indirect-prompt-injection/docs/en.md:26, 33, 37
- near zero ASR, adaptive attacks: P18/15-indirect-prompt-injection/docs/en.md:43-45
- refuses chemistry homework, measure over-refusal: C84/docs/en.md:12
- prefix injection survives post-hoc check: C87/docs/en.md:14
- ASR budgets not comparable, name the judge: P18/12-red-teaming-pair-automated-attacks/docs/en.md:60, 100
- 256 shots, classifier over full context: P18/13-many-shot-jailbreaking/docs/en.md:41, 55
- input only moderation, layered: P18/29-moderation-systems-openai-perspective-llamaguard/docs/en.md:63, 67

## Abbreviations (glossary)
- PAIR: P18/12-red-teaming-pair-automated-attacks/docs/en.md:98
- GCG: P18/12-red-teaming-pair-automated-attacks/docs/en.md:99
- TAP: P18/12-red-teaming-pair-automated-attacks/docs/en.md:104
- MSJ: P18/13-many-shot-jailbreaking/docs/en.md:97
- ArtPrompt: P18/14-ascii-art-visual-jailbreaks/docs/en.md:85
- IPI: P18/15-indirect-prompt-injection/docs/en.md:87
- IFC: P18/15-indirect-prompt-injection/docs/en.md:90
- ECE: C84/docs/en.md:37, 71

## Questions
- taxonomy turns attacks into histogram and coverage chart: C82/docs/en.md:14
- output classification, one-shot bypass: C85/docs/en.md:14
- maximum severity, block wins, redact + warn is redact: C85/docs/en.md:43
- PAIR black box, in-context feedback: P18/12-red-teaming-pair-automated-attacks/docs/en.md:44
- MSJ same mechanism as ICL: P18/13-many-shot-jailbreaking/docs/en.md:47-49

## Tips
- taxonomy id with every finding: C82/docs/en.md:71
- normalize first, keep raw prompt: C83/docs/en.md:24
- constitution in YAML, version control, separate review: C86/docs/en.md:14
- guard classifier on both sides: P18/16-red-team-tooling-garak-llamaguard-pyrit/docs/en.md:56
- single turn probes nightly, multi-turn campaigns before release: P18/16-red-team-tooling-garak-llamaguard-pyrit/docs/en.md:52, 56
- CVSS 4.0 per jailbreak: C15/docs/en.md:96
