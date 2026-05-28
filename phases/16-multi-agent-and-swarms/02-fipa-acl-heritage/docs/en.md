# Heritage of FIPA-ACL and Speech Acts

> MCP や A2A より前に、FIPA-ACL がありました。2000 年、IEEE Foundation for Intelligent Physical Agents は、20 個の performatives、2 つの content languages、そして contract net、subscribe/notify、request-when などの interaction protocols を持つ agent communication language を ratify しました。ontology overhead が web には重すぎたため industry からは消えていきましたが、LLM による multi-agent systems の復興は、formal semantics を抜いた同じ ideas を静かに再実装しています。JSON contracts は performatives の代わりになり、natural language は ontologies の代わりになります。この lesson では FIPA-ACL を真面目に読み、2026 年の protocol decisions のどれが再発明で、どれが新規で、現在の wave が 2000 年代に解かれた問題をどこで再発見するのかを見ます。

**種別:** 学習
**言語:** Python (stdlib)
**前提条件:** Phase 16 · 01 (Why Multi-Agent)
**所要時間:** 約60分

## 問題

2026 年の agent-protocol landscape は混雑しています。tools には MCP、agents には A2A、enterprise audit には ACP、decentralized trust には ANP、さらに NLIP、CA-MCP、数十の research proposals があります。各 spec は自分こそ foundational だと主張します。

率直に見ると、その多くは 20 年前の非常に具体的な decision tree を再発見しています。Austin (1962) と Searle (1969) の speech-act theory は「utterances are actions」を与えました。KQML (1993) はそれを wire protocol にしました。FIPA-ACL (ratified 2000) は reference standardization を作りました。20 performatives、content languages SL0/SL1、contract-net と subscribe-notify の interaction protocols です。JADE と JACK は Java の reference platforms でした。この effort は 2010 年頃に薄れました。ontology overhead が重く、web が勝ったからです。

MCP の `tools/call`、A2A の task lifecycle、CA-MCP の shared context store を見ると、FIPA decisions の JSON-native で柔らかい再演を見ていることになります。heritage を知ると、2 つのことが分かります。新しい「innovations」のどれが実は reinventions か、そして new specs がどの old failure modes を再発見するかです。

## コンセプト

### Speech acts を 1 段落で

Austin は、世界を描写するのではなく世界を変える sentences があることに気づきました。"I promise." "I request." "I declare." 彼はこれらを performative utterances と呼びました。Searle は assertive、directive、commissive、expressive、declarative の 5 categories に formalize しました。KQML (Finin et al., 1993) はこれを software agents 向けに operationalize しました。message は performative (action) と content (action の対象) から成ります。FIPA-ACL は KQML の gaps を整理し、約 20 performatives を standardize しました。

### 20 個の FIPA performatives (一部)

| Performative | Intent |
|---|---|
| `inform` | "P が true だと伝える" |
| `request` | "X をするよう依頼する" |
| `query-if` | "P は true か?" |
| `query-ref` | "X の値は何か?" |
| `propose` | "X をしようと提案する" |
| `accept-proposal` | "proposal を受け入れる" |
| `reject-proposal` | "proposal を拒否する" |
| `agree` | "X を行うことに同意する" |
| `refuse` | "X を拒否する" |
| `confirm` | "P が true だと確認する" |
| `disconfirm` | "P を否定する" |
| `not-understood` | "あなたの message は parse できなかった" |
| `cfp` | "X について proposal を募集する" |
| `subscribe` | "X が変わったら通知してほしい" |
| `cancel` | "進行中の X を cancel する" |
| `failure` | "X を試したが失敗した" |

full list は `fipa00037.pdf` (FIPA ACL Message Structure) にあります。暗記が目的ではありません。重要なのは、これらのすべてが LLM protocol が最終的に再追加する primitive に対応していることです。

### Canonical FIPA-ACL message

```
(inform
  :sender       agent1@platform
  :receiver     agent2@platform
  :content      "((price IBM 83))"
  :language     SL0
  :ontology     finance
  :protocol     fipa-request
  :conversation-id   conv-42
  :reply-with   msg-17
)
```

7 fields が protocol envelope を運び、1 field (`content`) が payload を運びます。残りの fields は、JSON protocol に retries、threading、ontology を後付けするたびに再発明するものそのものです。

### 2 つの legacy platforms

**JADE** (Java Agent DEvelopment framework, 1999-2020s) は最も使われた FIPA-compliant runtime でした。agents は base class を extend し、ACL messages を交換し、containers 内で動き、"behaviors" で coordinate しました。interaction-protocol library には contract-net、subscribe-notify、request-when、propose-accept が含まれていました。

**JACK** (Agent Oriented Software, commercial) は FIPA messages の上で BDI (Belief-Desire-Intention) reasoning を重視しました。より formal で、採用は少なめでした。

web stack が multi-agent use cases を取り込むにつれて、どちらも衰退しました。MCP と A2A は 2026 年の runtime "containers" です。

### FIPA が消えた理由

- **Ontology overhead.** FIPA は `content` を parse するために shared ontology を要求しました。ontology に合意するのは何年もかかる standardization process です。web は HTTP + JSON を使いました。
- **誰も使わなかった formal semantics.** SL (Semantic Language) は厳密な truth conditions を与えましたが、production systems の多くは free-form content を使い、formalism を無視しました。
- **Tooling lock-in.** JADE は Java-only、JACK は commercial でした。polyglot teams は両方を迂回しました。
- **internet が stack に勝った。** REST、次に JSON-RPC、次に gRPC が ACL の transport を置き換えました。

### LLM revival は FIPA-lite

FIPA `request` と MCP `tools/call` を比べます。

```
(request                                {
  :sender  agent1                         "jsonrpc": "2.0",
  :receiver tool-server                   "method":  "tools/call",
  :content "(lookup stock IBM)"           "params":  {"name":"lookup_stock",
  :ontology finance                                   "arguments":{"symbol":"IBM"}},
  :conversation-id c42                    "id": 42
)                                        }
```

同じ envelope で、syntax が違います。どちらも、who、whom、intent、payload、correlation id を運びます。どちらかがもう一方に対する revolution ではありません。同じ design に対する trade-off が違うだけです。

Liu et al. の 2025 survey ("A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP", arXiv:2505.02279) は、この lineage を明示しています。MCP は tool-use speech acts、A2A は agent-peer speech acts、ACP は audit-trail speech acts、ANP は decentralized-identity extensions に対応します。new specs は JSON syntax と緩い semantics を持つ ACL descendants です。

### trade-off を率直に言う

**FIPA が与え、modern specs が落としたもの:**

- Formal semantics - `inform` が sender が content を信じていることを imply すると証明できる。
- performatives の canonical catalog - `cancel` を持つべきかを毎回議論しなくてよい。
- interaction-protocol patterns の decades - contract-net、subscribe-notify、propose-accept。既知の correctness properties がある。

**modern specs が与え、FIPA が与えなかったもの:**

- すべての modern tool と互換性のある JSON-native payloads。
- hand-coded ontology なしに LLMs が解釈できる natural-language content。
- Web-stack transport (HTTP、SSE、WebSocket)。
- self-describing documents による capability discovery (MCP `listTools`、A2A Agent Card)。

実装しやすさのために intent semantics を緩める。それが正確な trade です。

### 移植する価値がある interaction protocols

FIPA は約 15 の interaction protocols を出荷しました。LLM multi-agent systems に持ち込む価値があるのは 3 つです。

1. **Contract Net Protocol (CNP).** manager が `cfp` (call for proposals) を出し、bidders が `propose` で応答し、manager が accept/reject します。canonical task-market pattern です (Phase 16 · 16 Negotiation)。
2. **Subscribe/Notify.** subscriber が `subscribe` を送り、publisher が topic 変更時に `inform` を送ります。2026 年の event-bus はすべてこれです。
3. **Request-When.** "condition Y が成立したら X を行う"。pre-conditions 付き delayed-action です。2026 年の analog は durable workflow engines の deferred tasks です (Phase 16 · 22 Production Scaling)。

どれも modern message queues、HTTP + polling、SSE streaming に clean に map できます。

### ontology を落とすと何が壊れるか

shared ontology がないと、agents は natural-language content から意味を推論します。2026 年の documented failure mode は **semantic drift** です。2 agents が同じ word (`"customer"`) を微妙に違う concepts に使い、receiver の agent が間違った interpretation で動き、schema validator はそれを検出しません。FIPA の ontology requirement なら parse time で message を reject していました。

full ontology に戻らずにできる mitigation:

- `content` への JSON Schema - wire 上の structural errors を reject する。
- Typed artifacts (A2A) - wrong modality を reject する。
- envelope 内の explicit performative - content が natural language でも intent を明確にする。

### 2026 specs を speech-act heritage に map する

| Modern spec | FIPA analog | What it keeps | What it drops |
|---|---|---|---|
| MCP `tools/call` | `request` | explicit intent, correlation id | formal semantics, ontology |
| MCP `resources/read` | `query-ref` | explicit intent, correlation id | formal semantics |
| A2A Task lifecycle | contract-net + request-when | async lifecycle, state transitions | formal completeness guarantees |
| A2A streaming events | subscribe/notify | async push | typed-predicate subscription |
| CA-MCP shared context | blackboard (Hayes-Roth 1985) | multi-writer shared memory | logical consistency model |
| NLIP | natural-language content | LLM-native | schema |

表を上から下に読むと、pattern はこうです。structural primitive は残し、formalism は落とし、ambiguity は LLMs に覆わせる。

## 実装

`code/main.py` は pure-stdlib の FIPA-ACL translator を実装します。canonical ACL envelope を encode/decode し、MCP / A2A の message shape がすべて同じ 7 fields に還元されることを示します。demo は次を行います。

- 5 つの MCP-style / A2A-style messages を FIPA-ACL として encode する。
- FIPA-ACL を modern equivalent に decode する。
- 1 manager と 3 bidders の toy Contract Net negotiation を `cfp`、`propose`、`accept-proposal`、`reject-proposal` で実行する。

実行:

```
python3 code/main.py
```

output は side-by-side trace です。各 modern message を 2026 JSON form と FIPA-ACL form の両方で表示し、その後に contract-net bid の round-trip を示します。同じ protocol primitives が round-trip 後も残り、syntax だけが違います。

## Use It

`outputs/skill-fipa-mapper.md` は任意の agent-protocol spec を読み、FIPA-ACL mapping を出す skill です。新しい protocol を採用する前に使い、「これは本当に新しいのか、それとも JSON syntax の `inform` なのか?」に答えます。

## Ship It

FIPA-ACL をそのまま復活させないでください。復活させるべきは checklist です。

- 各 message の intent primitive (performative) は何か?
- request-response と cancellation のための correlation id はあるか?
- explicit content language (JSON-RPC、plain text、structured typed artifact) はあるか?
- interaction protocols は first-class か、それとも contract-net をゼロから再実装しているか?
- 2 agents が content meaning について disagree したら何が起きるか (semantic drift)?

production に ship する前に、new protocol についてこの 5 questions を document してください。

## Exercises

1. `code/main.py` を実行し、round-trip encoding を観察する。`tools/call`、`resources/read`、A2A task creation に対応する FIPA performative を特定する。
2. contract-net demo に `cancel` performative を追加し、manager が bid の途中で task を withdraw できるようにする。`cancel` は retries だけでは解けないどんな failure case を解くか?
3. FIPA ACL Message Structure (http://www.fipa.org/specs/fipa00037/) の sections 4.1-4.3 を読む。この lesson で扱っていない performative を 1 つ選び、その modern JSON-RPC analog を説明する。
4. Liu et al., arXiv:2505.02279 を読む。MCP、A2A、ACP、ANP それぞれについて、残している FIPA performative families と落としているものを list する。
5. 自分の system の `request` performative の `content` field に対する minimal JSON-Schema を設計する。その schema は pure natural-language にはない何を与え、何を cost として要求するか?

## Key Terms

| Term | よくある言い方 | 実際の意味 |
|------|----------------|------------|
| Speech act | "An utterance that does something" | Austin/Searle: utterances as actions。ACL の theoretical parent。 |
| FIPA | "That old XML thing" | IEEE Foundation for Intelligent Physical Agents。2000 年に ACL を standardize した。 |
| ACL | "Agent Communication Language" | FIPA の envelope format: performative + content + metadata。 |
| Performative | "The verb" | message の intent class: `inform`、`request`、`propose`、`cfp` など。 |
| KQML | "FIPA's predecessor" | Knowledge Query and Manipulation Language (1993)。より simple で狭い。 |
| Ontology | "Shared vocabulary" | content language が扱う concepts の formal definition。 |
| SL0 / SL1 | "FIPA content languages" | Semantic Language levels 0 and 1。formal content language family。 |
| Contract Net | "Task market" | manager が cfp を出し、bidders が propose し、manager が accept する canonical interaction protocol。 |
| Interaction protocol | "Pattern of messages" | request-when、subscribe-notify など、known correctness を持つ performatives の sequence。 |

## 参考文献

- [Liu et al. — A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP](https://arxiv.org/html/2505.02279v1) — modern specs と FIPA heritage を結びつける canonical 2025 survey
- [FIPA ACL Message Structure Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) — ratified 2000 envelope format
- [FIPA Communicative Act Library Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) — full performative catalog
- [MCP specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — `request`/`query-ref` の modern tool-use equivalent
- [A2A specification](https://a2a-protocol.org/latest/specification/) — contract-net と subscribe-notify の modern agent-peer equivalent
