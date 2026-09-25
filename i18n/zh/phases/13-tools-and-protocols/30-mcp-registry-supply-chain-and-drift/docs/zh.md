# MCP Registry 供应链：准入、漂移与回滚

> Registry 条目告诉你发布者声明了什么。生产准入则证明你获取了什么、观察到了什么、批准了什么，以及可以安全恢复什么。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13 · 17（网关与注册表）、Phase 13 · 18（生产环境认证）
**Time:** 约 90 分钟

## 学习目标

- 区分 Registry 发布、包来源、运行时发现与本地审批。
- 在不信任记录自身名称的前提下验证 MCP 服务器命名空间。
- 固定（pin）不可变的发布、执行来源、来源证明和在线描述符证据。
- 在准入之后检测 Registry 状态变化与运行时漂移。
- 将路由回滚到先前已准入的版本，而不改写历史。
- 维护一个可证明防篡改的准入账本，解释每一个决策。

## 问题所在

你在 Registry 中找到 `com.example/inventory`。它的描述看起来没问题。它的包存在。服务器对 `server/discover` 有响应。

这并不是一个事实。它是一串来自不同权威方的事实：

1. 某个通过命名空间认证的发布者提交了一条记录。
2. 包仓库以特定标识和摘要提供了某个工件。
3. 运行中的端点报告了协议版本、能力、工具以及诊断性服务器信息。
4. 你的组织决定允许这一精确组合。

把这些事实压缩成“它在 Registry 里，所以信任它”会造成供应链盲区。有效的发布仍可能被弃用。如果你不固定其摘要，包标签可能指向意外的工件。服务器可能在审查之后添加破坏性工具。回滚可能悄悄选中一个从未被准入的版本。

解决办法是一个在每个边界都保留证据的准入控制器。

## Registry 是索引，不是你的审批系统

官方 MCP Registry 存储服务器元数据。其 `server.json` 记录命名一个服务器版本，并声明一个或多个包或远程端点。发布规则增加了命名空间认证、包所有权检查、受限 Registry 规则，以及一个狭窄的发布者元数据存放位置。

这些控制回答的是发布问题。你的生产策略仍要回答部署问题：

| 边界 | 问题 | 证据所有者 |
|---|---|---|
| 命名空间 | 发布者是否被允许使用这个名称？ | Registry 认证加上你验证过的命名空间输入 |
| 记录 | 发布者对这个版本声明了什么？ | 不可变的 `server.json` 摘要 |
| 执行来源 | 哪个包或远程端点将执行？ | 声明的来源字段、经验证的所有权结果、传输方式与受信摘要 |
| 运行时 | 端点当前暴露了什么？ | `server/discover` 与工具描述符 |
| 准入 | 你的策略是否批准了这一精确集合？ | 本地 pin 与账本条目 |
| 运维 | 它是否仍然安全，什么可以替代它？ | 漂移检查、状态同步、健康检查与回滚路由 |

Registry 模式版本与 MCP 协议版本相互独立。一条记录可能使用已发布的 `2025-12-11` 服务器模式，而在线服务器支持 MCP `2026-07-28`。绝不要由其中一个推断另一个。

```figure
mcp-registry-admission
```

## 一个准入决策中的七项控制

### 1. 命名空间验证

官方 Registry 名称使用经认证的命名空间。一个经验证的域名可以映射到反转域名前缀。例如，控制 `example.com` 可以确立 `com.example/*`。

不要接受字符串前缀检查：

```python
server_name.startswith("com.example")
```

这同样会接受 `com.exampleevil/tool`。应按 `/` 拆分名称，要求 slug 非空，并精确比较命名空间段。更重要的是，将经验证的命名空间从认证结果传入准入。不要从不受信任的记录中推导信任。

基于 GitHub 的命名空间与基于域名的命名空间使用不同的认证路径。将任一路径规范化为一个准入输入：精确的经验证命名空间字符串。

### 2. 来源关联

对于包记录，声明与获取的工件必须在显式字段上关联：

- 包仓库类型
- 包标识符
- 包版本
- 经验证的所有权结果
- 下载工件的摘要

同时验证声明的包传输方式。只包含远程端点的记录是有效的，不得因缺少包而被拒绝。对于远程来源，应将声明的 URL 和传输类型与独立验证过的端点所有权，以及可信连接或部署证据的摘要关联起来。

示例代码支持两种来源类型，并将选定的来源与 Registry 来源、服务器名称、Registry 版本、记录摘要和证据摘要一起哈希。得到的来源摘要是指向完整证据集的紧凑指针。它不能替代保留证据本身。

绝不要接受仅由你正试图验证的工件提供的摘要。在可信的获取边界计算它，或从其验证结果经过你校验的包服务处接收。

### 3. 固定决策，而不只是版本

Registry 版本是唯一的发布标识符。已发布的元数据不可变。更改记录需要新版本。推荐使用语义化版本，但 Registry 不强制要求，也不接受版本范围。

这意味着 `^1.4` 不是准入 pin。“latest”也不是。一个有用的 pin 包含：

```json
{
  "server": "com.example/inventory",
  "version": "1.0.0",
  "recordDigest": "...",
  "source": {"kind": "package", "registryType": "pypi"},
  "sourceDigest": "...",
  "toolsetDigest": "...",
  "provenanceDigest": "...",
  "registryStatus": "active"
}
```

固定多个层次让你能识别哪个边界发生了变化。相同 Registry 版本下记录摘要变化是 Registry 完整性失败。相同包坐标或远程部署下来源摘要变化是执行来源完整性失败。工具集摘要变化是运行时漂移。

### 4. 在线漂移检测

准入应观察将真正接收流量的服务器。调用 `server/discover`，通过你的可信路径列出或以其他方式获取暴露的工具描述符，并验证：

- `2026-07-28` 在 `supportedVersions` 中
- 所有本地必需的能力都存在
- 每个工具描述符具有必需的标识与模式表面
- 后续检查中规范化后的描述符摘要与准入 pin 匹配

可选结果 `_meta["io.modelcontextprotocol/serverInfo"]` 值是自报告的显示、日志和调试上下文。将其记录为诊断证据，但绝不要用它确立命名空间、包所有权、端点所有权、准入或任何其他安全决策。`_meta` 之外的直接 `serverInfo` 别名不是契约字段，也不应被提升为诊断证据。

只规范化顺序无意义的字段。示例在哈希前按稳定名称对工具列表排序，因此无害的列表顺序变化不会引起漂移。它不会丢弃描述符字段。新工具、更改的模式、更改的描述或新的注解都会改变 pin。

示例将格式错误的描述符和任何描述符摘要变化视为漂移，隔离该 pin，移除其活动路由，并将该版本封锁为回滚目标。生产策略可能只允许通过新的审查进行编辑性更改，因为描述会影响模型的工具选择。“表面上的”元数据可以改变智能体行为。

### 5. Registry 状态是实时状态

Registry API 在每条服务器记录旁附加一个响应级 `_meta` 对象。Registry 管理的字段位于 `_meta["io.modelcontextprotocol.registry/official"]` 下。将响应的 `_meta` 对象传入准入并读取 `_meta["io.modelcontextprotocol.registry/official"].status`。直接的 `_meta.status` 值不是官方线上格式。不要把响应元数据与发布记录自身的 `_meta` 混淆。状态可以是：

- `active`：默认返回，且可进行本地准入
- `deprecated`：仍可在警告下被发现，但不再是安全的自动选择
- `deleted`：默认隐藏，其历史记录仍可通过已删除或增量视图获取

在准入之后同步状态。如果一个活动版本被弃用或删除，隔离其 pin 并停止向它路由新工作。保留证据。从默认列表中删除不等于有权抹去你的审计轨迹。

发布者提供的自定义元数据只能位于发布记录的 `_meta.io.modelcontextprotocol.registry/publisher-provided` 下。Registry 管理的响应元数据是分开的。不要让发布者设定自己的官方状态。

### 6. 回滚意味着路由恢复

回滚期间不可变的发布不会被编辑。回滚选择一个先前已准入、当前符合资格的 pin，并更改活动路由。

一个安全目标必须：

1. 拥有已完成的准入记录。
2. 在你的策略下仍具有活动的 Registry 状态。
3. 未被运行时或安全证据隔离。
4. 仍能解析到被固定的包与在线描述符集合。
5. 通过当前的健康检查。

示例关注前三个条件。真正的协调器应在激活前重新获取包并重新检查在线端点。

### 7. 追加准入账本

准入数据库说明什么是活动的。账本解释为什么。

示例的每条条目包含序列号、时间、事件、服务器、版本、结果、原因、证据、上一条目的哈希以及自身的哈希。修改较早的结果会破坏该条目及之后所有链条的验证。

这是防篡改可证的，不是魔法般防篡改的。将周期性账本头锚定在单独的信任域中，例如签名的发布元数据或只写一次的存储。限制谁可以追加。不要将授权令牌、包凭据、工具参数和私有端点数据放入证据。

## 动手构建

可运行的控制器位于 `code/main.py`。它仅使用 Python 标准库。

从有限演示开始：

```bash
cd phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift
python3 code/main.py
```

演示执行五个操作：

1. 以匹配的命名空间、包来源、协议、能力和工具准入 `1.0.0`。
2. 准入 `1.1.0` 并将其设为活动。
3. 在运行时观察到一个意外的删除工具。
4. 观察 `1.1.0` 的 Registry 状态变为 `deprecated`。
5. 将路由恢复到仍然已准入的 `1.0.0` pin。

预期输出形态：

```json
{
  "admitted": [true, true],
  "driftAllowed": false,
  "rollbackAllowed": true,
  "activeVersion": "1.0.0",
  "ledgerValid": true
}
```

按以下顺序阅读实现：

1. `namespace_for_domain()` 和 `namespace_matches()` 确立精确的命名权威。
2. `digest()` 和 `normalized_tools()` 产生确定性证据。
3. `RegistryAdmissionController.admit()` 关联发布、来源、运行时与策略。
4. `check_live()` 将新的观察与 pin 比较。
5. `observe_registry_status()` 隔离 Registry 状态发生变化的版本。
6. `rollback()` 仅激活先前已准入且符合资格的目标。
7. `AdmissionLedger.verify()` 检测对已记录历史的更改。

## 使用它

将控制器置于发现与路由之间：

```text
Registry sync -> artifact verifier -> live discovery -> admission controller -> route table
                                               |                 |
                                               v                 v
                                          evidence store    admission ledger
```

为这些任务使用独立的身份。Registry 同步工作器只需要元数据的读取权限。工件验证器只需要包获取权限。路由协调器只需要激活已批准 pin 的权限。它们谁都不需要全部凭据。

让发布状态显式化。“Approved”表示证据通过了策略。“Active”表示路由当前选择了它。“Quarantined”表示它不能接收新工作。“Superseded”表示另一个已准入版本是活动的。不要把这四种含义编码进一个布尔值。

在 `tools/list` 中暴露服务器之前先运行准入。否则客户端可能在发布与策略评估之间的空档期发现某个工具。

## 交互实验

你将逐一观察单个边界的失效。

### 实验 A：命名空间冲突

从代码目录打开 Python shell：

```bash
cd phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/code
python3 -q
```

然后运行：

```python
from main import namespace_matches
namespace_matches("com.example/inventory", "com.example")
namespace_matches("com.exampleevil/inventory", "com.example")
```

第一个结果是 `True`；第二个是 `False`。在本地将精确比较替换为 `startswith`，观察为什么第二个名称越过了边界。继续之前恢复精确比较。

### 实验 B：描述符漂移

```python
from main import *
times = iter(f"2026-08-21T12:00:{n:02d}+00:00" for n in range(10))
c = RegistryAdmissionController(clock=lambda: next(times))
meta = {OFFICIAL_META_KEY: {"status": "active"}}
c.admit(sample_record("1.0.0"), meta, "com.example", evidence_for("1.0.0"), sample_live("1.0.0"))
c.check_live("com.example/inventory", "1.0.0", sample_live("1.0.0", True))
```

检查原因与路由状态。包和 Registry 记录没有变化。运行时工具表面变了，因此控制器隔离并停用了该 pin。这就是供应链控制必须在安装之后继续的原因。

### 实验 C：状态与回滚

准入 `1.1.0`，将其标记为弃用，并尝试两个回滚目标：

```python
c.admit(sample_record("1.1.0"), meta, "com.example", evidence_for("1.1.0"), sample_live("1.1.0"))
c.observe_registry_status("com.example/inventory", "1.1.0", "deprecated")
c.rollback("com.example/inventory", "1.1.0", "unsafe retry")
c.rollback("com.example/inventory", "1.0.0", "restore known release")
c.ledger.verify()
```

被隔离的目标被拒绝。较早的活动 pin 被接受。账本保持有效。

## 练习实验

为控制器扩展一个双人审批门。

要求：

- 将审批存储为签名的证据引用，而不是 pin 中的可变名称。
- 对于包含带有 `destructiveHint: true` 的工具的工具集，要求两个不同的审查者身份。
- 拒绝重复的审查者身份。
- 当审批不完整时，在账本中保留原始准入尝试。
- 为零、一、重复和两个不同审批添加测试。
- 不要记录签名、凭据或完整的私有工具参数。

成功的标准是：破坏性工具在两个身份都批准了精确的记录、包和工具集摘要之前无法变为活动状态。

## 交付产物

本课程附带 `outputs/skill-mcp-registry-admission.md`。在审查新的 Registry 版本或调查漂移时，将其作为扁平的、可复用的运行手册。它定义了输入、拒绝规则、证据包、状态协调和回滚证明，而不依赖示例中的类名。

## 验证

运行演示和确定性测试套件：

```bash
cd phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

验证应证明：

- 精确的命名空间边界拒绝形近前缀
- 只有官方带命名空间的 Registry 状态能使版本符合资格
- 未验证或不匹配的包与远程证据被拒绝
- 发布者元数据不能冒充 Registry 管理的元数据
- 工具排序被规范化而不隐藏描述符变化
- 格式错误的包与工具结构被安全拒绝
- `serverInfo` 仅作诊断用途，绝不提供准入权威
- 描述符漂移会隔离、停用并封锁回滚到该 pin
- 状态变化会隔离活动 pin
- 回滚不能选择被隔离或未知的版本
- 账本篡改被检测到

## 生产失效模式

| 失效 | 发生原因 | 所需响应 |
|---|---|---|
| 名称看似有效但命名空间从未被认证 | 策略信任了记录文本 | 在可信的命名空间验证器提供精确前缀之前拒绝 |
| 相同包坐标返回新字节 | 上游可变或分发被攻破 | 停止激活，保留两个摘要，调查获取边界 |
| “latest”未经审查就变化 | 浮动选择绕过了 pin | 只解析精确的已准入版本和摘要 |
| 审批后出现新工具 | 运行时漂移或不同的部署 | 隔离该路由并捕获新的描述符观察 |
| 弃用版本仍处于活动状态 | 状态同步缺失或延迟 | 按计划协调状态，并在激活前协调 |
| 已删除记录从默认同步中消失 | 客户端只请求了活动记录 | 使用增量或感知删除的协调，并保留本地历史 |
| 回滚目标从未被准入 | 路由控制与审批状态脱节 | 拒绝回滚并对目标运行新的准入 |
| 攻击者改写所有条目后账本本地仍可验证 | 哈希链没有外部锚点 | 将签名的账本头发布到单独的信任域 |
| 证据包含 bearer 令牌或工具参数 | 日志记录复制了完整请求 | 在收集时脱敏，只存储最小证明 |

## 运营规则

发布回答的是“这个身份可以发布这个名称吗？”准入回答的是“我们会执行这个精确工件并暴露这个精确行为吗？”保持这两个决策分离，固定每一个关联点，并让回滚依据证据而非记忆进行选择。

## 延伸阅读

- [官方 Registry server.json 要求](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/official-registry-requirements.md)
- [官方 Registry OpenAPI 契约](https://registry.modelcontextprotocol.io/openapi.yaml)
- [MCP 2026-07-28 服务器发现](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)