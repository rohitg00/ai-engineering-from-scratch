# Case Studies と 2026 年の State of the Art

> end-to-end で学ぶべき production-grade references は 3 つあり、それぞれ multi-agent engineering の異なる slice を示す。**Anthropic's Research system**（orchestrator-worker、15x tokens、single-agent Opus 4 比 +90.2%、rainbow deployments）は canonical supervisor case である。**MetaGPT / ChatDev**（software engineering 向け SOP-encoded role specialization、ChatDev の「communicative dehallucination」、DAGs により >1000 agents へ拡張する MacNet extension、arXiv:2406.07155）は canonical role-decomposition case である。**OpenClaw / Moltbook**（もとは Peter Steinberger による Clawdbot、2025 年 11 月。2 回改名。2026 年 3 月までに GitHub stars 247k。local ReAct-loop agents。Moltbook は agent-only social network として launch 後数日で約 2.3M agent accounts、2026-03-10 に Meta が買収）は population scale で何が起きるかを示す: emergent economic activity、prompt-injection risks、state-level regulation（中国は 2026 年 3 月に government computers 上の OpenClaw を制限）。**Framework landscape April 2026:** LangGraph と CrewAI が production を lead。AG2 は community AutoGen continuation。Microsoft AutoGen は maintenance mode（Microsoft Agent Framework に統合、2026 年 2 月 RC）。OpenAI Agents SDK は production Swarm successor。Google ADK（2025 年 4 月）は A2A-native entrant。すべての major framework が MCP support を出荷し、ほとんどが A2A を出荷している。この lesson は各 case を end-to-end で読み、common patterns を抽出して、次の production system に適した reference を選べるようにする。

**種別:** 学習（capstone）
**言語:** —
**前提条件:** all of Phase 16 (Lessons 01-24)
**所要時間:** 約90分

## 問題

multi-agent engineering は若い discipline である。production references は少なく、それぞれ space の異なる部分を覆っている。1 つずつ読むのも有用だが、set として比較する方が有用である。この lesson は 3 つの canonical 2026 case studies を end-to-end reading list として扱い、common patterns を固定し、framework choices を marketing ではなく knowledge に基づいて行えるよう framework landscape を map する。

## コンセプト

### Anthropic Research system

production supervisor-worker case。Claude Opus 4 が plan and synthesize し、Claude Sonnet 4 subagents が parallel に research する。published engineering post: https://www.anthropic.com/engineering/multi-agent-research-system。

Key measured results:

- internal research evals で single-agent Opus 4 に対し **+90.2%** improvement。
- **BrowseComp variance の 80%** は **token usage alone** で説明される。multi-agent が勝つ大きな理由は、各 subagent が fresh context window を得ること。
- single-agent 比 **15x tokens per query**。
- agents が long-running and stateful であるため **Rainbow deployment**。

Design lessons codified:

1. **query complexity に effort を scale する。** Simple → 1 agent with 3-10 tool calls。Medium → 3 agents。Complex research → 10+ subagents。
2. **Broad first, then narrow。** Subagents が wide searches を行い、lead が synthesize し、follow-up subagents が targeted deeps を行う。
3. **Rainbow deploys。** in-flight agents が終わるまで old runtime versions を生かす。
4. **Verification is not optional。** explicit verifier roles がないと hallucinate することが観察された。

これは production scale における supervisor-worker topology（Phase 16 · 05）の reference case である。

### MetaGPT / ChatDev

production SOP-role-decomposition case。arXiv:2308.00352（MetaGPT）と arXiv:2307.07924（ChatDev）を扱う。

MetaGPT は software-engineering SOPs を role prompts として encode する: Product Manager、Architect、Project Manager、Engineer、QA Engineer。paper の framing は `Code = SOP(Team)`。各 role は narrow で specialized な prompt を持つ。inter-role handoffs は structured artifacts（PRD docs、architecture docs、code）を運ぶ。

ChatDev の contribution は **communicative dehallucination** である。agents は回答前に specifics を要求する。designer agent は UI を sketch する前に、programmer に intended language を尋ねる。guess しない。この paper は、multi-agent pipelines における hallucination が measurable に減ると報告する。

MacNet（arXiv:2406.07155）は ChatDev を **DAGs により >1000 agents** へ拡張する。各 DAG node は role specialization、edges は handoff contracts を encode する。routing が explicit かつ offline-computable であるため scale できる。

Design lessons:

1. **Structure は size より重要。** tight な 5-role SOP team は、unstructured な 50-agent group に勝つ。
2. **Handoff contracts in writing。** roles 間で渡される artifacts は schema に従う。
3. **Communicative dehallucination** は安く load-bearing な pattern。
4. **DAGs は chat より遠くへ scale する。** flow が knowable なら encode する。

これは role specialization（Phase 16 · 08）と structured topology（Phase 16 · 15）の reference case である。

### OpenClaw / Moltbook ecosystem

production population-scale case。Timeline:

- **Nov 2025:** Clawdbot（Peter Steinberger の local ReAct-loop coding agent）が ship。
- **Dec 2025 – Mar 2026:** 2 回改名（Clawdbot → OpenClaw → OpenClaw として継続）。
- **Feb 2026:** Moltbook が同じ primitives 上の agent-only social network として launch。数日で約 2.3M agent accounts。
- **Mar 2026（2026-03-10）:** Meta が Moltbook を買収。
- **Mar 2026:** 中国が government computers 上の OpenClaw を制限。
- **Mar 2026:** OpenClaw が GitHub stars 247k を突破。

millions of agents を shared substrate 上に置くと、multi-agent はこう見える:

- **Emergent economic activity。** agents は token-payments を使って互いに buy、sell、service する。
- **population scale の prompt-injection risks。** viral agent profile 内の malicious prompt 1 つが、数時間で thousands of agent-to-agent interactions に伝播する。
- **State-level regulatory response。** launch 後数週間で regulation が ecosystem に到達する。

この case の design lessons は partly technical、partly governance である:

1. **population scale の multi-agent は新しい regime。** individual-system best practices（verification、role clarity）はまだ当てはまるが十分ではない。
2. **Prompt injection is the new XSS。** agent profiles と cross-agent messages は default で untrusted input として扱う。
3. **Regulation は design cycles より速い。** それを計画に入れる。
4. **Open-source + viral scale は複利で効く。** ~4 months で 247k stars は unusual。deploy-burst-load を想定して設計する。

ecosystem detail は [OpenClaw Wikipedia](https://en.wikipedia.org/wiki/OpenClaw) と CNBC / Palo Alto Networks reporting を参照。technical underpinnings については、Clawdbot / OpenClaw repos が local ReAct loop を公開し、Moltbook の public posts がその上の social-graph architecture を示している。

### Framework landscape April 2026

| Framework | Status | Best for | Notes |
|---|---|---|---|
| **LangGraph** (LangChain) | Production leader | structured graph + checkpointing + human-in-the-loop | production の recommended default |
| **CrewAI** | Production leader | role-based crews with Sequential/Hierarchical processes | role decomposition に強い |
| **AG2** | Community maintained | GroupChat + speaker selection | AutoGen v0.2 continuation |
| **Microsoft AutoGen** | Maintenance mode (Feb 2026) | — | Microsoft Agent Framework RC に統合 |
| **Microsoft Agent Framework** | RC (Feb 2026) | orchestration patterns + enterprise integration | new entrant。watch |
| **OpenAI Agents SDK** | Production | Swarm successor | tool-return handoff pattern |
| **Google ADK** | Production (April 2025) | A2A-native | Google Cloud integration |
| **Anthropic Claude Agent SDK** | Production | single-agent + Research extension | Research system post を参照 |

すべての major framework は **MCP** support を出荷している。ほとんどが **A2A** も出荷している。protocol compatibility はもはや differentiator ではない。

### 3 cases に共通する patterns

1. **Orchestrator + workers**（Anthropic の explicit supervisor、MetaGPT の PM-as-supervisor、OpenClaw の individual agents + network effects）。
2. **Structured handoff contracts**（Anthropic の subagent task descriptions、MetaGPT の PRD/architecture docs、OpenClaw の A2A artifacts）。
3. **Verification as first-class role**（Anthropic の verifier、MetaGPT の QA Engineer、OpenClaw の in-network validators）。
4. **Scaling は topology + substrate であり、more agents だけではない**（rainbow deploys、MacNet DAGs、population-scale substrates）。
5. **Cost は material で disclosed**（15x tokens、MetaGPT の per-role budget、Moltbook の per-interaction pricing）。
6. **Security posture は explicit**（Anthropic の sandboxing、MetaGPT の role restrictions、OpenClaw の prompt-injection as known attack surface）。

### 次の project の reference を選ぶ

- **Production research / knowledge task → Anthropic Research。** Fresh-context subagents が勝つ。
- **Engineering / tool-chain workflow → MetaGPT / ChatDev。** Roles + SOPs + handoff contracts。
- **Network-effect social product → OpenClaw / Moltbook。** Substrate + emergent economy。
- **Classic enterprise automation → CrewAI または LangGraph**（production leader、stable runtime）。

### 2026 state-of-the-art summary

2026 年 4 月時点の field:

- **Frameworks are converging。** MCP + A2A support は table stakes。handoff semantics が残る design choice。
- **Evaluation is hardening。** SWE-bench Pro、MARBLE、STRATUS mitigation benchmarks。Pro が current contamination-resistant reality check。
- **Production failure rates are measurable**（Cemri 2025 MAST、real MAS で 41-86.7%）。field は「demo では良さそう」era を出た。
- **Cost is the central engineering constraint。** task あたり token cost、interaction あたり wall-clock、rainbow-deploy overhead。multi-agent は accuracy で勝つが cost で負ける。その trade が business decision である。
- **Regulation は background concern ではなく near-term input。** jurisdictions は individual deploy cycles より速く動いている。

## Use It

`outputs/skill-case-study-mapper.md` は proposed multi-agent system design を読み、最も近い case study に map し、その case study がすでに test した design decisions を表面化する skill である。

## Ship It

2026 年の production multi-agent に向けた starter rules:

- **scratch からではなく case study から始める。** Anthropic Research / MetaGPT / OpenClaw のうち最も近いものを選び adapt する。
- **MCP + A2A を採用する。** frameworks 間 portability は価値があり、protocol support は無料に近い。
- **SWE-bench Pro または internal Pro-equivalent で測る。** Verified は contaminated。
- **verification tax を払う。** independent verifier は token budget の約 20-30% を消費し、measurable correctness を買う。
- **long-running agents は rainbow deploy する。** multi-hour agent runs が routine になると想定する。
- **WMAC 2026 と MAST follow-ups を読む。** discipline は速く動いている。

## Exercises

1. Anthropic Research system post を end-to-end で読む。Opus 4 を smaller model（例: Haiku 4）に置き換えたら変わる design decisions を 3 つ特定する。
2. MetaGPT Sections 3-4（arXiv:2308.00352）を読む。自分の domain（software 以外）の SOP を 1 つ role prompts として encode する。その SOP は何 roles を imply するか。
3. ChatDev（arXiv:2307.07924）を読む。「communicative dehallucination」の mechanism を特定する。既存の multi-agent systems の 1 つに実装する。
4. OpenClaw と Moltbook について読む。5-agent system では現れず population scale で現れた specific failure mode を 1 つ選ぶ。それにどう engineer against するか。
5. 現在の multi-agent project を選ぶ。3 case studies のうち最も近い reference はどれか。その case study の design decisions のうち、まだ採用していないものはどれか。今 quarter に採用するものを 1 つ書き出す。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Anthropic Research | 「supervisor reference」 | Claude Opus 4 + Sonnet 4 subagents。15x tokens。single-agent 比 +90.2%。 |
| MetaGPT | 「SOP as prompts」 | software engineering 向け role decomposition。`Code = SOP(Team)`。 |
| ChatDev | 「Agents as roles」 | designer / programmer / reviewer / tester。communicative dehallucination。 |
| MacNet | 「DAG で ChatDev を scale」 | arXiv:2406.07155。explicit DAG routing により 1000+ agents。 |
| OpenClaw | 「Local ReAct-loop agents」 | Steinberger の project。2026 年 3 月までに 247k stars。 |
| Moltbook | 「Agent-only social network」 | 2.3M agent accounts。2026 年 3 月 Meta が買収。 |
| Rainbow deploy | 「multiple versions concurrent」 | in-flight long-running agents のため old runtime versions を維持する。 |
| Communicative dehallucination | 「answer 前に ask する」 | agents が guessing せず peers に specifics を要求する。 |
| WMAC 2026 | 「AAAI workshop」 | multi-agent coordination の 2026 年 4 月 community focal point。 |

## 参考文献

- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — supervisor-worker production reference
- [MetaGPT — Meta Programming for Multi-Agent Collaborative Framework](https://arxiv.org/abs/2308.00352) — SOP-role decomposition
- [ChatDev — Communicative Agents for Software Development](https://arxiv.org/abs/2307.07924) — communicative dehallucination
- [MacNet — scaling role-based agents to 1000+](https://arxiv.org/abs/2406.07155) — DAG-based scale
- [OpenClaw on Wikipedia](https://en.wikipedia.org/wiki/OpenClaw) — ecosystem overview
- [WMAC 2026](https://multiagents.org/2026/) — AAAI 2026 Bridge Program Workshop on Multi-Agent Coordination
- [LangGraph docs](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — production leader
- [CrewAI docs](https://docs.crewai.com/en/introduction) — role-based framework
