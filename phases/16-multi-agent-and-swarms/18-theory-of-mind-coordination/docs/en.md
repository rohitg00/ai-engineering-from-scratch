# Theory of Mind と創発的 coordination

> Li et al.（arXiv:2310.10701）は、cooperative text game における LLM agents が **emergent high-order Theory of Mind**（ToM）を示すことを確認した。これは、第三者の beliefs について別の agent が何を信じているかを reasoning する能力である。一方で、context management と hallucination により long-horizon planning では失敗する。Riedl（arXiv:2510.05174）は population 全体の higher-order synergy を測定し、**ToM-prompt condition だけ**が identity-linked differentiation と goal-directed complementarity を生むことを見いだした。lower-capacity LLMs は spurious emergence しか示さない。つまり、coordination emergence は無料ではなく、prompt-conditional かつ model-dependent である。この lesson では、最小の ToM-aware agent を実装し、ToM prompting あり/なしで cooperative task を走らせ、Riedl 2025 protocol に対する coordination delta を測る。

**種別:** 学習 + 構築
**言語:** Python (stdlib)
**前提条件:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 17 (Generative Agents)
**所要時間:** 約75分

## 問題

multi-agent coordination はしばしば魔法のように見える。agents が作業を分担し、互いを予測し、重複を避ける。しかし通常、この「emergence」は prompt engineering の artifact である。誰かが agents に「coordinate」するよう伝えているだけだ。その prompt を外せば coordination も消える。

Riedl の 2025 年の finding はより厳しい。controlled conditions では、agents が **other agents' minds**（ToM）について reasoning するよう prompt された場合にだけ coordination が生じる。ToM prompt がないと、強い models でさえ statistical controls に耐える coordination patterns を示さない。これは production に重要である。teams は prompt-dependent で brittle な「multi-agent coordination」features を ship してしまう。

この lesson は ToM を特定の capability（beliefs about beliefs の reasoning）として扱い、最小の ToM-aware agent を構築し、本物の coordination と prompt dressing の違いを測定する。

## コンセプト

### ToM とは何か

発達心理学では、3 歳児は他者の内面世界が自分と同じだと考える。5 歳児は他者が異なる beliefs を持つことを理解する。7 歳児は beliefs about beliefs（「彼女は、私が ball は cup の下にあると思っている、と考えている」）を reasoning する。これが zeroth、first、second-order ToM である。

LLM agents では、ToM orders は次のように対応する:

- **Zeroth-order:** others の model がない。agent は自分の observations だけに基づいて行動する。
- **First-order:** agent は各 other agent の beliefs の model を持つ。「Alice believes X」。
- **Second-order:** agent は recursive beliefs を model する。「Alice believes that Bob believes X」。

Li et al. 2023 は、cooperative games の LLM agents に first- and second-order ToM が emergent する一方、long horizon と unreliable communication で劣化することを示した。

### Sally-Anne test の要点

1985 年の false-belief test である。Sally が marble を basket A に入れて部屋を出る。Anne がそれを basket B に移す。Sally が戻ったときどこを探すか。first-order ToM を持つ child は basket A と答える（Sally の belief は reality と異なる）。持たない child は basket B と答える。

GPT-4-era LLMs は、plain に出題された Sally-Anne-style tests には合格する。しかし narrative が長い、scene が何度も変わる、question が indirect に phrased されると失敗する。これが 2026 年の production LLMs における実用的な ToM の状態である。

### Riedl の coordination measurement

Riedl（arXiv:2510.05174）は population-scale test を作った: N agents、cooperative objective、可変 prompt conditions。測定するもの:

1. **Identity-linked differentiation。** agents は時間とともに stable role distinctions を発達させるか。
2. **Goal-directed complementarity。** agents の actions は互いを補完する（別 subtasks）か、それとも重複するか。
3. **Higher-order synergy。** group が、どの subset でも達成できないものを達成しているかを測る statistical measure。

結果: ToM prompt condition の下でだけ、3 metrics すべてが baseline を超える signal を出す。ToM prompting がない場合、moderate-capacity models では metrics は chance 付近に留まる。large models は explicit ToM prompting なしでも多少の coordination を示すが、その effect は explicit prompting より小さい。

### coordination illusion

statistical controls がない場合、demos の「emergent coordination」はしばしば次を反映している:

- coordination を焼き込んだ prompt engineering（「work together」と言う system prompts）。
- observer bias（期待する patterns を見てしまう）。
- successful runs の post-hoc selection。

measurable signal なしに「emergent coordination」を売る production systems は marketing として扱うべきである。claim する前に測定する。

### 最小の ToM-aware agent

構造:

```
agent state:
  own_beliefs:    {facts the agent believes}
  other_models:   {other_agent_id -> {beliefs_the_agent_attributes_to_them}}
  actions_last_N: [history of others' actions]

observation update:
  - direct observation から own_beliefs を update
  - action + prior beliefs から other_models[agent_id] を update

action selection:
  - candidate actions を enumerate
  - 各 candidate について、modeled beliefs に基づき each other agent の next action を predict
  - それらの prediction の下で joint outcome を最大化する action を選ぶ
```

`other_models` attribute が ToM state である。First-order ToM は 1 level だけを持つ。Second-order は `other_models[i][other_models_of_j]` を追加する。これは「agent i が agent j の beliefs をどう考えていると私が思うか」である。

### long-horizon がつらい理由

Li et al. は、context limits により agents がどの belief が誰のものかを忘れることを記録している。hallucination は false beliefs を other-agent models に追加する。どちらも「I thought he thought X」errors を生み、時間とともに compound する。

paper と 2024-2026 follow-ups で記録された mitigations:

- **prompt 内の explicit ToM state。** structured format: `{agent_id: belief_list}`。retrieval が identity-belief binding を保つよう強制する。
- **shorter reasoning chains。** turn ごとの ToM updates を減らすと compounding hallucination が減る。
- **external ToM store。** model を LLM context の外に保持し、turn ごとに relevant parts だけを inject する。

### production で ToM が失敗する場所

- **Adversarial settings。** 良い ToM を持つ agents は操作されやすい（相手が自分について何を model しているかを model し、それを exploit できる）。
- **Heterogeneous teams。** models が異なる場合、ある opponent に効く ToM model は generalize しない。
- **Ground-truth-dependent tasks。** ToM は beliefs についてのものだ。correctness が facts に依存するなら、ToM は distractions になり得る。

### 実際に測れる coordination

team の coordination が prompt-dressed ではなく本物であることを示す practical signals は 3 つある:

1. **Complementarity over time。** multi-turn task において agents の actions は disjoint sub-tasks を cover するか。
2. **Anticipation。** turn T+1 の agent A の action は、turn T+2 の B の action に関する prediction に依存し、その prediction は正しかったか。
3. **Correction。** turn T で A が B の belief を読み違えたとき、A は turn T+2 までに correction するか。

これらは logged multi-agent system で測定できる。「coordination」という narrative の substantive version である。

## 実装

`code/main.py` は次を実装する:

- `ToMAgent` — own beliefs と per-other-agent belief models を追跡する。
- cooperative task: 3 agents が 3 boxes から 3 tokens を集める。各 box は 1 token を保持できる。agents は communicate できず、互いの actions から intent を infer する。
- 2 configurations: `zeroth_order`（ToM なし）と `first_order`（1-level belief model の ToM）。
- 200 randomized trials での measurement: completion rate、duplication rate（2 agents が同じ box を狙う）、average turns to completion。

Run:

```
python3 code/main.py
```

期待される出力: zeroth-order agents は約 35% rate で effort を duplicate し、10 turns 内に約 60% の trials を complete する。First-order ToM agents は duplicate 約 5%、complete 約 95%。delta が measurable coordination effect である。

## Use It

`outputs/skill-tom-auditor.md` は「emergent coordination」を主張する multi-agent system を監査する skill である。prompt dressing、control に対する statistical significance、measured complementarity を確認する。

## Ship It

Coordination claims checklist:

- **Control condition。** coordination prompt を外した system version。両方を測る。
- **Statistical test。** metric 上で system と control の difference は `p < 0.05` で significant か。
- **Complementarity measure。** final success だけではなく、time にわたる action-disjointness。
- **Failure-case log。** agents が miscoordinate したとき、ToM state はどう見えるか。
- **Model-capacity disclosure。** smaller models で effect が消えるなら、そのことを言う。

## Exercises

1. `code/main.py` を実行する。first-order ToM が duplication rate を約 7x 下げることを確認する。5 agents / 5 boxes に scale しても gap は残るか。
2. second-order ToM（agent A が B が C についてどう思っているかを model する）を実装する。first-order より改善するか。どんな tasks でか。
3. ToM state に **hallucination** を注入する: turn ごとに belief を 1 つ random に flip する。first-order performance はどれだけ劣化するか。
4. Li et al.（arXiv:2310.10701）を読む。「long-horizon degradation」finding を再現する: turns を 10 から 30 に増やすと、first-order ToM performance はどう変わるか。
5. Riedl 2025（arXiv:2510.05174）を読む。simulation logs に higher-order synergy statistic を実装する。ToM prompt condition なしでも effect は存在するか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Theory of Mind | 「他者の心を理解すること」 | 別 agent の beliefs を model する能力。order（0, 1, 2+）で段階づけられる。 |
| Sally-Anne test | 「false-belief test」 | 1985 年の発達心理学。LLMs は plain versions には通るが complex ones には失敗する。 |
| First-order ToM | 「A believes X」 | facts について 1 人の others の beliefs を model すること。 |
| Second-order ToM | 「A believes B believes X」 | 1 level deeper の recursive modeling。 |
| Identity-linked differentiation | 「時間とともに安定した roles」 | Riedl の metric: roles が random ではなく persist する。 |
| Goal-directed complementarity | 「disjoint actions」 | agents が同じものではなく異なる subtasks を target する。 |
| Higher-order synergy | 「group が任意の subset を超える」 | real coordination に対する Riedl の statistical measure。 |
| Coordination illusion | 「coordinated に見える」 | measurable signal なしの prompt-dressed appearance of coordination。 |

## 参考文献

- [Li et al. — Theory of Mind for Multi-Agent Collaboration via Large Language Models](https://arxiv.org/abs/2310.10701) — cooperative games における emergent ToM と long-horizon failure modes
- [Riedl — Emergent Coordination in Multi-Agent Language Models](https://arxiv.org/abs/2510.05174) — population-scale measurement。ToM prompting が load-bearing condition
- [Premack & Woodruff — Does the chimpanzee have a theory of mind?](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/does-the-chimpanzee-have-a-theory-of-mind/1E96B02CD9850E69AF20F81FA7EB3595) — ToM concept の 1978 年の起源
- [Baron-Cohen, Leslie, Frith — Does the autistic child have a theory of mind?](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/does-the-autistic-child-have-a-theory-of-mind/) — Sally-Anne paper（1985）
