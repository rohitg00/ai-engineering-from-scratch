# Benchmarks: WebArena and OSWorld

> WebArenaは4つのself-hosted appにまたがるweb-agent capabilityをテストします。OSWorldはUbuntu、Windows、macOSにまたがるdesktop-agent capabilityをテストします。release時点 (2023–2024) では、どちらもbest-in-class agentと人間の間に大きなgapを示しました。gapは縮まっていますが、failure modesは変わっていません。

**種別:** 学習
**言語:** Python (stdlib)
**前提条件:** Phase 14 · 19 (SWE-bench, GAIA)
**所要時間:** 約60分

## Learning Objectives

- WebArenaの4つのself-hosted appと、execution-based evaluationが重要な理由を説明する。
- OSWorldがaccessibility APIsではなくreal OS screenshotsを使う理由を説明する。
- OSWorldの主要な2つのfailure modes、GUI groundingとoperational knowledgeを挙げる。
- OSWorld-GとOSWorld-Humanがbase benchmarkに何を追加するのかを要約する。

## 問題

Generalist agentはtoolを呼び出せます。では、browserを20 click操作してshopping checkoutを完了できるでしょうか。keyboardとmouseだけでLinux boxを設定できるでしょうか。WebArenaとOSWorldは、こうした問いに答えるbenchmarkです。

## The Concept

### WebArena (Zhou et al., ICLR 2024)

- 4つのself-hosted web appにまたがる812個のlong-horizon tasks: shopping site、forum、GitLab-like dev tool、business CMS。
- 追加utilities: map、calculator、scratchpad。
- 評価はgym APIsによるexecution-basedです。orderはplaceされたか、issueはcloseされたか、CMS pageはupdatedされたか。
- release時点: best GPT-4 agentは14.41% success、人間は78.24%。

self-hostedという構成が重要です。target appがpinされreproducibleなので、benchmarkがflakyになりません。

### Extensions

- **VisualWebArena** — image interpretationにsuccessが依存する、visually grounded tasks (screenshotをfirst-class observationとして扱う)。
- **TheAgentCompany** (Dec 2024) — terminal + codingを追加し、実際のremote-work environmentに近づけたもの。

### OSWorld (Xie et al., NeurIPS 2024)

- Ubuntu、Windows、macOSにまたがる369個のreal computer tasks。
- 実applicationをfree-formなkeyboard/mouse controlで操作する。
- observationは1920×1080 screenshots。
- release時点: best modelは12.24%、人間は72.36%。

### Primary failure modes

1. **GUI grounding。** Pixel → element mapping。modelは1920×1080内のUI elementを信頼性高くlocalizeするのに苦戦します。
2. **Operational knowledge。** どのmenuにsettingがあるか、どのkeyboard shortcutか、どのpreference paneか。人間が何年もかけて積むknowledge tailです。

### Follow-ups

- **OSWorld-G** — 564-sample grounding suite + Jedi training set。groundingをplanningから分解し、別々に測れるようにします。
- **OSWorld-Human** — 手動でcurateしたgold action trajectories。top agentが必要以上に1.4-2.7x多いstepを使うことを示します (trajectory-efficiency gap)。

### Why this matters

Claude computer use、OpenAI CUA、Gemini 2.5 Computer Use (Lesson 21) はすべて、WebArenaとOSWorldが形作ったworkloadでtrainされています。benchmarkはtargetであり、production modelはshipされたanswerです。

### Where benchmarking goes wrong

- **Screenshot-only evals。** OSWorldはscreenshot-drivenです。DOMやaccessibility APIsを使うagentをOSWorldで評価すると、grounding challengeを測りそこねます。
- **Ignoring trajectory length。** success-rateだけでscoreすると、OSWorld-Humanが示す1.4-2.7xのstep inefficiencyを見逃します。
- **Stale self-hosted apps。** WebArenaのappはspecific versionにpinされています。re-curationなしにupdateするとcomparabilityが壊れます。

## 実装

`code/main.py`はtoy web-agent harnessを実装しています。

- minimalな"shopping app" state machine: list_items、add_to_cart、checkout。
- 3 task分のgold trajectories。
- 各taskを試すscripted agent。
- execution-based evaluator (state check) とtrajectory-efficiency metric (steps vs gold)。

実行:

```
python3 code/main.py
```

Output: task別success rateとtrajectory efficiency。OSWorld-Humanのmethodologyを反映しています。

## Use It

- **WebArena Verified** をinternal clusterでself-hostし、continuous evaluationに使う。
- **OSWorld** はdesktop agent向けにVM fleetで使う。
- **Computer-use agents** (Lesson 21) — Claude、OpenAI CUA、Gemini — はすべて、このようなworkloadでtrainされている。
- **Your own product flows** — top 20 tasksのgold trajectoriesをcaptureし、weeklyでagentを走らせる。

## Ship It

`outputs/skill-web-desktop-harness.md`は、execution-based evalとtrajectory efficiency metricを備えたweb/desktop agent harnessを構築します。

## Exercises

1. toy harnessに2つ目のapp (forum) を追加する。3 tasksとgold trajectoriesを書く。
2. task別trajectory-efficiency reportingを追加する。toy上でagentはgoldの1x、2x、3xのどれか。
3. "distractor" tool、つまりgold trajectoryでは一切使わないtoolを実装する。scripted agentは誘惑されるか。
4. OSWorld-Gを読む。自分のevalsでgrounding failureとplanning failureをどう分離するか。
5. WebArenaのapps READMEを読む。pinされたapp versionの1つをupgradeすると何が壊れるか。

## Key Terms

| Term | よくある言い方 | 実際の意味 |
|------|----------------|------------|
| WebArena | "Web agent benchmark" | 4つのself-hosted appにまたがる812 tasks。gym-style evaluation |
| VisualWebArena | "Visual WebArena" | visually grounded WebArena。screenshotがobservation |
| OSWorld | "Desktop agent benchmark" | real Ubuntu/Windows/macOS上の369 tasks |
| GUI grounding | "Pixel-to-element mapping" | 1920x1080内でmodelがUI elementをlocalizeすること |
| Operational knowledge | "OS know-how" | どのmenu、どのshortcut、どのpreference paneか |
| OSWorld-G | "Grounding suite" | 564件のgrounding-only samples + training set |
| OSWorld-Human | "Gold trajectories" | efficiencyを測るためのmanual expert action sequences |
| Trajectory efficiency | "Steps over gold" | agent step countをhuman minimumで割った値 |

## 参考文献

- [Zhou et al., WebArena (arXiv:2307.13854)](https://arxiv.org/abs/2307.13854) — four-app web benchmark
- [Xie et al., OSWorld (arXiv:2404.07972)](https://arxiv.org/abs/2404.07972) — cross-OS desktop benchmark
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) — Claude's benchmark-shaped capability
- [OpenAI, Computer-Using Agent](https://openai.com/index/computer-using-agent/) — OSWorld and WebArena numbers
