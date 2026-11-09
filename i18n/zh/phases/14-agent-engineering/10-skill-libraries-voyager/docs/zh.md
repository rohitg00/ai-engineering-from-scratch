# 技能图书馆和终身学习 (旅行社)

> 旅行者 (Wang等等,TMLR 2024) 将可执行代码视为技能.技能通过环境反命名,可检索,可组合和精炼.这是克劳德代理SDK技能,技能套件和2026技能图书馆模式的参考架构.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 07 (MemGPT), Phase 14 · 08 (Letta Blocks)
**Time:** ~75 minutes

## 学习目标

- 命名旅行者三部份 自动课程,技能库,反复提示 和每个组件的作用.
- 解释为什么旅行者编写了行动空间代码,而不是原始命令.
- 实现一个具有注册,检索,组合和故障驱动的精炼的 stdlib技能库.
- 绘制旅行者模式,将2026年克劳德特工 SDK技能和技能套件生态系统介绍.

## 问题

那些在每次会议中重建一切能力的人,都做了三件事:

1. **Waste tokens.**每个任务都会重新引发相同的推理.
2. **Lose progress.**修改在A会话中学习的,不会转移到B会话中.
3. **Fail on long-horizon composition.**复杂的任务需要能力等级; 一次提示不能表达它们.

旅行者的答案:把每一个可重复使用的功能都视为一个名字的代码,存储在图书馆里,

## 概念

### 三个组成部分

旅行者 (arXiv:2305.16291) 建立了一个代理在:

1. **Automatic curriculum.**根据代理人的当前技能和环境状态,一个好奇心驱动的提议者选择下一个任务.
2. **Skill library.**每个技能都是可执行的代码.任务成功时,新技能被添加.技能通过查询到描述相似性获取.
3. **Iterative prompting mechanism.**在失败时,代理收到执行错误,环境反和自我验证输出,然后改进技能.

克莱夫特评估 (Wang等同等,2024):有3.3倍的独特物品,8.5倍的更快的石头工具,6.4倍的更快的铁工具,2.3倍的更长的地图穿越与基线.数字是克莱夫特特异性的,但模式转移.

### 行动空间 = 代码

许多代理都发出原始命令. 旅行者发出JavaScript功能.

```
async function craftIronPickaxe(bot) {
  await mineIron(bot, 3);
  await mineStick(bot, 2);
  await placeCraftingTable(bot);
  await craft(bot, 'iron_pickaxe');
}
```

包含了次技能,存储在描述和嵌入键上,作为程序,而不是提示.

这就是2026年Claude Agent SDK技能:一个命名的可检索的代码加上指令,

### 技能提升

另一个任务是做钻石.

1. 嵌入任务描述.
2. 查询技能库,查询上级的类似技能.
3. 检索`craftIronPickaxe`现在`mineDiamond`现在`placeCraftingTable`其他
4. 构建了从检索的原始+新逻辑的新技能.

采用MCP资源 (第13阶段) 和代理SDK技能实现的模式:在知识/代码表面上检索,针对当前任务.

### 复制的精炼

旅行者的反循环:

1. 代理写出一个技能.
2. 技能与环境相反.
3. 报道三种信号中的一个:`success`现在`error`子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子`self-verification failure`现在,我们要去.
4. 代理用信号作为背景重新写技能.
5. 循环到成功或最大轮.

通过环境基准验证来生成代码,它是自定义 (课05) 应用的.

### 课程和探索

旅行者课程模块提出了"在湖边建造避难所"等任务,根据代理人有什么以及尚未做什么. 提出者使用环境状态 +技能库存来选择一个任务,仅仅在当前能力度高于探索的甜点.

对于生产代理人来说,这意味着"缺失了什么"的操作员:鉴于目前的技能库和域名,我们还没有涵盖哪些技能?

### 在这个模式出现错误的地方

- **Skill library rot.**写作时添加除倍数,检索只返回一个.
- **Composed-skill drift.**孩子的父母技能取决于孩子的精炼. 版本技能;一个被绑定到v1的父母不会神奇地接收v3.
- **Retrieval quality.**随着库的数量增加,技能描述的向量检索会恶化.`category=tooling`")

```figure
voyager-skills
```

## 建立它

`code/main.py`实现了 stdlib 技能库:

- `Skill`名称,描述,代码 (作为字符串),版本,标签,依赖性.
- `SkillLibrary`注册,搜索 (代币重叠),编写 (顶级类型的 deps),并精炼 (更新版本弹).
- 编写剧本的代理,记录了三个原始技能, 编写了第四个, 击败了失败,

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

痕迹显示图书馆写作,检索,编译,失败执行,

## 用它

- **Claude Agent SDK skills**根据2026年参考,每个技能都有描述,代码和指令,
- **skillkit**跨代理技能管理,用于32+个AI编码代理.
- **Custom skill libraries**域名特定 (数据代理的SQL技能,地形代理的Terraform技能).
- **OpenAI Agents SDK `tools`**在低端;每个工具都是轻量级的技能.

## 运送它

`outputs/skill-skill-library.md`通过电子设备,我们可以在任何目标运行时间内进行编辑,检索,版本化和改进.

## 运动

1. 添加依赖周期检测器`compose()`什么会发生,当技能A取决于B取决于A?错误与警告?
2. 实现每技能版本的点. 当一个父母的技能构成孩子时`crafting@1`改进了`crafting@2`必须不默默地升级父母.
3. 替换代代币重叠检索用语句变换器嵌入式 (或BM25 stdlib impl).在50技能玩具库中测量检索@5.
4. 添加一个"课程"代理:鉴于当前的图书馆和域名描述,建议5个缺失技能.
5. 读到人类的Claude Agent SDK技能文件. 将玩具库移植到 SDK的技能方案.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Skill | "Reusable capability" | Named chunk of code + description, retrievable by similarity |
| Skill library | "Agent memory of how-to" | Persistent store of skills, searchable and composable |
| Curriculum | "Task proposer" | Bottom-up goal generator driven by current capability gap |
| Composition | "Skill DAG" | Skills invoking skills; topologically sorted on execution |
| Iterative refinement | "Self-correcting loop" | Env feedback + errors + self-verification fold back into the next version |
| Action-space-as-code | "Programmatic actions" | Emit functions, not primitive commands, for temporally extended behavior |
| Dedup on write | "Skill collapse" | Near-duplicate descriptions collapse to one canonical skill |

## 进一步阅读

- [Wang et al., Voyager (arXiv:2305.16291)](https://arxiv.org/abs/2305.16291)原始的技能图书馆论文
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview)2026年生产能力
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)实践中的技能和潜力
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651)航母下面的精炼循环
