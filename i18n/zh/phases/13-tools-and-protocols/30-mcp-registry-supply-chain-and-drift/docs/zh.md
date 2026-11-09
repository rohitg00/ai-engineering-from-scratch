# 关管理局注册链:接入,漂移和回转

> 编辑录制证明你收到的内容,你观察到的内容,你批准的内容,以及你可以安全地恢复的内容.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 17 (gateways and registries), Phase 13 · 18 (production authentication)
**Time:** ~90 minutes

## 学习目标

- 单独的登记库发布,包装来源,运行时间发现和当地批准.
- 检查一个MCP服务器名字空间,而不需要相信其名字在自己的记录中.
- 标签不可变的出版物,执行源,来源,现场描述符证据.
- 检测登记状态变化和录取后运行时间漂移.
- 转换路由到之前被允许的版本,而不需要重写历史.
- 保持一个明确的录取账本,解释每一个决定.

## 问题

你发现了`com.example/inventory`文件的描述是正确的,包裹存在,服务器回答了.`server/discover`现在,我们要去.

这不是一个事实,而是来自不同当局的数据链.

1. 发行商认证一个名字空间提交了记录.
2. 一个包装登记库提供了一个具有特定身份和消化的文物.
3. 运行终端报告了协议版本,功能,工具和诊断服务器信息.
4. 你的组织决定允许这种结合.

倒这些事实到"它"是注册表中的,所以相信它会造成供应链盲点.一个有效的出版物仍然可以被废除.如果您不将其结,包装标签可以指向一个意想不到的文物.服务器可以在审查后添加破坏性工具.滚动可以默默地选择一个未被承认的版本.

检查员在每一个边界都有证据.

## 登记是指数,而不是你的认证系统

官方MCP登记处存储服务器的元数据.`server.json`记录服务器版本名称,并声明一个或多个包或远程终端点. 出版规则增加名称空间认证,包所有权检查,限制登记规则和狭窄的出版商元数据位置.

您的生产政策仍然回答部署问题:

| Boundary | Question | Evidence owner |
|---|---|---|
| Namespace | Was the publisher allowed to use this name? | Registry authentication plus your verified namespace input |
| Record | What did the publisher declare for this version? | Immutable `server.json` digest |
| Execution source | Which package or remote endpoint will execute? | Declared source fields, verified ownership result, transport, and trusted digest |
| Runtime | What does the endpoint expose now? | `server/discover` and tool descriptors |
| Admission | Did your policy approve this exact set? | Local pin and ledger entry |
| Operations | Is it still safe, and what can replace it? | Drift checks, status sync, health, and rollback route |

登记方案版本和MCP协议版本是独立的.`2025-12-11`现场服务器支持MCP `2026-07-28`永远不要把一个推断到另一个.

```figure
mcp-registry-admission
```

## 一项录取决定中的七项检查

### 1. 名称空间验证

官方注册名字使用验证的名称空间.一个验证的域名可以映射到一个倒置域名前.例如,控制`example.com`能确定`com.example/*`现在,我们要去.

没有接受字符串前置检查:

```python
server_name.startswith("com.example")
```

这也可以接受.`com.exampleevil/tool`分别在`/`需要一个不空的字符串,并精确地比较名字空间段. 更重要的是,通过验证名字空间进入认证结果.不要从不值得信赖的记录中获得信任.

支持GitHub的名字空间和域名空间使用不同的身份验证路径.将任何路径都正常化为一个输入:确切验证的名字空间字符串.

### 2. 产地结合

对于包装记录,声明和采集的文物必须在明确的字段上结合:

- 包装登记类型
- 包装标识符
- 包装版本
- 经验证的所有权结果
- 下载的文物消化

确认声明的包运输.仅有一个远程终端点的记录是有效的,不能因为缺乏包而拒绝.对于远程源,将声明的URL和运输类型加入独立验证的终端点所有权和可信的连接或部署证据.

课程代码支持源类型,并将选定的源源与注册表源,服务器名称,注册表版本,记录消化和证据消化一起哈希.结果的来源消化是完整的证据集的紧指针.它不是保留证据的替代品.

永远不要接受只通过你试图验证的文物提供的化, 计算在一个可信的收货界限, 或从一个你验证的验证结果的包装服务中收到它.

### 3. 结决定,不仅仅是版本

登记版本是唯一的出版标识符. 发表的元数据是不可变的. 改变的记录需要一个新的版本. 推语义版本化,但登记程序不需要它,也不接受版本范围.

这意味着`^1.4`最新                                                                                                                                                                                                                                                             

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

通过将多层粘贴,可以确定哪个界限发生了变化.在同一注册表版本下发生的记录消化变化是注册表完整性失败.在同一包坐标或远程部署下发生的源消化变化是执行源完整性失败.工具集消化变化是运行时间漂移.

### 4. 现场漂移检测

接收者应该观察实际接收流量的服务器.`server/discover`通过您的可信路径列出或以其他方式获取暴露的工具描述符,并验证:

- `2026-07-28`现在`supportedVersions`
- 现有所有本地要求的能力
- 每个工具描述器都有所需的身份和方案表面
- 标准化描述器消化与后检验中被允许的匹配

选择性结果`_meta["io.modelcontextprotocol/serverInfo"]`值是自主报告的显示,日志和调试文本. 记录它作为诊断证据,但永远不要使用它来确定名字空间,包所有权,终端点所有权,录取或任何其他安全决定.`serverInfo`别名:外面`_meta`没有合同领域,不应被推广为诊断证据.

标准化仅仅是没有意义的字段.样本在哈希之前按稳定名称排序工具列表,因此无害的列表序变化不会导致漂移.它不会丢弃描述字段.新工具,改变方案,改变描述或新注释改变了.

样本将错误的描述符和任何描述符消化变化视为漂移,隔离,删除其活跃路线,并将该版本作为反弹目标.生产政策只允许通过新的审查进行编辑变化,因为描述影响模型工具选择.

### 5. 登记状态是现实状态

登记器API附加响应级别`_meta`文件的管理范围在 文件中.`_meta["io.modelcontextprotocol.registry/official"]`通过答案`_meta`反对录取和阅读`_meta["io.modelcontextprotocol.registry/official"].status`直接的`_meta.status`答案的元数据与出版记录的元数据不要混为一谈`_meta`状态可以是:

- `active`: 违约返回,可接受本地接入
- `deprecated`虽然可以通过警告发现,但不再是安全的自动选择
- `deleted`:默认隐藏,而其历史记录仍然可通过删除或增量查看

录取后同步状态. 如果一个活跃版本变得过时或删除,请关闭其点,停止向它调用新工作. 保存证据. 从默认列表中删除不是删除审计轨迹的许可.

出版商提供的定制元数据仅属于`_meta.io.modelcontextprotocol.registry/publisher-provided`管理登记的响应元数据是单独的. 不要让出版商设定自己的官方状态.

### 6. 翻车意味着恢复路线

滚动时不会编辑不可变的出版物.滚动选择以前被允许的,目前符合条件的脚,并改变主动路线.

安全目标必须:

1. 填写入学记录.
2. 您的保险仍然具有活跃的登记处状态.
3. 没有因运行时间或安全证据而被隔离.
4. 仍然要把它固定到封装上,并将描述器设置.
5. 通过目前的健康检查.

实际调整者应该重新检查包裹,并在激活之前重新检查现场终端点.

### 7. 添加录取账本

录取数据库显示了什么是活跃的.

每个样本输入包含一个序列,时间,事件,服务器,版本,结果,原因,证据,前一个输入哈希,以及自己的哈希.更改一个旧的结果打破了该输入和每一个后来的链接的验证.

根据"数据库"的定义,数据库的数据库可以被编写成一个数据库,并且可以被编写成一个数据库.

## 建立它

运行控制器已启动`code/main.py`它只使用Python标准库.

开始于有限的示范:

```bash
cd phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift
python3 code/main.py
npx tsx code/main.ts
```

演示活动进行了五次:

1. 承认`1.0.0`具有匹配的名称空间,包源,协议,功能和工具.
2. 承认`1.1.0`让它变得活跃.
3. 在运行时观察一个意外的删除工具.
4. 观察注册表的状态`1.1.0`成为`deprecated`现在,我们要去.
5. 恢复路由到仍被允许的`1.0.0`子.

预期的形状:

```json
{
  "admitted": [true, true],
  "driftAllowed": false,
  "rollbackAllowed": true,
  "activeVersion": "1.0.0",
  "ledgerValid": true
}
```

在下列顺序下阅读执行情况:

1. `namespace_for_domain()`其他`namespace_matches()`确定确切的命名权.
2. `digest()`其他`normalized_tools()`它们可以产生确定性证据.
3. `RegistryAdmissionController.admit()`加入出版,来源,运行时间和政策.
4. `check_live()`通过笔来比较一个新的观察.
5. `observe_registry_status()`隔离版本,注册表状态变化.
6. `rollback()`仅激活已被允许的可接受目标.
7. `AdmissionLedger.verify()`检测记录历史的变化.

## 用它

设置控制器在发现和路由之间:

```text
Registry sync -> artifact verifier -> live discovery -> admission controller -> route table
                                               |                 |
                                               v                 v
                                          evidence store    admission ledger
```

对于这些工作使用单独的身份. 登记器同步工作者需要阅读访问转录数据. 文物验证器需要获取数据包. 路线调整器需要许可才能激活一个批准的针. 它们都不需要每个凭证.

 已批准  意思是经过证据的政策.  活动  意思是目前选择的路线.  隔离 意思是它不能接收新工作.  补充 表示另一个被承认的版本是活跃的.不要用一个布尔语编码所有四个意思.

在曝光服务器之前运行入口`tools/list`否则,客户可以在发布和政策评估之间的差距中发现工具.

## 互动实验室

你会看到一个边界一次失败.

### 实验室A:名称空间碰撞

从代码目录中打开Python shell:

```bash
cd phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/code
python3 -q
```

然后运行:

```python
from main import namespace_matches
namespace_matches("com.example/inventory", "com.example")
namespace_matches("com.exampleevil/inventory", "com.example")
```

结果是`True`第二个是`False`取代对比的确切值为`startswith`在继续之前,请恢复准确的比较.

### 实验室B:描述器漂移

```python
from main import *
times = iter(f"2026-08-21T12:00:{n:02d}+00:00" for n in range(10))
c = RegistryAdmissionController(clock=lambda: next(times))
meta = {OFFICIAL_META_KEY: {"status": "active"}}
c.admit(sample_record("1.0.0"), meta, "com.example", evidence_for("1.0.0"), sample_live("1.0.0"))
c.check_live("com.example/inventory", "1.0.0", sample_live("1.0.0", True))
```

检查原因和路线状态.包装和注册表记录没有改变.运行时间工具表面确实改变了,因此控制器隔离和禁用了针.这就是为什么供应链控制必须在安装后继续.

### 实验室C:状态和反弹

承认`1.1.0`标记为"过期"并尝试两个反弹目标:

```python
c.admit(sample_record("1.1.0"), meta, "com.example", evidence_for("1.1.0"), sample_live("1.1.0"))
c.observe_registry_status("com.example/inventory", "1.1.0", "deprecated")
c.rollback("com.example/inventory", "1.1.0", "unsafe retry")
c.rollback("com.example/inventory", "1.0.0", "restore known release")
c.ledger.verify()
```

已被拒绝了被隔离的目标, 已被接受了早期的活跃脚本, 账本仍然有效.

## 实践实验室

扩展控制器,使用两个人使用的批准门.

要求:

- 存储批准作为签署的证据引用,而不是在子中可变的名称.
- 需要两个不同的审查员身份,以提供一个工具集`destructiveHint: true`现在,我们要去.
- 拒绝复制审查员身份.
- 在批准未完整时,保存原始录取尝试在本书中.
- 增加零,一,双重和两种不同的批准的测试.
- 不要记录签名,凭证或完整的私人工具参数.

成功意味着,直到两个身份批准了准确的记录,包装和工具集消化,

## 运输的文物

这一课是很好的.`outputs/skill-mcp-registry-admission.md`通过使用它作为一个平坦的可重复使用的运行簿,来审查新的登记库版本或调查漂移.它定义了输入,拒绝规则,证据捆绑,状态调整和反弹证明,而不会依赖于样本类名称.

## 检查

运行示范和确定性套件:

```bash
cd phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

验证应证明:

- 确切的命名空间界限拒绝类似的预写
- 只有官方名称空间登记处的状态才能使版本符合条件
- 未经验证或不匹配的包装和远程证据被拒绝
- 出版商的元数据不能伪装登记管理的元数据
- 工具的排序是正常化的,而不隐藏描述符的变化
- 错误的包装和工具结构安全地拒绝
- `serverInfo`仍然是诊断的,从来没有提供录取权
- 描述器漂移隔离,禁用和阻塞回转到杆
- 状态变化隔离活跃针
- 转换不能选择隔离或未知版本
- 检测到本书的改

## 生产失败模式

| Failure | Why it happens | Required response |
|---|---|---|
| Name looks valid but namespace was never authenticated | Policy trusted record text | Reject until a trusted namespace verifier supplies the exact prefix |
| Same package coordinate returns new bytes | Mutable upstream or compromised distribution | Stop activation, retain both digests, investigate the fetch boundary |
| “Latest” changes without review | Floating selection escaped the pin | Resolve only exact admitted versions and digests |
| New tool appears after approval | Runtime drift or a different deployment | Quarantine the route and capture a fresh descriptor observation |
| Deprecated version remains active | Status sync is missing or delayed | Reconcile status on a schedule and before activation |
| Deleted record disappears from default sync | Client requested only active records | Use incremental or deleted-aware reconciliation and preserve local history |
| Rollback target was never admitted | Route control and approval state are disconnected | Refuse rollback and run a new admission for the target |
| Ledger verifies locally after an attacker rewrites all entries | Hash chain has no external anchor | Publish signed ledger heads to a separate trust domain |
| Evidence contains bearer tokens or tool arguments | Logging copied whole requests | Redact at collection time and store only the minimum proof |

## 运营规则

发表答案 这个身份能发布这个名字吗? 录取答案 我们会执行这个精确的文物并暴露这个精确的行为吗?

## 进一步阅读

- [Official Registry server.json requirements](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/official-registry-requirements.md)
- [Official Registry OpenAPI contract](https://registry.modelcontextprotocol.io/openapi.yaml)
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
