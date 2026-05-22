# 基准测试：WebArena 与 OSWorld

> WebArena 测试跨四个自托管应用的网页 Agent 能力。OSWorld 测试跨 Ubuntu、Windows、macOS 的桌面 Agent 能力。在发布时（2023–2024），两者都显示了同类最佳 Agent 与人类之间的巨大差距。差距正在缩小；失败模式没有改变。

**类型：** 学习
**语言：** Python（标准库）
**前置要求：** 阶段 14 · 19（SWE-bench、GAIA）
**时长：** 约 60 分钟

## 学习目标

- 描述 WebArena 的四个自托管应用以及为什么基于执行的评估很重要。
- 解释为什么 OSWorld 使用真实 OS 截图而不是辅助功能 API。
- 说出 OSWorld 的两种主要失败模式：GUI grounding 和 operational knowledge。
- 总结 OSWorld-G 和 OSWorld-Human 在基础基准测试之上的补充内容。

## 问题背景

通用 Agent 可以调用工具。它们能否驱动浏览器完成 20 次点击来完成购物结账？它们能否仅使用键盘和鼠标配置 Linux 机器？这些是 WebArena 和 OSWorld 回答的问题。

## 核心概念

### WebArena（Zhou et al., ICLR 2024）

- 跨四个自托管网页应用的 812 个长期任务：购物网站、论坛、类 GitLab 的开发工具、商业 CMS。
- 加上实用工具：地图、计算器、记事本。
- 评估通过 gym API 基于执行——订单是否下达、问题是否关闭、CMS 页面是否更新？
- 发布时：最佳 GPT-4 Agent 达到 14.41% 成功率 vs 人类 78.24%。

自托管框架很重要——基准测试不可靠，因为目标应用是固定的且可复现的。

### 扩展

- **VisualWebArena**——视觉 ground 的任务，成功取决于解释图像（截图作为一等观察）。
- **TheAgentCompany**（2024 年 12 月）——添加终端 + 编码；更像真实的远程工作环境。

### OSWorld（Xie et al., NeurIPS 2024）

- 跨 Ubuntu、Windows、macOS 的 369 个真实计算机任务。
- 真实应用程序的自由格式键盘和鼠标控制。
- 1920×1080 截图作为观察。
- 发布时：最佳模型 12.24% vs 人类 72.36%。

### 主要失败模式

1. **GUI grounding。** 像素 → 元素映射。模型在 1920×1080 中难以可靠地定位 UI 元素。
2. **操作知识（Operational knowledge）。** 哪个菜单有设置，哪个键盘快捷键，哪个首选项目。人类多年积累的知识尾部。

### 后续工作

- **OSWorld-G**——564 样本 grounding 套件 + Jedi 训练集。将 grounding 从规划中分解，以便你可以分别衡量它们。
- **OSWorld-Human**——手动策划的黄金行动轨迹。显示顶级 Agent 使用的步骤比必要多 1.4-2.7 倍（轨迹效率差距）。

### 为什么这很重要

Claude computer use、OpenAI CUA、Gemini 2.5 Computer Use（第 21 课）都使用由 WebArena 和 OSWorld  shaped 的工作负载进行训练。基准测试是目标；生产模型是交付的答案。

### 基准测试哪里会出错

- **仅截图的评估。** OSWorld 是截图驱动的；在 OSWorld 上评估使用 DOM 或辅助功能 API 的 Agent 错过了 grounding 挑战。
- **忽略轨迹长度。** 仅评分成功率会错过 OSWorld-Human 显示的 1.4-2.7 倍步骤低效。
- **过时的自托管应用。** WebArena 的应用固定特定版本；不重新策划就升级会破坏可比性。

## 构建它

`code/main.py` 实现一个玩具网页 Agent 框架：

- 一个最小化的"购物应用"状态机：list_items、add_to_cart、checkout。
- 3 个任务的黄金轨迹。
- 一个尝试每个任务的脚本化 Agent。
- 基于执行的评估器（状态检查）和轨迹效率指标（步骤 vs 黄金）。

运行它：

```
python3 code/main.py
```

输出：每个任务的成功率和轨迹效率，反映 OSWorld-Human 的方法论。

## 使用它

- **WebArena Verified** 在内部集群上自托管用于持续评估。
- **OSWorld** 在 VM 队列中用于桌面 Agent。
- **Computer-use agents**（第 21 课）——Claude、OpenAI CUA、Gemini——都使用类似这些的工作负载进行训练。
- **你自己产品的工作流**——为你排名前 20 的任务捕获黄金轨迹；每周对它们运行 Agent。

## 部署它

`outputs/skill-web-desktop-harness.md` 构建一个带有基于执行的评估和轨迹效率指标的网页/桌面 Agent 框架。

## 练习

1. 用第二个应用（论坛）扩展玩具框架。编写 3 个任务加上黄金轨迹。
2. 添加每个任务的轨迹效率报告。在你的玩具上，Agent 是 1 倍、2 倍还是 3 倍超过黄金？
3. 实现一个"干扰项"工具——黄金轨迹从不使用的工具。脚本化 Agent 会被诱惑吗？
4. 阅读 OSWorld-G。在你的评估中，你如何将 grounding 失败与规划失败分开？
5. 阅读 WebArena 的应用 README。当你升级其中一个固定应用版本时什么会出问题？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| WebArena | "网页 Agent 基准测试" | 跨 4 个自托管应用的 812 个任务；gym 风格评估 |
| VisualWebArena | "视觉 WebArena" | 视觉 ground 的 WebArena；截图是观察 |
| OSWorld | "桌面 Agent 基准测试" | Ubuntu/Windows/macOS 上的 369 个任务 |
| GUI grounding | "像素到元素映射" | 模型在 1920x1080 中定位 UI 元素 |
| Operational knowledge | "操作系统操作诀窍" | 哪个菜单、哪个快捷键、哪个首选项目 |
| OSWorld-G | "Grounding 套件" | 564 个仅 grounding 样本 + 训练集 |
| OSWorld-Human | "黄金轨迹" | 手动专家行动序列来衡量效率 |
| Trajectory efficiency | "超过黄金的步骤" | Agent 步骤计数除以人类最小值 |

## 延伸阅读

- [Zhou et al., WebArena (arXiv:2307.13854)](https://arxiv.org/abs/2307.13854)——四应用网页基准测试
- [Xie et al., OSWorld (arXiv:2404.07972)](https://arxiv.org/abs/2404.07972)——跨操作系统桌面基准测试
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use)——Claude 的基准测试 shaped 能力
- [OpenAI, Computer-Using Agent](https://openai.com/index/computer-using-agent/)——OSWorld 和 WebArena 数字
