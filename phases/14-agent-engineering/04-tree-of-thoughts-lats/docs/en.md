# Tree of ThoughtsとLATS: 意図的なsearch

> 1本のchain-of-thought trajectoryにはbacktrackの余地がない。ToT（Yaoら、2023）はreasoningをtreeにし、各nodeでself-evaluationを行う。LATS（Zhouら、2024）は、ToT、ReAct、ReflexionをMonte Carlo Tree Searchの下で統合する。Game of 24は4%（CoT）から74%（ToT）へ上がり、LATSはHumanEvalで92.7% pass@1に到達する。

**タイプ:** 構築
**言語:** Python（stdlib）
**前提条件:** フェーズ 14 · 01（Agent Loop）、フェーズ 14 · 03（Reflexion）
**時間:** 約75分

## 学習目標

- reasoningをsearchとして捉える。nodesは「thoughts」、edgesは「expansions」、valueは「どれだけ有望か」である。
- self-evaluation scoringを持つstdlibのToT-style BFS tree searchを実装する。
- select / expand / simulate / backpropagateを持つtoy LATS MCTS loopへ拡張する。
- searchがtoken multiplierに見合う場面（Game of 24、code generation）と、single trajectoryで十分な場面（simple Q&A）を判断する。

## 課題

chain-of-thoughtはlinear walkである。最初のstepが間違っていると、それ以降のすべてのstepは悪い前提の上で動く。Game of 24（4つのdigitsを+ − × ÷で24にする）では、GPT-4 CoTは4% accuracyに留まる。modelが早い段階で間違ったsubexpressionを選ぶと回復できない。

reasoningに必要なのは、複数の候補を提案し、評価し、有望なものを選び、dead endが現れたらbacktrackする能力である。それがsearchである。Tree of ThoughtsとLATSは、その2つの標準的な定式化である。

## 考え方

### Tree of Thoughts（Yaoら、NeurIPS 2023）

各nodeは一貫した中間step（「thought」）である。各nodeはK個のchild thoughtsへexpandできる。LLMはscoring promptで各nodeをself-evaluateする。searchはtreeを探索する。BFS、DFS、またはbeamである。

```
                     (root: "find 24 from 4 6 4 1")
                    /               |            \
           ("6 - 4 = 2")    ("4 + 1 = 5")    ("4 * 6 = 24")  <- Score: HIGH
              /   \              |                  |
          ...    ...          ...                finish
```

self-evaluationが不可欠な部分である。論文は3つのvariantを示す。`sure / likely / impossible` classification、`1..10` numeric score、candidates間のvote。3つすべてがGame of 24でCoTを大きく上回る（GPT-4で4% -> 74%）。

### LATS（Zhouら、ICML 2024）

LATSはToT、ReAct、ReflexionをMCTSの下で統合する。LLMは3つのroleを果たす。

- **Policy**: candidate next actionsを提案する（ReAct-style）。
- **Value function**: partial trajectoryを採点する（ToT-style self-eval）。
- **Self-reflector**: failure時に自然言語reflectionを書く（Reflexion-style）。それをfuture rolloutsの再seedに使う。

Environment feedback（observations）はvalue functionに混ざるため、searchはmodel opinionだけでなく実際のtool resultsに基づいてinformされる。論文時点の結果は、GPT-4でHumanEval pass@1 92.7%（SOTA）、GPT-3.5でWebShop average 75.9（gradient-based fine-tuningに近い）である。

### MCTSを最小限で

iterationごとに4つのphaseがある。

1. **Select** - UCT（upper confidence bound for trees）を使ってrootからleafへ歩く。
2. **Expand** - policyでK個のchildrenを生成する。
3. **Simulate** - childからpolicyでrolloutし、value function（またはenvironment reward）でleafをscoreする。
4. **Backpropagate** - pathをさかのぼってvisit countsとvalue estimatesを更新する。

UCT formula: `Q(s, a) + c * sqrt(ln N(s) / N(s, a))`。第1項はexploitation、第2項はexplorationである。`c`はtaskごとにtuneする。

### costの現実

searchはtokensを爆発させる。Game of 24のToTはCoTの100〜1000倍のtokensを使う。LATSも似ている。無料ではない。searchは次の場面に限って使う。

- single trajectoryでは明らかに不十分なtask（Game of 24、complex code）。
- wall-clockよりcorrectnessが重要なtask。
- 安価で信頼できるvalue functionがあるtask（codeのunit tests、mathのexplicit target）。

taskにsingle right answerがありevaluatorがnoisyな場合、searchはしばしば状況を悪くする。「良く採点される」wrong answerを見つけてしまうからである。

### 2026年の位置づけ

ほとんどのproduction agentはLATSを実行しない。tool-grounded verification付きのReAct（CRITIC、レッスン05）を実行する。searchが現れるのはspecialized nichesである。

- testsをvalue functionとして実行するcoding agents（HumanEval-style）。
- 複数のquery pathを探索するdeep-research agents。
- LangGraph subgraphs内のplanning-heavy workflows。

AlphaEvolve（レッスン11）は2025年の極端な例である。code上のevolutionary search、machine-checkable fitness、frontier gains（56年ぶりの4x4 matmul改善）を組み合わせる。

## 構築

`code/main.py`は次を実装する。

- stylizedな「arithmetic opsを選ぶ」task上のtiny ToT BFS。
- 同じtask上のtoy LATS MCTS loop（Select / Expand / Simulate / Backpropagate）とUCT selection。
- symbolic scoreとself-eval scoreを合成するvalue function。

実行する。

```
python3 code/main.py
```

traceは、ToTがBFSでnodeあたり3 candidatesをexpandする様子と、LATSがMCTSでbest rolloutへ収束する様子を比較して示す。両方のtoken countsもprintされる。

## 使い方

LangGraphはToT-style explorationをsubgraph patternとして提供している。LangChain teamのLATSに関するblog（2024年5月）がreference tutorialである。LlamaIndexは`TreeOfThoughts` agentを提供する。2026年のほとんどのproduction agentでは、このpatternは`if task_complexity > threshold: use_search()` gateの背後に置かれる。レッスン05のevaluator-optimizer patternを参照。

## 出荷

`outputs/skill-search-policy.md`は、task shape、budget、evaluator fidelityが与えられたとき、linear ReAct、ToT、LATS、evolutionary searchのどれを選ぶか決める。

## 演習

1. toy LATSをUCT c=0.1とc=2.0で実行する。traceでは何が変わるか。
2. value functionをよりnoisyなscorerに置き換える（random jitterを追加）。MCTSはまだbest leafを見つけるか。許容できるsignal-to-noiseの最小値はどれくらいか。
3. beam-search ToTを実装する（各levelでtop-kを保持）。BFSと比較する。tight token budgetではどちらが良いか。
4. LATS Section 5.1を読む。HumanEval trajectory countを再現する。報告されたpass@1に到達するには何rollouts必要か。
5. LATS論文の「when LATS helps less」に関するdiscussionを読む。task shapeをsearch strategyに対応づける1段落のdecision ruleを書く。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|----------------|------------|
| Tree of Thoughts | 「Branching CoT」 | Yaoら。self-evaluation付きthought nodeのtree |
| LATS | 「LLM向けMCTS」 | Zhouら。ToT + ReAct + ReflexionをMCTS下で統合する |
| UCT | 「Upper confidence bound」 | exploitation（Q）とexploration（ln N / n）をbalanceするselect formula |
| Value function | 「このstateはどれだけ良いか」 | prompted LLM scoreまたはenvironment reward。backpropへ渡される |
| Policy | 「Action proposer」 | ReAct-style generator。candidate next thoughts/actionsを出す |
| Rollout | 「Simulated trajectory」 | policyを使いnodeからleafへ歩き、valueでscoreする |
| Backpropagate | 「ancestorsを更新する」 | leafのrewardをpath上へ押し戻し、visit countsとQを更新する |
| Search cost | 「Token explosion」 | Game of 24ではCoTの100〜1000倍。採用前にbudgetを決める |

## 参考資料

- [Yao et al., Tree of Thoughts (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) - 標準論文
- [Zhou et al., LATS (arXiv:2310.04406)](https://arxiv.org/abs/2310.04406) - Reflexion feedback付きMCTS
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) - search向けsubgraph patterns
- [AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) - programmatic evaluators付きevolutionary search
