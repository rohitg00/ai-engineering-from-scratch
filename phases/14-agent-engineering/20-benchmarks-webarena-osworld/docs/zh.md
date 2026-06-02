# 基准测试：WebArena 与 OSWorld（Benchmarks: WebArena and OSWorld）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> WebArena 在四个自托管 app 上测试 web agent 的能力。OSWorld 在 Ubuntu、Windows、macOS 上测试桌面 agent 的能力。两者发布时（2023–2024），最强 agent 与人类之间存在巨大差距。差距正在缩小，但失败模式没变。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 19 (SWE-bench, GAIA)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 描述 WebArena 的四个自托管 app，以及为什么基于执行（execution-based）的评估很重要。
- 解释 OSWorld 为什么用真实 OS 截图而不是 accessibility API。
- 说出 OSWorld 的两大主要失败模式：GUI grounding 与操作性知识（operational knowledge）。
- 总结 OSWorld-G 和 OSWorld-Human 在基础基准之上额外提供了什么。

## 问题（The Problem）

通才型 agent 会调用工具。它能不能驾驭浏览器、点 20 下完成购物结账？能不能只用键鼠配置好一台 Linux 机器？这些就是 WebArena 和 OSWorld 想回答的问题。

## 概念（The Concept）

### WebArena（Zhou et al., ICLR 2024）

- 812 个长链路任务，分布在四个自托管 web app 上：购物站、论坛、类 GitLab 的开发工具、商业 CMS。
- 外加几个工具：地图、计算器、便签。
- 评估通过 gym 风格 API 基于执行结果——订单下没下、issue 关没关、CMS 页面改没改？
- 发布时：最强 GPT-4 agent 跑出 14.41% 成功率，人类是 78.24%。

「自托管」这件事很重要——目标 app 被钉死、可复现，所以基准不会抽风。

### 扩展

- **VisualWebArena** — 视觉 grounded 任务，成败取决于能不能解读图像（截图作为一等公民的观测信号）。
- **TheAgentCompany**（2024 年 12 月）— 加了终端 + 编码；更接近真实远程办公环境。

### OSWorld（Xie et al., NeurIPS 2024）

- 369 个真实的电脑任务，覆盖 Ubuntu、Windows、macOS。
- 自由形式的键鼠控制，操作的是真实应用。
- 观测是 1920×1080 的截图。
- 发布时：最强模型 12.24%，人类 72.36%。

### 主要失败模式

1. **GUI grounding。** 像素→元素的映射。模型在 1920×1080 里很难稳定定位 UI 元素。
2. **操作性知识（operational knowledge）。** 设置藏在哪个菜单、对应哪个快捷键、在哪个偏好面板里。这是人类多年攒下来的长尾知识。

### 后续工作

- **OSWorld-G** — 564 个样本的 grounding 套件 + Jedi 训练集。把 grounding 从规划里解耦出来，可以分别度量。
- **OSWorld-Human** — 人工精挑的金标动作 trajectory（轨迹）。结果显示顶级 agent 用的步数是必要步数的 1.4–2.7 倍（轨迹效率差距）。

### 为什么这件事重要

Claude computer use、OpenAI CUA、Gemini 2.5 Computer Use（第 21 课）——这些都是用 WebArena 和 OSWorld 塑形出来的工作负载训出来的。基准是靶子，生产模型是交出来的答卷。

### 基准测试容易翻车的地方

- **只看截图的评测。** OSWorld 是截图驱动的；如果你拿一个用 DOM 或 accessibility API 的 agent 去跑 OSWorld，就绕开了 grounding 挑战。
- **忽略 trajectory 长度。** 只看成功率会漏掉 OSWorld-Human 揭示的 1.4–2.7 倍步数低效问题。
- **过期的自托管 app。** WebArena 的 app 是钉死特定版本的；不重新校准就升级会破坏可比性。

## 动手实现（Build It）

`code/main.py` 实现了一个玩具版的 web-agent harness：

- 一个最小化「购物 app」状态机：list_items、add_to_cart、checkout。
- 3 个任务的金标 trajectory。
- 一个脚本化 agent，逐个尝试这些任务。
- 基于执行的评估器（状态检查）以及 trajectory 效率指标（步数 vs 金标）。

跑起来：

```
python3 code/main.py
```

输出：每个任务的成功率和 trajectory 效率，对应 OSWorld-Human 的方法论。

## 用起来（Use It）

- 在内部集群上**自托管 WebArena Verified**做持续评估。
- 在 VM 集群里跑 **OSWorld** 评测桌面 agent。
- **computer-use agent**（第 21 课）—— Claude、OpenAI CUA、Gemini 都在类似工作负载上训过。
- **你自己的产品流程** —— 给你最重要的 20 个任务录金标 trajectory，每周拿 agent 跑一遍。

## 上线部署（Ship It）

`outputs/skill-web-desktop-harness.md` 搭建一个带基于执行的评估和 trajectory 效率指标的 web/桌面 agent harness。

## 练习（Exercises）

1. 给玩具 harness 加上第二个 app（论坛）。写 3 个任务加金标 trajectory。
2. 加上每个任务的 trajectory 效率上报。在你的玩具里，agent 是金标的 1 倍、2 倍还是 3 倍？
3. 实现一个「干扰项」工具——金标 trajectory 从来不用它。脚本化 agent 会不会被诱惑？
4. 读 OSWorld-G。在你自己的评测里，要怎么把 grounding 失败和规划失败分开？
5. 读 WebArena 的 apps README。当你升级某个钉死的 app 版本时，会有什么坏掉？

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际意思 |
|------|----------------|------------------------|
| WebArena | "Web agent benchmark" | 4 个自托管 app 上的 812 个任务；gym 风格评估 |
| VisualWebArena | "Visual WebArena" | 视觉 grounded 版 WebArena；截图作为观测 |
| OSWorld | "Desktop agent benchmark" | 真实 Ubuntu/Windows/macOS 上的 369 个任务 |
| GUI grounding | "Pixel-to-element mapping" | 模型在 1920x1080 中定位 UI 元素 |
| Operational knowledge | "OS know-how" | 哪个菜单、哪个快捷键、哪个偏好面板 |
| OSWorld-G | "Grounding suite" | 564 个纯 grounding 样本 + 训练集 |
| OSWorld-Human | "Gold trajectories" | 人工专家动作序列，用来度量效率 |
| Trajectory efficiency | "Steps over gold" | agent 步数除以人类最小步数 |

## 延伸阅读（Further Reading）

- [Zhou et al., WebArena (arXiv:2307.13854)](https://arxiv.org/abs/2307.13854) — 四 app web 基准
- [Xie et al., OSWorld (arXiv:2404.07972)](https://arxiv.org/abs/2404.07972) — 跨 OS 的桌面基准
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) — Claude 的基准塑形能力
- [OpenAI, Computer-Using Agent](https://openai.com/index/computer-using-agent/) — OSWorld 和 WebArena 数字
