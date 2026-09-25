# 技能发现与渐进式披露

> 技能在其正文被加载之前就已经变得有用。它的名称和描述为它赢得目录中的位置；只有当任务到达其更深层的文件时，这些文件才获得上下文。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** 阶段 13 · 22（Agent Skills：可移植契约与运行时边界）
**Time:** 约 105 分钟

## 学习目标

- 构建一个文件系统发现管道，将作用域、验证、冲突策略和目录发布彼此分离。
- 解释三个披露层级：目录元数据、激活指令和任务特定资源。
- 设计引用，使智能体可以直接获取所需细节，而无需加载整个包。
- 将目录空间预算与激活技能上下文的预算分开管理。
- 当技能读取自身资源时，拒绝路径穿越和符号链接逃逸。

## 问题所在

你的智能体安装了 200 个技能。在会话开始时加载每个 `SKILL.md`、引用文件、脚本和模板，会把当前任务埋进无关的流程中。什么都不加载则会迫使用户记住确切的文件系统路径。

常见的折中方案是目录：向模型展示每个合格技能的紧凑身份标识和路由描述，然后在选定之后才加载完整正文。这带来了两个新的工程问题。

第一，发现不仅仅是递归文件搜索。技能可以存在于项目、用户、管理员、插件或内置作用域中。两个包可能重名。一个符号链接可能指向受信任根之外。一个格式错误的包可能消耗目录空间，或变得无法调用。

第二，渐进式披露可能变成渐进式困惑。如果 `SKILL.md` 说"阅读相关指南"，而包里包含十二份指南，模型只能靠猜。如果每份指南又指向另外三个文件，加载就变成无界的图遍历。

一个好的运行时使发现具有确定性，使披露是有意图的。

## 概念

### 发现是一条编译器管道

把文件系统当作源输入。不要把原始路径直接发布给模型。

```figure
skill-discovery-pipeline
```

每个阶段都应产生结构化数据和结构化失败。发现日志应能回答：

- 搜索了哪些根目录？
- 找到了哪些候选？
- 哪些候选被拒绝，为什么？
- 哪个包赢得了冲突？
- 哪些目录条目因预算而被缩短或省略？

没有这些证据，"模型没有使用我的技能"几乎无法诊断。

### 作用域是运行时策略

可移植规范定义的是技能包，而不是某个通用的安装路径或优先级顺序。由宿主决定在哪里搜索。

一个通用运行时可能使用以下作用域：

| 作用域 | 示例根目录 | 预期归属 |
|---|---|---|
| 工作区 | `<repo>/.agents/skills/` | 项目维护者 |
| 用户 | `<user-data>/skills/` | 单个开发者 |
| 管理员 | `<system>/skills/` | 机器或组织策略 |
| 插件 | 签名的插件包 | 插件发布者和安装者 |
| 内置 | 运行时包 | 运行时供应商 |

截至 2026 年 8 月，Codex 文档说明项目发现从 `$CWD/.agents/skills` 开始，沿祖先目录向上直到仓库根目录，此外还包括用户、管理员和内置位置。它支持符号链接的技能目录。重复的名称可能同时出现而不是被合并。这些是 Codex 的行为，不是 `SKILL.md` 的要求；编写适配器时请核对当前的 [Codex skill documentation](https://learn.chatgpt.com/docs/build-skills)。

绝不要根据目录名称臆造优先级。将其声明为策略并加以测试。课程实验为每个 `Scope` 使用显式整数等级，因此同一候选集合总能以相同方式解析。

### 冲突需要 `name` 之外的身份标识

两个名为 `release-readiness` 的包可以同时合法。一个可能是工作区覆盖，另一个是用户默认。因此目录条目至少需要：

```json
{
  "name": "release-readiness",
  "description": "Inspect a release candidate for this repository.",
  "scope": "workspace",
  "source": "/repo/.agents/skills/release-readiness",
  "selected": true
}
```

常见的冲突策略包括：

| 策略 | 好处 | 风险 |
|---|---|---|
| 保留所有候选 | 没有内容被隐藏 | 模型看到含糊的名称 |
| 最高优先级作用域获胜 | 调用简单 | 本地包可以遮蔽受信任的包 |
| 拒绝重复 | 没有静默遮蔽 | 合法的覆盖会失效 |
| 按来源限定名称 | 身份明确 | 面向用户的名称变长 |

为宿主选择一种策略。即使被拒绝或被遮蔽的候选不出现在模型目录中，也要在诊断信息中保留它们。

### 三个披露层级

Agent Skills 规范描述了分阶段加载。关键在于每个层级的目的不同。

```figure
skill-disclosure-levels
```

#### 层级 1：目录元数据

模型需要足够的信息来将该技能与相邻技能区分开。规范估算每个目录条目约 100 个 token，但实际的序列化和分词由宿主负责。

有用的描述包含两个分句：

```yaml
description: Validate a release candidate and produce a readiness report. Use when the user asks whether a version, tag, or package is ready to publish.
```

第一个分句陈述能力。第二个分句陈述触发边界。第 25 课用正面提示和近似未命中提示来评估这一边界。

#### 层级 2：激活指令

激活之后，正文应当既是一张地图，也是一套流程。规范建议将 `SKILL.md` 保持在 500 行以内。这是一个设计信号，而不是要填满的目标。

正文应包含：

- 任务边界；
- 默认工作流；
- 分支条件；
- 对更深层次文件的直接引用；
- 工具和脚本契约；
- 失败与停止行为；
- 预期输出及其验证。

不要仅仅为了让条目文件变短，就把核心工作流移入引用。激活必须给模型足够的上下文以正确开始。

#### 层级 3：支持性资源

引用提供文本或数据。脚本提供确定性计算。资产被复制、填充或转换为交付物，而不是被当作指令。

| 目录 | 模型会读取吗？ | 模型会执行吗？ | 典型内容 |
|---|:---:|:---:|---|
| `references/` | 会，在需要时 | 否 | 模式、策略、领域指南 |
| `scripts/` | 可以查看 | 通过被许可的工具 | 校验器、转换器、采集器 |
| `assets/` | 只在有用时 | 否 | 模板、夹具、图片、起始文件 |

这些名称是约定，不是魔法能力。宿主仍然需要文件访问和执行工具。

### 面向分支的引用优于主题堆砌

把条目文件写成一张决策图：

```markdown
## Choose the path

- For a Python package, read `references/python-release.md`.
- For a container image, read `references/container-release.md`.
- For a documentation-only release, read `references/docs-release.md`.
- If the release combines artifact types, read only the guides for those artifacts.
```

这让每个引用都有可观察的加载条件。"阅读 `references/` 以了解更多"则做不到。

保持引用图浅平。官方指南建议从 `SKILL.md` 直接链接，并避免深层链条。一跳的可达性可以测试，并降低必要约束从未进入上下文的可能性。

```figure
skill-reference-map
```

### 目录预算与激活上下文是不同的预算

设 `c_i` 为技能 `i` 的序列化目录成本，`B_c` 为目录预算，`b_j` 为激活正文成本，`r_k` 为实际加载的资源。

```text
catalog_cost = sum(c_i for every published skill)
active_cost = sum(b_j for every activated skill) + sum(r_k for every disclosed resource)
```

削减一个预算不会自动削减另一个。简短的描述可以节省目录空间，而激活后的 900 行正文仍然会淹没任务。把正文拆成引用只有在运行时和指令确实避免加载无关分支时，才能降低激活成本。

Codex 目前在已知上下文窗口大小时，将初始技能列表的预算设为上下文窗口的 2%。8,000 字符值仅在该大小未知时作为回退；它不是与 2% 规则叠加的第二个上限。当目录超过适用预算时，描述可能被缩短或省略。将这些数字视为当前的 Codex 政策，而不是 Agent Skills 标准的属性。

### 资源路径是信任边界

技能应只读取其包内的文件。字面字符串前缀检查是不够的：

```text
references/../../../../.ssh/config
references/external-link -> /private/company-secrets
```

用文件系统语义解析包根和候选路径，拒绝绝对路径输入，并验证解析后的候选仍然位于解析后的根之下。在发现之前决定是否允许符号链接。如果允许，每次都检查解析后的目标。

```figure
skill-resource-containment
```

路径包含并不能确立内容信任。一个合法的包内引用仍可能包含恶意指令。第 26 课处理该威胁。

### 加载必须可观察

在不记录机密的前提下记录披露事件：

```json
{
  "event": "skill.resource.loaded",
  "skill": "release-readiness",
  "resource": "references/python-release.md",
  "reason": "candidate contains pyproject.toml",
  "bytes": 2840
}
```

"原因"把一次上下文选择变成可审查的证据。它还有助于识别那些导致智能体"以防万一"加载所有文件的指令。

## 动手构建

`code/main.py` 构建一个确定性的发现与披露引擎。

发现接口包括：

- `Scope` 用于来源和优先级元数据；
- `SkillCandidate` 用于未经校验的文件系统候选；
- `discover_scope(scope)` 用于枚举直接的技能目录；
- `resolve_collisions(candidates, precedence)` 用于应用一种已声明的策略；
- `CatalogEntry` 和 `build_catalog(...)` 用于发布有界的元数据；
- `CatalogBudget` 用于核算序列化条目，而不假装字符等于通用 token。

披露接口包括：

- `load_skill_body(entry, ...)` 用于层级 2 激活；
- `validate_reference(skill_dir, reference)` 用于路径包含；
- `load_reference(...)` 用于有界的层级 3 读取。

运行实验：

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

本模块需要本地克隆，并从克隆内的任意工作目录解析仓库根目录。

演示会创建临时的项目与用户作用域，插入一个冲突，在刻意设小的预算下构建目录，激活一个技能，并尝试一次合法的引用读取和一次路径穿越逃逸。不会安装任何永久文件。

### 为什么发现是浅层的

`discover_scope` 只检查 `SKILL.md` 的直接子目录。它不会递归地把每个嵌套的 `SKILL.md` 都当作独立包。这保住了包边界，避免意外发布已安装技能内的示例或夹具。

### 为什么实验不解析任意 YAML

实验只支持其目录所需的标量前置元数据。生产运行时应使用安全的 YAML 解析器，配合显式模式、大小限制，并禁用自定义对象构造。"仅用标准库"是教学约束，而不是默许发明一种残缺 YAML 方言的许可。

## 使用它

将以下清单应用于任何发现适配器：

1. 列出每个配置的根目录及其可写入者。
2. 说明是否允许符号链接的包。
3. 校验包名、目录名、必需元数据和正文大小。
4. 在内部身份中保留来源与作用域。
5. 声明并测试重名行为。
6. 度量发送给模型的目录的确切序列化大小。
7. 记录正文或资源为何被加载。
8. 将资源读取保持在解析后的包根之内。
9. 当被引用的文件缺失时，清晰地失败。
10. 当安装或策略变化时重建目录。

## 发布它

本课产出 `skill-catalog-builder` 包。它扫描显式排序的根目录，拒绝符号链接的条目文件以及名称与目录不匹配的情况，解析跨作用域冲突，拒绝同等优先级的重复，并将选定的元数据装入声明的条目、描述和序列化字符预算。

其 JSON 报告包含选定的条目、被遮蔽的候选、被省略的条目、校验错误、优先级和预算使用。正文与引用加载仍是独立的运行时操作，因此目录构建器不会执行脚本，也不会把整个包纳入上下文。

## 练习

1. 添加一个插件作用域，其优先级位于用户与内置之间。用测试证明冲突结果。
2. 把冲突策略从最高优先级改为限定名称。在目录中保留两个条目。
3. 给 `load_reference` 添加字节大小限制。测试恰好等于限制的文件和超出一个字节的文件。
4. 创建两个听起来几乎相同的描述。重写它们，使触发边界互不重叠。
5. 添加一个清单，包含每个引用和脚本的哈希值。在加载资源之前检测被篡改的资源。
6. 对演示进行插桩，分别报告层级 1、层级 2 和层级 3 的字节数。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|---|---|---|
| 技能发现 | "找到每个 SKILL.md" | 搜索配置的作用域、校验包、附加来源信息并应用策略 |
| 技能目录 | "已安装技能的列表" | 面向模型的合格包的紧凑路由元数据 |
| 冲突策略 | "哪个重复者获胜" | 一条针对来自不同来源的同名候选的已声明规则 |
| 渐进式披露 | "懒加载" | 从目录到正文再到面向分支资源的分阶段上下文纳入 |
| 引用图 | "技能链接的文件" | 可达的资源结构及其加载条件 |
| 路径包含 | "待在文件夹里" | 验证解析后的资源目标仍在解析后的包根之内 |

## 延伸阅读

- [Agent Skills specification](https://agentskills.io/specification)：包结构与渐进式披露层级。
- [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)：目录路由元数据。
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)：直接引用与条目文件大小。
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)：当前的 Codex 发现作用域与目录限制。