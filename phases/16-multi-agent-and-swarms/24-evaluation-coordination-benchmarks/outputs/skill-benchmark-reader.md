---
name: benchmark-reader
description: multi-agent benchmark claim を懐疑的に読む。benchmark selection、contamination、baselines、statistical significance、task diversity、cost disclosure の観点で claim を grade する。
version: 1.0.0
phase: 16
lesson: 24
tags: [multi-agent, benchmarks, evaluation, SWE-bench, MARBLE]
---

公開または internal の multi-agent benchmark performance claim が与えられたら、その claim を grade し caveats を表面化する。

作成するもの:

1. **Benchmark + split identification。** どの benchmark（MARBLE、COMMA、MedAgentBoard、AgentArch、SWE-bench Pro、SWE-bench Verified、custom）か。どの split（full、held-out、contamination-cleaned）か。unknown split は disqualifying。
2. **Contamination status。** benchmark は test 対象 model の training cutoff より後か。benchmark が training cutoff より前なら contamination risk を flag し、claim を discount する。
3. **Baseline quality。** Vs single-LLM、vs random、vs prior multi-agent work。vs untuned-same-system は baseline ではなく ablation なので数えない。
4. **Statistical significance。** N trials、confidence interval または standard error、p-value または同等指標。N < 50 trials で statistics のない claim は根拠が弱い。
5. **Task diversity。** 1 task、1 domain、または many か。single-task claims は generalization を意味しない。
6. **Cost disclosure。** task あたり tokens、task あたり wall-clock、task あたり dollar cost。20x cost の 90% solution は business decision である。cost がなければ claim は incomplete。
7. **Letter grade + one-sentence verdict。**

   - **A:** 6 checks すべて pass。claim はおそらく robust。
   - **B:** weakness が 1 つ。claim は caveat 付きで plausible。
   - **C:** weakness が 2 つ。claim は suggestive だが replication が必要。
   - **D:** weakness が 3 つ以上。claim は evidence ではない。
   - **F:** disqualifying issue（undisclosed split の contamination、statistics なし、baseline なし）。

Hard rejects:

- Verified vs Pro を指定せずに「SWE-bench」を引用する claim。40+ point gap があるため、この曖昧な報告は受け入れられない。
- baseline comparison のない claim。「Our system does X%」は数字であって result ではない。
- multi-agent systems で trials が 20 未満の claim。variance が高すぎる。
- cost-unreported な multi-agent system claim。coordination tax は実質的なコストである。

Refusal rules:

- benchmark が public に利用できず、user に internal audit trail もない場合、grade は付けられない。evaluation artifacts の公開を推奨する。
- claim が peer review 中の paper（arXiv preprint、unsubmitted）から来ている場合、replication までは precaution として 1 letter grade 下げる。
- user 自身が claimant として audit を依頼している場合、audit をそのまま実行する。claim が publication ready でない場合は flag する。

Output: 1 ページの grade card。1 文の summary（「Grade: C — good benchmark choice, adequate baselines, but no contamination check and no cost disclosure.」）から始め、その後に上記 7 sections を続ける。最後に「what to fix to raise the grade」の prioritized list を書く。
