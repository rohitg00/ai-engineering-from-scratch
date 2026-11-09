# 标准:WebArena和OSWorld

> 网络测试了四个自主托管的应用程序中的网络代理能力.OSWorld测试了Ubuntu,Windows,macOS中的桌面代理能力.在发布时 (20232024) 两者都显示了最好的代理人和人类之间的差距.差距正在缩小;故障模式没有改变.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 19 (SWE-bench, GAIA)
**Time:** ~60 minutes

## 学习目标

- 描述WebArena的四个自主托管应用程序,以及为什么基于执行的评估是重要的.
- 解释为什么OSWorld使用真实操作系统截图而不是可访问性API.
- 举个 OSWorld 失败模式的两个主要模式:GUI 接地和操作知识.
- 总结了OSWorld-G和OSWorld-Human在基准指标上添加的内容.

## 问题

总体代理可以调用工具.他们可以在20点击内驱动浏览器完成购物清单吗?他们可以仅使用键盘和鼠标配置Linux框吗?这些是WebArena和OSWorld回答的问题.

## 概念

### 网络场 (周等人,ICLR 2024)

- 通过四个自主托管的网络应用程序进行812个长任务:购物网站,论坛,像GitLab这样的开发工具,
- 另外还有地图,计算器,剪贴板.
- 评估是通过健身房API执行的? 订单是否订单,问题是否关闭,CMS页面是否更新?
- 在发布时,最好的GPT-4剂达到14.41%的成功率,而人类的成功率为78.24%.

基准不,因为目标应用程序是固定的,可复制的.

### 扩展

- **VisualWebArena**视觉基础任务,成功取决于图像的解释 (屏幕截图作为一流的观察).
- **TheAgentCompany**增加终端+编码;更像一个真正的远程工作环境.

### 其他技术:

- 在Ubuntu,Windows,MacOS上,有369个真正的计算机任务.
- 免费键盘和鼠标控制的实用应用程序.
- 作为观察的2020×1080屏幕截图.
- 在发布时:最佳模型12.24%vs人类72.36%.

### 主要故障模式

1. **GUI grounding.**像素 →元素映射.模型在 1920×1080 中难以可靠地定位UI元素.
2. **Operational knowledge.**哪个菜单有设置,哪个键盘快捷键,哪个偏好窗口.人类多年来建立的知识尾巴.

### 后续行动

- **OSWorld-G** 564 个样本的地面套件+ 杰迪训练套件.
- **OSWorld-Human**手动策划的黄金行动轨迹.显示顶级代理使用比必要的1.4-2.7倍多的步骤 (轨迹效率差距).

### 为什么这很重要

克劳德计算机使用,OpenAI CUA,双子 2.5计算机使用 (课 21) 都在WebArena和OSWorld塑造的工作负载上训练.

### 基准分析失败的地方

- **Screenshot-only evals.**通过截图驱动OSWorld; 评估使用OSWorld上的DOM或可访问性API的代理人错过了基础挑战.
- **Ignoring trajectory length.**只有成功率的得分, 错过了1.4-2.7x步骤效率 OSWorld-Human表面.
- **Stale self-hosted apps.**网络的应用程序将定制成特定版本;更新没有重新修改,

```figure
ae-agent-human-gap
```

## 建立它

`code/main.py`执行玩具网代理带:

- 简单的"购物应用程序"状态机:列表_项目,添加_卡车,收银.
- 为了完成3项任务,
- 一个试图完成每项任务的编写代理.
- 基于执行的评估器 (状态检查) 和轨迹效率指标 (步骤与黄金).

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

产量:每任务成功率和轨迹效率,反映了OSWorld-Human的方法.

## 用它

- **WebArena Verified**进行自主托管在内部集群中进行持续评估.
- **OSWorld**在一个机器人机器机队中,
- **Computer-use agents**克劳德,OpenAI CUA,双胞胎,所有人都在接受这样的工作训练.
- **Your own product flows**捕获你20项任务的黄金轨迹;每周向代理人进行攻击.

## 运送它

`outputs/skill-web-desktop-harness.md`建立一个基于执行的评估和轨迹效率指标的网络/桌面代理.

## 运动

1. 通过第二个应用程序 (论坛) 扩展玩具带. 写3项任务加上黄金轨迹.
2. 您的玩具上,代理是1x,2x,或3x比黄金?
3. 运用一个"分散注意力"工具, 黄金轨迹从来没有使用过.
4. 如何将地面失败与计划失败分开?
5. 阅读WebArena的应用程序 README. 当你升级一个嵌的应用程序版本时,什么会打破?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| WebArena | "Web agent benchmark" | 812 tasks across 4 self-hosted apps; gym-style evaluation |
| VisualWebArena | "Visual WebArena" | Visually grounded WebArena; screenshots are observations |
| OSWorld | "Desktop agent benchmark" | 369 tasks on real Ubuntu/Windows/macOS |
| GUI grounding | "Pixel-to-element mapping" | Model localizing UI elements in 1920x1080 |
| Operational knowledge | "OS know-how" | Which menu, which shortcut, which preference pane |
| OSWorld-G | "Grounding suite" | 564 grounding-only samples + training set |
| OSWorld-Human | "Gold trajectories" | Manual expert action sequences to measure efficiency |
| Trajectory efficiency | "Steps over gold" | Agent step count divided by human minimum |

## 进一步阅读

- [Zhou et al., WebArena (arXiv:2307.13854)](https://arxiv.org/abs/2307.13854)四个应用程序的网络基准
- [Xie et al., OSWorld (arXiv:2404.07972)](https://arxiv.org/abs/2404.07972)跨操作系统桌面基准
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) 克劳德的基准能力
- [OpenAI, Computer-Using Agent](https://openai.com/index/computer-using-agent/) OSWorld和WebArena的号码
