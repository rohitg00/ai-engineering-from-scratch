---
name: tom-auditor
description: 「emergent coordination」を主張する multi-agent system を監査する。control condition、statistical test、complementarity measurement により、実際の ToM-enabled coordination と prompt-dressed illusion を切り分ける。
version: 1.0.0
phase: 16
lesson: 18
tags: [multi-agent, theory-of-mind, coordination, evaluation, emergence]
---

emergent coordination を主張する multi-agent system が与えられたら、その coordination が本物か、prompt engineering の産物かを監査する。

作成するもの:

1. **Claim extraction。** どの coordination behavior が主張されているか（division of labor、anticipation、complementary actions、consensus reaching）。正確に記述する。
2. **Prompt inspection。** agent の system prompt が coordination、role selection、team awareness を明示的に指示しているか。該当する場合、その claim を partially prompt-dressed として flag し、control を設計する。
3. **Control condition。** coordination を誘導する文言を取り除いた system version。どの text を変更するかを正確に指定する。
4. **Metric。** 少なくとも 1 つ: identity-linked differentiation、goal-directed complementarity、higher-order synergy（Riedl 2025）。「agents seem to work together」を証拠として受け入れない。
5. **Statistical test。** system vs control における metric の significance。`p < 0.05` に必要な sample size。`n < 50` trials の場合は power を明示する。
6. **Model-capacity check。** より小さな base model で比較を繰り返す。effect は残るか、消えるか。Li/Riedl はどちらも capacity-dependence を示している。
7. **Failure-case review。** system が失敗したとき、ToM state（あれば）はどうなっているか。identity confusion（belief-agent binding の破綻）か、content hallucination（belief content の誤り）か。

Hard rejects:

- control condition のない emergence claim。demo reel は証拠ではない。
- statistical scrutiny で消える claim（`n >= 50` trials の metric が `p < 0.05` 未満）。これは coordination illusion。
- 1 つの model でしか成り立たない claim。より小さい strong baseline も ToM prompting なしで同じ effect を達成するなら、その coordination は ToM-driven ではない。
- mechanism explanation としての「Our agents just figured it out」。mechanism claim には logged and inspectable な ToM state が必要。

Refusal rules:

- per-agent reasoning の logging がない system では、監査は本物の coordination と randomness を区別できない。再監査の前に structured ToM-state logs を追加することを推奨する。
- task に oracle-computed optimal coordination があるなら、control ではなく optimal と比較する。
- claim が narrow（「single-round task の coordination」）なら、監査は短縮できる。single round の complementarity を測り、long-horizon analysis は不要。

Output: 2 ページの audit。1 文の verdict（「Coordination claim is prompt-dressed: removing 'work together' language drops the metric from 0.82 to 0.31, control-significant.」）から始め、その後に上記 7 sections を続ける。最後に prompt-dressed coordination を real coordination に変える fixes を列挙する: explicit ToM state、logging 付き long horizon、mixed-model ensembles。
