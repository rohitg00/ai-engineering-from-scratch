# 基准测试：WebArena 与 OSWorld

> WebArena 在四个自托管应用上测试网页代理能力。OSWorld 在 Ubuntu、Windows、macOS 上测试桌面代理能力。发布时（2023–2024），两者都显示出一流代理与人类之间的巨大差距。差距正在缩小，但失败模式没有改变。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 19 (SWE-bench, GAIA)
**Time:** ~60 分钟

## 学习目标

- 描述 WebArena 的四个自托管应用，以及为什么基于执行的评估很重要。
- 解释为什么 OSWorld 使用真实操作系统截图而不是辅助功能 API。
- 说出 OSWorld 的两种主要失败模式：GUI grounding 和操作性知识。
- 总结 OSWorld-G 和 OSWorld-Human 在基础基准之上增加了什么。

## 问题

通用代理可以调用工具。但它们能驱动浏览器完成 20 次点击以完成一次购物结账吗？它们能仅用键盘和鼠标配置一台 Linux 机器吗？这些就是 WebArena 和 OSWorld 要回答的问题。

## 概念

### WebArena（Zhou et al., ICLR 2024）

- 跨四个自托管 Web 应用的 812 个长程任务：一个购物网站、一个论坛、一个类 GitLab 的开发工具、一个商业 CMS。
- 外加实用工具：地图、计算器、草稿板。
- 评估通过 gym API 基于执行——订单是否已下单，issue 是否已关闭，CMS 页面是否已更新？
- 发布时：最好的 GPT-4 代理达到 14.41% 成功率，人类为 78.24%。

自托管的设定很重要——由于目标应用是固定且可复现的，基准不会不稳定。

### 扩展

- **VisualWebArena**——视觉定位任务，其成功取决于对图像的解读（截图作为一等观察）。
- **TheAgentCompany**（2024 年 12 月）——增加了终端与编码；更接近真实的远程工作环境。

### OSWorld（Xie et al., NeurIPS 2024）

- 跨 Ubuntu、Windows、macOS 的 369 个真实计算机任务。
- 对真实应用进行自由形式的键盘和鼠标控制。
- 以 1920×1080 截图作为观察。
- 发布时：最好的模型为 12.24%，人类为 72.36%。

### 主要失败模式

1. **GUI grounding。** 像素到元素的映射。模型难以在 1920×1080 分辨率下可靠地定位 UI 元素。
2. **操作性知识。** 哪个菜单包含某个设置、哪个键盘快捷键、哪个偏好面板。这是人类经年累月积累的知识尾部。

### 后续工作

- **OSWorld-G**——564 个样本的 grounding 套件 + Jedi 训练集。将 grounding 与规划解耦，使你可以分别度量两者。
- **OSWorld-Human**——人工整理的黄金动作轨迹。显示顶级代理使用的步骤数是必要值的 1.4–2.7 倍（轨迹效率差距）。

### 为什么这很重要

Claude computer use、OpenAI CUA、Gemini 2.5 Computer Use（第 21 课）都在由 WebArena 和 OSWorld 塑造的工作负载上训练。基准是目标；生产模型是交付的答案。

### 基准测试容易出错的地方

- **仅截图的评估。** OSWorld 是截图驱动的；在 OSWorld 上评估一个使用 DOM 或辅助功能 API 的代理，会错过 grounding 挑战。
- **忽略轨迹长度。** 只按成功率打分会错过 OSWorld-Human 揭示的 1.4–2.7 倍步骤低效。
- **陈旧的自托管应用。** WebArena 的应用固定了特定版本；不重新整理就升级会破坏可比性。

```figure
ae-agent-human-gap
```

## 动手构建

`code/main.py` 实现了一个玩具级网页代理 harness：

- 一个最小化的“购物应用”状态机：list_items、add_to_cart、checkout。
- 3 个任务的黄金轨迹。
- 一个尝试完成每个任务的脚本化代理。
- 基于执行的评估器（状态检查）和轨迹效率指标（步骤数 vs 黄金轨迹）。

运行它：

```
python3 code/main.py
```

输出：每个任务的成功率和轨迹效率，对应 OSWorld-Human 的方法。

## 使用场景

- **WebArena Verified** 自托管在内部集群上进行持续评估。
- **OSWorld** 部署在虚拟机集群中用于桌面代理。
- **Computer-use 代理**（第 21 课）——Claude、OpenAI CUA、Gemini——都在类似的工作负载上训练。
- **你自己的产品流程**——为你最重要的 20 个任务录制黄金轨迹；每周让代理对其运行。

## 上线实践

`outputs/skill-web-desktop-harness.md` 构建一个带基于执行评估和轨迹效率指标的网页/桌面代理 harness。

## 练习

1. 给玩具 harness 增加第二个应用（一个论坛）。编写 3 个任务及对应的黄金轨迹。
2. 为每个任务增加轨迹效率报告。在你的玩具任务上，代理相对黄金轨迹是 1 倍、2 倍还是 3 倍？
3. 实现一个“干扰”工具——黄金轨迹从不使用的工具。脚本化代理会被诱惑吗？
4. 阅读 OSWorld-G。在你自己的评估中，你会如何把 grounding 失败与规划失败区分开？
5. 阅读 WebArena 应用的 README。升级某个被固定版本的应用时，什么会出问题？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| WebArena | “网页代理基准” | 跨 4 个自托管应用的 812 个任务；gym 风格评估 |
| VisualWebArena | “视觉版 WebArena” | 视觉定位的 WebArena；截图即观察 |
| OSWorld | “桌面代理基准” | 真实 Ubuntu/Windows/macOS 上的 369 个任务 |
| GUI grounding | “像素到元素的映射” | 模型在 1920x1080 中定位 UI 元素 |
| 操作性知识 | “操作系统使用技巧” | 哪个菜单、哪个快捷键、哪个偏好面板 |
| OSWorld-G | “Grounding 套件” | 564 个纯 grounding 样本 + 训练集 |
| OSWorld-Human | “黄金轨迹” | 用于度量效率的人工专家动作序列 |
| 轨迹效率 | “相对黄金轨迹的步骤数” | 代理步骤数除以人类最小步骤数 |

## 延伸阅读

- [Zhou et al., WebArena (arXiv:2307.13854)](https://arxiv.org/abs/2307.13854) —— 四应用网页基准
- [Xie et al., OSWorld (arXiv:2404.07972)](https://arxiv.org/abs/2404.07972) —— 跨操作系统桌面基准
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) —— Claude 受基准塑造的能力
- [OpenAI, Computer-Using Agent](https://openai.com/index/computer-using-agent/) —— OSWorld 与 WebArena 的成绩