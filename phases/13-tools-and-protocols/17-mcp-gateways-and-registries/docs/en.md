# MCP Gateways and Registries — Enterprise Control Planes

> Enterprise は、すべての dev が任意の MCP server をインストールできる状態にはできません。Gateway は auth、RBAC、audit、rate limiting、caching、tool-poisoning detection を集中管理し、merge された tool surface を単一の MCP endpoint として公開します。Official MCP Registry (Anthropic + GitHub + PulseMCP + Microsoft、namespace-verified) が正典の upstream です。このレッスンでは gateway の位置づけを明確にし、最小実装をたどり、2026 年時点の vendor landscape を概観します。

**種別:** 学習
**言語:** Python (stdlib、minimal gateway)
**前提条件:** Phase 13 · 15 (tool poisoning), Phase 13 · 16 (OAuth 2.1)
**所要時間:** 約45分

## 学習目標

- MCP gateway がどこに位置するかを説明する (MCP clients と複数の backend MCP servers の間)。
- Gateway の 5 つの責務 auth、RBAC、audit、rate limit、policy を実装する。
- Gateway layer で pinned-tool-hash manifest を強制する。
- Official MCP Registry と metaregistries (Glama、MCPMarket、MCP.so、Smithery、LobeHub) を区別する。

## 問題

Fortune 500 企業には、承認済み MCP server が 30 個、developer が 5000 人、compliance と audit の要件があり、security team は centralized policy を求めています。すべての developer が IDE に任意の server をインストールできる運用はありえません。

Gateway pattern は次の通りです。

1. Gateway は developer が接続する単一の Streamable HTTP endpoint として動く。
2. Gateway は各 backend MCP server の credentials を保持する。
3. すべての developer request は gateway 自身の OAuth を通じて authenticate され、scope される。
4. Gateway は policy を適用しながら call を backend server に route する。
5. すべての call が audit のために logged される。

Cloudflare MCP Portals、Kong AI Gateway、IBM ContextForge、MintMCP、TrueFoundry、Envoy AI Gateway は、2025-2026 年に gateway または gateway feature を出荷しました。

同時に、Official MCP Registry が正典の upstream として立ち上がりました。Gateway が取得できる curated、namespace-verified、reverse-DNS-named server が登録されています。Metaregistries (Glama、MCPMarket、MCP.so、Smithery、LobeHub) は複数 source の server を集約します。

## コンセプト

### 5 つの gateway responsibility

1. **Auth。** OAuth 2.1 で developer を識別し、user roles に map する。
2. **RBAC。** User ごとの policy: どの server、どの tool、どの scope を許可するか。
3. **Audit。** すべての call を who、what、when、result とともに記録する。
4. **Rate limit。** Abuse を防ぐため、per-user / per-tool / per-server の cap を設ける。
5. **Policy。** Poisoned descriptions を拒否し、Rule of Two を強制し、PII を redact する。

### Gateway as a single endpoint

Developer から見ると、gateway は 1 つの MCP server に見えます。内部では N 個の backend に route します。Session ids (Phase 13 · 09) は境界で rewrite されます。

### Credential vaulting

Developer が backend token を見ることはありません。Gateway がそれを保持します (または identity provider に proxy します)。Gateway 上で `notes:read` を持つ developer は、gateway 自身の backend credentials によって notes MCP server へ transitively access できるかもしれません。ただし、その transitive access を bind する policy の下でのみです。

### Tool-hash pinning at the gateway

Gateway は承認済み tool description の manifest (SHA256 hashes) を持ちます。Discovery 時に各 backend の `tools/list` を取得し、hash を manifest と比較し、description が変化した tool は削除します。これは Phase 13 · 15 の rug-pull defense を中央で適用したものです。

### Policy-as-code

Advanced gateways は OPA/Rego、Kyverno、Styra で policy を表現します。"user `alice` may call `github.open_pr` only on repos in org `acme`" のような rule を declarative に encode します。Simple gateways は手書き Python を使います。どちらの形も有効です。

### Session-aware routing

User の session に server の混在がある場合、gateway は multiplex します。Developer の単一 MCP session は、server ごとに 1 つずつ N 個の backend session を保持します。どの backend からの notification も gateway を通じて developer の session に route されます。

### Namespace merging

Gateway はすべての backend の tool namespace を merge します。通常は collision 時に prefix を付けます。`github.open_pr`、`notes.search` のようにします。これにより routing が曖昧でなくなります。

### Registries

- **Official MCP Registry (`registry.modelcontextprotocol.io`)。** Anthropic、GitHub、PulseMCP、Microsoft の stewardship の下で開始。Namespace-verified (reverse-DNS: `io.github.user/server`)。基本品質で pre-filter される。
- **Glama。** 多数の source を集約する search-centric metaregistry。
- **MCPMarket。** Vendor listing を持つ commercial-leaning directory。
- **MCP.so。** Community directory。Open submissions。
- **Smithery。** Package-manager-style installation flow。
- **LobeHub。** LobeChat app に UI-integrated された registry。

Enterprise gateways は default で Official Registry から取得し、admin-curated な metaregistry 追加を許可し、pin されていないものは拒否します。

### Reverse-DNS naming

Official Registry は public servers に reverse-DNS names を必須にします: `io.github.alice/notes`。Namespace は squatting を防ぎ、trust delegation を明確にします。

### Vendor survey, April 2026

| Vendor | Strength |
|--------|----------|
| Cloudflare MCP Portals | Edge-hosted、OAuth integrated、free tier |
| Kong AI Gateway | K8s-native、fine-grained policy、OpenTelemetry への logs |
| IBM ContextForge | Enterprise IAM、compliance、audit export |
| TrueFoundry | DevOps-leaning、metrics-first |
| MintMCP | Developer-platform oriented |
| Envoy AI Gateway | Open-source、customizable filters |

Phase 17 (production infrastructure) は gateway operations をさらに深掘りします。

## 使ってみる

`code/main.py` は約 150 行の minimal gateway を出荷します。Fake Bearer token で users を authenticate し、per-user RBAC policy を持ち、request を 2 つの backend MCP servers に route し、すべての call を audit log に書き、rate limit を強制し、description hash が pinned manifest と一致しない backend tool を拒否します。

見るべき点:

- `RBAC` dict は `user_id` を key とし、allowed `server_tool` entries を持つ。
- `AUDIT_LOG` は append-only な events list。
- Rate limit は user ごとの token bucket を使う。
- Pinned manifest は `server::tool -> hash` の dict。

## 出荷物

このレッスンは `outputs/skill-gateway-bootstrap.md` を生成します。Enterprise MCP plan (users、backends、compliance) が与えられると、この skill は gateway configuration spec を生成します。

## 演習

1. `code/main.py` を実行する。Allowed user として call し、次に disallowed user、さらに rate-limit-exceeded burst を試す。3 つの flow を確認する。

2. Client に返す前に result から PII を redact する policy を追加する。SSN 形式の string に対して単純な regex pass を使い、gap (emails、phone numbers) を記録する。

3. Audit log を拡張し、OpenTelemetry GenAI spans を emit する。Phase 13 · 20 が exact attributes を扱う。

4. 50 人の developer team と 5 つの backend (notes、github、postgres、jira、slack) 用の RBAC policy を設計する。各 backend の read-only を誰に与えるか。write を誰に与えるか。

5. Cloudflare enterprise MCP post を最初から最後まで読む。この stdlib gateway が持たない Cloudflare の feature を 1 つ特定する。

## 重要用語

| Term | よく言われること | 実際の意味 |
|------|------------------|------------|
| Gateway | "MCP proxy" | Clients と backends の間で centralizing server として働く |
| Credential vaulting | "Backend tokens stay server-side" | Developer は upstream token を見ない |
| Session-aware routing | "Multi-backend session" | Gateway が developer session ごとに N 個の backend session を multiplex する |
| Tool-hash pinning | "Approved manifest" | 承認済み tool description すべての SHA256。Rug-pull を中央で block する |
| RBAC | "Per-user policy" | Tools と servers に対する role-based access control |
| Policy-as-code | "Declarative rules" | Gateway で強制される OPA/Rego、Kyverno、Styra policies |
| Audit log | "Who, what, when" | Compliance 用 append-only event log |
| Rate limit | "Per-user token bucket" | Abuse を防ぐ per-minute cap |
| Official MCP Registry | "Canonical upstream" | `registry.modelcontextprotocol.io`、namespace-verified |
| Reverse-DNS naming | "Registry namespace" | `io.github.user/server` convention |

## 参考資料

- [Official MCP Registry](https://registry.modelcontextprotocol.io/) — 正典の upstream、namespace-verified
- [Cloudflare — Enterprise MCP](https://blog.cloudflare.com/enterprise-mcp/) — OAuth と policy を備えた gateway pattern
- [agentic-community — MCP gateway registry](https://github.com/agentic-community/mcp-gateway-registry) — open-source reference gateway
- [TrueFoundry — What is an MCP gateway?](https://www.truefoundry.com/blog/what-is-mcp-gateway) — feature comparison article
- [IBM — MCP context forge](https://github.com/IBM/mcp-context-forge) — IBM の enterprise gateway
