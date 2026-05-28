# A2A — The Agent-to-Agent Protocol

> Google は 2025 年 4 月に A2A を発表した。2026 年 4 月時点で spec は https://a2a-protocol.org/latest/specification/ にあり、150 以上の組織が支援している。A2A は MCP (Lesson 13) の水平補完だ。MCP が vertical (agent ↔ tools) であるのに対し、A2A は peer-to-peer (agent ↔ agent) である。A2A は Agent Cards (discovery)、artifacts (text、structured data、video) を持つ tasks、不透明な task lifecycle、auth を定義する。production system では MCP と A2A を併用する例が増えている。Google Cloud は 2025-2026 年に Vertex AI Agent Builder へ A2A support を組み込んだ。

**種別:** 学習 + 構築
**言語:** Python (stdlib, `http.server`, `json`)
**前提条件:** Phase 16 · 04 (Primitive Model)
**所要時間:** 約75分

## 問題

あなたの agent が、別 system 上の別 agent を呼ぶ必要がある。どうするか。HTTP endpoint を公開し、独自 JSON schema を定義し、相手側がそれを話せることを祈る。agent の組み合わせごとに custom integration が生まれる。

A2A は、その呼び出しのための universal wire protocol だ。standard discovery、standard task model、standard transport、standard artifacts。agent を first-class citizen として扱う HTTP+REST のようなものだ。

## コンセプト

### The four elements

**Agent Card.** `/.well-known/agent.json` にある JSON document。agent の name、skills、endpoints、supported modalities、auth requirements を記述する。discovery は card を読むことで行う。

```
GET https://agent.example.com/.well-known/agent.json
→ {
    "name": "code-review-agent",
    "skills": ["review-python", "review-typescript"],
    "endpoints": {
      "tasks": "https://agent.example.com/tasks"
    },
    "auth": {"type": "bearer"},
    "modalities": ["text", "structured"]
  }
```

**Task.** work の unit。async で stateful な object で、`submitted → working → completed / failed / canceled` という lifecycle を持つ。client は task を送信し、polling または subscribe で update を受け取る。

**Artifact.** task が生成する result type。text、structured JSON、image、video、audio。artifact は typed なので、異なる modality が first-class になる。

**Opaque lifecycle.** A2A は remote agent が task を *どう* 解くかを規定しない。client が見るのは state transition と artifact であり、implementation は任意の framework を使える。

### The MCP/A2A split

- **MCP** (Lesson 13): agent ↔ tool。agent は JSON-RPC で tool server を read/write する。default では stateless。
- **A2A**: agent ↔ agent。peer protocol。両側が独自 reasoning を持つ agent。

production multi-agent system は両方を使う。A2A peer は自分側で MCP tools を呼ぶ。この分離により、2つの concern を明確に保てる。

### Discovery flow

```
Client                     Agent server
  ├──GET /.well-known/agent.json──>
  <──Agent Card JSON─────────────
  ├──POST /tasks {skill, input}──>
  <──201 task_id, state=submitted
  ├──GET /tasks/{id}──────────────>
  <──state=working, 42% done──────
  ├──GET /tasks/{id}──────────────>
  <──state=completed, artifacts──
```

streaming の場合は、push update のために `/tasks/{id}/events` へ SSE subscription する。

### Auth

A2A は一般的な3つの pattern をサポートする:

- **Bearer token** — OAuth2 または opaque。
- **mTLS** — mutual TLS。組織同士が identity を証明する。
- **Signed requests** — payload に対する HMAC。

auth は Agent Card で宣言される。client はそれを discover し、準拠する。

### 150+ organizations by April 2026

enterprise adoption が A2A の規模を押し上げた。headline は、A2A が enterprise agent system が trust boundary を越えるための方法になったことだ。Google Cloud は Vertex AI Agent Builder A2A support を出荷した。Microsoft Agent Framework は A2A をサポートし、主要 framework (LangGraph、CrewAI、AutoGen) の多くが A2A adapter を出荷している。

### Where A2A wins

- **Cross-organization calls。** company A の agent が company B の agent を呼ぶ。A2A なしでは、すべての pair が bespoke contract になる。
- **Heterogeneous frameworks。** LangGraph agent が CrewAI agent を呼び、さらに custom Python agent を呼ぶ。A2A が normalize する。
- **Typed artifacts。** video result、structured JSON、audio がすべて first-class。
- **Long-running tasks。** opaque lifecycle + polling により、数時間かかる task も扱いやすい。

### Where A2A struggles

- **Latency-sensitive micro-calls。** A2A の lifecycle は async。sub-millisecond agent-to-agent には合わない。direct RPC を使う。
- **Tight-coupled in-process agents。** 両 agent が同じ Python process で動くなら、A2A の HTTP round-trip は過剰。
- **Small teams。** spec overhead は実在する。internal-only agents には形式性が不要なこともある。

### A2A vs ACP, ANP, NLIP

2024-2026 年に関連 spec がいくつか登場した:

- **ACP** (IBM/Linux Foundation) — A2A の predecessor。scope はより狭い。
- **ANP** (Agent Network Protocol) — peer-discovery-heavy、decentralized-first。
- **NLIP** (Ecma Natural Language Interaction Protocol、2025 年 12 月 standardized) — natural-language content type。

2026 年 4 月時点で、A2A は最も採用された peer protocol である。比較は arXiv:2505.02279 (Liu et al., "A Survey of Agent Interoperability Protocols") を参照。

## 実装

`code/main.py` は `http.server` と JSON を使って A2A-minimal server と client を実装する。server は:

- `/.well-known/agent.json` を expose する。
- `POST /tasks` を受け付ける。
- task state を管理する。
- `GET /tasks/{id}` で artifact を返す。

client は:

- Agent Card を fetch する。
- task を submit する。
- completion まで poll する。
- artifact を読む。

Run:

```
python3 code/main.py
```

script は background thread で server を起動し、それに対して client を実行する。discovery、submit、poll、artifact の完全な flow が見える。

## Use It

`outputs/skill-a2a-integrator.md` は A2A integration を設計する。Agent Card contents、task schemas、auth choice、streaming vs polling を含む。

## Ship It

Checklist:

- **spec version を pin する。** A2A はまだ進化中である。Agent Card は protocol version を宣言すべき。
- **Idempotent task creation。** duplicate submission (network retry) は1つの task にまとまるべき。
- **Artifact schemas。** agent が返す shape を宣言する。consumer は validate すべき。
- **Rate limits + auth。** A2A は public-facing。標準的な web security を適用する。
- **failed task の dead-letter。** recurring failure type の pattern を時間とともに調べる。

## Exercises

1. `code/main.py` を実行する。client が server を discover し、正しい artifact を受け取ることを確認する。
2. server に2つ目の skill (例: "summarize") を追加する。Agent Card を更新する。task type に基づいて skill を選ぶ client を書く。
3. SSE streaming endpoint `/tasks/{id}/events` を実装し、state change を emit する。client は何を変える必要があるか。
4. A2A spec (https://a2a-protocol.org/latest/specification/) を読む。この demo が実装していない、spec が要求するものを3つ特定する。
5. A2A (Agent Card discovery) と MCP (server-side capability listing via `listTools`) を比較する。self-describing agents と capability-probing の tradeoff は何か。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| A2A | "Agent-to-agent" | system をまたいで agent が他の agent を呼ぶための peer protocol。Google 2025。 |
| Agent Card | "The agent's business card" | skills、endpoints、auth を記述する `/.well-known/agent.json` の JSON。 |
| Task | "The unit of work" | lifecycle を持つ async stateful object。completion 時に artifact を生成する。 |
| Artifact | "The result" | typed output: text、structured JSON、image、video、audio。first-class media。 |
| Opaque lifecycle | "How it's solved is the agent's business" | client は state transition だけを見る。server は framework/tools を自由に選べる。 |
| Discovery | "Finding the agent" | `GET /.well-known/agent.json` が card を返す。 |
| MCP vs A2A | "Tools vs peers" | MCP: vertical agent ↔ tool。A2A: horizontal agent ↔ agent。 |
| ACP / ANP / NLIP | "Sibling protocols" | 隣接 spec。A2A は 2026 年で最も採用されている。 |

## 参考文献

- [A2A specification](https://a2a-protocol.org/latest/specification/) — canonical spec
- [Google Developers Blog — A2A announcement](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/) — 2025 年 4 月の launch post
- [A2A GitHub repo](https://github.com/a2aproject/A2A) — reference implementations and SDKs
- [Liu et al. — A Survey of Agent Interoperability Protocols](https://arxiv.org/html/2505.02279v1) — MCP、ACP、A2A、ANP comparison
