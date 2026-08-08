# 20 · 基准测试：WebArena 与 OSWorld

> WebArena 跨四个自托管应用测试 Web 智能体（web-agent）能力。OSWorld 跨 Ubuntu、Windows、macOS 测试桌面智能体（desktop-agent）能力。在发布时（2023–2024），两者都显示出顶级智能体与人类之间的巨大差距。差距正在缩小；但失败模式没有变化。

**类型：** 学习
**语言：** Python（标准库）
**前置：** 阶段 14 · 19（SWE-bench、GAIA）
**时长：** 约 60 分钟

## 学习目标

- 描述 WebArena 的四个自托管应用，以及为什么基于执行的评估（execution-based evaluation）很重要。
- 解释为什么 OSWorld 使用真实操作系统截图而非无障碍 API（accessibility API）。
- 说出 OSWorld 的两种主要失败模式：GUI 定位（GUI grounding）与操作性知识（operational knowledge）。
- 总结 OSWorld-G 与 OSWorld-Human 在基础基准之上各自增加了什么。

## 问题所在

通用智能体能够调用工具。但它们能否操控浏览器、跨越 20 次点击完成一次购物结账？能否仅凭键盘和鼠标配置一台 Linux 主机？这些正是 WebArena 与 OSWorld 要回答的问题。

## 核心概念

### WebArena（Zhou 等人，ICLR 2024）

- 跨四个自托管 Web 应用的 812 个长程任务：一个购物网站、一个论坛、一个类 GitLab 的开发工具、一个商业 CMS。
- 外加若干实用工具：地图、计算器、草稿本。
- 评估基于执行，通过 gym 风格 API 完成——订单是否下达？issue 是否关闭？CMS 页面是否更新？
- 发布时：最佳 GPT-4 智能体的成功率为 14.41%，而人类为 78.24%。

自托管的设定很重要——由于目标应用被固定版本且可复现，该基准不会出现「不稳定」（flaky）的问题。

### 扩展版本

- **VisualWebArena**——视觉定位任务，成功与否取决于对图像的解读（截图作为一等观测）。
- **TheAgentCompany**（2024 年 12 月）——加入了终端 + 编码；更接近真实的远程办公环境。

### OSWorld（Xie 等人，NeurIPS 2024）

- 跨 Ubuntu、Windows、macOS 的 369 个真实计算机任务。
- 对真实应用进行自由形式的键盘和鼠标控制。
- 以 1920×1080 截图作为观测。
- 发布时：最佳模型为 12.24%，而人类为 72.36%。

### 主要失败模式

1. **GUI 定位（GUI grounding）。** 即像素到元素的映射。模型难以在 1920×1080 分辨率下可靠地定位 UI 元素。
2. **操作性知识（operational knowledge）。** 哪个菜单里有这个设置、哪个键盘快捷键、哪个偏好设置面板。这是人类历经多年积累的知识长尾。

### 后续工作

- **OSWorld-G**——564 样本的定位测试套件 + Jedi 训练集。将定位从规划中解耦，便于分别度量两者。
- **OSWorld-Human**——人工精选的黄金动作轨迹。结果显示顶级智能体使用的步骤数比必要步骤多出 1.4–2.7 倍（即轨迹效率差距）。

### 为何重要

Claude computer use、OpenAI CUA、Gemini 2.5 Computer Use（第 21 课）全都在由 WebArena 和 OSWorld 塑造的工作负载上训练。基准是目标；生产模型则是交付出来的答案。

### 基准测试容易出错的地方

- **仅靠截图的评估。** OSWorld 是截图驱动的；若在 OSWorld 上评估一个使用 DOM 或无障碍 API 的智能体，就会绕过定位这一挑战。
- **忽略轨迹长度。** 只对成功率打分，会错失 OSWorld-Human 揭示的 1.4–2.7 倍步骤低效问题。
- **陈旧的自托管应用。** WebArena 的应用固定了特定版本；未经重新精选就升级会破坏可比性。

## 动手构建

`code/main.py` 实现了一个玩具级 Web 智能体框架：

- 一个最小化的「购物应用」状态机：list_items、add_to_cart、checkout。
- 针对 3 个任务的黄金轨迹。
- 一个尝试完成各任务的脚本化智能体。
- 基于执行的评估器（状态检查）与轨迹效率指标（步骤数对比黄金轨迹）。

运行它：

```
python3 code/main.py
```

输出：逐任务的成功率与轨迹效率，与 OSWorld-Human 的方法论一致。

## 实际运用

- **WebArena Verified** 自托管于内部集群，用于持续评估。
- **OSWorld** 部署在 VM 集群中，用于桌面智能体。
- **Computer-use 智能体**（第 21 课）——Claude、OpenAI CUA、Gemini——全都在类似这样的工作负载上训练。
- **你自己的产品流程**——为你最重要的 20 个任务采集黄金轨迹；每周用智能体对其进行测试。

## 交付成果

`outputs/skill-web-desktop-harness.md` 构建一个具备基于执行的评估与轨迹效率指标的 Web/桌面智能体框架。

## 练习

1. 用第二个应用（一个论坛）扩展这个玩具框架。编写 3 个任务及其黄金轨迹。
2. 为每个任务添加轨迹效率报告。在你的玩具示例中，智能体是黄金轨迹的 1 倍、2 倍还是 3 倍？
3. 实现一个「干扰项」工具——一个黄金轨迹从不使用的工具。脚本化智能体会被它诱惑吗？
4. 阅读 OSWorld-G。你会如何在自己的评估中区分定位失败与规划失败？
5. 阅读 WebArena 的应用 README。当你升级其中一个被固定版本的应用时，会出什么问题？

## 关键术语

| 术语 | 人们怎么说 | 它的真正含义 |
|------|----------------|------------------------|
| WebArena | 「Web 智能体基准」 | 跨 4 个自托管应用的 812 个任务；gym 风格评估 |
| VisualWebArena | 「视觉版 WebArena」 | 视觉定位的 WebArena；以截图作为观测 |
| OSWorld | 「桌面智能体基准」 | 真实 Ubuntu/Windows/macOS 上的 369 个任务 |
| GUI grounding | 「像素到元素的映射」 | 模型在 1920x1080 中定位 UI 元素 |
| Operational knowledge | 「操作系统门道」 | 哪个菜单、哪个快捷键、哪个偏好设置面板 |
| OSWorld-G | 「定位套件」 | 564 个纯定位样本 + 训练集 |
| OSWorld-Human | 「黄金轨迹」 | 用于度量效率的人工专家动作序列 |
| Trajectory efficiency | 「相对黄金轨迹的步骤数」 | 智能体步骤数除以人类最少步骤数 |

## 延伸阅读

- [Zhou 等人，WebArena（arXiv:2307.13854）](https://arxiv.org/abs/2307.13854)——四应用 Web 基准
- [Xie 等人，OSWorld（arXiv:2404.07972）](https://arxiv.org/abs/2404.07972)——跨操作系统桌面基准
- [Anthropic，Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use)——Claude 受基准塑造的能力
- [OpenAI，Computer-Using Agent](https://openai.com/index/computer-using-agent/)——OSWorld 与 WebArena 的成绩数据
