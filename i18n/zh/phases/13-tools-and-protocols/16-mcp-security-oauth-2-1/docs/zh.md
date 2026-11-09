# 发行商的授权:CIMD,发行商的约束,PKCE和步骤

> 远程MCP请求是无国有的,但其授权并非匿名的. 绑定所有凭证与创建它的发行者,以及每一个代币与接收它资源.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 15 (security)
**Time:** ~90 minutes

## 学习目标

- 通过保护资源的元数据发现授权服务器.
- 优先使用客户ID的元数据文件,而不是过时的动态客户端注册.
- 声明正确的`application_type`如果 DCR 兼容性路径是不可避免的.
- 验证授权响应`iss`并且按发行人分隔证书.
- 使用PKCE,资源指标,观众验证和增量范围.
- 发送授权MCP 2026-07-28请求,而无需协议会议.

## 问题

远程MCP服务器可能会阅读私人记录,写外部系统或启动昂贵的工作.身份验证告诉它谁提交了凭证.权限还必须回答:

- 哪个授权服务器发出了凭证?
- 什么MCP资源是标志?
- 哪个客户端和转向URI完成了流动?
- 用户批准了哪些操作?
- 这一要求是否仍然符合批准?

根据"2026-07-28"授权配置文件,客户注册和发行商处理都会变得更加严格.`application_type`根据RFC 9207的证券交易条例,证券交易条例 (RFC 9207) 证券交易条例 (RFC 9207) 证券交易条例 (RFC 9207) 证券交易条例 (RFC 9207) 证券交易条例 (RFC 9207) 证券交易条例 (RFC 9207) 证券交易条例 (RFC 9207) 证券交易条例)

它们不恢复了核心握手或`Mcp-Session-Id`现在,我们要去.

## 概念

### 了解三个角色

- **MCP client:**代表资源所有者发送请求.
- **MCP resource server:**接受访问令牌并为MCP终端服务.
- **Authorization server:**认证资源所有者,收集同意,并发行代币.

资源服务器和授权服务器可以一起运行,但保持其识别器和验证责任分开.

### 权限适用于HTTP

基于HTTP的运输应用MCP授权规范.本地工作室服务器在进程和操作系统的信任边界下运行.仅仅为了对称性,不要添加虚假浏览器OAuth流向工作室.

对于远程流向 HTTP,将载体代币发送到 `Authorization`每次请求都会有标题.

### 开始使用保护资源的元数据

资源服务器发布RFC 9728的元数据:

```json
{
  "resource": "https://notes.example.com/mcp",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["notes:delete", "notes:read", "notes:write"]
}
```

客户端从MCP资源URL开始,获取此文档,选择广告授权服务器,然后获取该服务器的OAuth或OpenID连接元数据.

在构建RFC 9728的知名URL时保存资源路径.`https://notes.example.com/mcp`这一课使用了`https://notes.example.com/.well-known/oauth-protected-resource/mcp`放下了`/mcp`后可以选择同一来源的不同受保护资源的元数据.

根据主机名,不要猜测授权服务器.不要跟踪从未验证的错误机构发现的发行商.保持客户愿意信任的发行商政策.

### 验证授权服务器元数据

转载数据的数据应显示终端点和支持的控制:

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

需要S256来编写PKCE.记录出发行器的精确字符串. 这正确值成为注册和代币存储的关键.

### 按照注册优先级

使用预注册客户端信息,如果客户端已经与选择的发行商有明确关系.否则,当授权服务器广告支持时,更喜欢客户端ID元数据文件.仅使用DCR作为过时兼容性后退,然后要求客户端信息,如果这些机制中没有任何可用.

### 优先使用客户端ID 转载文件

客户端ID的元数据文档给权限服务器一个HTTPSURL,它既是客户端识别器,也是其元数据的位置:

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

授权服务器将文件获取并验证.`client_id`文件中值必须是相同的URL. 需要的文件字段是`client_id`现在`client_name`其他`redirect_uris`现在,我们要去.`application_type`根据CIMD的规定,该系统的使用是CIMD的新要求.

处理文件的获取作为SSRF敏感操作.解决和验证目的地,拒绝循环回归,私人,链接本地,以及其他不允许的地址,重新检查转向和DNS变更后,限制转向,字节和时间,需要JSON,并且只根据验证的HTTP缓存控制.`client_name`其他显示字段作为不可信的文本.

根据CIMD的规定,每次接触时都不需要打印新的动态标识符,不需要删除转向URI验证,发行方政策或用户同意.

###  DCR 是一个兼容性路径

动态客户端注册仍然可用于旧授权服务器,但对于新的MCP实现而言,它已经过时使用.

在使用DCR时,声明`application_type`其他:

```json
{
  "client_name": "Notes desktop client",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:8765/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}
```

- 桌面,移动,命令行和循环回复客户端使用`native`现在,我们要去.
- 使用远程托管的浏览器应用程序`web`通过远程HTTPS转向.

省掉该字段可能会默认到`web`在OpenID Connect注册实现中,并未实现合法循环回转向.

保持DCR代码在明确的反弹决定背后. 随意后退后CIMD验证失败后不要沉默地回落. 这可能会使安全失败成为一个更弱的注册路径.

### 绑定证书给发行人

存储发行人注册材料,以发行人名为:

```text
issuer_credentials[issuer] = pre_registered_or_dcr_client
tokens[(issuer, resource)] = access_token
```

如果保护资源的发现从 变化`https://auth-one.example`为了`https://auth-two.example`任何其他公司都必须使用其新发行商发行的凭据,如: 首发行商的客户密码,DCR客户ID,注册访问代币,更新代币或访问代币.

根据CIMD的数据,CIMD客户端的身份是不同的,因为它是一个自主托管的HTTPSURL,而不是授权服务器编制的凭证.同样的CIMD URL是可移植的:一个新的可信赖发行商在没有重新注册的DCR的情况下获取和验证了文档.授权回复和代币仍然被验证并存储在新的发行商下.

### 授权代码与PKCE

互动流程是:

1. 产生高气.`code_verifier`现在,我们要去.
2. 导出S256`code_challenge`现在,我们要去.
3. 发送授权请求的确切信息`client_id`现在`redirect_uri`现在`scope`现在`code_challenge`其他`resource`现在,我们要去.
4. 收到包含 许可的回复`code`提供时,`iss`现在,我们要去.
5. 验证`iss`在使用任何响应字段之前,对记录的确切发行者进行分析.
6. 换代码`code_verifier`转向的 URI,和相同的`resource`现在,我们要去.
7. 存储结果的代币在下面`(issuer, resource)`现在,我们要去.

其他`resource`参数从RFC 8707出现在授权和代币请求. 它识别了正规的MCP服务器URI.

### 验证`iss`确切地

标准规则9207防止一个发行商的授权响应与另一个发行商的响应混.

什么时候`iss`如果有,请与记录的发行商进行比较,而无需折叠案例,后续剪辑变化,默认端口删除或百分比编码正常化.

包含一个权限服务器`iss`广告`authorization_response_iss_parameter_supported: true`现在的客户仍然验证了礼物`iss`即使没有广告.

### 在MCP服务器上验证观众

资源服务器只接受为自己发行的代币:

```text
token.issuer == configured_authorization_server
token.audience == canonical_mcp_resource
```

无效,过期,发行错误或错误受众的代币收到401.MCP服务器不得接受或传输用于其他服务的代币.

### 要求最小的电流范围

如果后来的工具需要更多,服务器将返回403 带有权威的范围挑战:

```text
WWW-Authenticate: Bearer error="insufficient_scope",
  scope="notes:delete",
  resource_metadata="https://notes.example.com/.well-known/oauth-protected-resource/mcp"
```

客户端解释了新的许可,获得同意,执行了新的授权流程,并用新的JSON-RPCID重新尝试MCP请求.

不要假设所挑战的范围是`scopes_supported`挑战对目前的运营具有权威性.

### 授权和无国籍MCP线

授权工具调用仍然包含完整的当前请求包裹:

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

代币授权主任,请求元数据谈判协议行为,没有替代另一个.

验证线程以固定顺序:JSON-RPC和元数据类型,标题和体格等,然后支持协议.路由或版本标题不匹配返回HTTP 400与 `-32020`如果标题和体格同意不支持的版本,请返回HTTP 400`-32022`其他`data`完全是`{"supported":["2026-07-28"],"requested":"<actual>"}`未知方法返回了HTTP 404`-32601`现在,我们要去.

每个请求错误,包括401无效的代币和403不够的范围,都是一个包含原始请求的JSON-RPC错误包.`id`结构性恢复信息属于可选错误`data`其他`WWW-Authenticate`通知没有 文件的内容`id`通过 HTTP 通知,将返回 202 个空格.

服务器实现`server/discover`广告工具,因此它也执行强制性`tools/list`工具描述符具有稳定的名称,描述和对象根.`inputSchema`列表是确定性和返回的`resultType`服务器身份元数据,一个有限的`ttlMs`其他`cacheScope`查找和使用者独立的工具列表可在授权之前使用.

### 没有标志性通行

客户端的MCP访问代币不能转发到下游API. 获得一个独立的下游代币与正确的受众或使用明确的代币交易设计. 服务拒绝为别人发明的代币时,受众验证只能有效.

### 更新代码

更新代币是可选的.发行时,请保密存储它们,并按发行商和资源键键键.不要假设它们存在.当授权服务器支持旋转时,请旋转它们,并检测无效值的重复使用.

```figure
t3-scope-stepup
```

## 建立它

`code/main.py`是一个正在进行的协议和授权模拟器.它实现了保护资源发现,授权服务器元数据,CIMD注册,版本关闭DCR倒退,应用程序类型检查,PKCE,发行商验证,资源绑定代币,范围加大,`server/discover`现在`tools/list`没有国家,也没有国家.

该模型接收解析请求体和路由标题. 它不是完整的HTTP适配器,也不解析`Content-Type`或`Accept`连接到课程09的流式HTTP适配器,需要`Content-Type: application/json`其他`Accept`含有两者中的值`application/json`其他`text/event-stream`现在,我们要去.

运行它:

```bash
cd phases/13-tools-and-protocols/16-mcp-security-oauth-2-1
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

输出显示了发现首先,CIMD注册,普通阅读,两个独立的范围步骤,以及发行商密钥的凭证存储.

## 用它

映射模拟器对象到生产组件:

- `ResourceServer.protected_resource_metadata`成为RFC 9728终点.
- `AuthorizationServer.metadata`成为RFC 8414或OpenID Connect发现.
- `Client.enroll`成为CIMD分辨率加上明确的DCR兼容性分支.
- 发行商所证实的客户身份证和`tokens_by_issuer_resource`作为CIMD的网站,CIMD的网站可以保持可移植性,而其授权结果仍然是发行商的.
- `ResourceServer.handle`成为中间件,在发送之前验证当前的MCP标题,代币和工具范围,同时将每个请求错误都在匹配的JSON-RPC封装中保存.

## 运送它

这一课是很好的.`outputs/skill-oauth-scope-planner.md`现在它设计了注册优先级,发行商的认证存储,申请类型,PKCE,资源指标,范围挑战以及目前无国籍请求界限.

## 运动

1. 加入更新代币的旋转,并拒绝重新使用之前的更新代币.
2. 添加发行人权限列表.在发行人变更时,只使用可移植的CIMD URL;拒绝所有之前发行人硬币的凭证和代币.
3. 添加到授权代码的期限,并确认迟到的交换失败.
4. 建立一个使用远程HTTPS转向的网络客户端变体,并将其DCR元数据与本地客户端进行比较.
5. 确认其访问令牌不能在第一个资源上使用.

## 关键词

| Term | Meaning |
|------|---------|
| Protected-resource metadata | RFC 9728 document that identifies the resource and authorization servers |
| CIMD | HTTPS metadata document whose URL is the OAuth client identifier |
| DCR | Deprecated dynamic client enrollment retained for compatibility |
| `application_type` | `native` or `web`, used to validate redirect URI rules |
| PKCE | Verifier and S256 challenge that protect an intercepted authorization code |
| `iss` | RFC 9207 authorization response issuer identifier |
| Resource indicator | RFC 8707 parameter that binds a token request to an MCP resource |
| Audience | Resource for which a token is valid |
| Step-up | New consent and token issuance for an additional current-operation scope |
| Issuer-bound credentials | Registration and token records isolated by exact authorization server issuer |

## 进一步阅读

- [MCP 2026-07-28 authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [RFC 9728: OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728)
- [RFC 8707: Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707)
- [RFC 9207: OAuth 2.0 Authorization Server Issuer Identification](https://www.rfc-editor.org/rfc/rfc9207)
- [OAuth Client ID Metadata Document draft](https://datatracker.ietf.org/doc/draft-ietf-oauth-client-id-metadata-document/)
