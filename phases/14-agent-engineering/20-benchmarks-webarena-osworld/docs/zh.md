# 基准测试：WebArena 与 OSWorld

> WebArena 测试 Web Agent 在四个自托管应用上的能力。OSWorld 测试桌面 Agent 在 Ubuntu、Windows、macOS 上的能力。发布时（2023–2024 年），两者均显示出顶级 Agent 与人类之间的巨大差距。差距正在缩小，但失败模式未变。

**类型：** 学习
**语言：** Python（标准库）
**前置知识：** 阶段 14 · 19（SWE-bench、GAIA）
**时间：** 约 60 分钟

## 学习目标

- 描述 WebArena 的四个自托管应用，以及为什么基于执行的评估很重要。
- 解释为什么 OSWorld 使用真实操作系统截图而非无障碍 API。
- 列举 OSWorld 的两种主要失败模式：GUI 定位与操作知识。
- 总结 OSWorld-G 和 OSWorld-Human 在基础基准测试之上增加了什么。

## 问题

通用 Agent 可以调用工具。但它们能驱动浏览器完成 20 次点击来执行购物结账吗？它们能仅用键盘和鼠标配置一台 Linux 机器吗？WebArena 和 OSWorld 正是回答这些问题的基准测试。

## 概念

### WebArena（Zhou 等，ICLR 2024）

- 812 个长周期任务，跨越四个自托管 Web 应用：一个购物网站、一个论坛、一个类似 GitLab 的开发工具、一个企业内容管理系统。
- 外加实用工具：地图、计算器、便签。
- 评估通过类似 gym 环境的 API 基于执行结果进行——订单是否已下单？Issue 是否已关闭？CMS 页面是否已更新？
- 发布时：最佳 GPT-4 Agent 成功率为 14.41%，而人类为 78.24%。

自托管的框架很重要——由于目标应用被固定且可复现，该基准测试不会出现不稳定问题。

### 扩展

- **VisualWebArena**——依赖图像理解（截图作为第一类观察）的视觉定位任务。
- **TheAgentCompany**（2024 年 12 月）——增加了终端和编码能力，更像真实的远程工作环境。

### OSWorld（Xie 等，NeurIPS 2024）

- 369 个真实计算机任务，覆盖 Ubuntu、Windows、macOS。
- 通过自由形式的键盘和鼠标控制真实应用程序。
- 使用 1920×1080 截图作为观察输入。
- 发布时：最佳模型 12.24%，人类 72.36%。

### 主要失败模式

1. **GUI 定位（GUI grounding）**：像素到元素的映射。模型难以在 1920×1080 分辨率下可靠地定位 UI 元素。
2. **操作知识（Operational knowledge）**：哪个菜单有某个设置、哪个键盘快捷键、哪个偏好设置面板。这是人类多年积累的知识长尾。

### 后续工作

- **OSWorld-G**——包含 564 个样本的定位测试集和 Jedi 训练集。将定位与规划分解开来，以便分别衡量。
- **OSWorld-Human**——人工精选的黄金动作轨迹。显示顶级 Agent 比必要步骤多用了 1.4–2.7 倍（轨迹效率差距）。

### 为什么这很重要

Claude Computer Use、OpenAI CUA、Gemini 2.5 Computer Use（第 21 课）都在由 WebArena 和 OSWorld 塑造的工作负载上进行训练。这些基准测试是靶心，生产模型是最终交付的答案。

### 基准测试容易走入的误区

- **仅依赖截图的评估**。OSWorld 是基于截图的；使用 DOM 或无障碍 API 的 Agent 在 OSWorld 上评估会错过定位挑战。
- **忽略轨迹长度**。仅评估成功率会忽略 OSWorld-Human 揭示的 1.4–2.7 倍步骤低效问题。
- **自托管应用过时**。WebArena 的应用固定了特定版本；未经重新标定的更新会破坏可比性。

## 动手构建

`code/main.py` 实现了一个简易的 Web Agent 框架：

- 一个极简的"购物应用"状态机：list_items、add_to_cart、checkout。
- 3 个任务的黄金轨迹。
- 一个尝试完成每个任务的脚本化 Agent。
- 基于执行的评估器（状态检查）和轨迹效率指标（步骤数与黄金轨迹对比）。

运行方式：

```
python3 code/main.py
```

输出：每个任务的成功率和轨迹效率，与 OSWorld-Human 的方法论一致。

## 场景应用

- **WebArena Verified**——在内网集群上自托管，用于持续评估。
- **OSWorld**——在虚拟机集群中用于桌面 Agent。
- **计算机操作 Agent（第 21 课）**——Claude、OpenAI CUA、Gemini 均在此类工作负载上训练。
- **你自己的产品流程**——为你最常用的 20 个任务录制黄金轨迹；每周让 Agent 对它们进行测试。

## 交付产物

`outputs/skill-web-desktop-harness.md` 构建了一个包含基于执行的评估和轨迹效率指标的 Web/桌面 Agent 框架。

## 练习

1. 在简易框架中增加第二个应用（一个论坛）。编写 3 个任务及其黄金轨迹。
2. 为每个任务添加轨迹效率报告。在你的简易框架中，Agent 是黄金轨迹的 1 倍、2 倍还是 3 倍？
3. 实现一个"干扰"工具——黄金轨迹从不使用的工具。脚本化 Agent 会被引诱吗？
4. 阅读 OSWorld-G。你会如何在自有的评估中区分定位失败与规划失败？
5. 阅读 WebArena 的应用 README。当你升级其中一个固定版本的应用时，会出什么问题？

## 关键术语

| 术语 | 人们通常说的 | 实际含义 |
|------|-------------|---------|
| WebArena | "Web Agent 基准测试" | 4 个自托管应用上的 812 个任务；类似 gym 的评估 |
| VisualWebArena | "视觉版 WebArena" | 基于视觉的 WebArena；截图即观察 |
| OSWorld | "桌面 Agent 基准测试" | 真实 Ubuntu/Windows/macOS 上的 369 个任务 |
| GUI 定位（GUI grounding） | "像素到元素的映射" | 模型在 1920×1080 中定位 UI 元素 |
| 操作知识（Operational knowledge） | "操作系统使用知识" | 哪个菜单、哪个快捷键、哪个偏好设置面板 |
| OSWorld-G | "定位测试集" | 564 个纯定位样本 + 训练集 |
| OSWorld-Human | "黄金轨迹" | 人工专家动作序列，用于衡量效率 |
| 轨迹效率（Trajectory efficiency） | "步骤与黄金轨迹之比" | Agent 步骤数除以人类最小步骤数 |

## 延伸阅读

- [Zhou 等，WebArena（arXiv:2307.13854）](https://arxiv.org/abs/2307.13854)——四个应用的 Web 基准测试
- [Xie 等，OSWorld（arXiv:2404.07972）](https://arxiv.org/abs/2404.07972)——跨操作系统的桌面基准测试
- [Anthropic，Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use)——Claude 由基准测试塑造的能力
- [OpenAI，Computer-Using Agent](https://openai.com/index/computer-using-agent/)——OSWorld 和 WebArena 数据
