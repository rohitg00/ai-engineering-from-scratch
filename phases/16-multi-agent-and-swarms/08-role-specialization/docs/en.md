# Role Specialization — Planner, Critic, Executor, Verifier

> 2026 年に最も一般的な multi-agent decomposition は、1 agent が plan し、1 agent が execute し、1 agent が critique または verify する形です。MetaGPT (arXiv:2308.00352) はこれを role prompt に encode した SOP として formalize します。Product Manager、Architect、Project Manager、Engineer、QA Engineer が `Code = SOP(Team)` に従います。ChatDev (arXiv:2307.07924) は designer、programmer、reviewer、tester を "chat chain" でつなぎ、"communicative dehallucination" (agent が不足 detail を明示的に request する) を使います。verifier は load-bearing です。Cemri et al. (MAST, arXiv:2503.13657) は、すべての multi-agent failure が missing or broken verification にたどれることを示しています。PwC は CrewAI で structured validation loop により accuracy が 7× (10% → 70%) 向上したと報告しました。

**種別:** 学習 + 構築
**言語:** Python (stdlib)
**前提条件:** Phase 16 · 04 (Primitive Model), Phase 16 · 05 (Supervisor)
**所要時間:** 約60分

## 問題

generic な multi-agent system は generic な output を出します。group chat にいる 3 人の coder は、同じ mediocre code の 3 variations を書きます。agent を増やし、round を増やしても、quality threshold を越えないことがあります。

fix は more agents ではなく、*different* agents です。distinct role を割り当てます。critic には planner が持たない tool を与えます。verifier には objective test suite を与えます。これで system は、parallel guessing ではなく、grounded correction を持つ internal disagreement を得ます。

## コンセプト

### 4 つの canonical roles

**Planner.** goal を読み、step list または spec を作る。Tools: knowledge retrieval, docs。Output: structured plan。

**Executor.** plan step を 1 つずつ読み、artifact を作る。Tools: 実作業 tool (code compiler, shell, API client)。Output: artifact。

**Critic.** executor output を planner intent と照合して読む。Tools: artifact への read-only access、static analysis。Output: reason つき accept/reject。

**Verifier.** artifact を読み、deterministic check を実行する。Tools: test runner, type checker, schema validator。Output: evidence つき pass/fail。

Critic は subjective、opinionated、多くは LLM-based です。Verifier は objective、deterministic、多くは code-based です。同じ role ではありません。

### MetaGPT の SOP pattern

MetaGPT (arXiv:2308.00352) は software engineering SOP を role prompt として encode します。

- **Product Manager** は PRD を書く。
- **Architect** は system design を作る。
- **Project Manager** は task を分割する。
- **Engineer** は実装する。
- **QA Engineer** は tests を走らせる。

各 role は strict input/output schema を持ちます。role prompt は、その role が何であり、何を *must produce* するかを定義します。`Code = SOP(Team)` という formulation です。deterministic SOP は LLM の team を predictable pipeline に変えます。

### ChatDev の communicative dehallucination

ChatDev は key move を追加します。executor が plan にない specific detail を必要とするとき、続行前に designer へ明示的に質問します。これにより、LLM が detail を plausible に invent する classic failure を防ぎます。

実装: role prompt に「与えられていない specific information が必要な場合、output を作る前に relevant role を名前で指定して質問する」と含めます。

### verifier が最も重要な理由

Cemri et al. (MAST) は 1642 件の multi-agent execution failure を追跡しました。21.3% は verification gap でした。system が、誰も check していない answer を ship したのです。残り 79% も多くは「check はあったが silently fail した、または一度も run されなかった」に戻ります。verification は load-bearing role です。

PwC は (CrewAI deployments, 2025)、structured validation loop の追加で accuracy が 10% から 70% へ上がったと報告しました。1 role で 7× gain です。

### Critic vs verifier

- critic は artifact の quality を review する LLM です。subjective で、plausible prose に騙されます。
- verifier は artifact 上で走る deterministic program です。objective で、evidence つき pass/fail を返します。

両方使います。critic は verifier が言語化できない taste issue を拾います。verifier は runtime に出ないと見えない bug を拾います。

### anti-pattern

system 内のすべての role が LLM で、すべての role output が "looks good to me" になっている状態です。classic MAST failure mode です。pass/fail が LLM ではなく code で決まる verifier を少なくとも 1 つ追加してください。

### Framework mappings

- **CrewAI** — `Agent(role, goal, backstory)` が教科書的な specialization surface。
- **LangGraph** — node に specialized prompt を持たせ、edge が pipeline を enforce する。
- **AutoGen** — GroupChat 内の one-word name を持つ role-specific ConversableAgents。
- **OpenAI Agents SDK** — role-specialized Agents 間の handoff tools。

## 実装

`code/main.py` は simple Python function を作る 4-role pipeline を実装します。

- **Planner** が spec を作る。
- **Executor** が code string を生成する。
- **Critic** (LLM-simulated) が obvious issue を flag する。
- **Verifier** が generated code を sandbox (`exec`) 内で test case に対して実行する。

demo は 2 回走ります。executor が correct code を作る case (critic + verifier が両方 pass) と、executor が off-spec code を作る case (critic は plausible に見えるため bug を見逃し、verifier は test failure で捕まえる) です。

実行:

```
python3 code/main.py
```

## Use It

`outputs/skill-role-designer.md` は task を受け取り、role roster (3-5 roles)、role ごとの input/output schema、verifier check を作ります。agent を framework に wire する前に使います。

## Ship It

Checklist:

- **At least one deterministic verifier.** all-LLM にしない。
- **Explicit I/O schema per role.** planner は prose ではなく spec を返し、executor はその schema を読む。
- **Communicative dehallucination.** info が不足している場合、executor は planner に質問しなければならない。invent しない。
- **Critic/verifier ordering.** critic を先に実行する (安価で design issue を拾う)。verifier を次に実行する (遅いが bug を拾う)。
- **Loop budget.** human escalation 前の critic-executor revision は最大 2 rounds。

## Exercises

1. `code/main.py` を実行し、critic が見逃した bug を verifier が捕まえる様子を観察してください。追加 verifier として static-analysis check (`return` の出現数を数える) を追加してください。runtime test が見逃す何を捕まえますか。
2. 5 番目の role として "requirements analyst" を追加し、user wish を planner-ready spec に翻訳させてください。どの communicative dehallucination request がそこへ上がるべきですか。
3. MetaGPT Section 3 ("Agents") を読んでください。MetaGPT の 5 roles それぞれの input/output schema を列挙してください。
4. ChatDev の chat-chain diagram (arXiv:2307.07924 Figure 3) を読んでください。communicative dehallucination が、そうでなければ infinite になる loop をどこで断ち切っているか特定してください。
5. PwC の 7× accuracy gain は verification loop から来ました。verifier 追加が効かない task を 3 つ仮説として挙げてください。correctness の deterministic check が不可能、または高価すぎる task です。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Role specialization | 「different agents, different jobs」 | planner/executor/critic/verifier role 向けに調整した distinct system prompts。 |
| SOP pattern | 「encoded standard operating procedure」 | MetaGPT の framing。role ごとの strict I/O schema が team を pipeline に変える。 |
| Communicative dehallucination | 「invent する前に質問する」 | detail が missing のとき、executor が作り上げず planner に質問する ChatDev pattern。 |
| Critic | 「LLM reviewer」 | subjective, opinionated reviewer。taste issue を拾う。plausible prose に騙されることがある。 |
| Verifier | 「deterministic check」 | code-based pass/fail。test runner, type checker, schema validator。騙されない。 |
| Verification gap | 「誰も check していない」 | MAST failure の 21.3%。bug を捕まえられる check なしに answer が ship された状態。 |
| Revision loop | 「critic が差し戻す」 | critic rejection が feedback つき executor re-run を発火する。budget が必要。 |
| All-LLM anti-pattern | 「looks good to me」 | すべての role が LLM で deterministic check がない状態。classic MAST failure。 |

## 参考文献

- [Hong et al. — MetaGPT: Meta Programming for Multi-Agent Collaboration](https://arxiv.org/abs/2308.00352) — SOP-as-role-prompt の reference paper
- [Qian et al. — Communicative Agents for Software Development (ChatDev)](https://arxiv.org/abs/2307.07924) — chat chain + communicative dehallucination
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) — MAST taxonomy。verification gap は failure の 21.3%
- [CrewAI docs — Agent roles](https://docs.crewai.com/en/introduction) — production role specification surface
