# MCP 授权：CIMD、发行方绑定、PKCE 与逐步提权

> 远程 MCP 请求是无状态的，但其授权并非匿名。将每个凭证绑定到创建它的发行方，将每个令牌绑定到接收它的资源。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13 · 09（传输层）、Phase 13 · 15（安全）
**Time:** ~90 分钟

## 学习目标

- 通过受保护资源元数据发现授权服务器。
- 优先使用 Client ID Metadata Documents，而非已弃用的动态客户端注册。
- 在无法避免 DCR 兼容路径时，声明正确的 `application_type`。
- 校验授权响应中的 `iss`，并按发行方隔离凭证。
- 使用 PKCE、资源指示符、受众校验和增量作用域。
- 在没有协议会话的情况下发送经过授权的 MCP 2026-07-28 请求。

## 问题

远程 MCP 服务器可能读取私有记录、写入外部系统，或触发高成本操作。身份认证告诉它凭据由谁出示，授权还必须回答：

- 该凭据由哪个授权服务器签发？
- 该令牌面向哪个 MCP 资源？
- 哪个客户端和重定向 URI 完成了该流程？
- 用户批准了哪些操作？
- 这个确切的请求是否仍在该批准范围之内？

2026-07-28 授权配置文件强化了客户端注册与发行方处理。它优先使用 Client ID Metadata Documents，弃用动态客户端注册，要求在 DCR 中使用正确的 `application_type`，校验 RFC 9207 发行方响应，并禁止跨发行方复用凭据。

这些规则是对无状态核心的补充。它们不会恢复核心握手或 `Mcp-Session-Id`。

## 概念

### 了解三个角色

- **MCP 客户端：**代表资源所有者发送请求。
- **MCP 资源服务器：**接受访问令牌并提供 MCP 端点服务。
- **授权服务器：**认证资源所有者、收集同意并签发令牌。

资源服务器和授权服务器可以一起运营，但要保持它们的标识符和校验职责相互独立。

### 授权适用于 HTTP

MCP 授权规范适用于基于 HTTP 的传输。本地 stdio 服务器运行在进程和操作系统信任边界之内。不要仅为对称性而给 stdio 添加虚假的浏览器 OAuth 流程。

对于远程 Streamable HTTP，在每次请求的 `Authorization` 头中发送 bearer 令牌。切勿将其放入 URL。

### 从受保护资源元数据开始

资源服务器发布 RFC 9728 元数据：

```json
{
  "resource": "https://notes.example.com/mcp",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["notes:delete", "notes:read", "notes:write"]
}
```

客户端从 MCP 资源 URL 出发，获取该文档，选择一个已通告的授权服务器，然后获取该服务器的 OAuth 或 OpenID Connect 元数据。

构造 RFC 9728 well-known URL 时应保留资源路径。对于资源 `https://notes.example.com/mcp`，本课使用 `https://notes.example.com/.well-known/oauth-protected-resource/mcp`。丢弃 `/mcp` 后缀可能会选中同一源上另一个受保护资源的元数据。

不要从主机名猜测授权服务器。不要信任从未校验的错误响应体中发现的发行方。对客户端愿意信任哪些发行方保持明确策略。

### 校验授权服务器元数据

元数据应暴露端点及支持的控件：

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "code_challenge_methods_supported": ["S256"],
  "authorization_response_iss_parameter_supported": true,
  "client_id_metadata_document_supported": true
}
```

对 PKCE 要求使用 S256。记录确切的发行方字符串。该确切值将成为注册和令牌存储的键。

### 遵循注册优先级

当客户端与所选发行方已有明确关系时，使用预注册的客户端信息。否则，当授权服务器通告支持时，优先使用 Client ID Metadata Documents。仅在作为已弃用的兼容回退时使用 DCR，若这些机制都不可用，则提示用户输入客户端信息。

### 优先使用 Client ID Metadata Documents

Client ID Metadata Document 向授权服务器提供一个 HTTPS URL，它既是客户端标识符，也是其元数据的位置：

```json
{
  "client_id": "https://client.example.com/oauth/metadata.json",
  "client_name": "Notes desktop client",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:8765/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}
```

授权服务器获取并校验该文档。`client_id` 必须是带路径的 HTTPS URL，文档内的值必须与该 URL 完全一致。必需的文档字段是 `client_id`、`client_name` 和 `redirect_uris`。`application_type` 出现在本例中，但并非 CIMD 的必需字段。它的强制使用专门针对 DCR 路径。

将获取该文档视为对 SSRF 敏感的操作。解析并校验目标地址，拒绝环回、私有、链路本地及其他不允许的地址，在重定向和 DNS 变化后重新检查，限制重定向次数、字节数和时限，要求 JSON，且仅按经过校验的 HTTP 缓存控制进行缓存。将 `client_name` 和其他展示字段视为不可信文本。

CIMD 免除了为每次初次接触生成新的动态标识符的需要。它不会免除重定向 URI 校验、发行方策略或用户同意。

### DCR 是兼容路径

动态客户端注册在较旧的授权服务器上仍然可用，但对新的 MCP 实现而言已被弃用。

使用 DCR 时，声明 `application_type`：

```json
{
  "client_name": "Notes desktop client",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:8765/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}
```

- 桌面、移动、命令行和环回客户端使用 `native`。
- 远程托管的浏览器应用使用 `web` 和远程 HTTPS 重定向。

省略该字段可能在 OpenID Connect 注册实现中默认为 `web`，导致合法的环回重定向失败。

将 DCR 代码置于明确的回退决策之后。不要在任意的 CIMD 校验失败后静默回退。这会把一次安全失败转变为一条更弱的注册路径。

### 将凭据绑定到发行方

将发行方签发的注册材料存储在确切的发行方键之下：

```text
issuer_credentials[issuer] = pre_registered_or_dcr_client
tokens[(issuer, resource)] = access_token
```

如果受保护资源发现从 `https://auth-one.example` 变为 `https://auth-two.example`，需重新评估信任。绝不要将第一个发行方的客户端密钥、DCR client id、注册访问令牌、刷新令牌或访问令牌发送给第二个。预注册客户端和 DCR 客户端必须使用为新城发行方签发的凭据。

CIMD 客户端 id 则不同，因为它是自托管的 HTTPS URL，而非由授权服务器签发的凭据。同一个 CIMD URL 是可携带的：新的受信任发行方可以直接获取并校验该文档，无需重新进行 DCR 注册。但授权响应和令牌仍须在新发行方之下校验和存储。

### 使用 PKCE 的授权码流程

交互式流程为：

1. 生成高熵的 `code_verifier`。
2. 推导 S256 `code_challenge`。
3. 发送带有确切 `client_id`、`redirect_uri`、`scope`、`code_challenge` 和 `resource` 的授权请求。
4. 接收包含 `code` 以及（若提供）`iss` 的授权响应。
5. 在使用任何响应字段之前，先对照记录的确切发行方校验 `iss`。
6. 使用 `code_verifier`、相同的重定向 URI 和相同的 `resource` 兑换授权码。
7. 将得到的令牌存储在 `(issuer, resource)` 之下。

来自 RFC 8707 的 `resource` 参数同时出现在授权请求和令牌请求中。它标识规范化的 MCP 服务器 URI。

### 精确校验 `iss`

RFC 9207 防止一个发行方的授权响应与另一个发行方的响应相混淆。

当 `iss` 存在时，将其与记录的发行方进行比较，不进行大小写折叠、末尾斜杠调整、默认端口移除或百分号编码规范化。若不匹配，不要对该授权码采取任何行动，甚至不要显示该响应中攻击者可控的错误详情。

包含 `iss` 的授权服务器会通告 `authorization_response_iss_parameter_supported: true`。即使缺少该通告，现有客户端仍会校验存在的 `iss`。

### 在 MCP 服务器校验受众

资源服务器只接受为其自身签发的令牌：

```text
token.issuer == configured_authorization_server
token.audience == canonical_mcp_resource
```

无效、过期、发行方错误或受众错误的令牌都会收到 401。MCP 服务器绝不能接受或传递面向其他服务的令牌。

### 请求当前所需的最小作用域

从当前所需的作用域开始。如果后续工具需要更多权限，服务器返回带权威作用域质询的 403：

```text
WWW-Authenticate: Bearer error="insufficient_scope",
  scope="notes:delete",
  resource_metadata="https://notes.example.com/.well-known/oauth-protected-resource/mcp"
```

客户端解释新权限，征得同意，以合并后的作用域集合执行新的授权流程，然后用新的 JSON-RPC id 重试 MCP 请求。

不要假设被质询的作用域是 `scopes_supported` 的子集。该质询对当前操作具有权威性。

### 授权与无状态的 MCP 线路

经过授权的工具调用仍携带完整的当前请求信封：

```text
POST /mcp
Authorization: Bearer <access-token>
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.delete
```

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "method": "tools/call",
  "params": {
    "name": "notes.delete",
    "arguments": {"id": "note-7"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "oauth-lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

令牌为主体授权。请求元数据协商协议行为。二者不能相互替代。

以固定顺序校验线路：先校验 JSON-RPC 与元数据类型，再校验头部与正文的一致性，最后校验协议支持。路由或版本头部不匹配返回 HTTP 400 并带 `-32020`。如果头部与正文一致但版本不受支持，返回 HTTP 400 并带 `-32022` 和恰好为 `{"supported":["2026-07-28"],"requested":"<actual>"}` 的 `data`。未知方法返回 HTTP 404 并带 `-32601`。

每个请求错误，包括 401 无效令牌和 403 作用域不足，都是带有原始请求 `id` 的 JSON-RPC 错误信封。结构化恢复信息放入可选的错误 `data` 中；`WWW-Authenticate` 仍作为 HTTP 响应头。通知没有 `id`，因此不会收到 JSON-RPC 响应体。被接受的 HTTP 通知返回 202 和空响应体。

服务器实现了 `server/discover` 并通告工具，因此它也实现了必需的 `tools/list` 方法。其工具描述符具有稳定的名称、描述和以对象为根的 `inputSchema` 值。该列表是确定性的，返回 `resultType`、服务器身份元数据、有界的 `ttlMs` 以及 `cacheScope`。发现功能和与用户无关的工具列表可以在授权之前可用。若其中任一随主体变化，则应用常规策略和私有缓存。

### 禁止令牌透传

MCP 服务器不得将客户端的 MCP 访问令牌转发给下游 API。应使用正确受众获取单独的下游令牌，或采用显式的令牌交换设计。只有当各服务拒绝为他人签发的令牌时，受众校验才有效。

### 刷新令牌

刷新令牌是可选的。一旦签发，应机密存储并按发行方和资源作为键。不要假设它们一定存在。在授权服务器支持轮换时轮换它们，并检测已失效值被重用的情况。

```figure
t3-scope-stepup
```

## 动手构建

`code/main.py` 是一个进程内协议与授权模拟器。它实现了受保护资源发现、授权服务器元数据、CIMD 注册、版本门控的 DCR 回退、应用类型检查、PKCE、发行方校验、资源绑定令牌、作用域逐步提权、`server/discover`、`tools/list` 以及无状态工具请求。

该模型接收解析后的请求体和路由头部。它不是完整的 HTTP 适配器，不解析 `Content-Type` 或 `Accept`。可将其接入第 09 课的 Streamable HTTP 适配器，后者要求 `Content-Type: application/json` 以及同时包含 `application/json` 和 `text/event-stream` 的 `Accept` 值。

运行它：

```bash
cd phases/13-tools-and-protocols/16-mcp-security-oauth-2-1
python3 code/main.py
python3 -m unittest discover code/tests -v
```

输出依次展示发现流程、CIMD 注册、一次普通读取、两次独立的作用域逐步提权，以及按发行方键控的凭据存储。

## 投入使用

将模拟器对象映射到生产组件：

- `ResourceServer.protected_resource_metadata` 成为 RFC 9728 端点。
- `AuthorizationServer.metadata` 成为 RFC 8414 或 OpenID Connect 发现。
- `Client.enroll` 成为 CIMD 解析加上显式的 DCR 兼容分支。
- 发行方签发的客户端凭据和 `tokens_by_issuer_resource` 成为加密记录。CIMD URL 可以保持可携带性，而其授权结果仍绑定于发行方。
- `ResourceServer.handle` 成为中间件，在分发之前校验当前 MCP 头部、令牌和工具作用域，同时将每个请求错误放入匹配的 JSON-RPC 信封。

## 发布它

本课发布了 `outputs/skill-oauth-scope-planner.md`。它现在涵盖了注册优先级、发行方绑定的凭据存储、应用类型、PKCE、资源指示符、作用域质询以及当前的无状态请求边界。

## 练习

1. 添加刷新令牌轮换，并拒绝重用上一个刷新令牌。
2. 添加发行方允许列表。当发行方变化时，仅复用可携带的 CIMD URL；拒绝之前发行方签发的所有凭据和令牌。
3. 为授权码添加过期时间，并确认延迟兑换会失败。
4. 构建一个使用远程 HTTPS 重定向的 Web 客户端变体，并将其 DCR 元数据与原生客户端进行比较。
5. 在同一发行方下添加第二个资源。确认其访问令牌不能用于第一个资源。

## 关键术语

| 术语 | 含义 |
|------|---------|
| 受保护资源元数据 | 标识资源与授权服务器的 RFC 9728 文档 |
| CIMD | 其 URL 即 OAuth 客户端标识符的 HTTPS 元数据文档 |
| DCR | 出于兼容性保留的已弃用动态客户端注册 |
| `application_type` | `native` 或 `web`，用于校验重定向 URI 规则 |
| PKCE | 保护被截获授权码的验证器和 S256 质询 |
| `iss` | RFC 9207 授权响应中的发行方标识符 |
| 资源指示符 | 将令牌请求绑定到 MCP 资源的 RFC 8707 参数 |
| 受众 | 令牌对其有效的资源 |
| 逐步提权 | 为额外的当前操作作用域进行的新同意与令牌签发 |
| 发行方绑定的凭据 | 按确切的授权服务器发行方隔离的注册和令牌记录 |

## 延伸阅读

- [MCP 2026-07-28 授权规范](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [RFC 9728: OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728)
- [RFC 8707: Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707)
- [RFC 9207: OAuth 2.0 Authorization Server Issuer Identification](https://www.rfc-editor.org/rfc/rfc9207)
- [OAuth Client ID Metadata Document 草案](https://datatracker.ietf.org/doc/draft-ietf-oauth-client-id-metadata-document/)