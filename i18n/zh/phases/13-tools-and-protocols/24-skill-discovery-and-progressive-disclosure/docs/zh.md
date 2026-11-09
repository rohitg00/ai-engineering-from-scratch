# 技能发现和逐步揭示

> 技能在被装载之前就会变得有用.它的名称和描述在目录中获得位置;其更深层次的文件只有当任务达到它们时才获得了语境.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 22 (Agent Skills: Portable Contract and Runtime Boundary)
**Time:** ~105 minutes

## 学习目标

- 建立一个文件系统发现管道,分开范围,验证,碰撞政策和目录发布.
- 解释三个披露水平:目录元数据,活跃指令和具体任务资源.
- 设计参考,使代理人可以直接到达所需细节,而不需要装载整个包装.
- 预算目录空间独立于活跃技能背景.
- 拒绝路径穿越和符号链接逃脱,当一个技能读取自己的资源.

## 问题

你的代理人有200个技能,`SKILL.md`访问程序的内容将会被删除,并且将其运行到无关程序中.

常见的妥协是目录:向模型展示每个合格技能的紧身份和路由描述,然后在选择后才加载整个机器. 这会产生两个新的工程问题.

首先,发现不仅仅是复制文件搜索.技能可以存在于项目,用户,管理员,插件或内置范围.两个包可以共享一个名称.一个符号链接可以指向值得信赖的根外.一个错误的包可能耗尽目录空间或变得无法调用.

另一方面,逐步披露可能会导致逐步的混乱.`SKILL.md`如果每个指南指向了另外三个文件,加载就会变成一个无限的图形行程.

良好的运行时间使发现确定性,

## 概念

### 发现是一个编译器管道

处理文件系统作为源输入.不要直接发布原始路径到模型中.

```figure
skill-discovery-pipeline
```

每个阶段都应该产生结构化数据和结构性故障.

- 它们的根源是什么?
- 谁的候选人被发现?
- 哪些候选人被拒绝,为什么?
- 哪个包赢得了碰撞?
- 由于预算问题,哪些目录被缩短或遗漏?

没有这些证据, "模型没有使用我的技能"几乎不可能诊断.

### 范围是运行时间政策

移动规格定义了技能包,而不是一个通用的安装路径或优先级顺序. 主机决定它在哪里搜索.

总体运行时间可能使用以下范围:

| Scope | Example root | Intended ownership |
|---|---|---|
| Workspace | `<repo>/.agents/skills/` | Project maintainers |
| User | `<user-data>/skills/` | One developer |
| Administrator | `<system>/skills/` | Machine or organization policy |
| Plugin | A signed plugin bundle | Plugin publisher and installer |
| Built-in | Runtime package | Runtime vendor |

截至2026年8月,Codex文件将项目发现`$CWD/.agents/skills`通过祖先目录到库根,加上用户,管理员和内置位置.它支持交互式技能目录.重复名称可能都会出现而不是合并.这些是Codex行为,而不是要求的`SKILL.md`检查电流[Codex skill documentation](https://learn.chatgpt.com/docs/build-skills)在编写适配器时.

任何类目录名字都不能先决地出现. 声明为政策并测试它.`Scope`所以同一个候选人总是以同样的方式解决.

### 碰撞需要一个身份`name`

两个名为的包裹`release-readiness`一个可能是工作空间过失,另一个可能是用户默认.因此,目录入口至少需要:

```json
{
  "name": "release-readiness",
  "description": "Inspect a release candidate for this repository.",
  "scope": "workspace",
  "source": "/repo/.agents/skills/release-readiness",
  "selected": true
}
```

共同的碰撞政策包括:

| Policy | Benefit | Risk |
|---|---|---|
| Keep every candidate | Nothing is hidden | The model sees ambiguous names |
| Highest-precedence scope wins | Simple invocation | A local package can shadow a trusted one |
| Reject duplicates | No silent shadowing | Legitimate overrides stop working |
| Qualify names by source | Explicit identity | User-facing names become longer |

选择一个主机的政策.即使在模型目录中没有被拒绝或被置的候选人,也可以在诊断中保留.

### 披露的三个层次

机关的关键是每个层次都有不同的目的.

```figure
skill-disclosure-levels
```

#### 级别1:目录元数据

模型需要足够的信息来区分技能与邻居.规格估计每一条目录的约100个代币,但实际的序列化和代币化属于主机.

有用的描述有两个条款:

```yaml
description: Validate a release candidate and produce a readiness report. Use when the user asks whether a version, tag, or package is ready to publish.
```

第一个条款规定了能力. 第二条规定了触发界限. 第25课程评估了这个界限,通过积极和接近错误的提示.

#### 级别2: 活动指令

激活后,该机体应作为一个地图和程序.`SKILL.md`这是一个设计信号,而不是一个填充目标.

身体应包含:

- 任务界限;
- 默认工作流程;
- 部门条件;
- 直接引用更深层次的文件;
- 工具和脚本合同;
- 失败和停止行为;
- 预期产量和其验证.

仅仅是为了使输入文件短暂,不要将中央工作流转换为参考.

#### 支持资源的第三级

引用提供散文或数据.脚本提供确定性计算.资产被复制,填写或转化为交付物而不是作为说明.

| Directory | Model reads it? | Model executes it? | Typical content |
|---|:---:|:---:|---|
| `references/` | Yes, when needed | No | schemas, policies, domain guides |
| `scripts/` | May inspect it | Through a permitted tool | validators, converters, collectors |
| `assets/` | Only if useful | No | templates, fixtures, images, starter files |

它们是规范,而不是魔术功能.

### 专业指南比主题倾销更高

写入文件作为决策地图:

```markdown
## Choose the path

- For a Python package, read `references/python-release.md`.
- For a container image, read `references/container-release.md`.
- For a documentation-only release, read `references/docs-release.md`.
- If the release combines artifact types, read only the guides for those artifacts.
```

这使得每个引用都能观察到的负载条件.`references/`没有.

官方指南建议直接链接到`SKILL.md`一次跳跃使得可访问性可测试,

```figure
skill-reference-map
```

### 产品表预算和活动背景是不同的预算

让我们`c_i`作为一个系列化目录的技能成本`i`现在`B_c`产品表预算`b_j`活动体成本,`r_k`实际上,资源的装载量.

```text
catalog_cost = sum(c_i for every published skill)
active_cost = sum(b_j for every activated skill) + sum(r_k for every disclosed resource)
```

减少一个预算不会自动减少另一个.简短的描述可以节省目录空间,而一个激活的900行体仍然压倒任务.将体积分为参考可以减少活动成本,只有当运行时间和说明实际避免加载无关的分支时.

目前,Codex将初步技能列表的预算为
设置一个窗口,当背景窗口大小已知.
只有当该尺寸不清楚时,只有当该尺寸不清楚时;它不是第二个盖子,结合
如果目录超过适用的预算,
描述可能会缩短或遗漏.
编码政策,不是代理技能标准的属性.

### 资源路径是信任界限

技能只需要阅读包装中的文件.

```text
references/../../../../.ssh/config
references/external-link -> /private/company-secrets
```

通过文件系统语义来解决包根和候选,拒绝绝绝对输入,并验证已解决的候选仍然存在于已解决的根下. 确定是否允许在发现之前符号链接. 如果允许,每次都检查已解决的目标.

```figure
skill-resource-containment
```

路径封锁不会建立内容信任.一个有效的包装引用仍然可能包含恶意指令. 第26课处理这种威胁.

### 载荷必须可观测

记录披露事件,没有记录秘密:

```json
{
  "event": "skill.resource.loaded",
  "skill": "release-readiness",
  "resource": "references/python-release.md",
  "reason": "candidate contains pyproject.toml",
  "bytes": 2840
}
```

原因是,它将文本选择转化为可审查的证据.

## 建立它

`code/main.py`建立一个确定性发现和披露引擎.

发现表面包括:

- `Scope`对于源和优先级的元数据;
- `SkillCandidate`对于未经验证的文件系统候选人;
- `discover_scope(scope)`列出直接技能目录;
- `resolve_collisions(candidates, precedence)`实施一个声明的政策;
- `CatalogEntry`其他`build_catalog(...)`发布有限的元数据;
- `CatalogBudget`为了解释连续化输入,而没有假装字符是通用代币.

透露表面包括:

- `load_skill_body(entry, ...)`对于2级激活;
- `validate_reference(skill_dir, reference)`对于路径封锁;
- `load_reference(...)`对于有边界的3级读数.

运行实验室:

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

这个区块需要一个本地克隆,并解决任何存储库的根
在那个克隆内部的工作目录.

演示程序创建了临时项目和用户范围,插入了碰撞,在故意小预算下构建了目录,激活了一个技能,并尝试了有效的参考阅读和穿越逃逸.没有永久文件安装.

### 为什么发现是浅的

`discover_scope`检查了儿童直接目录`SKILL.md`它不会反复治疗每一个子.`SKILL.md`作为单独的包装,从而保护包装边界,避免在安装的技能内意外发布示例或装置.

### 为什么实验室不分析任意的YAML

实验室支持其目录所需的 skalar frontmatter.生产运行时间应使用一个安全的YAML解析器,具有明确的方案,尺寸限制和禁用的自定义对象构建. "仅Stdlib"是教学约束,而不是允许默默地发明部分YAML方言.

## 用它

应用此检查列表到任何发现适配器:

1. 列出每个配置的根和谁可以写到它.
2. 说明是否允许连接包裹.
3. 验证包名,目录名称,所需的元数据和输入体尺寸.
4. 保持内部身份的来源和范围.
5. 声明和测试复制名称行为.
6. 测量向模型发送的精确序列目录.
7. 记录为什么一个尸体或资源被装载.
8. 保持资源读数在解决包根内.
9. 当引用文件缺失时,显然失败.
10. 修改安装或政策时重建目录.

## 运送它

这一课产生了`skill-catalog-builder`包.它扫描了明确排序的根,拒绝了链接的输入文件和名称目录不匹配,解决了跨范围的碰撞,拒绝了相同优先级的重复,并将选定的元数据纳入了声明的输入,描述和序列化字符预算.

它的JSON报告包含选定的输入,阴影的候选人,遗漏的输入,验证错误,优先级和预算使用.体体和参考加载仍然是分离的运行时间操作,因此目录构建器不会执行脚本或将整个包放入文本中.

## 运动

1. 添加一个插件范围,将其放在用户和内置优先级之间.
2. 改变碰撞政策,从最优先级到合格名称.
3. 添加字节大小限制`load_reference`检查一个文件的极限和一个字节以上.
4. 创建两个几乎相同的描述,重新写它们,以免触发器界限重叠.
5. 添加一个包含每个引用和脚本的哈希表. 在加载之前检测修改的资源.
6. 仪器显示,报告级别1,级别2,级别3的字节分别计数.

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| Skill discovery | "Find every SKILL.md" | Search configured scopes, validate packages, attach provenance, and apply policy |
| Skill catalog | "The list of installed skills" | Compact model-visible routing metadata for eligible packages |
| Collision policy | "Which duplicate wins" | A declared rule for same-name candidates from different sources |
| Progressive disclosure | "Lazy loading" | Staged context admission from catalog to body to branch-specific resources |
| Reference graph | "Files linked by the skill" | The reachable resource structure and its load conditions |
| Path containment | "Stay in the folder" | Verify resolved resource targets remain inside the resolved package root |

## 进一步阅读

- [Agent Skills specification](https://agentskills.io/specification)包装形状和逐步披露水平.
- [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)对于目录路由元数据.
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)直接引用和输入文件大小.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)对于目前的Codex发现范围和目录限制.
