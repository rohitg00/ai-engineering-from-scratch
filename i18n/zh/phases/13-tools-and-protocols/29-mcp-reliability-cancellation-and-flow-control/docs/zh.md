#  MCP可靠性,取消和流量控制

> 请求 ID 与消息相关,它不会使副作用安全,阻止一个工作者,或者保护一个流量免受缓慢的消费者.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lessons 09 and 13
**Time:** ~120 minutes

## 学习目标

- 执行stdio和流式HTTP的正确取消信号.
- 解决完成和取消比赛,而没有在取消后发送消息.
- 单独取消请求与持久的取消`tasks/cancel`它们是什么意思?
- 根据副作用和明确的无能度关键,重新尝试决策.
- 限制进步队列,同时保留最终的回复.
- 通过重新连接,重新调整和动的后退来恢复流.

## 问题

幸福之路隐藏着最昂贵的分布式系统 bug.

客户端调用工具.服务器开始工作. 进程到达. 代理缓冲流. 客户端达到其时间过期,然后断开. 服务器完成一毫秒后. 客户端重新尝试一个新的JSON-RPCID. 突变运行两次.

系统在全球范围内失败.

虽然MCP定义了消息和运输行为,但您的应用程序仍然拥有:

- 时间预算;
- 商业自由;
- 边界排队;
- 复试分类;
- 持续任务状态;
- 重新联系和重新调整政策.

通过这种方式,我们可以将这些决定构成一个确定性模拟器.
没有休息,插座或随机故障.
一个同步的线程测试迫使两个账本客户竞争
对于相同的无权重关.

## 取消请求是具体的交通

客户不再需要飞行结果. 电线信号不同.

### 工作室

通过使用一个共享的双向频道,客户端发送通知:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/cancelled",
  "params": {
    "requestId": 41,
    "reason": "User closed the operation"
  }
}
```

服务器没有发出任何JSON-RPC响应.

服务器应停止工作,释放资源,避免发送取消请求的回复. 当请求未知,已经完成或无法安全地停止时,它可能会忽视取消.

由于这些比赛被错误化,将会导致更多的比赛.

### 流式 HTTP

现代流式HTTP给每个请求自己的HTTP响应或SSE响应流.客户端通过关闭该请求的响应流取消.

不要发帖`notifications/cancelled`关闭流是取消信号.

一旦服务器观察到断开,该服务器应停止工作,不得再发送更多的信息.

### 服务器发送的取消是狭窄的

服务器不使用`notifications/cancelled`在工作室,服务器发送的取消仅用于终止一个 `subscriptions/listen`保持该路径与普通客户请求取消分开.

## 取消是一个种族

两项活动订单都有效.

### 取消的胜利

```text
request starts
client sends cancellation signal
server marks request cancelled
worker reaches completion
server suppresses the response
```

### 完成胜利

```text
request starts
worker commits the result
server sends the response
cancellation arrives late
server ignores the late notification
```

网络延迟意味着双方都无法证明另一方首先观察到哪个事件.

```figure
mcp-reliability-race
```

我们学会了什么?`RequestCoordinator`存储一个终端状态.`complete()`取消后没有回复. 取消迟到不能改变已完成的记录.

## 时间限制需要两个钟

一个无活动计时器不够.

使用两个限制:

1. **Idle timeout.**要求可能不会产生有用活动的时间.
2. **Maximum timeout.**要求开始时的绝对墙壁时钟预算.

进步可能会重新设置空时钟,

```text
start: 0 ms
progress: 400 ms
progress: 800 ms
progress: 1200 ms
idle timeout: 500 ms
maximum timeout: 2000 ms
```

在 1500 ms 时,请求仍然活跃,因为最新的进展仅仅是300 ms 时.在 2000 ms 时,最大的截止日期会取消它,即使在 1999 ms 时,另一个进展事件也会出现.

服务器可以接受一个进步代币,并且不会发出任何更新.

必须增加MCP进步值.通知完成或取消后停止. 速度限制进步,以便快速工人无法淹没运输.

## 取消请求是没有的`tasks/cancel`

这些机制可以解决不同的生命.

| Mechanism | Target | Signal | What success means |
|-----------|--------|--------|--------------------|
| Request cancellation on stdio | One in-flight RPC | `notifications/cancelled` | Client abandoned the request; server should stop if practical |
| Request cancellation on HTTP | One in-flight response stream | Close the stream | Client abandoned the request; server should stop if practical |
| `tasks/cancel` | One durable Task | Ordinary MCP request | Server acknowledged cancellation intent |

一个成功的人`tasks/cancel`工作人员的工作可能仍然在工作中.`working`工人检查站观察旗之前.工作可能在该检查站之前完成.

当HTTP连接关闭时,不要删除持久任务状态.创建任务的原因是其生命周期超过一个请求和一个连接.

## 新的JSON-RPCID不是无效

 JSON-RPC id 相关请求和响应.它们不识别一个业务操作.

假设客户提交一个指控,`41`输出了回应,然后再试用ID`42`服务器看到两个不同的消息. 没有应用程序密钥,它不能知道它们代表一个支票.

无权密钥标识了商业意图:

```json
{
  "name": "charge_account",
  "arguments": {
    "account": "acct-7",
    "cents": 1200,
    "idempotencyKey": "checkout-7"
  }
}
```

服务器存储:

- 关键;
- 操作论证的指纹;
- 承诺的结果.

同样的关键和相同的参数返回存储的结果.同样的关键与不同的参数被拒绝. 这防止意外重复使用的关键改变了不同的业务操作.

### 总账边界必须是原子和持久的

这种序列是不安全的:

```text
check key
run mutation
store result
```

两个工人可以观察一个缺失的钥匙,
在效果之后,但在商店之前,重新尝试时会产生相同的模糊性.

课程使用文件支持的SQLite账本.`BEGIN IMMEDIATE`连续化
密钥检查,模拟业务效果,执行计数,以及存储成绩
两个独立的账本连接,用相同的密钥竞争
因此,观察一个承诺结果和一个执行.
记本保存了记录.

根据存储的JSON,每一个返回值都被重建.
由于本书所持的可变物体,因此更改返回的字典不能
后续复制结果.

模拟器的商业效果是收件和执行柜台
实际的支付,部署或外部API调用是
只有通过写一个本地表来制造原子.
共有数据库交易,交易输出箱或上游供应商
只有一个过程锁,不能保护
复制或重启.

### 复试矩阵

在实施之前重新分类尝试.

| Class | Example | Retry rule |
|------|---------|------------|
| Safe | Deterministic read with no side effect | Retry with a new JSON-RPC id after the failure boundary is understood |
| Conditional | Mutation with a durable idempotency key | Retry with the same key and identical arguments |
| Unsafe | Mutation without business deduplication | Do not retry automatically; reconcile first |

工具注释如`readOnlyHint`其他`idempotentHint`应用程序合同和服务器实现决定了重新尝试安全性.

## 压力是正确的部分

无限排队将缓慢转化为记忆耗尽.

通过一个有限的排队来定义可能丢失的东西.

进步可替换.后来的进步值取代了之前的值.最终的JSON-RPC响应是无法替换的.

课程缓冲适用于以下政策:

1. 为了同样实现相邻的进展.
2. 能达到最大的容量时,就放弃最古老的进步.
3. 标记流需要权威的改造.
4. 保存最后的反应.
5. 拒绝一个状态, 保存最终反应需要放下另一个最终反应.

丧不是一个策略.

### 代理缓冲

一个服务器可以正确流动,而一个反向代理在缓冲中保存事件.

为了获得SSE的回应,请发送:

```http
Content-Type: text/event-stream
Cache-Control: no-cache
X-Accel-Buffering: no
```

2026 流式HTTP规范建议`X-Accel-Buffering: no`让兼容的代理人立即传递事件.

对于静静长期的流,定期发出SSE评论:

```text
:
```

客户忽略评论行,中间人看到流量,更不太可能关闭空置连接.

保持效率不是进步. 不要仅仅因为输送评论到达,重新设置操作的语义空置时间.

## 连接意味着重新连接

现代流式HTTP不支持可重启的SSE通过 `Last-Event-ID`现在,我们要去.

在一个`subscriptions/listen`流量下降:

1. 打开一个新的听取请求,使用新的JSON-RPCID.
2. 恢复所需的订阅过器.
3. 根据权威方法,重新查找所影响的工具,资源,提示或任务.
4. 通过稳定标识符进行减复应用状态.
5. 不要因为没有反应而重复一个不安全的突变.

样本回收计划明确规定`sendLastEventId`其他地方的资源.

### 防止重新连接的群体

如果1万个客户在1秒内重新连接,恢复服务器再次失败.

课程计算了客户端ID和尝试号码的确定性 jitter,因此测试仍然可复制:

```text
attempt 0: up to 250 ms
attempt 1: up to 500 ms
attempt 2: up to 1000 ms
...
cap: 8000 ms
```

产品可以使用加密安全或运行时间随机性. 不变量是分布,而不是特定的公式.

## 建立它

`code/main.py`构建了五个小型可靠性组件.

### `RequestCoordinator`

- 开始在飞行时提出的空置和最高截止日期请求;
- 发出单调的进展通知;
- 产生正确的stdio或HTTP取消信号;
- 忽略无效的取消通知;
- 明确取消和完成终端比赛;
- 保留服务器发送的取消,

### `MutationLedger`

- 证明两个JSON-RPCID没有商用密钥执行两次;
- 使用文件支持的SQLite交易进行键检查,模拟效果,
  执行计数和结果承诺;
- 在一个独立的无能率键下,将匹配的参数进行排版
  账本连接;
- 拒绝使用不同的参数重复使用的单个关键;
- 恢复了防守副本,并保存了已提交的记录.

### `DurableTaskService`

- 确认取消请求;
- 能完成任务`working`直到工人检查站;
- 证明确认为什么不是最终状态.

### `BoundedSseBuffer`

- 压力下合或降低进展;
- 记录需要进行权威的改编;
- 没有任何最终反应.

### 恢复人员

- 返回安全的代理SSE标题和保留意见;
- 建立重新连接和重新调整计划;
- 扩散复试, 具有决定性指数的反弹和.

## 用它

根据数据库根:

```bash
cd phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

演示程序运行了中央竞赛的两侧,
在临时文件支持的本书中,除复制突变,超载了有限的
显示一个持续的任务从已确认的取消移动
工人观察到的取消.

## 互动实验室

运行四次活动,没有增加睡眠.

1. 开始请求`A`取消,然后打电话`complete()`现在,我们要去.
2. 开始请求`B`完成,然后取消.
3. 开始请求`C`在每一个空的最后期限之前发出进展,然后超过最大的最后期限.
4. 开始请求`D`通过流式HTTP,关闭其响应流.

记录每个场景:

- 终端请求状态;
- 是否存在最终回应;
- 放到电线上的取消信号;
- 客户应该忽略哪个事件.

然后改变`D`操作是相同的,但取消信号必须改变.

## 实践实验室

添加一个`reserve_inventory`变化到`MutationLedger`现在,我们要去.

要求:

1. 密钥将 SKU,数量,租户和运营名称绑定.
2. 通过相同的键和相同的参数再次尝试,将返回第一个预订.
3. 没有另一个保留,改变数量的重试失败.
4. 执行但失去了回应的执行可以通过关键调和.
5. 结果没有记录秘密或支付数据.
6. 如果客户端未提供钥匙,则将自动重新尝试禁用.
7. 在决定接下来要做什么之前,添加一个模拟的订阅下降,
8. 在一个屏障中启动两个账本连接,并提交相同的键
   确认已提交一个保留.
9. 转换返回的首个预订对象. 重复播放键,证明
   存储结果没有改变.
10. 关闭和重新打开本书文件,然后按键调整预订.

实验室诚实:如果库存存存入另一个服务,
服务接受相同的无权密钥,或者是否是交易输出箱
桥梁,地方的承诺是远程效应.

## 运输的文物

`outputs/skill-mcp-reliability-reviewer.md`提供MCP操作,运输,时间限度政策,重试行为,队列政策和恢复计划.它返回比赛表,重试分类,无能度边界,流量控制检查和故障装置.

## 检查

如果这些说法是真的,课程就会完整:

- 工作室取消发送`notifications/cancelled`他没有得到任何回应.
- 流式HTTP取消关闭请求流,并不会发送取消POST.
- 取消前完成抑制最终反应.
- 完全取消之前保留响应,忽略迟到取消.
- 进步可以重新设置空置时间,但永远不会达到最大的时间.
- 单独一个新的JSON-RPCID再次执行突变.
- 一个无效键和相同的参数执行一次在同时
  两连接的比赛.
- 复制后,可以恢复,反复复复制后,可以恢复.
- 转换返回结果不能改变存储的结果.
- 限制式缓冲器保持容量内,保持最终反应.
- 连接重新使用新的请求,不发送`Last-Event-ID`并且重新调整受影响的状态.
- `tasks/cancel`确认将使任务不终结,直到工人遵守它.

## 生产失败模式

| Failure | Observable symptom | Correct response |
|---------|--------------------|------------------|
| HTTP client POSTs cancellation notification | Server and client disagree about request lifetime | Close the request's SSE response stream |
| Server responds after accepted cancellation | Client receives an unusable late result | Stop work and suppress further messages when cancellation wins |
| Progress resets every deadline | Hung work survives forever | Keep a separate absolute maximum timeout |
| New RPC id treated as deduplication | Charge, deployment, or deletion runs twice | Add a durable application idempotency key |
| Key check and effect are separate | Concurrent workers both observe a missing key | Commit key claim, effect record, and result atomically |
| In-memory ledger used across replicas | Restart or another worker forgets prior commits | Use shared durable storage or upstream idempotency |
| Stored mutable result returned directly | Caller mutation corrupts later replays | Serialize committed results and return defensive copies |
| Key reused with changed arguments | One key aliases two business intents | Store and compare an argument fingerprint |
| Unbounded progress queue | Memory rises with a slow consumer | Coalesce and drop replaceable progress within a bound |
| Final response dropped under pressure | Client cannot know the request outcome | Reserve capacity or evict progress, never the final response |
| Proxy buffers SSE | Progress arrives in bursts or after timeout | Disable buffering and configure compatible proxy timeouts |
| `Last-Event-ID` assumed | Client resumes from state the server does not support | Reconnect with a new request and refetch |
| Every client reconnects immediately | Recovery creates another outage | Use capped exponential backoff with jitter |
| Task ack treated as final cancellation | Worker keeps running after UI says stopped | Poll the Task until a terminal status |

## 石连接

工具生态系统的终点石应该将可靠性视为可执行的证据,而不是建筑图中的段落.

需要这些文物:

- 每辆运输的取消赛车记录;
- 每个暴露的突变的重试表;
- 无效密钥记录和不匹配装置;
- 一次同步的相同密钥转录,重新开放检查和突变代号检查;
- 限制缓冲过载结果;
- 逆代理SSE标题和空置政策;
- 连接计划,其中列出了权威的重复方法;
- 终点石使用Task时,具有持久的任务取消痕迹.

绿色要求在本地过程中证明了只有幸福的道路. 失败的反应,迟到的取消,消费者缓慢和重新连接的群体产生决定性结果时,终点石是生产准备的.

## 关键词

| Term | Meaning |
|------|---------|
| Request cancellation | Abandonment of one in-flight MCP request |
| Cancellation race | Competition between terminal completion and cancellation events |
| Idle timeout | Limit since the last useful request activity |
| Maximum timeout | Absolute limit from request start, unaffected by progress |
| Idempotency key | Application identifier that deduplicates one business intent |
| Atomic ledger | Durable boundary that commits the key claim, effect record, and result as one unit |
| Backpressure | Control applied when producers outpace consumers |
| Progress coalescing | Replacing older progress with a newer authoritative value |
| Refetch | Reading current state again after a stream gap |
| Jitter | Deliberate variation that spreads retries across time |

## 进一步阅读

- [MCP Cancellation](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/cancellation)
- [MCP Progress](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/progress)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Tasks Extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
