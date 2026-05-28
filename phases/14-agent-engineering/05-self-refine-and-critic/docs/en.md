# Self-RefineとCRITIC: 反復的な出力改善

> Self-Refine（Madaanら、2023）は1つのLLMをgenerate、feedback、refineの3 roleでloopさせる。平均gainは7 tasksで絶対値+20。CRITIC（Gouら、2023）は、verificationを外部toolsへroutingすることでfeedback stepを堅くする。2026年、このpatternはすべてのframeworkで「evaluator-optimizer」（Anthropic）またはguardrail loop（OpenAI Agents SDK）として出荷されている。

**タイプ:** 構築
**言語:** Python（stdlib）
**前提条件:** フェーズ 14 · 01（Agent Loop）、フェーズ 14 · 03（Reflexion）
**時間:** 約60分

## 学習目標

- Self-Refineの3つのprompt（generate、feedback、refine）を述べ、refine promptにhistoryが重要な理由を説明する。
- CRITICの重要な洞察を説明する。外部groundingなしのLLMはself-verificationが信頼できない。
- historyとoptional external verifierを持つstdlib Self-Refine loopを実装する。
- このpatternをAnthropicの「evaluator-optimizer」workflowとOpenAI Agents SDKのoutput guardrailsに対応づける。

## 課題

agentがほぼ正しいanswerを生成する。codeの1行にsyntax errorがあるかもしれない。summaryが長すぎるかもしれない。planがedge caseを見落としているかもしれない。欲しいのは、agentが自分のoutputを批評し、それから修正することである。

Self-Refineは、これがsingle model、training dataなし、RLなしで機能することを示した。ただし落とし穴がある。LLMはhard factsのself-verificationが苦手である。CRITICはその修正を名付けた。verify stepを外部tools（search、code interpreter、calculator、test runner）へroutingする。

この2本の論文は、2026年のiterative improvementのdefaultを定義している。generate、verify（可能ならexternal）、refine、verifierがpassするまで停止しない。

## 考え方

### Self-Refine（Madaanら、NeurIPS 2023）

1つのLLM、3つのrole。

```
generate(task)            -> output_0
feedback(task, output_0)  -> critique_0
refine(task, output_0, critique_0, history) -> output_1
feedback(task, output_1)  -> critique_1
refine(task, output_1, critique_1, history) -> output_2
...
feedbackが「no issues」と言う、またはbudgetを使い切ったら停止する。
```

重要なdetail: `refine`はfull history、つまり過去のすべてのoutputsとcritiquesを見る。これにより同じmistakeを繰り返さない。論文のablationでは、historyを落とすとqualityが大きく低下する。

headlineは、7 tasks（math、code、acronym、dialog）平均で絶対値+20 improvement、GPT-4を含む。trainingなし、external toolsなし、single modelである。

### CRITIC（Gouら、arXiv:2305.11738、v4 2024年2月）

Self-Refineの弱点は、feedback stepがLLM自身による採点であることだ。factual claimsではこれは信頼できない（hallucinationは、それを生成したmodelにはしばしば説得的に見える）。CRITICは`feedback(task, output)`を`verify(task, output, tools)`に置き換える。`tools`には次が含まれる。

- factual claims用のsearch engine。
- code correctness用のcode interpreter。
- arithmetic用のcalculator。
- domain-specific verifiers（unit tests、type checkers、linters）。

verifierはtool resultsにgroundされたstructured critiqueを生成する。refinerはそのcritiqueに条件づけられる。

headline: CRITICはfactual tasksでSelf-Refineを上回る。critiqueがgroundedだからである。external verifierがないtask（creative writing、formatting）では、CRITICはSelf-Refineに縮退する。

### 停止条件

よくある形は2つ。

1. **Verifier passes。** external testがsuccessを返す。利用可能なら推奨（unit tests、type checker、guardrail assertion）。
2. **feedbackなし。** modelが「output is fine」と言う。安いが信頼性は低い。max-iteration capと組み合わせる。

2026年のdefaultは両方を組み合わせることだ。「verifier passes OR model says fine AND iterations >= 2 OR iterations >= max_iterations」で停止する。

### Evaluator-Optimizer（Anthropic、2024）

Anthropicの2024年12月の記事は、これを5つのworkflow patternsの1つとして名付けている。2つのroleがある。

- Evaluator: outputを採点し、critiqueを生成する。
- Optimizer: critiqueをもとにoutputを修正する。

evaluatorがpassするまでloopする。これはAnthropicの枠組みでのSelf-Refine/CRITICである。Anthropicが追加した重要なengineering detailは、modelが単にrubber-stampしないよう、evaluatorとoptimizerのpromptをかなり異なるものにすべきという点である。

### OpenAI Agents SDK output guardrails

OpenAI Agents SDKは、このpatternを「output guardrails」として提供している。guardrailはagentのfinal outputに対して実行されるvalidatorである。guardrailがtripする（`OutputGuardrailTripwireTriggered`をraiseする）と、outputはrejectされ、agentはretryできる。Guardrailsはtoolsを呼べる（CRITIC-style）し、pure functionsにもできる（Self-Refine-style）。

### 2026年の落とし穴

- **Rubber-stamp loops。** 同じmodelが同じprompt styleでgenerationとcritiqueを行うと、「looks good to me」に収束する。構造的に異なるpromptsを使うか、critiqueには小さく安い別modelを使う。
- **Over-refinement。** 各refine passはlatencyとtokensを増やす。1〜3 passesにbudgetする。それ以上はhuman reviewへescalateする。
- **trivial taskでのCRITIC。** external verifierがなければ、CRITICはSelf-Refineへ退化する。stub verifierのためにlatencyを払わない。

## 構築

`code/main.py`はtoy task上でSelf-RefineとCRITICを実装する。topicが与えられたらshort bullet listを生成するtaskである。verifierはformat（3 bullets、各60 chars未満）をcheckする。CRITICは、既知のhallucinationにpenaltyを与える外部「fact verifier」を追加する。

構成要素:

- `generate` - scripted producer。
- `feedback` - LLM-style self-critique。
- `verify_external` - CRITIC-style grounded verifier。
- `refine` - historyをもとにoutputを書き直す。
- Stop condition - verifier passesまたはmax 4 iterations。

実行する。

```
python3 code/main.py
```

Self-Refine runとCRITIC runを比較する。CRITICは、Self-Refineが見逃したfactual errorを捕まえる。external verifierにはself-criticにないgroundingがあるからである。

## 使い方

Anthropicのevaluator-optimizerは、Claude向けの言葉で表したこのpatternである。OpenAI Agents SDKのoutput guardrailsはCRITIC-shapedである（guardrailsはtoolsを呼べる）。LangGraphはSelf-Refineのように読めるreflection nodeを提供する。GoogleのGemini 2.5 Computer Useはper-step safety evaluatorを追加しており、これはCRITIC variantである。すべてのactionがcommit前にverifyされる。

## 出荷

`outputs/skill-refine-loop.md`は、task shape、verifier availability、iteration budgetが与えられたとき、evaluator-optimizer loopを設定する。generator、evaluator/verifier、optimizerのpromptsとstop policyを出力する。

## 演習

1. toyをmax_iterations=1で実行する。CRITICはまだ役立つか。
2. external verifierをnoisyなもの（random 30% false positives）に置き換える。loopはどう振る舞うか。これは2026年の多くのguardrail stackの現実である。
3. 「generator-criticを異なるmodelsにする」variantを実装する。big modelがgenerateし、small modelがcritiqueする。同一modelより良いか。
4. CRITIC Section 3（arXiv:2305.11738 v4）を読む。3つのverification-tool categoriesを挙げ、それぞれの例を出す。
5. OpenAI Agents SDKの`output_guardrails`をCRITICのverifier roleに対応づける。SDKが間違えているところ、正しいところは何か。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|----------------|------------|
| Self-Refine | 「自分を直すLLM」 | 1つのmodelでGenerate -> feedback -> refineをhistory付きでloopする |
| CRITIC | 「Tool-grounded verification」 | feedbackをexternal verifier（search、code、calc、tests）に置き換える |
| Evaluator-Optimizer | 「Anthropic workflow pattern」 | evaluatorが採点し、optimizerが修正する2 roleをconvergenceまでloopする |
| Output guardrail | 「Post-hoc check」 | agentがoutputを生成した後に実行されるOpenAI Agents SDK validator |
| Verify step | 「Critique phase」 | groundedかself-ratedかを決める不可欠なdecision |
| Refine history | 「modelがすでに試したこと」 | prior outputs + critiquesをrefine prompt前半に付ける。落とすとqualityが崩れる |
| Rubber-stamp loop | 「Self-agreement failure」 | same-prompt critiqueが「looks good」を返す。構造的に異なるpromptで直す |
| Stop condition | 「Convergence test」 | verifier passes OR no feedback AND iteration cap。単一条件にしない |

## 参考資料

- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) - 標準論文
- [Gou et al., CRITIC (arXiv:2305.11738)](https://arxiv.org/abs/2305.11738) - tool-grounded verification
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) - evaluator-optimizer workflow pattern
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) - CRITIC-shaped verifierとしてのoutput guardrails
