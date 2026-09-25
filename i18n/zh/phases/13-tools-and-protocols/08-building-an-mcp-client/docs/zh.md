# 构建一个 MCP 客户端：发现、路由与双时代回退

> 一个现代的 MCP 客户端在每个请求上都会重复其契约。它最困难的兼容性决策，是判断一台旧服务器是真正的旧服务器，还是一台现代服务器在报告一个可纠正的错误。

**Type:** Build
**Languages:** Python
**Prerequisites:** 阶段 13，第 07 课
**Time:** ~85 分钟

## 学习目标

- 使用当前元数据构建每一个 MCP `2026-07-28` 请求。
- 使用 `server/discover` 探测 stdio 服务器，并选择一个双方都支持的版本。
- 仅对明确列入允许清单的对端授权进行有边界的旧版探测。
- 只有在校验了某个受支持修订版本的肯定性 `initialize` 结果之后，才接受旧版时代。
- 合并确定性的工具列表，而不默默地覆盖冲突项。
- 将调用路由到拥有对应工具的对端，而不是凭空发明协议会话。

## 问题

一个 agent host 通常要与不止一个 MCP 服务器通信。它必须发现每台服务器、合并工具目录、解决重名、路由调用，并从传输故障中恢复。

`2026-07-28` 修订版使稳态变得更简单，因为每个请求都是自包含的。兼容性则让启动过程更加微妙。客户端可能会遇到：

- 支持首选版本的现代服务器；
- 返回可识别版本或头部错误的现代服务器；
- 从未听说过 `server/discover` 的旧版服务器；
- 在收到 `initialize` 之前保持沉默的旧版服务器。

把每一个探测错误都当作旧版处理是危险的。格式错误的现代请求、过载的服务器、已死的进程和旧服务器，都可能产生相同的超时或连接关闭。这些信号是含糊的。客户端在选择旧版时代之前，必须将明确的运维意图与肯定性的协议证据结合起来。

## 概念

### 一个对端，而非一个协议会话

为每个服务器进程或端点保留一条传输对端记录：

- 传输句柄或发送函数；
- 已选定的协议时代与版本；
- 最近一次发现的服务器能力；
- 最近一次确定性工具列表；
- 用于关联的待处理请求 id；
- 传输健康状况。

这是客户端的记账信息。它不是协议会话状态。在现代 MCP 上，服务器仍然在每个请求中接收当前版本和能力。

### 从零开始构建每个现代请求

```python
def modern_request(request_id, method, params, version, capabilities):
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": method,
        "params": {
            **params,
            "_meta": {
                "io.modelcontextprotocol/protocolVersion": version,
                "io.modelcontextprotocol/clientCapabilities": capabilities,
                "io.modelcontextprotocol/clientInfo": CLIENT_INFO,
            },
        },
    }
```

不要把元数据一次性附加到一个连接对象上，然后假定它已到达线上。要在最终序列化的请求上打戳并检查它。

### 现代发现

`server/discover` 返回受支持的版本、服务器能力、说明、缓存提示和推荐的服务器身份。客户端选择双方都支持的最高的现代版本。

对于仅支持现代版的客户端来说，发现是可选的，但在 stdio 上建议使用。某些旧版服务器会在初始化之前接受操作，因此先发送 `tools/list` 可能产生一个含糊的成功结果。`server/discover` 建立了一个清晰的时代边界。

### stdio 兼容性探测

一个双时代的 stdio 客户端在任何其他请求之前，先发送带有其首选现代元数据的 `server/discover`。结果有三类：

1. **DiscoverResult。** 服务器是现代的。选择一个双方都支持的版本，并继续使用逐请求元数据。
2. **可识别的现代错误。** 服务器是现代的。对于 `-32022`，从 `data.supported` 中选择，并使用新的请求 id 重试。对于头部或能力错误，修正请求。不要发送 `initialize`。
3. **含糊信号。** 无法识别的 JSON-RPC 错误、超时、连接关闭或空响应，都不能确定时代。除非该确切对端已配置为旧版兼容，否则应“失败即关闭”（fail closed）。

可识别的现代协议错误包括：

- `-32020` HeaderMismatch
- `-32021` MissingRequiredClientCapability
- `-32022` UnsupportedProtocolVersion

即使对端在旧版允许清单上，可识别的现代错误仍然表明它是现代的。一旦服务器证明它理解现代错误词汇表，发送 `initialize` 就是一种降级。

不要把 `-32601` 当作肯定性的旧版证据。它只是使一个明确列入允许清单的对端有资格进行一次旧版探测。同样的规则适用于超时、连接关闭或空响应。

### 允许清单是运维意图，而非证据

旧版兼容性必须是一个被固定的对端配置上的显式属性：

```python
client.add_server("archive", archive_transport, allow_legacy=True)
```

把该选择绑定到已配置的命令或端点上。不要使用通配符，以免让任意服务器自行选择更弱的语义。没有 `allow_legacy=True` 的对端在发现结果含糊后会失败，并且永远不会收到 `initialize`。

允许清单授予的是探测许可。它并不选择时代。客户端在一个由传输层强制执行的期限内发送一个 `initialize`，然后要求以下全部条件：

- 一个 JSON-RPC `2.0` 响应，其请求 id 匹配；
- 恰好一个 `result` 且没有 `error`；
- 一个位于客户端已配置的旧版修订版本集合中的 `protocolVersion`；
- 一个对象类型的 `capabilities` 字段；
- 一个 `serverInfo` 对象，其 `name` 和 `version` 字段为非空字符串。

超时、连接关闭、错误响应、格式错误的结果、id 不匹配或不受支持的修订版本都会导致失败即关闭。只有结构有效的肯定性结果才能选择旧版时代。代码将 `legacy_probe_timeout_ms` 传递给传输适配器；真实的 stdio 或 HTTP 适配器必须强制执行该期限，而不仅仅是记录它。

为该传输对端缓存选定的时代。不要在每次调用前重新探测。

### 旧版是一条兼容性分支

一旦这个有边界的探测返回了有效的肯定性旧版证据，客户端就严格按照该修订版的定义使用选定的旧版版本：

1. 校验响应信封和关联 id。
2. 校验协商的修订版本位于已配置的旧版集合中。
3. 记录已校验的能力和服务器身份。
4. 只有在所有检查通过后才发送 `notifications/initialized`。
5. 在该传输生命周期内使用旧版请求形状。

这条分支的存在是为了与已知对端进行互操作。它不是新服务器或新请求的默认设计。如果传输重启或其端点发生变化，丢弃对端时代缓存并重新协商。

### 发现与缓存工具

对于每个活跃的对端，调用 `tools/list`。一个现代结果包含 `resultType`、`ttlMs` 和 `cacheScope`。在正确的授权上下文内遵守新鲜度提示。在过期或收到已订阅的列表变更事件之后重新获取。

客户端必须把旧版服务器缺失的 `resultType` 视为 `"complete"`。不要对来自较早协商时代的响应要求现代缓存字段。

服务器应返回确定性的排序。客户端在合并之前也应进行排序，这样本地注册表的顺序就不会取决于进程启动的时序。

### 冲突安全的命名空间合并

两台服务器可能都暴露 `search`。选择一个已声明的策略：

1. **冲突时加前缀。** 保留第一个规范名称，并把后续冲突暴露为 `<server>/<tool>`。
2. **冲突时拒绝。** 不加载重复项，并报告一个清晰的配置错误。
3. **默默覆盖。** 绝不使用。它隐藏了哪个服务器接收模型选择的操作。

同时存储规范名称和本地名称。模型看到的是规范名称。发出的 `tools/call` 使用拥有该工具的服务器声明的本地名称。

### 路由一次调用

路由是一次纯粹的查找：

```text
canonical tool name
  -> peer name + local tool name
  -> new JSON-RPC request id
  -> modern request metadata or explicit legacy shape
  -> matching response id
```

当调用所属的传输不可用时，不要发送该调用。重连或重启传输，然后重新运行发现和 `tools/list`。当操作的安全策略允许时，因传输中断而丢失的现代在途请求可以使用新的 JSON-RPC id 进行重试。

### 通知与订阅

现代的列表和资源变更只会到达客户端开启的 `subscriptions/listen` 流。客户端发送通知过滤器，等待 `notifications/subscriptions/acknowledged`，并使用通知元数据中的监听请求 id 关联事件。

断开连接时，开启一个新的监听请求，并重新获取相关的列表或资源。现代流不会通过 `Last-Event-ID` 恢复。

### 没有服务器发起的请求

现代服务器不会用独立的 JSON-RPC 请求来调用客户端以进行 sampling、elicitation 或 roots。它们返回 `input_required`，客户端在完成嵌入的输入请求之后重试原始请求。

在完成输入请求时，不要阻塞该对端的响应读取器。保持关联，并为重试创建一个新的 JSON-RPC id。

```figure
tp-client-merge
```

## 使用它

`code/main.py` 使用进程内的对端函数，因此协议决策保持可见。它连接到两个现代对端和一个有意列入允许清单的旧版对端，然后合并并路由它们的工具。传输可调用对象接收一个超时预算，因此兼容性分支无法隐藏一个无界限的探测。

```bash
cd code
python3 main.py
python3 -m unittest discover tests -v
```

测试证明了普通演示容易遗漏的边界：

- 现代请求重复元数据；
- `-32022` 在未初始化的情况下重试现代发现；
- 可识别的现代错误绝不降级，即使对端在允许清单上；
- 在没有允许清单的情况下，超时、连接关闭、空响应和无法识别的错误不会触发 `initialize`；
- 一个列入允许清单的对端只有在一个有效的、受支持的 `initialize` 结果之后才变为旧版；
- 格式错误和不受支持的旧版结果会使该对端保持不可用；
- 成功选定的时代会为该传输生命周期缓存。

## 发布它

本课发布 `outputs/skill-mcp-client-harness.md`。它搭建了现代请求打戳、stdio 时代协商、确定性命名空间合并、路由，以及一条失败即关闭的旧版兼容性分支。

## 练习

1. 让一个假服务器返回没有双方都受支持版本的 `-32022`。确认客户端会失败，而不是发送 `initialize`。
2. 允许一个假旧版服务器，让其有边界的 `initialize` 探测超时，并证明该对端保持 `unknown` 且不可用。
3. 为两个授权上下文添加 `cacheScope: "private"` 工具列表。确认客户端绝不会把一个上下文缓存的结果与另一个上下文共享。
4. 将冲突策略改为拒绝，并让启动失败，错误中包含两个对端的名称。
5. 添加一个有限的 `subscriptions/listen` 模拟器。在流丢失时，用新的请求 id 重新监听并重新获取工具。

## 关键术语

| 术语 | 含义 |
|------|---------|
| 对端 | 针对一个服务器传输及其发现数据的客户端侧记录 |
| 协议时代 | 现代的逐请求元数据或旧版的初始化语义 |
| 发现探测 | 用于识别 stdio 时代的初始 `server/discover` |
| 可识别的现代错误 | 证明现代行为并禁止旧版回退的错误 |
| 旧版允许清单 | 运维配置，允许对一个固定的对端进行一次有边界的兼容性探测 |
| 肯定性旧版证据 | 针对明确受支持的旧版修订版本的有效、已关联的 `initialize` 结果 |
| 合并后的命名空间 | 跨所有活跃对端的规范工具名称 |
| 冲突策略 | 针对重复工具名称的加前缀或拒绝规则 |
| 时代缓存 | 为一个传输对端存储的已选定的现代或旧行为 |
| 传输恢复 | 重启或重连、重新发现、重新列出，并使用新 id 安全重试 |

## 延伸阅读

- [MCP Specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/)
- [MCP Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP stdio Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)
- [MCP Versioning](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)