# Red-Teaming: PAIR と自動攻撃

> Chao, Robey, Dobriban, Hassani, Pappas, Wong (NeurIPS 2023, arXiv:2310.08419)。PAIR — Prompt Automatic Iterative Refinement — は、標準的な自動 black-box jailbreak です。red-team system prompt を持つ attacker LLM が target LLM に対する jailbreak を反復的に提案し、自分の chat history に試行と応答を蓄積して in-context feedback として使います。PAIR は通常 20 queries 以内に成功し、GCG (Zou et al. の token-level gradient search) より桁違いに効率的で、white-box access も不要です。PAIR は現在、GCG、AutoDAN、TAP、Persuasive Adversarial Prompt と並び、JailbreakBench (arXiv:2404.01318) と HarmBench の標準 baseline です。

**種別:** 構築
**言語:** Python (stdlib, toy target に対する mock PAIR loop)
**前提条件:** Phase 18 · 01 (instruction-following), Phase 14 (agent engineering)
**所要時間:** 約75分

## 学習目標

- PAIR algorithm を説明する: attacker system prompt、iterative refinement、in-context feedback。
- target が black-box のとき、PAIR が GCG より厳密に効率的である理由を説明する。
- 他の自動攻撃 baseline を4つ (GCG、AutoDAN、TAP、PAP) 挙げ、それぞれの識別的特徴を1つ述べる。
- JailbreakBench と HarmBench の評価 protocol と、それぞれにおける "attack success rate" の意味を説明する。

## 問題

Red-teaming は以前、手作業でした。少数の expert tester が adversarial prompts を作り、どれが機能したかを追跡していました。これは scale しません。attack success rate には統計的サンプルが必要であり、target はモデルリリースごとに動く標的です。PAIR は red-teaming を black-box target に対する最適化問題として operationalize します。

## コンセプト

### PAIR algorithm

入力:
- Target LLM T (攻撃対象モデル)。
- Judge LLM J (応答が jailbreak かを採点する)。
- Attacker LLM A (red-team optimizer)。
- Goal string G: 「[有害な指示] に応答する」。
- Budget K (通常 20 queries)。

k = 1..K についてループ:
1. A に goal G と、これまでの (prompt, response) pairs の history を渡す。
2. A が新しい prompt p_k を出す。
3. p_k を T に送信し、response r_k を受け取る。
4. J が goal に対して (p_k, r_k) を採点する。
5. score >= threshold なら停止する — jailbreak 発見。
6. そうでなければ (p_k, r_k) を A の history に追加し、続ける。

経験的結果 (NeurIPS 2023): GPT-3.5-turbo、Llama-2-7B-chat に対して attack success rate は 50% 超。成功までの平均 queries は 10-20 程度。

### PAIR が効率的な理由

GCG (Zou et al. 2023) は adversarial token suffix を gradient で探索します。white-box model access が必要で、読みにくい suffix を生成します。PAIR は black-box で動作し、モデル間で転移しやすい自然言語攻撃を生成します。PAIR の in-context feedback により、attacker は各拒否から学習できます。GCG には対応する仕組みがありません (新しい token update ごとに過去の進捗を再発見する必要があります)。

### 関連する自動攻撃

- **GCG (Zou et al. 2023, arXiv:2307.15043)。** adversarial suffix を探す token-level gradient search。white-box、transferable、読みにくい文字列を生成。
- **AutoDAN (Liu et al. 2023)。** hierarchical objective に導かれた prompt の evolutionary search。
- **TAP (Mehrotra et al. 2024)。** pruning 付き tree-of-attacks。複数の PAIR-style rollout を分岐させる。
- **PAP (Zeng et al. 2024)。** Persuasive Adversarial Prompts。人間の説得技法を prompt template として符号化する。

### JailbreakBench と HarmBench

どちらも (2024) 評価を標準化します。

- JailbreakBench (arXiv:2404.01318)。OpenAI policy 10カテゴリにわたる100の harmful behaviors。主要 metric は Attack Success Rate (ASR)。judge (GPT-4-turbo、Llama Guard、StrongREJECT など) が必要。
- HarmBench (Mazeika et al. 2024)。7カテゴリ510 behaviors、semantic harm test と functional harm test を含む。33モデルに対して18攻撃を比較。

ASR は通常、固定 query budget で報告されます。攻撃を比較するには budget を揃える必要があります。200 queries の 90% ASR は、20 queries の 85% ASR と比較できません。

### 2026 年の deployment で重要な理由

すべての frontier lab は、リリース前に production model に対して PAIR と TAP を実行しています。ASR trajectories は model cards (Lesson 26) や safety-case appendix (Lesson 18) に出ます。この攻撃は特殊なものではありません。標準インフラです。

### Phase 18 における位置づけ

Lesson 12 は自動攻撃の基礎です。Lesson 13 (Many-Shot Jailbreaking) は相補的な length exploit です。Lesson 14 (ASCII Art / Visual) は encoding attack です。Lesson 15 (Indirect Prompt Injection) は 2026 年 production の attack surface です。Lesson 16 では defensive-tooling 側 (Llama Guard、Garak、PyRIT) を扱います。

## 使ってみる

`code/main.py` は toy PAIR loop を作ります。target は「明白な」有害 prompt を拒否する mock classifier (keyword-filter) です。attacker は rule-based refiner で、paraphrase、roleplay-framing、encoding を試します。judge が response を採点します。keyword filter には約5-15 iterations で成功し、semantic filter には失敗する様子を観察します。

## 成果物

この lesson は `outputs/skill-attack-audit.md` を生成します。red-team evaluation report が与えられたら、どの攻撃 (PAIR、GCG、TAP、AutoDAN、PAP) をどの budget で、どの judge を使い、どの harmful-behaviour set (JailbreakBench、HarmBench、internal) で実行したかを監査します。

## 演習

1. `code/main.py` を実行してください。組み込みの3つの attacker strategy について mean-queries-to-success を測定してください。各 strategy がどの target-defense 仮定を突いているかを説明してください。

2. 4つ目の attacker strategy (例: 別言語への翻訳、base64 encoding) を実装してください。keyword-filter target と semantic-filter target に対する新しい mean-queries-to-success を報告してください。

3. Chao et al. 2023 Figure 5 (PAIR vs GCG comparison) を読んでください。PAIR の効率上の利点があるにもかかわらず、GCG が好まれるシナリオを2つ説明してください。

4. JailbreakBench は固定 goal set に対する ASR を報告します。attack diversity (successful prompts の分散) を測る追加 metric を設計してください。defense evaluation において diversity が重要な理由を説明してください。

5. TAP (Mehrotra 2024) は PAIR を branching + pruning で拡張します。`code/main.py` への TAP-style 拡張を sketch し、計算コストと success-rate の trade-off を説明してください。

## 重要用語

| Term | よく言われる説明 | 実際の意味 |
|------|------------------|------------|
| PAIR | 「自動 jailbreak」 | Prompt Automatic Iterative Refinement; attacker-LLM + judge-LLM loop |
| GCG | 「gradient jailbreak」 | adversarial suffix を探す white-box token-level gradient search |
| Attack success rate (ASR) | 「k queries での jailbreak 率」 | 主要 metric。query budget と judge identity とともに報告する必要がある |
| Judge LLM | 「採点器」 | response が harmful goal を満たすかを grading する LLM |
| JailbreakBench | 「評価」 | tag 付き category を持つ標準化 harmful-behaviour set |
| HarmBench | 「より広い benchmark」 | 510 behaviours、functional + semantic harm tests |
| TAP | 「tree of attacks」 | branching + pruning 付き PAIR。compute は増えるが ASR が上がる |

## 参考文献

- [Chao et al. — Jailbreaking Black Box LLMs in Twenty Queries (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — PAIR paper, NeurIPS 2023
- [Zou et al. — Universal and Transferable Adversarial Attacks on Aligned LLMs (arXiv:2307.15043)](https://arxiv.org/abs/2307.15043) — GCG paper
- [Chao et al. — JailbreakBench (arXiv:2404.01318)](https://arxiv.org/abs/2404.01318) — standardized evaluation
- [Mazeika et al. — HarmBench (ICML 2024)](https://arxiv.org/abs/2402.04249) — broader evaluation
