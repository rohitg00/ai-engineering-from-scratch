# Handoffs and Routines — Stateless Orchestration

> OpenAI の Swarm (2024 年 10 月) は multi-agent orchestration を2つの primitive に絞った。**routines** (system prompt としての instructions + tools) と **handoffs** (別の Agent を返す tool) だ。state machine も branching DSL もない。LLM が適切な handoff tool を呼ぶことで route する。OpenAI Agents SDK (2025 年 3 月) は production successor である。Swarm 自体は、今でも最も明快な概念参照だ。source 全体が数百行に収まる。この pattern が広がった理由は、API surface がほぼ「agent = prompt + tools; handoff = agent を返す function」だからだ。制限: stateless なので memory は caller 側の責任になる。

**種別:** 学習 + 構築
**言語:** Python (stdlib)
**前提条件:** Phase 16 · 04 (Primitive Model)
**所要時間:** 約60分

## 問題

あらゆる multi-agent framework は独自 DSL を学ばせようとする。LangGraph の nodes と edges、CrewAI の crews と tasks、AutoGen の GroupChat と managers。DSL は本物の抽象化だが、対象を必要以上に重く感じさせる。

Swarm は逆方向に進む。model がすでに持つ tool-calling capability を使う。handoff は tool call になる。orchestrator は現在 conversation を持っている agent だ。state machine は agent の system prompt に暗黙に含まれる。

## コンセプト

### Two primitives

**Routine.** agent の role と利用可能な tool を定義する system prompt。scoped instruction set と考えるとよい: 「あなたは triage agent である。user が refund について尋ねたら refund agent に hand off する」。

**Handoff.** agent が呼べる tool で、new Agent object を返す。Swarm runtime は Agent return value を検出し、次の turn の active agent を切り替える。

抽象化はこれだけだ。

```
def transfer_to_refunds():
    return refund_agent  # Swarm sees Agent return → switch active agent

triage_agent = Agent(
    name="triage",
    instructions="Route the user to the right specialist.",
    functions=[transfer_to_refunds, transfer_to_sales, transfer_to_support],
)
```

triage agent の system prompt が user message に基づいて適切な handoff を選ばせる。LLM の tool-calling が routing を行う。

### Why it is viral

- **Small API.** 学ぶ概念は2つ。
- **model がすでにできることを使う。** tool calling は provider をまたいで production-grade になっている。
- **state-machine burden がない。** graph を記述しない。agent prompt が、誰に hand off するかを記述する。

### The stateless trade

Swarm は run 間で明示的に stateless である。framework は run 中の message history を保持するが、何も persist しない。memory、continuity、long-running tasks はすべて caller の責任になる。

production 版 (OpenAI Agents SDK、2025 年 3 月) で主に変わった点の1つがこれだ。SDK は handoff primitive を保ったまま、built-in session management、guardrails、tracing を追加する。

### When Swarm/handoffs fit

- **Triage patterns。** front-line agent が user を specialist に route する。
- **Skill-based handoffs。** 「task に code が必要なら coder を呼ぶ。research が必要なら researcher を呼ぶ」。
- **Short, bounded conversations。** customer support、FAQ-to-ticket、simple workflows。

### When Swarm struggles

- **shared memory を持つ long sessions。** handoff は conversation state を新しい agent の prompt + history に reset する。caller-managed memory なしでは agent 間で persistent state を持てない。
- **Parallel execution。** handoff は1回に1つ。active agent が切り替わるだけだ。parallelism には caller が複数の Swarm run を orchestrate する必要がある。
- **Audit and replay。** stateless run を正確に replay するのは難しい。LLM の handoff choice は deterministic ではない。

### OpenAI Agents SDK (March 2025)

production successor は次を追加する:

- **Session state.** run をまたぐ persistent thread。
- **Guardrails.** input/output validation hook。
- **Tracing.** すべての tool call と handoff を log する。
- **Handoff filters.** handoff 時にどの context を transfer するかを制御する。

handoff primitive は残り、その周りに production ergonomics が追加される。

### Swarm vs GroupChat

どちらも LLM-driven routing を使うが、違いは **誰が next を選ぶか** だ:

- GroupChat: selector (function または LLM) が外側から next speaker を選ぶ。
- Swarm: current agent が handoff tool を呼び、自分の successor を選ぶ。

Swarm は「agent が次を決める」。GroupChat は「manager が次を決める」。Swarm の decision は active agent の tool call にあり、GroupChat の decision は `GroupChatManager` にある。

## 実装

`code/main.py` は Swarm を scratch で実装する。Agent dataclass、handoff mechanism (tool が Agent を返す)、agent switch を検出する run loop を含む。

demo: triage agent が refund、sales、support specialist に route する。各 specialist は独自 tool を持つ。run loop は各 handoff を出力する。

Run:

```
python3 code/main.py
```

## Use It

`outputs/skill-handoff-designer.md` は、与えられた task の handoff topology を設計する。どの agent が存在し、どの handoff を呼べるか、どの context を transfer するかを決める。

## Ship It

Checklist:

- **Handoff logging。** すべての handoff は from-agent、to-agent、context snapshot を含む trace event を書く。
- **Context transfer rules。** handoff 時に何を移すかを決める。full history (高価)、last N messages、summary のいずれか。
- **Guardrail on handoff。** 異なる tool permission を持つ specialist への handoff は認証されなければならない。そうしないと prompt injection が望ましくない handoff を強制できる。
- **Loop detection。** 2つの agent が行き来し続けるのはよくある failure。単純な last-K ring check で検出する。
- **Fallback agent。** handoff target が存在しない場合、安全な default に fallback する。

## Exercises

1. `code/main.py` を実行し、refund agent への triage を行う。2 turn 目の active agent が refund であることを確認する。
2. loop-detection rule を追加する。同じ2 agent が3回連続で handoff し合ったら exit を強制する。fallback を設計する。
3. OpenAI Agents SDK docs の handoff filters を読む。"summarize-on-handoff" 版を実装する。incoming agent が引き継ぐ前に outgoing agent が context を bullet summary に圧縮する。
4. Swarm handoff と GroupChatManager selector を比較する。どちらの pattern が prompt injection を悪化させるか、なぜか。
5. Swarm cookbook (https://developers.openai.com/cookbook/examples/orchestrating_agents) を読む。Swarm の明示的な design decision のうち、OpenAI Agents SDK が変更または維持したものを1つ特定する。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Routine | "The agent prompt" | system prompt + tool list。role と available handoffs を定義する。 |
| Handoff | "Transfer to another agent" | active agent が呼べる tool。new Agent を返す。runtime が active agent を切り替える。 |
| Stateless | "No memory between runs" | Swarm は何も persist しない。memory は caller の責任。 |
| Active agent | "Who's speaking now" | 現在 conversation を保持している agent。handoff がこれを変える。 |
| Context transfer | "What moves on handoff" | incoming agent が見る history の policy: full、last N、summary。 |
| Handoff loop | "Agents ping-pong" | 2つの agent が互いに handoff し続ける failure mode。 |
| OpenAI Agents SDK | "Production Swarm" | 2025 年 3 月の successor。handoff primitive に sessions、guardrails、tracing を追加する。 |
| Handoff filter | "Gate on transfer" | handoff boundary で context を inspect/modify する SDK feature。 |

## 参考文献

- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) — reference articulation
- [OpenAI Swarm repo](https://github.com/openai/swarm) — original implementation。概念参照として保持されている
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) — sessions と tracing を持つ production successor
- [Anthropic handoff-in-Claude notes](https://docs.anthropic.com/en/docs/claude-code) — Claude Code subagents が `Task` で handoff-like pattern を使う方法
