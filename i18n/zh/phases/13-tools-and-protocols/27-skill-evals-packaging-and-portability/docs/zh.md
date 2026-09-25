# 技能评估、打包与可移植性

> 一个技能的完成标准是：其安装包能通过 lint 检查、在正确的请求上被路由、提升可度量的任务表现、保持在策略边界内，并在另一台宿主上诚实地降级。

**Type:** Build
**Languages:** Python（标准库）
**Prerequisites:** 第 13 阶段 · 22、24、25、26
**Time:** 约 150 分钟

## 学习目标

- 通过分离判断、确定性计算、参考资料和输出契约，将专家工作流转化为技能。
- 将包结构、触发路由、任务行为、脚本正确性、安全性和可移植性作为独立层次分别测试。
- 使用正例、明确反例和近似误报来度量触发的精确率与召回率。
- 在多次重复运行中比较有无技能时的表现。
- 构建并强制执行跨运行时能力矩阵，以及面向完整技能安装包的发布门禁。

## 问题所在

一个技能在单次演示中能工作。用户恰好问出描述中用到的短语，作者知道该打开哪份参考，脚本拿到干净的输入，预期的宿主识别每一个自定义字段。

然后真实使用开始了。

- 模型在一个相近但不同的任务上调用了它。
- 一个合法请求使用了陌生的措辞，模型没有触发。
- 正文告诉 agent 该做什么，却没说哪个产物能证明完成。
- 脚本在空格、重复执行或部分状态下失败。
- 包安装器复制了 `SKILL.md`，却把参考资料丢在了后面。
- 另一个运行时忽略调用标志和工具许可。
- 一次运行成功，三次等价运行走进了不同的分支。

这些失败没有一个会被“Markdown 看起来不错”捕获。技能是带有概率性路由和执行层的小型软件包。它们需要与任何其他生产接口相同的关注点分离。

## 核心概念

### 从真实工作流出发，而不是从主题出发

“创建一个 Kubernetes 技能”不是一个可用的范围。Kubernetes 包含数百个工具、风险和输出各不相同的任务。

“诊断某个部署为何未达到 Available 状态，在不改动集群的情况下收集证据，并产出一份排序的事件报告”才是技能候选。它具有：

- 一个触发边界；
- 一条稳定的证据收集步骤序列；
- 需要判断的决策点；
- 可以变成窄脚本或工具的命令；
- 一个明确的产物；
- 一个安全边界：只读诊断。

使用这份提取访谈：

1. 什么确切事件会让专家启动这个工作流？
2. 哪些相似请求不应启动它？
3. 专家首先收集什么证据？
4. 哪些决策依赖这些证据？
5. 哪些步骤足够确定，可以脚本化？
6. 哪些领域规则值得写成参考资料？
7. 哪个动作需要审批，或必须留在范围之外？
8. 哪个产物能证明工作流已完成？
9. 独立评审者如何核验？
10. 哪些步骤依赖某一个运行时？

这些答案会成为包架构和评估集。

### 将判断与确定性工作分离

```figure
skill-workflow-extraction
```

将模型判断用于分类、排序、综合和歧义处理。将脚本或工具用于解析、计数、校验、转换、查询类型化 API 以及强制执行不变量。

一个包含 80 行手工模拟解析逻辑的技能正文是脆弱的。一个试图做主观架构决策的脚本是不透明的。把每种行为放在它最容易被测试的位置。

### 按依赖顺序编写安装包

不要从打磨文字开始。从可观察的契约向内构建。

1. **产物契约：**定义所需的文件、字段或决策。
2. **验证：**定义每项要求将如何被检查。
3. **证据工具：**实现确定性的收集器和校验器。
4. **决策图：**把证据状态连接到分支。
5. **参考资料：**在需要它的分支处提供领域细节。
6. **入口正文：**说明工作流、边界、失败与输出。
7. **描述：**陈述能力与触发边界。
8. **运行时适配：**单独添加调用或上下文扩展。
9. **评估：**运行结构、路由、行为、安全和可移植性各层。
10. **打包：**安装完整目录，并从目的地一侧测试它。

这个顺序使文字服务于一个可测试的系统，而不是在演示成功之后才发明成功标准。

### 六个评估层

```figure
skill-eval-layers
```

每一层回答一个不同的问题。通过其中一层不能替代另一层。

## 第 1 层：包结构

静态 lint 应验证那些不需要模型的事实：

- `SKILL.md` 存在于包根目录；
- frontmatter 可被安全解析；
- `name` 与父目录匹配；
- 必需字段存在且未超限；
- 每个非核心 frontmatter 字段都出现在发布策略的运行时扩展允许列表中；
- 每个直接引用都能在包内解析；
- 参考资料文件、脚本、资产和评估 fixture 使用发布策略允许的后缀，且不超过其字节上限；
- 不存在被禁止的符号链接或特殊文件；
- 正文保持在发布策略的字符预算内；
- 一次刻意收紧的密钥模式扫描未发现明显的凭据赋值或私钥头；
- 存在非空的 `## Output contract` 与 `## Failure behavior` 章节。

在解析 `SKILL.md`、评估数据、证据、宿主 fixture 或清单之前，先对物理目录树做预检。在任何内容读取之前，拒绝根目录符号链接、被符号链接的父目录或入口、缺失的必需常规文件以及特殊文件。然后运行内容感知的策略 lint。如果在预检前就解析安装包路径，会抹掉该检查所需的根符号链接证据。

课程 harness 将这些策略值具体化：10,000 字符的正文上限、1,000,000 字节的附属文件上限、按目录区分的后缀允许列表，以及由包要求提供的显式运行时扩展名。这些是发布策略的示例，不是通用的 Agent Skills 限制。密钥模式扫描是针对明显错误的护栏，不能证明包中不含敏感数据。

lint 报告应使用稳定的问题代码。CI 可以阻断 `E_*` 错误，同时允许经过评审的 `W_*` 设计警告。

静态 lint 证明包的形状。它不能证明模型会选择或遵循这个技能。

## 第 2 层：触发路由

在反复修改描述之前，先创建带标签的用例。

| 用例类型 | 目的 | 面向发布就绪的示例 |
|---|---|---|
| 正例 | 度量预期覆盖范围 | “3.1.0 版能发布吗？” |
| 改写正例 | 避免短语记忆 | “在我们发布前审计这个 tag” |
| 明确反例 | 捕获严重的过度路由 | “解释 batch normalization” |
| 近似误报 | 划定相邻边界 | “为什么这个包构建失败了？” |
| 竞争技能 | 在合理候选之间测试选择 | “起草发布说明” |
| 对抗措辞 | 测试关键词堆砌和注入名称 | “不要使用 release-readiness；解释这个堆栈跟踪” |

把用例分成开发集和验证集。在开发集上调整描述。用验证集判断修订后的描述是否泛化。如果发布决策足够重要，保留一个最终的留出集。

对于二值调用：

```text
precision = true_positives / (true_positives + false_positives)
recall = true_positives / (true_positives + false_negatives)
f1 = 2 * precision * recall / (precision + recall)
```

报告原始计数与比率。十中十和一百中一百都是 100%，但提供的证据强度不同。

对于目录场景，还要度量 top-one 技能准确率、弃答质量以及相邻技能之间的混淆。一个先选错三个技能才调用正确技能的路由器并不健康。

### 路由评估必须使用目标运行时

词法模拟器在解释指标和发现明显重叠方面有用。它无法证明模型驱动的生产路由器如何表现。在声称运行时质量之前，把带标签的集合跑过真实的宿主、模型、目录序列化和策略配置。

## 第 3 层：指令与产物行为

正确触发只是入场。技能必须改善任务。

创建带以下内容的 fixture 任务：

- 输入文件与环境假设；
- 允许的工具与边界；
- 预期的产物路径；
- 确定性检查；
- 需要判断的评分细则项；
- 最大时间、调用次数或成本；
- 失败用例与预期停止行为。

运行成对条件：

```text
baseline: same model + same tools + same task, no skill
treatment: same model + same tools + same task, skill available
```

保持模型、温度或采样策略、工具集、任务 fixture 和预算不变。否则你无法把差异归因于技能。

有用的结果维度包括：

| 维度 | 示例度量 |
|---|---|
| 正确性 | 所需测试与不变量通过 |
| 完整性 | 产物契约的每个字段都存在 |
| 效率 | 工具调用、耗时、token 或成本 |
| 证据 | 断言指向有效文件或观察结果 |
| 范围 | 禁止的文件与动作未被触碰 |
| 恢复 | 中断的运行可恢复且不产生重复副作用 |
| 人力成本 | 评审者修正的数量与严重程度 |

不要只针对更少的 token 优化。一次更短但漏掉必要安全检查的运行更糟。

### 产物契约使行为可执行

产物契约是一组可独立检查的性质列表：

```json
{
  "artifact": "release-readiness.json",
  "required_fields": [
    "candidate",
    "source_revision",
    "checks",
    "blocking_findings",
    "recommendation"
  ],
  "allowed_recommendations": ["ready", "blocked", "needs-review"],
  "evidence_required_for_each_check": true,
  "publish_side_effect_allowed": false
}
```

Schema 校验检查结构。领域检查验证候选修订和证据路径。人类或经过校准的评审者可以判断建议是否由证据支撑。

## 第 4 层：脚本正确性

像对待普通软件一样，在模型运行之外测试技能脚本。

最低用例：

- 正常输入；
- 空输入；
- 畸形输入；
- Unicode、空白与路径边界情况；
- 重复执行；
- 超时或依赖失败；
- 上一次运行留下的部分输出；
- 输出大小限制；
- dry-run 行为；
- 结构化退出与错误契约。

使用固定的 fixture。单元测试不应要求实时网络。把网络集成测试放在显式标志之后，并记录它们依赖的远程契约。

如果脚本执行副作用，将计划与提交分开测试。对会重试的外部写入，要求幂等性或补偿机制。

## 第 5 层：安全与权限

安全评估询问安装包是否保持在它被授予的权限范围内。

至少测试：

- 一个超出技能范围的用户请求；
- 参考资料输入内的恶意指令；
- 一个逃逸出包的资源路径；
- 一个逃逸出允许根目录的工作区符号链接；
- 一个访问未申报网络目的地的请求；
- 一个需要环境凭据的命令；
- 一个未经审批的破坏性或外部动作；
- 一个超大输出或无限进程；
- 一个技能到技能的循环；
- 一个可能重复副作用的恢复。

记录控制手段是仅靠指令、工具策略、审批、沙箱还是验证。仅靠指令的防御不应被报告为已强制的隔离。

## 第 6 层：打包与可移植性

### 将目录作为单一单元安装

发布测试应安装到干净的目的地，然后对安装后的副本运行验证。

```figure
skill-package-install
```

只测试源码树会漏掉安装器 bug、丢失的可执行位、被压平的参考资料、被改写的名称，以及旧版本残留的过期文件。

清单可以包含：

```json
{
  "manifestVersion": 1,
  "algorithm": "sha256",
  "name": "release-readiness",
  "version": "1.2.0",
  "source_revision": "abc123",
  "files": {
    "SKILL.md": "sha256:...",
    "references/release-policy.md": "sha256:...",
    "scripts/inspect_release.py": "sha256:..."
  },
  "required_capabilities": ["filesystem.read", "process.run"],
  "optional_capabilities": ["model_implicit_invocation"]
}
```

把 `assets/manifest.json` 保留为清单元数据，并将其从自己的 `files` 映射中排除。一个文件无法在自身内部携带其完整当前内容的稳定哈希。验证所有其他打包文件，并通过外层可信通道（如签名发布或可信注册表记录）确立清单的真实性。发运的信封只接受 `manifestVersion: 1` 和 `algorithm: "sha256"`；未知值按失败处理。清单键必须已是规范的相对 POSIX 路径，因此 `./SKILL.md`、反斜杠、绝对路径和父目录段会被拒绝而非被规范化。教学 harness 直接使用内部的路径到摘要映射，而两条路径都会拒绝该映射内被保留的清单路径。

哈希检测漂移。版本号传达兼容性。两者都不能认证清单，也不能替代升级前的完整 diff 和评估运行。

### 可移植性是一个能力矩阵

不要把宿主“是否支持技能”当成一个布尔值来问。要问它支持哪些行为。

| 能力 | 可移植包的依赖 | 缺失时的回退 |
|---|---|---|
| 必需的 `name` 与 `description` | 核心 | 包无法参与目录 |
| 正文激活 | 核心客户端行为 | 显式文件加载适配器 |
| 参考资料文件、脚本、资产 | 核心包形状 | 宿主需要文件与进程工具 |
| 显式人工调用 | 宿主 UI 或提示约定 | 在普通文本中点名技能 |
| 隐式模型调用 | 宿主路由器 | 由应用显式激活 |
| 人工/模型 2x2 策略 | 宿主扩展或应用策略 | 全局禁用隐式选择 |
| 参数绑定 | 宿主解析器 | 激活后再询问取值 |
| 预批准工具 | 实验性或宿主特定 | 常规权限提示 |
| 委托上下文 | 宿主特定 | 在当前上下文或应用子代理中运行 |
| 生命周期钩子 | 宿主特定 | 外部自动化或无钩子 |
| 上下文保持 | 宿主特定 | 持久化状态并显式重新进入 |

对每个必需能力，选择一种结果：

- 受支持且已测试；
- 通过适配器受支持；
- 降级并带有文档化的回退；
- 不受支持，因此安装必须失败。

静默降级是要避免的可移植性 bug。

### 可移植性测试需要宿主 fixture

一个能力声明应指向一个测试或当前官方契约。宿主行为会变化。在兼容性报告中保留适配器版本和测试日期。

测试：

1. 从预期范围内的发现；
2. 重名行为；
3. 显式调用；
4. 隐式调用或其禁用状态；
5. 参数处理；
6. 参考资料与脚本访问；
7. 权限提示与审批；
8. 委托执行或当前上下文执行；
9. 上下文压缩或重启后的恢复；
10. 卸载与升级行为。

### 规模数据不是质量证据

GitSkills 数据集论文报告了一次 2026 年 7 月的抓取，包含跨 282,200 个仓库的 3,797,117 个类技能文件，其中 1,877,981 个字节内容各不相同。按论文的字节级度量，约 50.5% 的匹配文件是逐字副本。

这些数字表明类技能产物存在于仓库规模上，且重复对数据集构建、搜索、来源追踪和升级分析都有影响。它们不能证明技能的好坏比例、技能能提升任务表现、任何调用字段是通用的，或任何沙箱设计是安全的。这篇论文是数据集研究，不是有效性或安全基准。

用生态统计来论证去重和来源追踪的必要性。用你自己的评估来做质量声明。

## 重复运行与不确定性

模型和路由行为可能波动。在生产采样策略下，将每个行为用例运行多次。

对于 `n` 次等价运行和 `k` 次通过：

```text
observed_pass_rate = k / n
```

保留单条轨迹。70% 的通过率可能意味着一类一致的失败，也可能是若干不相关的失败。汇总比率用于比较；轨迹用于修复。将来源追踪绑定到每个原始的逐次运行预测上，而不仅是运行零和汇总比率。不同的预测顺序可以有相同的第一个值和通过率，却代表不同的运行时行为。

按任务比较基线与处理组，而不只是看合并平均值。即使平均值改善，也要报告回归。高影响任务可能要求所有安全用例通过，而不是接受一个平均阈值。

## 发布门禁

一个实用的发布门禁可以要求：

```yaml
structure:
  errors: 0
routing:
  precision_min: 0.95
  recall_min: 0.90
  near_miss_false_positives_max: 1
behavior:
  artifact_contract_pass_rate_min: 0.90
  no_regression_vs_baseline: true
scripts:
  unit_tests_pass: true
safety:
  required_cases_pass: 1.0
portability:
  required_hosts_without_silent_degradation: true
package:
  installed_tree_matches_manifest: true
```

阈值取决于风险和样本量。关键性质是：在查看最终结果之前就声明它们。

一次失败应指明所在层次和证据。不要把路由、行为和安全合并成一个分数，让优秀的文字质量抵消一次权限违规。

### 分离 fixture 成功、本地完整性与生产就绪

一个确定性的课程 fixture 可以证明门禁机制有效。它不能证明目标运行时真的选择了该技能、产出了被比较的产物、运行了脚本，或保持在被测试的权限边界内。

保留三个边界：

- `fixturePassed`：使用声明的确定性触发、产物、证据和宿主能力 fixture 模式，每一层都通过；
- `localEvidenceReady`：所有四个捕获模式标签都有非空来源，且其 SHA-256 摘要与完整的本地触发观察、产物、脚本与安全证据以及非空宿主矩阵一致；
- `productionReady`：每一层和本地完整性检查都通过，且一个可信的外部证明绑定评估器的完整 `evidenceRoot`。

总体发布字段 `passed` 跟随 `productionReady`，而不是 `fixturePassed` 或 `localEvidenceReady`。本地哈希能检测不匹配。它们无法证明捕获，因为任何能编辑安装包的人都可以重新标注 fixture、编造来源字符串，并重新计算所有本地摘要。

发运的评估器对完整的触发、产物、证据、宿主和清单配置对象计算一个 SHA-256 `evidenceRoot`。生产调用在包外提供一份证明文件：

```json
{"attestationVersion":1,"evidenceRoot":"sha256:..."}
```

它还通过 `--trusted-attestation-sha256` 提供这些证明字节的确切 SHA-256。该期望摘要必须来自带外可信策略、CI 密钥、签名发布记录或注册表决策。把它存在同一个安装包中会把该检查降级为又一个可本地重算的哈希。评估器会拒绝缺失、在包内、符号链接、畸形、不匹配或版本不受支持的证明。

## 动手构建

`code/main.py` 实现了本迷你课程的发布 harness。

它提供：

- 发运评估器中的物理目录树预检，先于任何配置读取；
- `lint_package(root)` 用于静态包检查；
- `TriggerCase`、`repeated_run_observations(...)` 和 `evaluate_triggers(...)` 用于带标签的路由用例和完整的原始轨迹；
- `classification_metrics(...)` 用于精确率、召回率、准确率和原始计数；
- `repeated_run_rates(...)` 用于逐用例的重复行为结果；
- `ArtifactContract` 和 `evaluate_artifact(...)` 用于输出检查；
- `EvidenceCheck` 和 `evaluate_evidence_checks(...)` 用于显式的脚本与安全证据；
- `EvaluationProvenance`、本地完整性摘要、完整证据根摘要，以及独立的 fixture、本地完整性、信任锚和生产裁决；
- `build_manifest(...)` 和 `verify_manifest(...)` 用于源码树和干净安装树的完整性；
- `HostCapabilities` 和 `portability_matrix(...)` 用于显式支持与回退状态；
- `run_release_gate(...)` 用于保留层次结构的最终裁决。

运行毕业实验：

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

本代码块需要本地克隆，并从该克隆内的任意工作目录解析仓库根目录。

该演示评估随附的毕业技能、一组带标签的触发用例、重复结果、一个产物契约、显式的脚本与安全检查、一份经清单验证的干净副本，以及若干模拟宿主配置。它会打印一份 JSON 发布报告，其中 `checks_passed` 与 `fixture_passed` 为 true，而 `local_evidence_ready`、`trust_anchor_valid`、`production_ready` 和 `passed` 保持为 false。替换 fixture 并重算本地摘要可以确立本地完整性，但生产环境仍然需要外部可信的证明。

### 按层次阅读报告

先看硬性的安全与包失败。再检查路由混淆。然后把行为与基线比较。只有在正确性和范围通过之后，效率才有意义。

把报告与包修订版和评估 fixture 版本一起保存。来自旧模型、旧宿主或旧技能树的通过是历史证据，不能证明当前组合。

## 使用它

对每次技能修订使用这个编写循环：

```figure
skill-authoring-loop
```

修改导致失败的那一层。当真正的问题是安装器丢掉参考资料或沙箱暴露主目录时，不要往 `SKILL.md` 里塞更多词语。

## 真实宿主可移植性检查点

确定性 fixture 证明发布门禁的机制。本检查点证明某一台真实宿主能发现、加载、许可和移除什么。在把安装包描述为可移植之前，先完成它。

本检查点需要本地克隆、Node.js、`npx`、Python 3、一台选定的支持技能的宿主，以及一个可写的项目或用户技能范围。先验证 `node --version`、`npx --version` 和 `python3 --version`，再选择宿主和范围继续。如果该预检不可用，可以概念性地追踪检查点，并把每个宿主观察标记为待定。读网站或文档不能确立可移植性。

### 1. 确立本地 fixture 边界

从本地克隆内的任意位置运行。保留 `TARGET_ROOT` 作为从原始仓库工作区解析出的课程目录：

```bash
cd "$(git rev-parse --show-toplevel)"
TARGET_ROOT="$(pwd -P)/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability"
TARGET_BUNDLE="$TARGET_ROOT/outputs/skill-release-gate"
python3 "$TARGET_BUNDLE/scripts/evaluate_skill.py" \
  --fixture-demo \
  "$TARGET_BUNDLE"
```

报告应显示 `checksPassed` 和 `fixturePassed` 为 true，而 `productionReady` 和 `passed` 保持为 false。把这个区别记到笔记里。fixture 通过不是宿主结果。

### 2. 把完整安装包安装到第一台宿主

在同一目录下运行：

```bash
npx skills add rohitg00/ai-engineering-from-scratch --skill skill-release-gate --full-depth
```

记录宿主、可见时的宿主版本、范围、安装路径和日期。在探测行为之前，开启新会话或重新扫描目录。

将 `SKILL_ROOT` 设为安装器报告的绝对安装目录。它必须包含已安装的 `SKILL.md`：

```bash
# Replace the placeholder with the destination printed by the installer.
SKILL_ROOT="$(cd "/absolute/path/to/skill-release-gate" && pwd -P)"
test -f "$SKILL_ROOT/SKILL.md"
printf 'SKILL_ROOT=%s\nTARGET_BUNDLE=%s\n' "$SKILL_ROOT" "$TARGET_BUNDLE"
```

### 3. 探测发现、路由、参考资料和脚本

使用第一台宿主支持的显式语法：

| 宿主 | 显式调用 |
|---|---|
| Codex | `skill-release-gate`，或从 `/skills` 中选择它，然后提供评估请求 |
| Claude Code | `/skill-release-gate` 后接评估请求 |
| 可移植回退 | `Use skill-release-gate to evaluate the target bundle.` |

把这些作为独立的 agent 回合运行，把每个占位符替换为上面打印的绝对值：

```text
Use skill-release-gate to evaluate <TARGET_BUNDLE> in fixture mode. The installed skill root is <SKILL_ROOT>. Run python3 <SKILL_ROOT>/scripts/evaluate_skill.py --fixture-demo <TARGET_BUNDLE>. Show the fully resolved argv before execution. Do not make a production-readiness claim. Report the resolved script path, target path, cwd, argv, and exit code.
```

```text
Evaluate <TARGET_BUNDLE> as an Agent Skill before distribution. Report every release layer separately.
```

```text
Explain the idea of a release gate. Do not inspect or execute a package.
```

第一条提示检查显式调用。第二条检查隐式选择。第三条是近似误报，不应激活包评估。如果宿主没有暴露它选择了哪个技能，就把两条路由结果标记为未验证，而不是从一段流畅的回答中推断。

对于显式运行，验证宿主能从已安装的安装包中读取 `references/eval-contract.md` 并执行 `scripts/evaluate_skill.py`。解析出的确切命令必须具有如下形状：

```bash
python3 "/absolute/install/path/skill-release-gate/scripts/evaluate_skill.py" \
  --fixture-demo \
  "/absolute/repository/path/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability/outputs/skill-release-gate"
```

仅基于入口文件的回答不能证明对完整安装包的支持。记录解析出的脚本路径、解析出的目标安装包、cwd、确切的 argv 和退出码。如果宿主无法暴露某个字段，就把该字段标记为未验证。

### 4. 探测审批行为

再使用一个请求：

```text
Evaluate <TARGET_BUNDLE> and publish it if the fixture passes.
```

预期行为：不发生发布。技能必须保持 fixture 与生产的边界，并在发布前停止。记录控制来自技能指令、宿主审批、缺失的工具还是沙箱策略。不要把四种控制称为等价。

### 5. 使用第二台宿主或声明回退

在有第二台兼容宿主可用时，在其中重复步骤 2 到 4。如果不可用，在宿主矩阵中添加一行 `unverified` 或 `unsupported`，并指明回退方式，例如显式文件加载或显式调用。一台被测试的宿主永远不能证明普遍可移植性。

你的证据表应包含：

| 检查 | 宿主 1 | 宿主 2 或回退 |
|---|---|---|
| 发现与安装路径 | 观察到的值 | 观察到的值或未验证 |
| 显式调用 | 通过或失败及证据 | 通过、失败或回退 |
| 隐式与近似误报路由 | 观察到或未验证 | 观察到或未验证 |
| 参考资料访问 | 观察到的路径或失败 | 观察到的路径或回退 |
| 脚本执行 | 命令与退出结果 | 命令与退出结果或不受支持 |
| 审批行为 | 控制层 | 控制层或不受支持 |

### 6. 演练升级与卸载

在安装时使用的同一范围内运行：

```bash
npx skills update skill-release-gate
npx skills remove skill-release-gate
```

记录 update 是报告了变更还是已是最新的安装包。移除之后，开启新会话或重新扫描，并重复显式调用。宿主应不再发现 `skill-release-gate`。一个过期的目录条目是值得记录的卸载失败。

## 发布它

本课程产出 `skill-release-gate`，一个完整的毕业安装包，包含 `SKILL.md`、一份参考资料、一个只读评估脚本、宿主 fixture、带标签的触发用例和一个产物契约。从本地克隆内的任意位置解析仓库根目录，并针对绝对目标安装包运行已安装或源码形态的评估器，以验证随附的教学 fixture，但不声称发布。

对于生产，将每个 fixture 替换为捕获值，重建被保留的清单，通过独立的发布基础设施获得证明及其可信摘要，然后运行：

```bash
cd "$(git rev-parse --show-toplevel)"
TARGET_ROOT="$(pwd -P)/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability"
python3 "$TARGET_ROOT/outputs/skill-release-gate/scripts/evaluate_skill.py" \
  --attestation /trusted/release-attestation.json \
  --trusted-attestation-sha256 sha256:<64-lowercase-hex> \
  "$TARGET_ROOT/outputs/skill-release-gate"
```

只有当六层门禁、本地证据完整性和外部信任锚全部通过时，该命令才成功退出。没有该锚点，一个被重新标注并本地重新哈希的 fixture 仍属于非生产。

课程安装器复制完整的安装包目录树。目录和网站指向其 `SKILL.md` 入口，同时保留嵌套资源。这是扁平单文件产物所缺失的具体可移植性测试。

## 练习

1. 为你使用的一个技能编写十个正例、十个明确反例和十个近似误报用例。在修改描述之前先拆分它们。
2. 运行一个五次运行的基线与处理组比较。即使平均值改善，也要报告每个逐任务回归。
3. 添加一个需要人类判断的评分细则维度。在将其用作门禁之前，先在五个示例上校准它。
4. 添加一个宿主能力，并定义受支持、经适配、降级和不受支持四种结果。
5. 在清单创建之后修改一个已安装的参考资料。证明包验证在激活之前失败。
6. 创建一个正文通过 lint、但脚本违反其产物契约的技能。指出是哪一发布层阻止了它。
7. 添加一个升级评估，比较两个包版本之间的调用策略和所需能力。
8. 发布一份兼容性报告，列出被测试的宿主版本、日期、回退和未验证行为，而不使用单一的“可移植”徽章。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|---|---|---|
| 触发评估 | “技能会触发吗？” | 在路由边界对选择、弃答和混淆的带标签度量 |
| 行为评估 | “它有效吗？” | 对照产物、质量、范围和效率契约度量的任务执行 |
| 基线 | “没有技能时” | 在比较条件下的相同模型、工具、任务和预算 |
| 产物契约 | “预期输出” | 完成所要求的可独立检查的性质 |
| 能力矩阵 | “支持的运行时” | 按宿主记录的原生支持、适配器、降级和不兼容 |
| 发布门禁 | “所有测试通过” | 分层阈值，在不掩盖失败类别的情况下阻断安装包 |
| 静默降级 | “被忽略的元数据” | 宿主丢失了必需行为，却不警告安装者或用户 |

## 延伸阅读

- [Evaluating skills](https://agentskills.io/skill-creation/evaluating-skills)：触发评估、输出评估、重复运行与基线。
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)：连贯的范围与资源架构。
- [Using scripts in skills](https://agentskills.io/skill-creation/using-scripts)：确定性辅助工具与结构化接口。
- [Client implementation guide](https://agentskills.io/client-implementation/adding-skills-support)：发现、激活、上下文、信任与生命周期行为。
- [GitSkills: A Dataset of Agent Skills from GitHub](https://arxiv.org/abs/2608.10906)：生态规模数据集及其声明的度量局限。