# 建立一个MCP客户端:发现,路由和双代回归

> 现代MCP客户端每次请求都会重复其合同. 它最难的兼容性决定是知道什么时候一个旧服务器真的老了,什么时候一个现代服务器正在报告一个可纠正的错误.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lesson 07
**Time:** ~85 minutes

## 学习目标

- 建立每一个MCP`2026-07-28`要求包含当前的元数据.
- 检查工作室服务器`server/discover`选择一个相互支持的版本.
- 允许仅限于被明确允许的同龄人进行有限遗产探测.
- 接受一个遗产时代,只有经过验证一个积极的时代.`initialize`支持的修订结果.
- 没有默默地覆盖碰撞的确定性工具列表.
- 通过调用每个工具的同行,而没有发明协议会议.

## 问题

代理主机通常与多个MCP服务器交谈.它必须发现每个服务器,将工具目录结合起来,解决重复名称,路线调用,并恢复运输故障.

其他`2026-07-28`复制使稳定状态更简单,因为每个请求都是自主化的.兼容性使启动更微妙.

- 支持首选版本的现代服务器;
- 现代服务器,返回已识别的版本或标题错误;
- 一个从未听说过的遗产服务器`server/discover`其他
- 一个遗留服务器,直到收到`initialize`现在,我们要去.

处理每一个探测器错误都是遗产的.一个错误的现代请求,一个过载的服务器,一个死进程,和一个旧的服务器都能产生相同的时间过关或连接关闭.这些信号是模糊的.客户端必须在选择遗产时代之前,将运营商的明确意图与积极的协议证据结合起来.

## 概念

### 一个同行,而不是协议会议

保持每个服务器进程或终端点的一个运输同行记录:

- 运输手柄或发送功能;
- 选择的协议时代和版本;
- 最后发现的服务器功能;
- 最后确定性工具列表;
- 暂未申请相关性身份证;
- 交通健康.

在现代MCP上,服务器仍然在每次请求中接收到当前版本和功能.

### 创建每一个现代要求从零开始

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

连接对象不要连接一次的元数据,假设它已经到达电线. 盖章并检查最终串行请求.

### 现代发现

`server/discover`返回支持版本,服务器功能,说明,缓存提示和推的服务器身份. 客户端选择最高的互助现代版本.

发现是当代客户端的选项,但在studio上建议.一些传统服务器在启动之前接受操作,所以发送`tools/list`首先可以产生模糊的成功.`server/discover`创造了一个清洁的时代界限.

### 工作室兼容性探测器

两代工作室客户发送`server/discover`需要在任何其他请求之前使用其首选的现代化元数据.

1. **DiscoverResult.**服务器是现代化的. 选择一个相互支持的版本,然后继续按请求进行元数据.
2. **Recognized modern error.**服务器是现代化的.`-32022`选择一个`data.supported`对于标题或功能错误,请纠正请求.不要发送`initialize`现在,我们要去.
3. **Ambiguous signal.**没有识别的JSON-RPC错误,截止时间,连接关闭或空响应不识别一个时代.除非该精确的同行配置为遗留兼容性,否则失败关闭.

已识别的现代协议错误包括:

- `-32020`标题不匹配
- `-32021`缺失要求 客户能力
- `-32022`无支持协议版本

认可的现代错误仍然是现代的,即使同行在遗留的允许列表上. 一旦服务器证明它理解现代错误词汇,发送`initialize`这将是降级.

不要治疗`-32601`只有一个被明确允许的同行才有资格接受一个被遗留的探测.同样的规则适用于时间过期,连接关闭或空响应.

### 允许列表是操作员的意图,而不是证据

遗产兼容性必须是一个固定同行配置的明确属性:

```python
client.add_server("archive", archive_transport, allow_legacy=True)
```

没有任何选择,请将其绑定到配置命令或终端点.不要使用一个允许任意服务器选择更弱的语义符号的野生卡.`allow_legacy=True`经过模糊的发现结果失败,`initialize`现在,我们要去.

允许者允许探测,而不是选择时代.`initialize`在运输的强制期限内,则要求所有以下内容:

- 一个JSON-RPC `2.0`答案与匹配请求ID;
- 完全是一个.`result`没有`error`其他
- 其他`protocolVersion`在客户端配置的传统修改集中;
- 值对象`capabilities`领域;
- 其他`serverInfo`无空字符串的对象`name`其他`version`其他地方

时间过关,连接关闭,错误响应,错误的结果,不匹配的ID或未支持的修改未能关闭.只有结构有效的正确结果才能选择遗产时代.代码通过`legacy_probe_timeout_ms`实际的STDIO或HTTP适应器必须执行该截止日期,而不是仅仅记录它.

预备选定的时代,不要在每次电话之前再次查询.

### 遗产是一个兼容之分支

一旦边界探测器返回有效的正确遗产证据,客户端使用所选的遗产版本,正如该修订所定义的那样:

1. 检查响应包裹和相关性ID.
2. 检查谈判修订在配置的遗产集中.
3. 记录验证的功能和服务器身份.
4. 发送`notifications/initialized`只有经过所有支票之后.
5. 使用已旧的请求形状,用于运输寿命.

运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的使用方式是: 运输系统的运输方式是: 运输系统的运输方式是: 运输系统的运输方式是: 运输方式是: 运输方式是: 运输方式是: 运输方式是: 运输方式是: 运输方式是: 运输方式是: 运输方式是: 运输方式是运输方式是: 运输方式是运输的运输方式是: 运输方式是: 运输的运输方式是:

### 发现和缓存工具

对于每位活跃的同龄人,请拨打`tools/list`现代化结果包括`resultType`现在`ttlMs`其他`cacheScope`根据正确的授权背景, 根据订阅过期或订阅过的变更事件, 重新收购.

客户必须处理一个失踪者`resultType`从一个旧服务器中`"complete"`对于一个早期的谈判时代的响应,不需要现代缓存字段.

服务器应该返回确定性排序. 客户端也应该在合并之前排序,以便本地注册表排序不取决于进程启动时间.

### 无碰撞名字空间的合并

两个服务器可能都会暴露`search`选择声明的政策:

1. **Prefix on collision.**保存第一名,并将后来的碰撞暴露为`<server>/<tool>`现在,我们要去.
2. **Reject on collision.**不要加载复制文件,并出现明显的配置错误.
3. **Silent overwrite.**永远不要使用这个,它隐藏了哪个服务器接收了模型选择的操作.

保存既正规名称和当地名称.模型看到正规名称.`tools/call`使用了所有者服务器声明的本地名称.

### 调用通话

路由是纯粹的搜索:

```text
canonical tool name
  -> peer name + local tool name
  -> new JSON-RPC request id
  -> modern request metadata or explicit legacy shape
  -> matching response id
```

没有可用的运输时不要发电,重新连接或重新启动运输,然后重新执行发现和`tools/list`现代飞行过程中在故障的运输中丢失的请求可在操作的安全政策允许时再使用新的JSON-RPCID.

### 通知和订阅

现代的列表和资源变更只会在客户端开放时发生`subscriptions/listen`客户端发送通知过器,等待`notifications/subscriptions/acknowledged`并且与通知元数据中的听取请求ID相关.

在断开电话时,打开一个新的听取请求,重新调整相关列表或资源.`Last-Event-ID`现在,我们要去.

### 没有服务器启动的请求

现代服务器不会用独立的JSON-RPC请求调用客户端进行样本采集,发出或根源.`input_required`客户端在完成嵌入式输入请求后重新尝试原始请求.

保持相关性,并创建一个新的JSON-RPCID,以便重新尝试.

```figure
tp-client-merge
```

## 用它

`code/main.py`通过使用在进程中的同行功能,使协议决策保持可见.它连接到两个现代同行和一个故意允许的遗产同行,然后合并并并路由他们的工具.运输调用器获得时间限期预算,因此兼容分支不能隐藏无限探测器.

```bash
cd code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

测试证明了正常演示所错过的界限:

- 现代请求重复元数据;
- `-32022`试图重新进行现代发现,而不需要初始化;
- 已认可的现代错误,甚至对于被允许的同行,从来没有降级;
- 时间停止,连接关闭,空置响应,未识别错误不会触发`initialize`没有允许的;
- 允许的同行仅在有效,支持后成为继承者`initialize`结果;
- 错误的和未支持的遗产结果使同行无法获得;
- 已成功选择的时代将为运输寿命存储在缓存中.

## 运送它

这一课是很好的.`outputs/skill-mcp-client-harness.md`它提供了现代的请求邮票,工作室时代的谈判,确定性命名空间的合并,路由和一个故障关闭的传统兼容分支.

## 运动

1. 让一个假的服务器返回`-32022`确认客户端失败,而不是发送`initialize`现在,我们要去.
2. 允许一个假的遗产服务器,使其有限`initialize`探测时间,证明同龄人留下了`unknown`没有任何东西.
3. 加入`cacheScope: "private"`确认客户端从来没有与另一个文本共享一个缓存结果.
4. 改变碰撞政策到拒绝,使启动失败,
5. 添加一个有限的`subscriptions/listen`在流失时,再用新的请求身份和重复工具来听.

## 关键词

| Term | Meaning |
|------|---------|
| Peer | Client-side record for one server transport and its discovered data |
| Protocol era | Modern per-request metadata or legacy initialization semantics |
| Discovery probe | Initial `server/discover` used to identify the stdio era |
| Recognized modern error | Error that proves modern behavior and forbids legacy fallback |
| Legacy allowlist | Operator configuration permitting one bounded compatibility probe for a pinned peer |
| Positive legacy evidence | Valid, correlated `initialize` result for an explicitly supported legacy revision |
| Merged namespace | Canonical tool names across all active peers |
| Collision policy | Prefix or reject rule for duplicate tool names |
| Era cache | Selected modern or legacy behavior stored for one transport peer |
| Transport recovery | Restart or reconnect, rediscover, relist, and retry safely with a new id |

## 进一步阅读

- [MCP Specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/)
- [MCP Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP stdio Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)
- [MCP Versioning](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
