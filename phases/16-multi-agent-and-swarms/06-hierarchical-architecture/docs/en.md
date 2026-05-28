# Hierarchical Architecture and Its Failure Mode

> hierarchical は nested supervisor です。manager agents の下に sub-managers、その下に workers。CrewAI `Process.hierarchical` は textbook version で、`manager_llm` が tasks を動的に delegate し outputs を validate します。LangGraph では `create_supervisor(create_supervisor(...))` が相当します。task が本当に org chart なら自然な pattern です。一方で、managerial looping に最も崩れやすい pattern でもあります。manager agents が work を誤って割り当て、sub-outputs を誤解し、consensus に到達できません。sequential の方が勝つこともよくあります。

**種別:** 学習 + 構築
**言語:** Python (stdlib)
**前提条件:** Phase 16 · 05 (Supervisor Pattern)
**所要時間:** 約60分

## 問題

supervisor pattern が分かると、自然な次の問いは「workers 自身が supervisors だったら?」です。teams には sub-teams があり、companies には departments of departments があります。hierarchical architectures はそれを mirror します。

問題は、LLM managers が human managers と同じではないことです。human manager は reports が何を知っているかについて stable priors を持ちます。LLM manager は context にあるものだけから毎 turn org を再推論します。その context が少し drift するだけで、tree 全体が work を misallocate します。

## コンセプト

### Shape

```
                 Manager
                 ┌─────┐
                 └──┬──┘
           ┌────────┴────────┐
           ▼                 ▼
       Sub-Mgr A         Sub-Mgr B
       ┌─────┐           ┌─────┐
       └──┬──┘           └──┬──┘
         ┌┴──┬──┐          ┌┴──┐
         ▼   ▼  ▼          ▼   ▼
       W1  W2  W3         W4  W5
```

internal node はすべて plan、delegate、synthesize します。work を行うのは leaves だけです。

### 活きる場面

- **Clear org mapping.** real task が departmental ("legal review the doc, finance review the doc, engineering review the doc, then summarize for exec") なら hierarchy は explicit です。
- **Local summarization.** 各 sub-manager は team output を top manager が見る前に synthesize します。top manager は 15 worker outputs ではなく 3 sub-manager summaries を見ます。

### 壊れる場面

2026 post-mortems で繰り返し見つかる 3 failure modes:

1. **Task assignment error.** manager が goal を読み、decomposition を hallucinate し、wrong sub-manager に delegate します。sub-manager は与えられた work に従順に取り組むため、error は top synthesis で初めて surface します。human なら気づけた場所から 1 level 離れています。
2. **Output misinterpretation.** sub-manager が "unable to verify claim X" と返します。top manager が "claim X not confirmed" と summarize します。meaning は level ごとに drift します。
3. **Consensus loops.** 2 sub-managers が disagree します。top manager が reconcile を依頼します。彼らは再び下に delegate します。workers が rerun します。sub-managers は少し違う answers を返します。loop します。CrewAI の `Process.hierarchical` は step limits でこれを guard しますが、その limit 自体が hyperparameter になります。

### 決める問い

sequential (linear pipeline) か hierarchical か。task は本当に independent sub-teams を持つのか、それとも tree のふりをした linear flow なのか。後者なら sequential を使います。前者なら hierarchical を使えますが、explicit reconciliation rules を budget してください。

### CrewAI の実装

`Process.hierarchical` は manager LLM を specialist crews の上に wire します。manager は次を行います。

- top-level task を受け取る
- subtasks を crews に割り当てる
- crew outputs を評価する
- accept、re-delegate、iterate のどれにするか決める

docs: https://docs.crewai.com/en/introduction ("Hierarchical Process" under Core Concepts を参照)。

### LangGraph の実装

LangGraph は nested `create_supervisor` calls を使います。inner supervisor は自分の graph を持ち、outer supervisor は inner graph を opaque node として扱います。これは CrewAI より debugging が cleaner です (各 graph を別々に step できる) が、tree の dynamic reshaping は表現しにくくなります。

reference: https://reference.langchain.com/python/langgraph-supervisor。

## 実装

`code/main.py` は 3-level hierarchy を走らせます。

- top manager: task を "engineering" と "legal" branches に分ける
- engineering sub-manager: "frontend" と "backend" workers に分ける
- legal sub-manager: 1 worker

demo は happy path (everyone agrees) と **perturbed path** を対比します。perturbed path では top manager の decomposition が "legal" を "finance" と mislabel し、その error cascade を観察します。sub-manager は従順に finance work を行い、top synthesizer は finance findings を報告し、元の legal question は unanswered のままです。

実行:

```
python3 code/main.py
```

output は "what was asked" と "what was delivered" を side-by-side で明確に示します。

## Use It

`outputs/skill-hierarchy-fitness.md` は、given task が hierarchical、sequential、flat supervisor のどれに適するかを評価します。inputs は task description、org structure、reconciliation budget。output は pattern recommendation と guard すべき specific failure modes です。

## Ship It

hierarchical を ship するなら:

- **Cap tree depth at 2.** 3 levels だけでもほとんどの errors は observability から隠れます。
- **Explicit reconciliation budget.** top manager が commit する前の max rounds を設定します。通常 2。
- **Provenance on every synthesis.** 各 node の summary は、それを生んだ leaf outputs を cite する必要があります。
- **Alert on decomposition drift.** step ごとに manager の decomposition を log し、user query と diff します。decomposition が query を cover しなくなったら alert します。

## Exercises

1. `code/main.py` を実行し、happy と perturbed を比較する。top output が user question から完全に diverge するまでに何 levels の manager hand-off が必要か?
2. 3rd level (top → sub → sub-sub → worker) を追加する。depth が増えるほど perturbed path が self-correct する頻度と fully diverge する頻度を測る。
3. 各 sub-manager に "canary" worker を実装する。canary には常に original user question を unchanged で尋ねる。canary answer を使って decomposition drift を検出する。canary が synthesized answer と disagree したとき manager はどう反応すべきか?
4. CrewAI の `Process.hierarchical` docs を読む。CrewAI が適用する concrete guardrail (step limit、manager_llm constraint など) を 1 つ特定し、どの failure mode を狙っているか説明する。
5. nested LangGraph supervisors と CrewAI hierarchical を比較する。reconciliation loops を cheaper に検出できるのはどちらか?

## Key Terms

| Term | よくある言い方 | 実際の意味 |
|------|----------------|------------|
| Hierarchical | "Org chart pattern" | supervisors over supervisors。work を行うのは leaves だけ。 |
| Manager LLM | "The boss" | internal node で decompose、assign、validate する LLM。 |
| Decomposition drift | "The boss lost the plot" | top manager の split が original question を cover しなくなること。 |
| Reconciliation loop | "Endless meetings" | sub-managers が disagree し、top が re-delegate し、workers が rerun し、budget exhausted まで loop する。 |
| Depth-2 ceiling | "Don't go deeper than 2 levels" | empirical guardrail。3+ levels では observability が崩れる。 |
| Canary question | "Ground truth at every level" | drift を検出するため、常に original query を unchanged で尋ねる worker。 |
| Provenance chain | "Who said what" | 各 synthesis から、それを生んだ leaf outputs への trace。 |

## 参考文献

- [CrewAI introduction — Process.hierarchical](https://docs.crewai.com/en/introduction) — manager LLM を使う textbook hierarchical
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) — `create_supervisor` による nested supervisor
- [Anthropic engineering — Research system](https://www.anthropic.com/engineering/multi-agent-research-system) — Anthropic が flat supervisor を意図的に選んだ理由
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) — MAST taxonomy。coordination failures section が decomposition drift を記録
