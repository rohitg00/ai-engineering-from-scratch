<p align="center">
  <img src="assets/banner.svg" alt="AI Engineering from Scratch — 参考手册横幅" width="100%">
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-1a1a1a?style=flat-square&labelColor=fafaf5" alt="MIT License"></a>
  <a href="ROADMAP.md"><img src="https://img.shields.io/badge/lessons-435-3553ff?style=flat-square&labelColor=fafaf5" alt="435 节课"></a>
  <a href="#目录"><img src="https://img.shields.io/badge/phases-20-3553ff?style=flat-square&labelColor=fafaf5" alt="20 个阶段"></a>
  <a href="https://github.com/rohitg00/ai-engineering-from-scratch/stargazers"><img src="https://img.shields.io/github/stars/rohitg00/ai-engineering-from-scratch?style=flat-square&labelColor=fafaf5&color=3553ff" alt="GitHub stars"></a>
  <a href="https://aiengineeringfromscratch.com"><img src="https://img.shields.io/badge/web-aiengineeringfromscratch.com-3553ff?style=flat-square&labelColor=fafaf5" alt="网站"></a>
  <a href="README.md"><img src="https://img.shields.io/badge/English-README-3553ff?style=flat-square&labelColor=fafaf5" alt="English"></a>
</p>

```
░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒
```

> **84%的学生已经在使用AI工具，但只有18%认为自己已经准备好在专业环境中使用它们。**
> 本课程正是为了弥合这一差距而设计。
>
> 435节课。20个阶段。约320小时。Python、TypeScript、Rust、Julia。每节课都会产出一个可复用的产物：
> 一个提示词、一个技能、一个智能体、一个MCP服务器。免费、开源、MIT协议。
>
> 你不只是学习AI。你从零构建它。端到端。亲手实现。

## 运作方式

大多数AI教材都是碎片化教学的。这里一篇论文，那里一篇微调文章，别处一个炫酷的智能体演示。这些碎片很少能对齐。你部署了一个聊天机器人，却无法解释它的损失曲线。你把一个函数挂接到智能体上，却说不清注意力机制在调用它的模型内部做了什么。

本课程是那条脊柱。20个阶段，435节课，四种语言：Python、TypeScript、Rust、Julia。一端是线性代数，另一端是自主集群。每个算法都先从原始数学开始构建。反向传播。分词器。注意力机制。智能体循环。等到PyTorch登场时，你已经知道它在底层做了什么。

每节课遵循相同的循环：阅读问题、推导数学、编写代码、运行测试、保留产物。没有五分钟视频，没有复制粘贴部署，没有手把手教学。免费、开源，专为在你自己的笔记本上运行而设计。

```
░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒
```

## 课程体系结构

二十个阶段层层叠加。数学是地基，智能体和生产是屋顶。如果你已经掌握了底层，可以跳过；但不要跳过之后又纳闷为什么顶层的东西出了问题。

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#fafaf5','primaryTextColor':'#1a1a1a','primaryBorderColor':'#3553ff','lineColor':'#3553ff','fontFamily':'JetBrains Mono','fontSize':'12px'}}}%%
flowchart TB
  P0["阶段0 — 环境搭建与工具"] --> P1["阶段1 — 数学基础"]
  P1 --> P2["阶段2 — 机器学习基础"]
  P2 --> P3["阶段3 — 深度学习核心"]
  P3 --> P4["阶段4 — 计算机视觉"]
  P3 --> P5["阶段5 — 自然语言处理"]
  P3 --> P6["阶段6 — 语音与音频"]
  P3 --> P9["阶段9 — 强化学习"]
  P5 --> P7["阶段7 — Transformer深入"]
  P7 --> P8["阶段8 — 生成式AI"]
  P7 --> P10["阶段10 — 从零构建大语言模型"]
  P10 --> P11["阶段11 — 大语言模型工程"]
  P10 --> P12["阶段12 — 多模态AI"]
  P11 --> P13["阶段13 — 工具与协议"]
  P13 --> P14["阶段14 — 智能体工程"]
  P14 --> P15["阶段15 — 自主系统"]
  P15 --> P16["阶段16 — 多智能体与集群"]
  P14 --> P17["阶段17 — 基础设施与生产"]
  P15 --> P18["阶段18 — 伦理、安全与对齐"]
  P16 --> P19["阶段19 — 毕业项目"]
  P17 --> P19
  P18 --> P19
```

```
░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒
```

## 课程结构

每节课都在自己的文件夹中，整个课程使用相同的结构：

```
phases/<NN>-<phase-name>/<NN>-<lesson-name>/
├── code/      可运行的实现（Python、TypeScript、Rust、Julia）
├── docs/
│   └── en.md  课程叙述
└── outputs/   本节课产出的提示词、技能、智能体或MCP服务器
```

每节课遵循六个环节。*构建/使用* 的分野是核心——你先从零实现算法，然后通过生产库运行同样的东西。你能理解框架在做什么，因为你亲手写了那个精简版本。

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#fafaf5','primaryTextColor':'#1a1a1a','primaryBorderColor':'#3553ff','lineColor':'#3553ff','fontFamily':'JetBrains Mono','fontSize':'13px'}}}%%
flowchart LR
  M["格言<br/><sub>一句话核心思想</sub>"] --> Pr["问题<br/><sub>具体痛点</sub>"]
  Pr --> C["概念<br/><sub>图示与直觉</sub>"]
  C --> B["构建它<br/><sub>原始数学，无框架</sub>"]
  B --> U["使用它<br/><sub>同样的东西用PyTorch/sklearn</sub>"]
  U --> S["发布它<br/><sub>提示词 · 技能 · 智能体 · MCP</sub>"]
```

## 入门指南

三种方式，任选其一。

**方式A — 阅读。** 在 [aiengineeringfromscratch.com](https://aiengineeringfromscratch.com) 上打开任意已完成的课程，或在[目录](#目录)下展开任意阶段。无需设置，无需克隆。

**方式B — 克隆并运行。**

```bash
git clone https://github.com/rohitg00/ai-engineering-from-scratch.git
cd ai-engineering-from-scratch
python phases/01-math-foundations/01-linear-algebra-intuition/code/vectors.py
```

**方式C — 找到你的水平 *（推荐）*。** 智能跳级。在 Claude、Cursor、Codex、OpenClaw、Hermes 或任何安装了 SkillKit 的智能体中：

```bash
/find-your-level
```

十个问题。将你的知识映射到起始阶段，生成带有时间估算的个性化路径。每个阶段完成后：

```bash
/check-understanding 3        # 测试你对阶段3的理解
ls phases/03-deep-learning-core/05-loss-functions/outputs/
# ├── prompt-loss-function-selector.md
# └── prompt-loss-debugger.md
```

### 前置要求

- 你能写代码（任何语言；Python更有优势）
- 你想理解AI**到底是怎么工作的**，而不仅仅是调用API

### 内置智能体技能（SkillKit / Claude, Cursor, Codex, OpenClaw, Hermes）

|| 技能 | 功能 |
||---|---|
|| [`/find-your-level`](.claude/skills/find-your-level/SKILL.md) | 十题定位测试。将你的知识映射到起始阶段，生成带有时间估算的个性化路径。 |
|| [`/check-understanding <phase>`](.claude/skills/check-understanding/SKILL.md) | 阶段测验，八道题，附带反馈和需要复习的具体课程。 |

```
░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒
```

## 每节课都有产出

其他课程以"恭喜你学完了X"结束。这里的每节课都以一个**可复用工具**结束——你可以安装它或粘贴到日常工作流中。

<table>
<tr>
<th align="left" width="25%"><img src="site/assets/figures/001-a-prompts.svg" width="96" height="96" alt="FIG_001.A prompts"/><br/><sub>FIG_001 · A</sub><br/><b>提示词</b></th>
<th align="left" width="25%"><img src="site/assets/figures/001-b-skills.svg" width="96" height="96" alt="FIG_001.B skills"/><br/><sub>FIG_001 · B</sub><br/><b>技能</b></th>
<th align="left" width="25%"><img src="site/assets/figures/001-c-agents.svg" width="96" height="96" alt="FIG_001.C agents"/><br/><sub>FIG_001 · C</sub><br/><b>智能体</b></th>
<th align="left" width="25%"><img src="site/assets/figures/001-d-mcp-servers.svg" width="96" height="96" alt="FIG_001.D MCP servers"/><br/><sub>FIG_001 · D</sub><br/><b>MCP服务器</b></th>
</tr>
<tr>
<td valign="top">粘贴到任何AI助手中，获得针对窄任务的专业级帮助。</td>
<td valign="top">拖入 Claude、Cursor、Codex、OpenClaw、Hermes 或任何读取 <code>SKILL.md</code> 的智能体。</td>
<td valign="top">部署为自主工作者——你在阶段14亲手写了那个循环。</td>
<td valign="top">插入任何MCP兼容客户端。在阶段13端到端构建。</td>
</tr>
</table>

> 使用 [SkillKit](https://github.com/rohitg00/skillkit) 安装全部。真正的工具，不是家庭作业。到课程结束时，你将拥有435个你真正理解的产物组合，因为是你亲手构建的。

### FIG_002 · 完整示例

阶段14，第1课：智能体循环。约120行纯Python，无依赖。

<table>
<tr>
<td valign="top" width="50%">

**`code/agent_loop.py`** &nbsp; <sub><i>构建它</i></sub>

```python
def run(query, tools):
    history = [user(query)]
    for step in range(MAX_STEPS):
        msg = llm(history)
        if msg.tool_calls:
            for call in msg.tool_calls:
                result = tools[call.name](**call.args)
                history.append(tool_result(call.id, result))
            continue
        return msg.content
    raise StepLimitExceeded
```

</td>
<td valign="top" width="50%">

**`outputs/skill-agent-loop.md`** &nbsp; <sub><i>发布它</i></sub>

```markdown
---
name: agent-loop
description: ReAct-style loop for any tool list
phase: 14
lesson: 01
---

Implement a minimal agent loop that...
```

**`outputs/prompt-debug-agent.md`**

```markdown
You are an agent debugger. Given the trace
of an agent run, identify the step where
the agent went wrong and explain why...
```

</td>
</tr>
</table>

```
░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒
```

<a id="目录"></a>

## 目录

二十个阶段。点击任意阶段展开其课程列表。

<a id="phase-0"></a>
### 阶段0：环境搭建与工具 `12节课`
> 为后续所有内容准备好你的环境。

|| # | 课程 | 类型 | 语言 |
||:---:|--------|:----:|------|
|| 01 | [开发环境](phases/00-setup-and-tooling/01-dev-environment/) | 构建 | Python, TypeScript, Rust |
|| 02 | [Git与协作](phases/00-setup-and-tooling/02-git-and-collaboration/) | 学习 | — |
|| 03 | [GPU设置与云计算](phases/00-setup-and-tooling/03-gpu-setup-and-cloud/) | 构建 | Python |
|| 04 | [API与密钥](phases/00-setup-and-tooling/04-apis-and-keys/) | 构建 | Python, TypeScript |
|| 05 | [Jupyter笔记本](phases/00-setup-and-tooling/05-jupyter-notebooks/) | 构建 | Python |
|| 06 | [Python环境](phases/00-setup-and-tooling/06-python-environments/) | 构建 | Python |
|| 07 | [Docker for AI](phases/00-setup-and-tooling/07-docker-for-ai/) | 构建 | Python |
|| 08 | [编辑器设置](phases/00-setup-and-tooling/08-editor-setup/) | 构建 | — |
|| 09 | [数据管理](phases/00-setup-and-tooling/09-data-management/) | 构建 | Python |
|| 10 | [终端与Shell](phases/00-setup-and-tooling/10-terminal-and-shell/) | 学习 | — |
|| 11 | [Linux for AI](phases/00-setup-and-tooling/11-linux-for-ai/) | 学习 | — |
|| 12 | [调试与性能分析](phases/00-setup-and-tooling/12-debugging-and-profiling/) | 构建 | Python |

<details id="phase-1">
<summary><b>阶段1 — 数学基础</b> &nbsp;<code>22节课</code>&nbsp; <em>每个AI算法背后的直觉，通过代码展现。</em></summary>
<br/>

|| # | 课程 | 类型 | 语言 |
||:---:|--------|:----:|------|
|| 01 | [线性代数直觉](phases/01-math-foundations/01-linear-algebra-intuition/) | 学习 | Python, Julia |
|| 02 | [向量、矩阵与运算](phases/01-math-foundations/02-vectors-matrices-operations/) | 构建 | Python, Julia |
|| 03 | [矩阵变换与特征值](phases/01-math-foundations/03-matrix-transformations/) | 构建 | Python, Julia |
|| 04 | [ML微积分：导数与梯度](phases/01-math-foundations/04-calculus-for-ml/) | 学习 | Python |
|| 05 | [链式法则与自动微分](phases/01-math-foundations/05-chain-rule-and-autodiff/) | 构建 | Python |
|| 06 | [概率与分布](phases/01-math-foundations/06-probability-and-distributions/) | 学习 | Python |
|| 07 | [贝叶斯定理与统计思维](phases/01-math-foundations/07-bayes-theorem/) | 构建 | Python |
|| 08 | [优化：梯度下降家族](phases/01-math-foundations/08-optimization/) | 构建 | Python |
|| 09 | [信息论：熵、KL散度](phases/01-math-foundations/09-information-theory/) | 学习 | Python |
|| 10 | [降维：PCA、t-SNE、UMAP](phases/01-math-foundations/10-dimensionality-reduction/) | 构建 | Python |
|| 11 | [奇异值分解](phases/01-math-foundations/11-singular-value-decomposition/) | 构建 | Python, Julia |
|| 12 | [张量运算](phases/01-math-foundations/12-tensor-operations/) | 构建 | Python |
|| 13 | [数值稳定性](phases/01-math-foundations/13-numerical-stability/) | 构建 | Python |
|| 14 | [范数与距离](phases/01-math-foundations/14-norms-and-distances/) | 构建 | Python |
|| 15 | [ML统计学](phases/01-math-foundations/15-statistics-for-ml/) | 构建 | Python |
|| 16 | [采样方法](phases/01-math-foundations/16-sampling-methods/) | 构建 | Python |
|| 17 | [线性系统](phases/01-math-foundations/17-linear-systems/) | 构建 | Python |
|| 18 | [凸优化](phases/01-math-foundations/18-convex-optimization/) | 构建 | Python |
|| 19 | [AI中的复数](phases/01-math-foundations/19-complex-numbers/) | 学习 | Python |
|| 20 | [傅里叶变换](phases/01-math-foundations/20-fourier-transform/) | 构建 | Python |
|| 21 | [ML中的图论](phases/01-math-foundations/21-graph-theory/) | 构建 | Python |
|| 22 | [随机过程](phases/01-math-foundations/22-stochastic-processes/) | 学习 | Python |

</details>

<details id="phase-2">
<summary><b>阶段2 — 机器学习基础</b> &nbsp;<code>18节课</code>&nbsp; <em>经典ML——仍然是大多数生产AI的骨干。</em></summary>
<br/>

|| # | 课程 | 类型 | 语言 |
||:---:|--------|:----:|------|
|| 01 | [什么是机器学习](phases/02-ml-fundamentals/01-what-is-machine-learning/) | 学习 | Python |
|| 02 | [从零构建线性回归](phases/02-ml-fundamentals/02-linear-regression/) | 构建 | Python |
|| 03 | [逻辑回归与分类](phases/02-ml-fundamentals/03-logistic-regression/) | 构建 | Python |
|| 04 | [决策树与随机森林](phases/02-ml-fundamentals/04-decision-trees/) | 构建 | Python |
|| 05 | [支持向量机](phases/02-ml-fundamentals/05-support-vector-machines/) | 构建 | Python |
|| 06 | [KNN与距离度量](phases/02-ml-fundamentals/06-knn-and-distances/) | 构建 | Python |
|| 07 | [无监督学习：K-Means、DBSCAN](phases/02-ml-fundamentals/07-unsupervised-learning/) | 构建 | Python |
|| 08 | [特征工程与选择](phases/02-ml-fundamentals/08-feature-engineering/) | 构建 | Python |
|| 09 | [模型评估：指标、交叉验证](phases/02-ml-fundamentals/09-model-evaluation/) | 构建 | Python |
|| 10 | [偏差、方差与学习曲线](phases/02-ml-fundamentals/10-bias-variance/) | 学习 | Python |
|| 11 | [集成方法：Boosting、Bagging、Stacking](phases/02-ml-fundamentals/11-ensemble-methods/) | 构建 | Python |
|| 12 | [超参数调优](phases/02-ml-fundamentals/12-hyperparameter-tuning/) | 构建 | Python |
|| 13 | [ML流水线与实验追踪](phases/02-ml-fundamentals/13-ml-pipelines/) | 构建 | Python |
|| 14 | [朴素贝叶斯](phases/02-ml-fundamentals/14-naive-bayes/) | 构建 | Python |
|| 15 | [时间序列基础](phases/02-ml-fundamentals/15-time-series/) | 构建 | Python |
|| 16 | [异常检测](phases/02-ml-fundamentals/16-anomaly-detection/) | 构建 | Python |
|| 17 | [处理不平衡数据](phases/02-ml-fundamentals/17-imbalanced-data/) | 构建 | Python |
|| 18 | [特征选择](phases/02-ml-fundamentals/18-feature-selection/) | 构建 | Python |

</details>

<details id="phase-3">
<summary><b>阶段3 — 深度学习核心</b> &nbsp;<code>13节课</code>&nbsp; <em>从第一性原理构建神经网络。在构建自己的框架之前不使用任何框架。</em></summary>
<br/>

|| # | 课程 | 类型 | 语言 |
||:---:|--------|:----:|------|
|| 01 | [感知机：一切的起点](phases/03-deep-learning-core/01-the-perceptron/) | 构建 | Python |
|| 02 | [多层网络与前向传播](phases/03-deep-learning-core/02-multi-layer-networks/) | 构建 | Python |
|| 03 | [从零实现反向传播](phases/03-deep-learning-core/03-backpropagation/) | 构建 | Python |
|| 04 | [激活函数：ReLU、Sigmoid、GELU 及其原理](phases/03-deep-learning-core/04-activation-functions/) | 构建 | Python |
|| 05 | [损失函数：MSE、交叉熵、对比损失](phases/03-deep-learning-core/05-loss-functions/) | 构建 | Python |
|| 06 | [优化器：SGD、Momentum、Adam、AdamW](phases/03-deep-learning-core/06-optimizers/) | 构建 | Python |
|| 07 | [正则化：Dropout、权重衰减、BatchNorm](phases/03-deep-learning-core/07-regularization/) | 构建 | Python |
|| 08 | [权重初始化与训练稳定性](phases/03-deep-learning-core/08-weight-initialization/) | 构建 | Python |
|| 09 | [学习率调度与预热](phases/03-deep-learning-core/09-learning-rate-schedules/) | 构建 | Python |
|| 10 | [构建你自己的迷你框架](phases/03-deep-learning-core/10-mini-framework/) | 构建 | Python |
|| 11 | [PyTorch 入门](phases/03-deep-learning-core/11-intro-to-pytorch/) | 构建 | Python |
|| 12 | [JAX 入门](phases/03-deep-learning-core/12-intro-to-jax/) | 构建 | Python |
|| 13 | [神经网络调试](phases/03-deep-learning-core/13-debugging-neural-networks/) | 构建 | Python |

</details>

<details id="phase-4">
<summary><b>阶段4 — 计算机视觉</b> &nbsp;<code>28节课</code>&nbsp; <em>从像素到理解——图像、视频、3D、VLM 和世界模型。</em></summary>
<br/>

|| # | 课程 | 类型 | 语言 |
||:---:|--------|:----:|------|
|| 01 | [图像基础：像素、通道、颜色空间](phases/04-computer-vision/01-image-fundamentals/) | 学习 | Python |
|| 02 | [从零实现卷积](phases/04-computer-vision/02-convolutions-from-scratch/) | 构建 | Python |
|| 03 | [CNN：LeNet 到 ResNet](phases/04-computer-vision/03-cnns-lenet-to-resnet/) | 构建 | Python |
|| 04 | [图像分类](phases/04-computer-vision/04-image-classification/) | 构建 | Python |
|| 05 | [迁移学习与微调](phases/04-computer-vision/05-transfer-learning/) | 构建 | Python |
|| 06 | [目标检测——从零实现 YOLO](phases/04-computer-vision/06-object-detection-yolo/) | 构建 | Python |
|| 07 | [语义分割——U-Net](phases/04-computer-vision/07-semantic-segmentation-unet/) | 构建 | Python |
|| 08 | [实例分割——Mask R-CNN](phases/04-computer-vision/08-instance-segmentation-mask-rcnn/) | 构建 | Python |
|| 09 | [图像生成——GAN](phases/04-computer-vision/09-image-generation-gans/) | 构建 | Python |
|| 10 | [图像生成——扩散模型](phases/04-computer-vision/10-image-generation-diffusion/) | 构建 | Python |
|| 11 | [Stable Diffusion——架构与微调](phases/04-computer-vision/11-stable-diffusion/) | 构建 | Python |
|| 12 | [视频理解——时序建模](phases/04-computer-vision/12-video-understanding/) | 构建 | Python |
|| 13 | [3D 视觉：点云、NeRF](phases/04-computer-vision/13-3d-vision-nerf/) | 构建 | Python |
|| 14 | [视觉 Transformer（ViT）](phases/04-computer-vision/14-vision-transformers/) | 构建 | Python |
|| 15 | [实时视觉：边缘部署](phases/04-computer-vision/15-real-time-edge/) | 构建 | Python, Rust |
|| 16 | [构建完整的视觉流水线](phases/04-computer-vision/16-vision-pipeline-capstone/) | 构建 | Python |
|| 17 | [自监督视觉——SimCLR、DINO、MAE](phases/04-computer-vision/17-self-supervised-vision/) | 构建 | Python |
|| 18 | [开放词汇视觉——CLIP](phases/04-computer-vision/18-open-vocab-clip/) | 构建 | Python |
|| 19 | [OCR 与文档理解](phases/04-computer-vision/19-ocr-document-understanding/) | 构建 | Python |
|| 20 | [图像检索与度量学习](phases/04-computer-vision/20-image-retrieval-metric/) | 构建 | Python |
|| 21 | [关键点检测与姿态估计](phases/04-computer-vision/21-keypoint-pose/) | 构建 | Python |
|| 22 | [3D 高斯泼溅从零实现](phases/04-computer-vision/22-3d-gaussian-splatting/) | 构建 | Python |
|| 23 | [扩散 Transformer 与整流流](phases/04-computer-vision/23-diffusion-transformers-rectified-flow/) | 构建 | Python |
|| 24 | [SAM 3 与开放词汇分割](phases/04-computer-vision/24-sam3-open-vocab-segmentation/) | 构建 | Python |
|| 25 | [视觉-语言模型（ViT-MLP-LLM）](phases/04-computer-vision/25-vision-language-models/) | 构建 | Python |
|| 26 | [单目深度与几何估计](phases/04-computer-vision/26-monocular-depth/) | 构建 | Python |
|| 27 | [多目标跟踪与视频记忆](phases/04-computer-vision/27-multi-object-tracking/) | 构建 | Python |
|| 28 | [世界模型与视频扩散](phases/04-computer-vision/28-world-models-video-diffusion/) | 构建 | Python |

</details>

<details id="phase-5">
<summary><b>阶段5 — NLP：从基础到进阶</b> &nbsp;<code>29节课</code>&nbsp; <em>语言是通往智能的接口。</em></summary>
<br/>

|| # | 课程 | 类型 | 语言 |
||:---:|--------|:----:|------|
|| 01 | [文本处理：分词、词干提取、词形还原](phases/05-nlp-foundations-to-advanced/01-text-processing/) | 构建 | Python |
|| 02 | [词袋模型、TF-IDF 与文本表示](phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/) | 构建 | Python |
|| 03 | [词嵌入：从零实现 Word2Vec](phases/05-nlp-foundations-to-advanced/03-word-embeddings-word2vec/) | 构建 | Python |
|| 04 | [GloVe、FastText 与子词嵌入](phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword/) | 构建 | Python |
|| 05 | [情感分析](phases/05-nlp-foundations-to-advanced/05-sentiment-analysis/) | 构建 | Python |
|| 06 | [命名实体识别（NER）](phases/05-nlp-foundations-to-advanced/06-named-entity-recognition/) | 构建 | Python |
|| 07 | [词性标注与句法分析](phases/05-nlp-foundations-to-advanced/07-pos-tagging-parsing/) | 构建 | Python |
|| 08 | [文本分类——用于文本的 CNN 与 RNN](phases/05-nlp-foundations-to-advanced/08-cnns-rnns-for-text/) | 构建 | Python |
|| 09 | [序列到序列模型](phases/05-nlp-foundations-to-advanced/09-sequence-to-sequence/) | 构建 | Python |
|| 10 | [注意力机制——突破](phases/05-nlp-foundations-to-advanced/10-attention-mechanism/) | 构建 | Python |
|| 11 | [机器翻译](phases/05-nlp-foundations-to-advanced/11-machine-translation/) | 构建 | Python |
|| 12 | [文本摘要](phases/05-nlp-foundations-to-advanced/12-text-summarization/) | 构建 | Python |
|| 13 | [问答系统](phases/05-nlp-foundations-to-advanced/13-question-answering/) | 构建 | Python |
|| 14 | [信息检索与搜索](phases/05-nlp-foundations-to-advanced/14-information-retrieval-search/) | 构建 | Python |
|| 15 | [主题建模：LDA、BERTopic](phases/05-nlp-foundations-to-advanced/15-topic-modeling/) | 构建 | Python |
|| 16 | [文本生成](phases/05-nlp-foundations-to-advanced/16-text-generation-pre-transformer/) | 构建 | Python |
|| 17 | [聊天机器人：从规则到神经网络](phases/05-nlp-foundations-to-advanced/17-chatbots-rule-to-neural/) | 构建 | Python |
|| 18 | [多语言 NLP](phases/05-nlp-foundations-to-advanced/18-multilingual-nlp/) | 构建 | Python |
|| 19 | [子词分词：BPE、WordPiece、Unigram、SentencePiece](phases/05-nlp-foundations-to-advanced/19-subword-tokenization/) | 学习 | Python |
|| 20 | [结构化输出与约束解码](phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/) | 构建 | Python |
|| 21 | [自然语言推理与文本蕴含](phases/05-nlp-foundations-to-advanced/21-nli-textual-entailment/) | 学习 | Python |
|| 22 | [嵌入模型深度解析](phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive/) | 学习 | Python |
|| 23 | [RAG 分块策略](phases/05-nlp-foundations-to-advanced/23-chunking-strategies-rag/) | 构建 | Python |
|| 24 | [共指消解](phases/05-nlp-foundations-to-advanced/24-coreference-resolution/) | 学习 | Python |
|| 25 | [实体链接与消歧](phases/05-nlp-foundations-to-advanced/25-entity-linking/) | 构建 | Python |
|| 26 | [关系抽取与知识图谱构建](phases/05-nlp-foundations-to-advanced/26-relation-extraction-kg/) | 构建 | Python |
|| 27 | [LLM 评估：RAGAS、DeepEval、G-Eval](phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks/) | 构建 | Python |
|| 28 | [长上下文评估：NIAH、RULER、LongBench、MRCR](phases/05-nlp-foundations-to-advanced/28-long-context-evaluation/) | 学习 | Python |
|| 29 | [对话状态追踪](phases/05-nlp-foundations-to-advanced/29-dialogue-state-tracking/) | 构建 | Python |

</details>

<details id="phase-6">
<summary><b>阶段6 — 语音与音频</b> &nbsp;<code>17节课</code>&nbsp; <em>听、理解、说话。</em></summary>
<br/>

|| # | 课程 | 类型 | 语言 |
||:---:|--------|:----:|------|
|| 01 | [音频基础：波形、采样、FFT](phases/06-speech-and-audio/01-audio-fundamentals) | 学习 | Python |
|| 02 | [频谱图、梅尔尺度与音频特征](phases/06-speech-and-audio/02-spectrograms-mel-features) | 构建 | Python |
|| 03 | [音频分类](phases/06-speech-and-audio/03-audio-classification) | 构建 | Python |
|| 04 | [语音识别（ASR）](phases/06-speech-and-audio/04-speech-recognition-asr) | 构建 | Python |
|| 05 | [Whisper：架构与微调](phases/06-speech-and-audio/05-whisper-architecture-finetuning) | 构建 | Python |
|| 06 | [说话人识别与验证](phases/06-speech-and-audio/06-speaker-recognition-verification) | 构建 | Python |
|| 07 | [文本转语音（TTS）](phases/06-speech-and-audio/07-text-to-speech) | 构建 | Python |
|| 08 | [声音克隆与转换](phases/06-speech-and-audio/08-voice-cloning-conversion) | 构建 | Python |
|| 09 | [音乐生成](phases/06-speech-and-audio/09-music-generation) | 构建 | Python |
|| 10 | [音频-语言模型](phases/06-speech-and-audio/10-audio-language-models) | 构建 | Python |
|| 11 | [实时音频处理](phases/06-speech-and-audio/11-real-time-audio-processing) | 构建 | Python, Rust |
|| 12 | [构建语音助手流水线](phases/06-speech-and-audio/12-voice-assistant-pipeline) | 构建 | Python |
|| 13 | [神经网络音频编解码器——EnCodec、SNAC、Mimi、DAC](phases/06-speech-and-audio/13-neural-audio-codecs) | 学习 | Python |
|| 14 | [语音活动检测与说话人轮换](phases/06-speech-and-audio/14-voice-activity-detection-turn-taking) | 构建 | Python |
|| 15 | [流式语音转语音——Moshi、Hibiki](phases/06-speech-and-audio/15-streaming-speech-to-speech-moshi-hibiki) | 学习 | Python |
|| 16 | [语音防欺骗与音频水印](phases/06-speech-and-audio/16-anti-spoofing-audio-watermarking) | 构建 | Python |
|| 17 | [音频评估——WER、MOS、MMU、排行榜](phases/06-speech-and-audio/17-audio-evaluation-metrics) | 学习 | Python |

</details>

<details id="phase-7">
<summary><b>阶段7 — Transformer 深入</b> &nbsp;<code>14节课</code>&nbsp; <em>改变一切的架构。</em></summary>
<br/>

|| # | 课程 | 类型 | 语言 |
||:---:|--------|:----:|------|
|| 01 | [为什么是 Transformer：RNN 的问题](phases/07-transformers-deep-dive/01-why-transformers/) | 学习 | Python |
|| 02 | [从零实现自注意力](phases/07-transformers-deep-dive/02-self-attention-from-scratch/) | 构建 | Python |
|| 03 | [多头注意力](phases/07-transformers-deep-dive/03-multi-head-attention/) | 构建 | Python |
|| 04 | [位置编码：正弦、RoPE、ALiBi](phases/07-transformers-deep-dive/04-positional-encoding/) | 构建 | Python |
|| 05 | [完整 Transformer：编码器 + 解码器](phases/07-transformers-deep-dive/05-full-transformer/) | 构建 | Python |
|| 06 | [BERT —— 掩码语言建模](phases/07-transformers-deep-dive/06-bert-masked-language-modeling/) | 构建 | Python |
|| 07 | [GPT —— 因果语言建模](phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/) | 构建 | Python |
|| 08 | [T5、BART —— 编码器-解码器模型](phases/07-transformers-deep-dive/08-t5-bart-encoder-decoder/) | 学习 | Python |
|| 09 | [视觉 Transformer（ViT）](phases/07-transformers-deep-dive/09-vision-transformers/) | 构建 | Python |
|| 10 | [音频 Transformer —— Whisper 架构](phases/07-transformers-deep-dive/10-audio-transformers-whisper/) | 学习 | Python |
|| 11 | [混合专家（MoE）](phases/07-transformers-deep-dive/11-mixture-of-experts/) | 构建 | Python |
|| 12 | [KV 缓存、Flash Attention 与推理优化](phases/07-transformers-deep-dive/12-kv-cache-flash-attention/) | 构建 | Python |
|| 13 | [缩放定律](phases/07-transformers-deep-dive/13-scaling-laws/) | 学习 | Python |
|| 14 | [从零构建一个 Transformer（毕业项目）](phases/07-transformers-deep-dive/14-build-a-transformer-capstone/) | 构建 | Python |

</details>

<details id="phase-8">
<summary><b>阶段8 — 生成式 AI</b> &nbsp;<code>14节课</code>&nbsp; <em>创造图像、视频、音频、3D 等。</em></summary>
<br/>

|| # | 课程 | 类型 | 语言 |
||:---:|--------|:----:|------|
|| 01 | [生成模型：分类学与历史](phases/08-generative-ai/01-generative-models-taxonomy-history/) | 学习 | Python |
|| 02 | [自编码器与 VAE](phases/08-generative-ai/02-autoencoders-vae/) | 构建 | Python |
|| 03 | [GAN：生成器 vs 判别器](phases/08-generative-ai/03-gans-generator-discriminator/) | 构建 | Python |
|| 04 | [条件 GAN 与 Pix2Pix](phases/08-generative-ai/04-conditional-gans-pix2pix/) | 构建 | Python |
|| 05 | [StyleGAN](phases/08-generative-ai/05-stylegan/) | 构建 | Python |
|| 06 | [扩散模型——DDPM 从零实现](phases/08-generative-ai/06-diffusion-ddpm-from-scratch/) | 构建 | Python |
|| 07 | [潜在扩散与 Stable Diffusion](phases/08-generative-ai/07-latent-diffusion-stable-diffusion/) | 构建 | Python |
|| 08 | [ControlNet、LoRA 与条件控制](phases/08-generative-ai/08-controlnet-lora-conditioning/) | 构建 | Python |
|| 09 | [修复、外绘与编辑](phases/08-generative-ai/09-inpainting-outpainting-editing/) | 构建 | Python |
|| 10 | [视频生成](phases/08-generative-ai/10-video-generation/) | 构建 | Python |
|| 11 | [音频生成](phases/08-generative-ai/11-audio-generation/) | 构建 | Python |
|| 12 | [3D 生成](phases/08-generative-ai/12-3d-generation/) | 构建 | Python |
|| 13 | [流匹配与整流流](phases/08-generative-ai/13-flow-matching-rectified-flows/) | 构建 | Python |
|| 14 | [评估：FID、CLIP 分数](phases/08-generative-ai/14-evaluation-fid-clip-score/) | 构建 | Python |

</details>

<details id="phase-9">
<summary><b>阶段9 — 强化学习</b> &nbsp;<code>12节课</code>&nbsp; <em>RLHF 与游戏 AI 的基础。</em></summary>
<br/>

|| # | 课程 | 类型 | 语言 |
||:---:|--------|:----:|------|
|| 01 | [MDP、状态、动作与奖励](phases/09-reinforcement-learning/01-mdps-states-actions-rewards/) | 学习 | Python |
|| 02 | [动态规划](phases/09-reinforcement-learning/02-dynamic-programming/) | 构建 | Python |
|| 03 | [蒙特卡洛方法](phases/09-reinforcement-learning/03-monte-carlo-methods/) | 构建 | Python |
|| 04 | [Q-Learning、SARSA](phases/09-reinforcement-learning/04-q-learning-sarsa/) | 构建 | Python |
|| 05 | [深度 Q 网络（DQN）](phases/09-reinforcement-learning/05-dqn/) | 构建 | Python |
|| 06 | [策略梯度——REINFORCE](phases/09-reinforcement-learning/06-policy-gradients-reinforce/) | 构建 | Python |
|| 07 | [Actor-Critic —— A2C、A3C](phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/) | 构建 | Python |
|| 08 | [PPO](phases/09-reinforcement-learning/08-ppo/) | 构建 | Python |
|| 09 | [奖励建模与 RLHF](phases/09-reinforcement-learning/09-reward-modeling-rlhf/) | 构建 | Python |
|| 10 | [多智能体强化学习](phases/09-reinforcement-learning/10-multi-agent-rl/) | 构建 | Python |
|| 11 | [模拟到真实迁移](phases/09-reinforcement-learning/11-sim-to-real-transfer/) | 构建 | Python |
|| 12 | [强化学习用于游戏](phases/09-reinforcement-learning/12-rl-for-games/) | 构建 | Python |

</details>

<details id="phase-10">
<summary><b>阶段10 — 从零构建大语言模型</b> &nbsp;<code>22节课</code>&nbsp; <em>构建、训练并理解大语言模型。</em></summary>
<br/>

|| # | 课程 | 类型 | 语言 |
||:---:|--------|:----:|------|
|| 01 | [分词器：BPE、WordPiece、SentencePiece](phases/10-llms-from-scratch/01-tokenizers/) | 构建 | Python |
|| 02 | [从零构建一个分词器](phases/10-llms-from-scratch/02-building-a-tokenizer/) | 构建 | Python |
|| 03 | [预训练数据流线](phases/10-llms-from-scratch/03-data-pipelines/) | 构建 | Python |
|| 04 | [预训练一个迷你 GPT（124M）](phases/10-llms-from-scratch/04-pre-training-mini-gpt/) | 构建 | Python |
|| 05 | [分布式训练：FSDP、DeepSpeed](phases/10-llms-from-scratch/05-scaling-distributed/) | 构建 | Python |
|| 06 | [指令微调——SFT](phases/10-llms-from-scratch/06-instruction-tuning-sft/) | 构建 | Python |
|| 07 | [RLHF —— 奖励模型 + PPO](phases/10-llms-from-scratch/07-rlhf/) | 构建 | Python |
|| 08 | [DPO —— 直接偏好优化](phases/10-llms-from-scratch/08-dpo/) | 构建 | Python |
|| 09 | [宪法 AI 与自我改进](phases/10-llms-from-scratch/09-constitutional-ai-self-improvement/) | 构建 | Python |
|| 10 | [评估——基准测试、Evals](phases/10-llms-from-scratch/10-evaluation/) | 构建 | Python |
|| 11 | [量化：INT8、GPTQ、AWQ、GGUF](phases/10-llms-from-scratch/11-quantization/) | 构建 | Python, Rust |
|| 12 | [推理优化](phases/10-llms-from-scratch/12-inference-optimization/) | 构建 | Python |
|| 13 | [构建完整的 LLM 流水线](phases/10-llms-from-scratch/13-building-complete-llm-pipeline/) | 构建 | Python |
|| 14 | [开放模型：架构详解](phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/) | 学习 | Python |
|| 15 | [投机解码与 EAGLE-3](phases/10-llms-from-scratch/15-speculative-decoding-eagle3/) | 构建 | Python |
|| 16 | [差分注意力（V2）](phases/10-llms-from-scratch/16-differential-attention-v2/) | 构建 | Python |
|| 17 | [原生稀疏注意力（DeepSeek NSA）](phases/10-llms-from-scratch/17-native-sparse-attention/) | 构建 | Python |
|| 18 | [多令牌预测（MTP）](phases/10-llms-from-scratch/18-multi-token-prediction/) | 构建 | Python |
|| 19 | [DualPipe 并行ism](phases/10-llms-from-scratch/19-dualpipe-parallelism/) | 学习 | Python |
|| 20 | [DeepSeek-V3 架构详解](phases/10-llms-from-scratch/20-deepseek-v3-walkthrough/) | 学习 | Python |
|| 21 | [Jamba —— SSM-Transformer 混合架构](phases/10-llms-from-scratch/21-jamba-hybrid-ssm-transformer/) | 学习 | Python |
|| 22 | [异步与 Hogwild! 推理](phases/10-llms-from-scratch/22-async-hogwild-inference/) | 构建 | Python |

</details>

<details id="phase-11">
<summary><b>阶段11 — LLM 工程</b> &nbsp;<code>15节课</code>&nbsp; <em>让 LLM 在生产中发挥作用。</em></summary>
<br/>

|| # | 课程 | 类型 | 语言 |
||:---:|--------|:----:|------|
|| 01 | [提示工程：技术与模式](phases/11-llm-engineering/01-prompt-engineering/) | 构建 | Python |
|| 02 | [少样本、思维链、思维树](phases/11-llm-engineering/02-few-shot-cot/) | 构建 | Python |
|| 03 | [结构化输出](phases/11-llm-engineering/03-structured-outputs/) | 构建 | Python, TypeScript |
|| 04 | [嵌入与向量表示](phases/11-llm-engineering/04-embeddings/) | 构建 | Python |
|| 05 | [上下文工程](phases/11-llm-engineering/05-context-engineering/) | 构建 | Python, TypeScript |
|| 06 | [RAG：检索增强生成](phases/11-llm-engineering/06-rag/) | 构建 | Python, TypeScript |
|| 07 | [进阶 RAG：分块、重排序](phases/11-llm-engineering/07-advanced-rag/) | 构建 | Python |
|| 08 | [使用 LoRA 与 QLoRA 微调](phases/11-llm-engineering/08-fine-tuning-lora/) | 构建 | Python |
|| 09 | [函数调用与工具使用](phases/11-llm-engineering/09-function-calling/) | 构建 | Python |
|| 10 | [评估与测试](phases/11-llm-engineering/10-evaluation/) | 构建 | Python |
|| 11 | [缓存、速率限制与成本](phases/11-llm-engineering/11-caching-cost/) | 构建 | Python |
|| 12 | [护栏与安全](phases/11-llm-engineering/12-guardrails/) | 构建 | Python |
|| 13 | [构建生产级 LLM 应用](phases/11-llm-engineering/13-production-app/) | 构建 | Python |
|| 14 | [模型上下文协议（MCP）](phases/11-llm-engineering/14-model-context-protocol/) | 构建 | Python |
|| 15 | [提示缓存与上下文缓存](phases/11-llm-engineering/15-prompt-caching/) | 构建 | Python |

</details>

<details id="phase-12">
<summary><b>阶段12 — 多模态 AI</b> &nbsp;<code>25节课</code>&nbsp; <em>跨模态看、听、读和推理——从 ViT 补丁到计算机使用智能体。</em></summary>
<br/>

|| # | 课程 | 类型 | 语言 |
||:---:|--------|:----:|------|
|| 01 | [视觉 Transformer 与补丁-令牌原语](phases/12-multimodal-ai/01-vision-transformer-patch-tokens/) | 学习 | Python |
|| 02 | [CLIP 与对比视觉-语言预训练](phases/12-multimodal-ai/02-clip-contrastive-pretraining/) | 构建 | Python |
|| 03 | [BLIP-2 Q-Former 作为模态桥接](phases/12-multimodal-ai/03-blip2-qformer-bridge/) | 构建 | Python |
|| 04 | [Flamingo 与门控交叉注意力](phases/12-multimodal-ai/04-flamingo-gated-cross-attention/) | 学习 | Python |
|| 05 | [LLaVA 与视觉指令微调](phases/12-multimodal-ai/05-llava-visual-instruction-tuning/) | 构建 | Python |
|| 06 | [任意分辨率视觉——Patch-n'-Pack 与 NaFlex](phases/12-multimodal-ai/06-any-resolution-patch-n-pack/) | 构建 | Python |
|| 07 | [开放权重 VLM 方案：真正重要的东西](phases/12-multimodal-ai/07-open-weight-vlm-recipes/) | 学习 | Python |
|| 08 | [LLaVA-OneVision：单图、多图、视频](phases/12-multimodal-ai/08-llava-onevision-single-multi-video/) | 构建 | Python |
|| 09 | [Qwen-VL 系列与 Dynamic-FPS 视频](phases/12-multimodal-ai/09-qwen-vl-family-dynamic-fps/) | 学习 | Python |
|| 10 | [InternVL3 原生多模态预训练](phases/12-multimodal-ai/10-internvl3-native-multimodal/) | 学习 | Python |
|| 11 | [Chameleon 早期融合仅令牌](phases/12-multimodal-ai/11-chameleon-early-fusion-tokens/) | 构建 | Python |
|| 12 | [Emu3 用于生成的下一令牌预测](phases/12-multimodal-ai/12-emu3-next-token-for-generation/) | 学习 | Python |
|| 13 | [Transfusion 自回归 + 扩散](phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion/) | 构建 | Python |
|| 14 | [Show-o 离散扩散统一](phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/) | 学习 | Python |
|| 15 | [Janus-Pro 解耦编码器](phases/12-multimodal-ai/15-janus-pro-decoupled-encoders/) | 构建 | Python |
|| 16 | [MIO 任意到任意流式传输](phases/12-multimodal-ai/16-mio-any-to-any-streaming/) | 学习 | Python |
|| 17 | [视频-语言时序定位](phases/12-multimodal-ai/17-video-language-temporal-grounding/) | 构建 | Python |
|| 18 | [百万令牌上下文长视频](phases/12-multimodal-ai/18-long-video-million-token/) | 构建 | Python |
|| 19 | [音频-语言模型：Whisper 到 AF3](phases/12-multimodal-ai/19-audio-language-whisper-to-af3/) | 构建 | Python |
|| 20 | [全模态模型：思考者-说话者流式架构](phases/12-multimodal-ai/20-omni-models-thinker-talker/) | 构建 | Python |
|| 21 | [具身 VLA：RT-2、OpenVLA、π0、GR00T](phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot/) | 学习 | Python |
|| 22 | [文档与图表理解](phases/12-multimodal-ai/22-document-diagram-understanding/) | 构建 | Python |
|| 23 | [ColPali 视觉原生文档 RAG](phases/12-multimodal-ai/23-colpali-vision-native-rag/) | 构建 | Python |
|| 24 | [多模态 RAG 与跨模态检索](phases/12-multimodal-ai/24-multimodal-rag-cross-modal/) | 构建 | Python |
|| 25 | [多模态智能体与计算机使用（毕业项目）](phases/12-multimodal-ai/25-multimodal-agents-computer-use/) | 构建 | Python |

</details>

<details id="phase-13">
<summary><b>阶段13 — 工具与协议</b> &nbsp;<code>23节课</code>&nbsp; <em>AI 与现实世界之间的接口。</em></summary>
<br/>

|| # | 课程 | 类型 | 语言 |
||:---:|--------|:----:|------|
|| 01 | [工具接口](phases/13-tools-and-protocols/01-the-tool-interface/) | 学习 | Python |
|| 02 | [函数调用深入](phases/13-tools-and-protocols/02-function-calling-deep-dive/) | 构建 | Python |
|| 03 | [并行与流式工具调用](phases/13-tools-and-protocols/03-parallel-and-streaming-tool-calls/) | 构建 | Python |
|| 04 | [结构化输出](phases/13-tools-and-protocols/04-structured-output/) | 构建 | Python |
|| 05 | [工具 Schema 设计](phases/13-tools-and-protocols/05-tool-schema-design/) | 学习 | Python |
|| 06 | [MCP 基础](phases/13-tools-and-protocols/06-mcp-fundamentals/) | 学习 | Python |
|| 07 | [构建 MCP 服务器](phases/13-tools-and-protocols/07-building-an-mcp-server/) | 构建 | Python |
|| 08 | [构建 MCP 客户端](phases/13-tools-and-protocols/08-building-an-mcp-client/) | 构建 | Python |
|| 09 | [MCP 传输：stdio vs Streamable HTTP vs SSE 迁移](phases/13-tools-and-protocols/09-mcp-transports/) | 学习 | Python |
|| 10 | [MCP 资源与提示词](phases/13-tools-and-protocols/10-mcp-resources-and-prompts/) | 构建 | Python |
|| 11 | [MCP 采样](phases/13-tools-and-protocols/11-mcp-sampling/) | 构建 | Python |
|| 12 | [MCP 根与询问](phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/) | 构建 | Python |
|| 13 | [MCP 异步任务](phases/13-tools-and-protocols/13-mcp-async-tasks/) | 构建 | Python |
|| 14 | [MCP 应用](phases/13-tools-and-protocols/14-mcp-apps/) | 构建 | Python |
|| 15 | [MCP 安全 I —— 工具投毒](phases/13-tools-and-protocols/15-mcp-security-tool-poisoning/) | 学习 | Python |
|| 16 | [MCP 安全 II —— OAuth 2.1](phases/13-tools-and-protocols/16-mcp-security-oauth-2-1/) | 构建 | Python |
|| 17 | [MCP 网关与注册表](phases/13-tools-and-protocols/17-mcp-gateways-and-registries/) | 学习 | Python |
|| 18 | [MCP 生产环境认证——DCR + JWKS](phases/13-tools-and-protocols/18-mcp-auth-production/) | 构建 | Python |
|| 19 | [A2A 协议](phases/13-tools-and-protocols/19-a2a-protocol/) | 构建 | Python |
|| 20 | [OpenTelemetry GenAI](phases/13-tools-and-protocols/20-opentelemetry-genai/) | 构建 | Python |
|| 21 | [LLM 路由层](phases/13-tools-and-protocols/21-llm-routing-layer/) | 学习 | Python |
|| 22 | [技能与智能体 SDK](phases/13-tools-and-protocols/22-skills-and-agent-sdks/) | 学习 | Python |
|| 23 | [毕业项目 —— 工具生态](phases/13-tools-and-protocols/23-capstone-tool-ecosystem/) | 构建 | Python |

</details>

<details id="phase-14">
<summary><b>阶段14 — 智能体工程</b> &nbsp;<code>42节课</code>&nbsp; <em>从第一性原理构建智能体——循环、记忆、规划、框架、基准测试、生产、工作台。</em></summary>
<br/>

|| # | 课程 | 类型 | 语言 |
||:---:|--------|:----:|------|
|| 01 | [智能体循环：观察、思考、行动](phases/14-agent-engineering/01-the-agent-loop/) | 构建 | Python |
|| 02 | [ReWOO 与 Plan-and-Execute](phases/14-agent-engineering/02-rewoo-plan-and-execute/) | 构建 | Python |
|| 03 | [Reflexion 与语言强化学习](phases/14-agent-engineering/03-reflexion-verbal-rl/) | 构建 | Python |
|| 04 | [思维树与 LATS](phases/14-agent-engineering/04-tree-of-thoughts-lats/) | 构建 | Python |
|| 05 | [Self-Refine 与 CRITIC](phases/14-agent-engineering/05-self-refine-and-critic/) | 构建 | Python |
|| 06 | [工具使用与函数调用](phases/14-agent-engineering/06-tool-use-and-function-calling/) | 构建 | Python |
|| 07 | [记忆 —— 虚拟上下文与 MemGPT](phases/14-agent-engineering/07-memory-virtual-context-memgpt/) | 构建 | Python |
|| 08 | [记忆块与睡眠时计算](phases/14-agent-engineering/08-memory-blocks-sleep-time-compute/) | 构建 | Python |
|| 09 | [混合记忆 —— Mem0 向量 + 图 + KV](phases/14-agent-engineering/09-hybrid-memory-mem0/) | 构建 | Python |
|| 10 | [技能库与终身学习 —— Voyager](phases/14-agent-engineering/10-skill-libraries-voyager/) | 构建 | Python |
|| 11 | [使用 HTN 与进化搜索进行规划](phases/14-agent-engineering/11-planning-htn-and-evolutionary/) | 构建 | Python |
|| 12 | [Anthropic 的工作流模式](phases/14-agent-engineering/12-anthropic-workflow-patterns/) | 构建 | Python |
|| 13 | [LangGraph —— 有状态图与持久化执行](phases/14-agent-engineering/13-langgraph-stateful-graphs/) | 构建 | Python |
|| 14 | [AutoGen v0.4 —— Actor 模型](phases/14-agent-engineering/14-autogen-actor-model/) | 构建 | Python |
|| 15 | [CrewAI —— 基于角色的智能体与流程](phases/14-agent-engineering/15-crewai-role-based-crews/) | 构建 | Python |
|| 16 | [OpenAI Agents SDK —— 交接、护栏、追踪](phases/14-agent-engineering/16-openai-agents-sdk/) | 构建 | Python |
|| 17 | [Claude Agent SDK —— 子智能体与会话存储](phases/14-agent-engineering/17-claude-agent-sdk/) | 构建 | Python |
|| 18 | [Agno 与 Mastra —— 生产运行时](phases/14-agent-engineering/18-agno-and-mastra-runtimes/) | 学习 | Python, TypeScript |
|| 19 | [基准测试 —— SWE-bench、GAIA、AgentBench](phases/14-agent-engineering/19-benchmarks-swebench-gaia/) | 学习 | Python |
|| 20 | [基准测试 —— WebArena 与 OSWorld](phases/14-agent-engineering/20-benchmarks-webarena-osworld/) | 学习 | Python |
|| 21 | [计算机使用智能体 —— Claude、OpenAI CUA、Gemini](phases/14-agent-engineering/21-computer-use-agents/) | 构建 | Python |
|| 22 | [语音智能体 —— Pipecat 与 LiveKit](phases/14-agent-engineering/22-voice-agents-pipecat-livekit/) | 构建 | Python |
|| 23 | [OpenTelemetry GenAI 语义约定](phases/14-agent-engineering/23-otel-genai-conventions/) | 构建 | Python |
|| 24 | [智能体可观测性 —— Langfuse、Phoenix、Opik](phases/14-agent-engineering/24-agent-observability-platforms/) | 学习 | Python |
|| 25 | [多智能体辩论与协作](phases/14-agent-engineering/25-multi-agent-debate/) | 构建 | Python |
|| 26 | [失效模式 —— 智能体为何崩溃](phases/14-agent-engineering/26-failure-modes-agentic/) | 构建 | Python |
|| 27 | [提示注入与 CVE 防御](phases/14-agent-engineering/27-prompt-injection-defense/) | 构建 | Python |
|| 28 | [编排模式 —— 监督者、集群、分层](phases/14-agent-engineering/28-orchestration-patterns/) | 构建 | Python |
|| 29 | [生产运行时 —— 队列、事件、Cron](phases/14-agent-engineering/29-production-runtimes/) | 学习 | Python |
|| 30 | [评估驱动的智能体开发](phases/14-agent-engineering/30-eval-driven-agent-development/) | 构建 | Python |
|| 31 | [智能体工作台：为何能力强的模型仍然失败](phases/14-agent-engineering/31-agent-workbench-why-models-fail/) | 学习 | Python |
|| 32 | [最简智能体工作台](phases/14-agent-engineering/32-minimal-agent-workbench/) | 构建 | Python |
|| 33 | [智能体指令作为可执行约束](phases/14-agent-engineering/33-instructions-as-executable-constraints/) | 构建 | Python |
|| 34 | [仓库记忆与持久化状态](phases/14-agent-engineering/34-repo-memory-and-state/) | 构建 | Python |
|| 35 | [智能体初始化脚本](phases/14-agent-engineering/35-initialization-scripts/) | 构建 | Python |
|| 36 | [作用域契约与任务边界](phases/14-agent-engineering/36-scope-contracts/) | 构建 | Python |
|| 37 | [运行时反馈循环](phases/14-agent-engineering/37-runtime-feedback-loops/) | 构建 | Python |
|| 38 | [验证网关](phases/14-agent-engineering/38-verification-gates/) | 构建 | Python |
|| 39 | [审查者智能体：将构建者与标记者分离](phases/14-agent-engineering/39-reviewer-agent/) | 构建 | Python |
|| 40 | [多会话交接](phases/14-agent-engineering/40-multi-session-handoff/) | 构建 | Python |
|| 41 | [在真实仓库上的工作台](phases/14-agent-engineering/41-workbench-for-real-repos/) | 构建 | Python |
|| 42 | [毕业项目：发布一个可复用的智能体工作台包](phases/14-agent-engineering/42-agent-workbench-capstone/) | 构建 | Python |

每个阶段14工作台课程（31-42）在打开完整课程文档之前，会发送一份 `mission.md` 来向智能体简要说明任务。

</details>

<details id="phase-15">
<summary><b>阶段15 — 自主系统</b> &nbsp;<code>22节课</code>&nbsp; <em>长视野智能体、自我改进，以及 2026 安全栈。</em></summary>
<br/>

|| # | 课程 | 类型 | 语言 |
||:---:|--------|:----:|------|
|| 01 | [从聊天机器人到长视野智能体（METR）](phases/15-autonomous-systems/01-long-horizon-agents/) | 学习 | Python |
|| 02 | [STaR、V-STaR、Quiet-STaR：自教推理](phases/15-autonomous-systems/02-star-family-reasoning/) | 学习 | Python |
|| 03 | [AlphaEvolve：进化编码智能体](phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/) | 学习 | Python |
|| 04 | [Darwin Gödel 机器：自修改智能体](phases/15-autonomous-systems/04-darwin-godel-machine/) | 学习 | Python |
|| 05 | [AI Scientist v2：工作坊级研究](phases/15-autonomous-systems/05-ai-scientist-v2/) | 学习 | Python |
|| 06 | [自动化对齐研究（Anthropic AAR）](phases/15-autonomous-systems/06-automated-alignment-research/) | 学习 | Python |
|| 07 | [递归自我改进：能力 vs 对齐](phases/15-autonomous-systems/07-recursive-self-improvement/) | 学习 | Python |
|| 08 | [有界自我改进设计](phases/15-autonomous-systems/08-bounded-self-improvement/) | 学习 | Python |
|| 09 | [自主编码智能体全景（SWE-bench、CodeAct）](phases/15-autonomous-systems/09-coding-agent-landscape/) | 学习 | Python |
|| 10 | [Claude Code 权限模式与自动模式](phases/15-autonomous-systems/10-claude-code-permission-modes/) | 学习 | Python |
|| 11 | [浏览器智能体与间接提示注入](phases/15-autonomous-systems/11-browser-agents/) | 学习 | Python |
|| 12 | [长运行智能体的持久化执行](phases/15-autonomous-systems/12-durable-execution/) | 学习 | Python |
|| 13 | [动作预算、迭代上限、成本控制器](phases/15-autonomous-systems/13-cost-governors/) | 学习 | Python |
|| 14 | [终止开关、断路器、金丝雀令牌](phases/15-autonomous-systems/14-kill-switches-canaries/) | 学习 | Python |
|| 15 | [HITL：提议-然后-提交](phases/15-autonomous-systems/15-propose-then-commit/) | 学习 | Python |
|| 16 | [检查点与回滚](phases/15-autonomous-systems/16-checkpoints-rollback/) | 学习 | Python |
|| 17 | [宪法 AI 与规则覆盖](phases/15-autonomous-systems/17-constitutional-ai/) | 学习 | Python |
|| 18 | [Llama Guard 与输入/输出分类](phases/15-autonomous-systems/18-llama-guard/) | 学习 | Python |
|| 19 | [Anthropic 责任扩展政策 v3.0](phases/15-autonomous-systems/19-anthropic-rsp/) | 学习 | Python |
|| 20 | [OpenAI 准备框架与 DeepMind FSF](phases/15-autonomous-systems/20-openai-preparedness-deepmind-fsf/) | 学习 | Python |
|| 21 | [METR 时间视野与外部评估](phases/15-autonomous-systems/21-metr-external-evaluation/) | 学习 | Python |
|| 22 | [CAIS、CAISI 与社会规模风险](phases/15-autonomous-systems/22-cais-caisi-societal-risk/) | 学习 | Python |

</details>

<details id="phase-16">
<summary><b>阶段16 — 多智能体与集群</b> &nbsp;<code>25节课</code>&nbsp; <em>协调、涌现与集体智能。</em></summary>
<br/>

|| # | 课程 | 类型 | 语言 |
||:---:|--------|:----:|------|
|| 01 | [为什么需要多智能体](phases/16-multi-agent-and-swarms/01-why-multi-agent/) | 学习 | TypeScript |
|| 02 | [FIPA-ACL 遗产与言语行为](phases/16-multi-agent-and-swarms/02-fipa-acl-heritage/) | 学习 | Python |
|| 03 | [通信协议](phases/16-multi-agent-and-swarms/03-communication-protocols/) | 构建 | TypeScript |
|| 04 | [多智能体原始模型](phases/16-multi-agent-and-swarms/04-primitive-model/) | 学习 | Python |
|| 05 | [监督者/编排者-工作者模式](phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/) | 构建 | Python |
|| 06 | [分层架构与分解漂移](phases/16-multi-agent-and-swarms/06-hierarchical-architecture/) | 学习 | Python |
|| 07 | [心智社会与多智能体辩论](phases/16-multi-agent-and-swarms/07-society-of-mind-debate/) | 构建 | Python |
|| 08 | [角色专门化 —— 规划者/评论者/执行者/验证者](phases/16-multi-agent-and-swarms/08-role-specialization/) | 构建 | Python |
|| 09 | [并行集群与网络化架构](phases/16-multi-agent-and-swarms/09-parallel-swarm-networks/) | 构建 | Python |
|| 10 | [群聊与发言者选择](phases/16-multi-agent-and-swarms/10-group-chat-speaker-selection/) | 构建 | Python |
|| 11 | [交接与例程（无状态编排）](phases/16-multi-agent-and-swarms/11-handoffs-and-routines/) | 构建 | Python |
|| 12 | [A2A —— 智能体到智能体协议](phases/16-multi-agent-and-swarms/12-a2a-protocol/) | 构建 | Python |
|| 13 | [共享记忆与黑板模式](phases/16-multi-agent-and-swarms/13-shared-memory-blackboard/) | 构建 | Python |
|| 14 | [共识与拜占庭容错](phases/16-multi-agent-and-swarms/14-consensus-and-bft/) | 构建 | Python |
|| 15 | [投票、自一致性、辩论拓扑](phases/16-multi-agent-and-swarms/15-voting-debate-topology/) | 构建 | Python |
|| 16 | [谈判与议价](phases/16-multi-agent-and-swarms/16-negotiation-bargaining/) | 构建 | Python |
|| 17 | [生成式智能体与涌现模拟](phases/16-multi-agent-and-swarms/17-generative-agents-simulation/) | 构建 | Python |
|| 18 | [心智理论与涌现协调](phases/16-multi-agent-and-swarms/18-theory-of-mind-coordination/) | 构建 | Python |
|| 19 | [集群优化（PSO、ACO）](phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco/) | 构建 | Python |
|| 20 | [多智能体强化学习 —— MADDPG、QMIX、MAPPO](phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/) | 学习 | Python |
|| 21 | [智能体经济、令牌激励、声誉](phases/16-multi-agent-and-swarms/21-agent-economies/) | 学习 | Python |
|| 22 | [生产扩展 —— 队列、检查点、持久性](phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints/) | 构建 | Python |
|| 23 | [失效模式 —— MAST、群体思维、单一文化](phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/) | 学习 | Python |
|| 24 | [评估与协调基准测试](phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks/) | 学习 | Python |
|| 25 | [案例研究与 2026 最先进技术](phases/16-multi-agent-and-swarms/25-case-studies-2026-sota/) | 学习 | Python |

</details>

<details id="phase-17">
<summary><b>阶段17 — 基础设施与生产</b> &nbsp;<code>28节课</code>&nbsp; <em>将 AI 部署到真实世界。</em></summary>
<br/>

|| # | 课程 | 类型 | 语言 |
||:---:|--------|:----:|------|
|| 01 | [托管 LLM 平台 —— Bedrock、Azure OpenAI、Vertex AI](phases/17-infrastructure-and-production/01-managed-llm-platforms/) | 学习 | Python |
|| 02 | [推理平台经济学 —— Fireworks、Together、Baseten、Modal](phases/17-infrastructure-and-production/02-inference-platform-economics/) | 学习 | Python |
|| 03 | [Kubernetes 上的 GPU 自动扩展 —— Karpenter、KAI Scheduler](phases/17-infrastructure-and-production/03-gpu-autoscaling-kubernetes/) | 学习 | Python |
|| 04 | [vLLM 服务内部 —— PagedAttention、Continuous Batching、Chunked Prefill](phases/17-infrastructure-and-production/04-vllm-serving-internals/) | 学习 | Python |
|| 05 | [EAGLE-3 生产环境投机解码](phases/17-infrastructure-and-production/05-eagle3-speculative-decoding/) | 学习 | Python |
|| 06 | [SGLang 与 RadixAttention 用于前缀密集型工作负载](phases/17-infrastructure-and-production/06-sglang-radixattention/) | 学习 | Python |
|| 07 | [TensorRT-LLM on Blackwell with FP8 and NVFP4](phases/17-infrastructure-and-production/07-tensorrt-llm-blackwell/) | 学习 | Python |
|| 08 | [推理指标 —— TTFT、TPOT、ITL、Goodput、P99](phases/17-infrastructure-and-production/08-inference-metrics-goodput/) | 学习 | Python |
|| 09 | [生产量化 —— AWQ、GPTQ、GGUF、FP8、NVFP4](phases/17-infrastructure-and-production/09-production-quantization/) | 学习 | Python |
|| 10 | [无服务器 LLM 的冷启动缓解](phases/17-infrastructure-and-production/10-cold-start-mitigation/) | 学习 | Python |
|| 11 | [多区域 LLM 服务与 KV 缓存局部性](phases/17-infrastructure-and-production/11-multi-region-kv-locality/) | 学习 | Python |
|| 12 | [边缘推理 —— ANE、Hexagon、WebGPU、Jetson](phases/17-infrastructure-and-production/12-edge-inference/) | 学习 | Python |
|| 13 | [LLM 可观测性栈选择](phases/17-infrastructure-and-production/13-llm-observability/) | 学习 | Python |
|| 14 | [提示缓存与语义缓存经济学](phases/17-infrastructure-and-production/14-prompt-semantic-caching/) | 学习 | Python |
|| 15 | [批量 API —— 50% 折扣作为行业标准](phases/17-infrastructure-and-production/15-batch-apis/) | 学习 | Python |
|| 16 | [模型路由作为降本原语](phases/17-infrastructure-and-production/16-model-routing/) | 学习 | Python |
|| 17 | [分解预填充/解码 —— NVIDIA Dynamo 和 llm-d](phases/17-infrastructure-and-production/17-disaggregated-prefill-decode/) | 学习 | Python |
|| 18 | [vLLM 生产栈与 LMCache KV 卸载](phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache/) | 学习 | Python |
|| 19 | [AI 网关 —— LiteLLM、Portkey、Kong、Bifrost](phases/17-infrastructure-and-production/19-ai-gateways/) | 学习 | Python |
|| 20 | [影子、金丝雀与渐进式部署](phases/17-infrastructure-and-production/20-shadow-canary-progressive/) | 学习 | Python |
|| 21 | [A/B 测试 LLM 功能 —— GrowthBook 和 Statsig](phases/17-infrastructure-and-production/21-ab-testing-llm-features/) | 学习 | Python |
|| 22 | [LLM API 负载测试 —— k6、LLMPerf、GenAI-Perf](phases/17-infrastructure-and-production/22-load-testing-llm-apis/) | 构建 | Python |
|| 23 | [AI 的 SRE —— 多智能体事件响应](phases/17-infrastructure-and-production/23-sre-for-ai/) | 学习 | Python |
|| 24 | [LLM 生产的混沌工程](phases/17-infrastructure-and-production/24-chaos-engineering-llm/) | 学习 | Python |
|| 25 | [安全 —— 密钥、PII 擦除、审计日志](phases/17-infrastructure-and-production/25-security-secrets-audit/) | 学习 | Python |
|| 26 | [合规 —— SOC 2、HIPAA、GDPR、EU AI Act、ISO 42001](phases/17-infrastructure-and-production/26-compliance-frameworks/) | 学习 | Python |
|| 27 | [LLM 的 FinOps —— 单位经济学与多租户归因](phases/17-infrastructure-and-production/27-finops-llms/) | 学习 | Python |
|| 28 | [自托管服务选择 —— llama.cpp、Ollama、TGI、vLLM、SGLang](phases/17-infrastructure-and-production/28-self-hosted-serving-selection/) | 学习 | Python |

</details>

<details id="phase-18">
<summary><b>阶段18 — 伦理、安全与对齐</b> &nbsp;<code>30节课</code>&nbsp; <em>构建帮助人类的 AI。这不是可选的。</em></summary>
<br/>

|| # | 课程 | 类型 | 语言 |
||:---:|--------|:----:|------|
|| 01 | [指令遵循作为对齐信号](phases/18-ethics-safety-alignment/01-instruction-following-alignment-signal/) | 学习 | Python |
|| 02 | [奖励黑客与古德哈特定律](phases/18-ethics-safety-alignment/02-reward-hacking-goodhart/) | 学习 | Python |
|| 03 | [直接偏好优化家族](phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/) | 学习 | Python |
|| 04 | [谄媚作为 RLHF 放大](phases/18-ethics-safety-alignment/04-sycophancy-rlhf-amplification/) | 学习 | Python |
|| 05 | [宪法 AI 与 RLAIF](phases/18-ethics-safety-alignment/05-constitutional-ai-rlaif/) | 学习 | Python |
|| 06 | [介观优化与欺骗性对齐](phases/18-ethics-safety-alignment/06-mesa-optimization-deceptive-alignment/) | 学习 | Python |
|| 07 | [潜伏智能体 —— 持久欺骗](phases/18-ethics-safety-alignment/07-sleeper-agents-persistent-deception/) | 学习 | Python |
|| 08 | [前沿模型中的上下文图谋](phases/18-ethics-safety-alignment/08-in-context-scheming-frontier-models/) | 学习 | Python |
|| 09 | [对齐伪装](phases/18-ethics-safety-alignment/09-alignment-faking/) | 学习 | Python |
|| 10 | [AI 控制 —— 尽管有颠覆行为仍保证安全](phases/18-ethics-safety-alignment/10-ai-control-subversion/) | 学习 | Python |
|| 11 | [可扩展监督与弱到强](phases/18-ethics-safety-alignment/11-scalable-oversight-weak-to-strong/) | 学习 | Python |
|| 12 | [红队测试：PAIR & 自动化攻击](phases/18-ethics-safety-alignment/12-red-teaming-pair-automated-attacks/) | 构建 | Python |
|| 13 | [多次射击越狱](phases/18-ethics-safety-alignment/13-many-shot-jailbreaking/) | 学习 | Python |
|| 14 | [ASCII 艺术与视觉越狱](phases/18-ethics-safety-alignment/14-ascii-art-visual-jailbreaks/) | 构建 | Python |
|| 15 | [间接提示注入](phases/18-ethics-safety-alignment/15-indirect-prompt-injection/) | 构建 | Python |
|| 16 | [红队工具：Garak、Llama Guard、PyRIT](phases/18-ethics-safety-alignment/16-red-team-tooling-garak-llamaguard-pyrit/) | 构建 | Python |
|| 17 | [WMDP & 双用途能力评估](phases/18-ethics-safety-alignment/17-wmdp-dual-use-evaluation/) | 学习 | Python |
|| 18 | [前沿安全框架 —— RSP、PF、FSF](phases/18-ethics-safety-alignment/18-frontier-safety-frameworks-rsp-pf-fsf/) | 学习 | — |
|| 19 | [模型福利研究](phases/18-ethics-safety-alignment/19-model-welfare-research/) | 学习 | Python |
|| 20 | [偏见与表征伤害](phases/18-ethics-safety-alignment/20-bias-representational-harm/) | 构建 | Python |
|| 21 | [公平性原则：群体、个体、反事实](phases/18-ethics-safety-alignment/21-fairness-criteria-group-individual-counterfactual/) | 学习 | Python |
|| 22 | [LLM 的差分隐私](phases/18-ethics-safety-alignment/22-differential-privacy-for-llms/) | 构建 | Python |
|| 23 | [水印：SynthID、Stable Signature、C2PA](phases/18-ethics-safety-alignment/23-watermarking-synthid-stable-signature-c2pa/) | 构建 | Python |
|| 24 | [监管框架：EU、US、UK、Korea](phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea/) | 学习 | — |
|| 25 | [EchoLeak & CVE 用于 AI](phases/18-ethics-safety-alignment/25-echoleak-cves-for-ai/) | 学习 | Python |
|| 26 | [模型、系统与数据集卡片](phases/18-ethics-safety-alignment/26-model-system-dataset-cards/) | 构建 | Python |
|| 27 | [数据溯源与训练数据治理](phases/18-ethics-safety-alignment/27-data-provenance-training-governance/) | 学习 | Python |
|| 28 | [对齐研究生态：MATS、Redwood、Apollo、METR](phases/18-ethics-safety-alignment/28-alignment-research-ecosystem/) | 学习 | — |
|| 29 | [审核系统：OpenAI、Perspective、Llama Guard](phases/18-ethics-safety-alignment/29-moderation-systems-openai-perspective-llamaguard/) | 构建 | Python |
|| 30 | [双用途风险：网络、生物、化学、核](phases/18-ethics-safety-alignment/30-dual-use-risk-cyber-bio-chem-nuclear/) | 学习 | — |

</details>

<details id="phase-19">
<summary><b>阶段19 — 毕业项目</b> &nbsp;<code>17个项目</code>&nbsp; <em>2026 端到端可发布产品，每个 20-40 小时。</em></summary>
<br/>

|| # | 项目 | 组合 | 语言 |
||:---:|---------|----------|------|
|| 01 | [终端原生编码智能体](phases/19-capstone-projects/01-terminal-native-coding-agent/) | P0 P5 P7 P10 P11 P13 P14 P15 P17 | TypeScript, Python |
|| 02 | [代码库 RAG（跨仓库语义搜索）](phases/19-capstone-projects/02-rag-over-codebase/) | P5 P7 P11 P13 P17 | Python, TypeScript |
|| 03 | [实时语音助手（ASR → LLM → TTS）](phases/19-capstone-projects/03-realtime-voice-assistant/) | P6 P7 P11 P13 P14 P17 | Python, TypeScript |
|| 04 | [多模态文档 QA（视觉优先）](phases/19-capstone-projects/04-multimodal-document-qa/) | P4 P5 P7 P11 P12 P17 | Python, TypeScript |
|| 05 | [自主研究智能体（AI-Scientist 级别）](phases/19-capstone-projects/05-autonomous-research-agent/) | P0 P2 P3 P7 P10 P14 P15 P16 | Python |
|| 06 | [Kubernetes 的 DevOps 故障排查智能体](phases/19-capstone-projects/06-devops-troubleshooting-agent/) | P11 P13 P14 P15 P17 P18 | Python, TypeScript |
|| 07 | [端到端微调流水线](phases/19-capstone-projects/07-end-to-end-fine-tuning-pipeline/) | P2 P3 P7 P10 P11 P17 P18 | Python |
|| 08 | [生产级 RAG 聊天机器人（受监管垂直领域）](phases/19-capstone-projects/08-production-rag-chatbot/) | P5 P7 P11 P12 P17 P18 | Python, TypeScript |
|| 09 | [代码迁移智能体（仓库级升级）](phases/19-capstone-projects/09-code-migration-agent/) | P5 P7 P11 P13 P14 P15 P17 | Python, TypeScript |
|| 10 | [多智能体软件工程团队](phases/19-capstone-projects/10-multi-agent-software-team/) | P11 P13 P14 P15 P16 P17 | Python, TypeScript |
|| 11 | [LLM 可观测性与评估仪表板](phases/19-capstone-projects/11-llm-observability-dashboard/) | P11 P13 P17 P18 | TypeScript, Python |
|| 12 | [视频理解流水线（场景 → QA）](phases/19-capstone-projects/12-video-understanding-pipeline/) | P4 P6 P7 P11 P12 P17 | Python, TypeScript |
|| 13 | [MCP 服务器与注册表及治理](phases/19-capstone-projects/13-mcp-server-with-registry/) | P11 P13 P14 P17 P18 | Python, TypeScript |
|| 14 | [投机解码推理服务器](phases/19-capstone-projects/14-speculative-decoding-server/) | P3 P7 P10 P17 | Python |
|| 15 | [宪法安全沙箱 + 红队靶场](phases/19-capstone-projects/15-constitutional-safety-harness/) | P10 P11 P13 P14 P18 | Python |
|| 16 | [GitHub Issue 到 PR 自主智能体](phases/19-capstone-projects/16-github-issue-to-pr-agent/) | P11 P13 P14 P15 P17 | Python, TypeScript |
|| 17 | [个人 AI 导师（自适应、多模态）](phases/19-capstone-projects/17-personal-ai-tutor/) | P5 P6 P11 P12 P14 P17 P18 | Python, TypeScript |

</details>

```
░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒
```

## 工具包

每节课产出一个可复用产物。到课程结束时你将拥有：

```
outputs/
├── prompts/      每个 AI 任务的提示词模板
└── skills/       SKILL.md 文件，用于 AI 编码智能体
```

使用 [SkillKit](https://github.com/rohitg00/skillkit) 安装它们。插入到 Claude、Cursor、Codex、OpenClaw、Hermes 或任何兼容 MCP 的智能体中。真正的工具，不是家庭作业。

### 将每节课的技能安装到你的智能体中

仓库在 `phases/**/outputs/` 下提供 373 个技能和 99 个提示词。`scripts/install_skills.py` 遍历每个产物，解析 YAML 前置元数据，并将匹配的文件复制到目标目录中，布局格式符合你的智能体预期。

```bash
python3 scripts/install_skills.py ~/.claude/skills                 # 所有技能，SkillKit 布局
python3 scripts/install_skills.py ./out --type all                 # 技能 + 提示词 + 智能体
python3 scripts/install_skills.py ./out --phase 14                 # 仅一个阶段
python3 scripts/install_skills.py ./out --tag rag                  # 按标签过滤
python3 scripts/install_skills.py ./out --layout flat              # 平面文件而非 SkillKit
python3 scripts/install_skills.py ./out --dry-run                  # 预览而不写入
python3 scripts/install_skills.py ./out --force                    # 覆盖已存在的文件
```

默认情况下，脚本拒绝覆盖已存在的目标文件，并在列出每个冲突路径后以代码 1 退出。使用 `--dry-run` 预览冲突，或使用 `--force` 覆盖。每次非 dry-run 运行都会在目标中写入一个 `manifest.json`，其中包含按类型和阶段分组的完整清单。选择你的智能体读取的布局：

| `--layout`  | 写入路径 |
|---|---|
| `skillkit`  | `<target>/<name>/SKILL.md`（Claude / Cursor / SkillKit） |
| `by-phase`  | `<target>/phase-NN/<name>.md` |
| `flat`      | `<target>/<name>.md` |

### 将智能体工作台导入你自己的仓库

阶段14毕业项目提供一个可复用的智能体工作台包（AGENTS.md、schemas、init / verify / handoff 脚本）。使用以下命令将其脚手架到任何仓库：

```bash
python3 scripts/scaffold_workbench.py path/to/your-repo            # 完整包 + 种子
python3 scripts/scaffold_workbench.py path/to/your-repo --minimal  # 跳过 docs/
python3 scripts/scaffold_workbench.py path/to/your-repo --dry-run  # 仅预览
python3 scripts/scaffold_workbench.py path/to/your-repo --force    # 覆盖
```

你将获得七个已连接的工作台界面、一个起始 `task_board.json` 和一份位于 `schema_version: 1` 的新鲜 `agent_state.json`。从那里：编辑任务，编辑 `AGENTS.md`，运行 `scripts/init_agent.py`，将契约交给你的智能体。包源代码位于 `phases/14-agent-engineering/42-agent-workbench-capstone/outputs/agent-workbench-pack/`。

### 以 JSON 格式浏览整个课程

`scripts/build_catalog.py` 遍历磁盘上的每个阶段、每节课、每个产物，并在仓库根目录写入 `catalog.json`。一个文件，全部课程事实。

```bash
python3 scripts/build_catalog.py               # 写入 <repo>/catalog.json
python3 scripts/build_catalog.py --stdout      # 输出到 stdout，不触碰仓库
python3 scripts/build_catalog.py --out path/to/file.json
```

目录是从文件系统派生的，而非 README，因此计数始终与磁盘上的实际情况一致。将其用于网站构建、下游工具或验证 README 计数是否漂移。模式在脚本顶部有文档说明。

GitHub Action（`.github/workflows/curriculum.yml`）在每次 PR 时重建 `catalog.json`，如果提交的文件已过期则构建失败。编辑任何课程后，运行 `python3 scripts/build_catalog.py` 并提交结果，否则 CI 将拒绝该 PR。同一工作流以 warn-only 模式运行 `audit_lessons.py`（因此现有漂移不会阻止贡献者）。

### 冒烟检查每节课的 Python 代码

`scripts/lesson_run.py` 对每节课 `code/` 目录下的每个 `.py` 文件进行字节编译。默认模式仅进行语法检查——不执行、不需要 API 密钥、不需要重度 ML 依赖。捕获贡献者最常引入的回归（错误缩进、损坏的 f-string、意外编辑）。

```bash
python3 scripts/lesson_run.py                  # 语法检查整个课程
python3 scripts/lesson_run.py --phase 14       # 仅一个阶段
python3 scripts/lesson_run.py --json           # JSON 报告输出到 stdout
python3 scripts/lesson_run.py --strict         # 任何课程失败则以代码1退出
python3 scripts/lesson_run.py --execute        # 实际运行，每节课超时10秒
```

`--execute` 运行每节课的 `code/main.py`（或第一个 `.py` 文件），超时10秒。入口文件以 `# requires: pkg1, pkg2` 注释列出非标准库依赖的课程将被跳过，原因为 `needs <deps>`。该脚本是选择加入的，未接入 CI。

仅限标准库，Python 3.10+。设置 `LINK_CHECK_SKIP=domain1,domain2` 以覆盖默认的跳过列表（`twitter.com`、`x.com`、`linkedin.com`、`instagram.com`、`medium.com`——积极阻止自动化 HEAD/GET 的域名）。

```
░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒
```

## 从哪里开始

|| 背景 | 从……开始 | 预估时间 |
||---|---|---|
|| 编程和 AI 新手 | 阶段0 — 环境搭建 | ~306 小时 |
|| 懂 Python，AI 新手 | 阶段1 — 数学基础 | ~270 小时 |
|| 懂 ML，深度学习新手 | 阶段3 — 深度学习核心 | ~200 小时 |
|| 懂深度学习，想要 LLM 和智能体 | 阶段10 — 从零构建 LLM | ~100 小时 |
|| 高级工程师，只想要智能体工程 | 阶段14 — 智能体工程 | ~60 小时 |

```
░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒
```

## 为什么这很重要

<table>
<tr>
<th align="left" width="50%"><sub>FIG_003 · A</sub><br/><b>行业信号</b></th>
<th align="left" width="50%"><sub>FIG_003 · B</sub><br/><b>涵盖的基础论文</b></th>
</tr>
<tr>
<td valign="top">

> *"最热门的新编程语言是英语。"*<br/>
> — **Andrej Karpathy** ([推文](https://x.com/karpathy/status/1617979122625712128))

> *"软件工程正在我们眼前被重塑。"*<br/>
> — **Boris Cherny**，Claude Code 创始人

> *"模型会持续变好。会复合的技能是**知道要构建什么**。"*<br/>
> — 行业共识，2026

</td>
<td valign="top">

- *Attention Is All You Need* — Vaswani et al., 2017 → [阶段7](#phase-7)
- *Language Models are Few-Shot Learners* (GPT-3) → [阶段10](#phase-10)
- *Denoising Diffusion Probabilistic Models* → [阶段8](#phase-8)
- *InstructGPT / RLHF* → [阶段10](#phase-10)
- *Direct Preference Optimization* → [阶段10](#phase-10)
- *Chain-of-Thought Prompting* → [阶段11](#phase-11)
- *ReAct: Reasoning + Acting in LLMs* → [阶段14](#phase-14)
- *Model Context Protocol* — Anthropic → [阶段13](#phase-13)

</td>
</tr>
</table>

```
░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒
```

## 贡献

|| 目标 | 阅读 |
||---|---|
|| 贡献一课或修复 | [CONTRIBUTING.md](CONTRIBUTING.md) |
|| 为你的团队或学校复刻 | [FORKING.md](FORKING.md) |
|| 课程模板 | [LESSON_TEMPLATE.md](LESSON_TEMPLATE.md) |
|| 追踪进度 | [ROADMAP.md](ROADMAP.md) |
|| 术语表 | [glossary/terms.md](glossary/terms.md) |
|| 行为准则 | [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) |

提交课程之前，运行不变式检查：

```bash
python3 scripts/audit_lessons.py           # 完整课程
python3 scripts/audit_lessons.py --phase 14  # 单个阶段
python3 scripts/audit_lessons.py --json    # CI 友好输出
```

退出代码在任何规则失败时非零。规则（L001–L010）验证目录形状、`docs/en.md` 存在 + H1、`code/` 非空、`quiz.json` 模式（拒绝导致问题 #102 的旧版 `q/choices/answer` 键）以及课程文档内的相对链接。

```
░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒
```

## 赞助这项工作

免费，MIT 协议，435 节课。课程仅通过赞助维持。仅接受现金。

**触达（已验证 2026-05-14）：** 55,593 月访问者 · 90,709 页面浏览量 · 7.5K 星标 ·
Twitter/X 是 #1 获客渠道。

| 层级 | $/月 | 你将获得 |
|------|------|---|
| 支持者 | $25 | 名字出现在 BACKERS.md |
| 铜牌 | $250 | README 赞助区块纯文本行 + 发布日推文 |
| 银牌 | $750 | README 小 logo + 列为 API 课程中的一个支持提供商 |
| 金牌 | $2,000 | README 首屏上方大 logo + 季度 X / LinkedIn 联合特写 |
| 白金 | $5,000 | 首屏上方英雄 logo + 一个专属集成课程，最多1个合作伙伴 |

完整价目表、严格规则、定价锚点和触达数据：[SPONSORS.md](SPONSORS.md)。
通过 [GitHub Sponsors](https://github.com/sponsors/rohitg00) 注册。

```
░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒░░░▒▒▒
```

## Star 历史

<a href="https://star-history.com/#rohitg00/ai-engineering-from-scratch&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repo=rohitg00/ai-engineering-from-scratch&type=Date&theme=dark">
    <img alt="Star history" src="https://api.star-history.com/svg?repo=rohitg00/ai-engineering-from-scratch&type=Date" width="100%">
  </picture>
</a>

如果这本手册对你有帮助，请给仓库点星。这让项目保持活力。

## 许可证

MIT。随便你怎么用——复刻它、教授它、售卖它、发布它。注明出处感激不尽，但不是必须的。

由 [Rohit Ghumare](https://github.com/rohitg00) 和社区维护。

<sub>
  <a href="https://x.com/ghumare64">@ghumare64</a> &nbsp;·&nbsp;
  <a href="https://aiengineeringfromscratch.com">aiengineeringfromscratch.com</a> &nbsp;·&nbsp;
  <a href="https://github.com/rohitg00/ai-engineering-from-scratch/issues/new/choose">报告 / 建议</a>
</sub>
