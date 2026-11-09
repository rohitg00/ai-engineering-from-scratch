# 标准:SWE-bench,GAIA,代理Bench

> 据了解,在2026年,SWE-Bench测试了代码补丁.GAIA测试了一般主义工具使用.AgentBench测试了多环境推理.了解它们的组成,污染史,以及它们不测量什么.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 06 (Tool Use)
**Time:** ~60 minutes

## 学习目标

- 命名SWE-bench的试验带 (FAIL_TO_PASS) 并解释为什么它在单元测试中被关闭.
- 解释为什么SWE-bench Verified (OpenAI,500任务) 存在以及它删除的内容.
- 描述GAIA的设计:对于人类来说简单,对人工智能来说难以做到;三个难度级别.
- 给 AgentBench 的八个环境命名,
- 概述SWE-bench+污染发现及其影响.

## 问题

排名表告诉你哪个模型在一个基准上获胜.

- 基准指标是否受污染 (训练数据中的解决方案,测试泄漏).
- 基准测量你关心什么 (代码与浏览与通用).
- 评估人员是否强 (AST匹配,状态检查,人检查).

在引用数字之前,了解三个定基准及其故障模式.

## 概念

### 子 (Jimenez et al., ICLR 2024 口头)

- 通过12个受欢迎的Python存储器,
- 代理得到:预设提交的代码基础+自然语言问题描述.
- 代理生产:一个补丁.
- 评估器:应用补丁,运行 repo 的测试套件.补丁必须在不打破 PASS_TO_PASS 测试的情况下翻转 FAIL_TO_PASS 测试 (以前失败,现在通过).

通过强调代理-计算机接口 (文件编辑器命令,模型理解的搜索语法) 发布时,SWE-agent (Yang等,2024) 达到12.5%.

### 证实的SWE位

开放AI,2024年8月. 人为主办的500项子集. 消除了模糊的问题,不可靠的测试和未明确的任务. "你的代理是否会发送真实的补丁?"的主要基准.

### 污染

- 超过94%的SWE台问题都在大多数车型的截止之前.
- **SWE-bench+**发现32.67%的成功补丁在问题文本中泄露了解决方案 (模型在描述中看到修正),31.08%由于测试覆盖率低而可疑.
- 检测到的清洁,但没有污染.

实际含义:在SWE-bench上得分50%的模型可能在SWE-bench上得分35%.

### 其他国家:

- 466个问题;在 huggingface.co/gaia-benchmark上保留了300个问题.
- 设计理念:"对人类 (92%) 构想简单,但对人工智能 (GPT-4 附加插件:15%) 难以理解.
- 测试推理,多种方式,网络,工具使用.
- 难度级别为三级;第三级要求在各种模式中使用长长的工具链.

对于一般性能力来说, GAIA是指测量"一般性能力".

### 博公司 (Liu et al., ICLR 2024)

- 通过代码 (Bash, DB, KG),游戏 (Alfworld, LTP),网络 (WebShop,Mind2Web) 和开放式生成的环境.
- 几轮,每分别的4K-13K转.
- 基本发现:长期推理,决策和指导是OSS LLM追赶商业的阻碍者.

### 这些都不衡量

- 实际运营成本 (代币,墙钟).
- 在不利条件下安全行为.
- 您的域名表现 (使用您自己的评价,30课).
- 尾部故障 (标准平均值;生产经营者关注最差的1%).

### 基准分析失败的地方

- **Single-number fixation.**利率50%比P50/P75/P95成本+阶段分布低.
- **Contaminated claims.**报告SWE-bench而不提到 Verified或SWE-bench+是误导性的.
- **Benchmark-as-development-target.**优化基准与生产有用性不同.

```figure
ae-swebench-gate
```

## 建立它

`code/main.py`装备一个玩具SWE子式带:

- 合成 bug-fix任务 (3项任务).
- 一个编写的"代理"提出补丁.
- 检查 FAIL_TO_PASS (bug已修复) 和 PASS_TO_PASS (没有任何故障) 的测试运行器.
- 基于问题分解深度的GAIA类型难度分类器.

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

输出显示每个任务+每个难度的分辨率,使评估者规则具体化.

## 用它

- **SWE-bench Verified**对于代码代理,总是报告验证的成绩.
- **GAIA**对于一般主义代理人,使用私人排名板分.
- **AgentBench**对于多环境比较.
- **Custom evals**对于产品的实际形状.

## 运送它

`outputs/skill-benchmark-harness.md`构建任何具有 FAIL_TO_PASS / PASS_TO_PASS 盖特的代码基础任务对象的SWE-bench式带.

## 运动

1. 输入玩具带以运行一个真正的 repo (选择一个你的).写3个 FAIL_TO_PASS测试已知 bug.
2. 在你的3个任务中,每分辨率有多少代理步骤?
3. 阅读SWE-bench+论文. 执行解决方案泄漏检查 (图案与问题文本相匹配).
4. 查看一个GPT-4类的代理会做什么.
5. 读取 AgentBench 的环境分解. 哪个环境反映你的产品表面?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SWE-bench | "Code agent benchmark" | 2,294 GitHub issues; patch must flip FAIL_TO_PASS tests |
| SWE-bench Verified | "Clean SWE-bench" | 500 human-curated tasks, OpenAI |
| FAIL_TO_PASS | "Fix gate" | Tests previously failing that must pass after the patch |
| PASS_TO_PASS | "No-regression gate" | Tests that were passing and must still pass |
| GAIA | "Generalist benchmark" | 466 human-easy / AI-hard multi-tool questions |
| AgentBench | "Multi-env benchmark" | 8 environments; long-horizon multi-turn |
| Contamination | "Training-set leak" | Benchmark tasks present in model training |
| SWE-bench+ | "Contamination audit" | 32.67% solution leakage found in successful SWE-bench patches |

## 进一步阅读

- [Jimenez et al., SWE-bench (arXiv:2310.06770)](https://arxiv.org/abs/2310.06770)原始基准
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) 选定的子集
- [Mialon et al., GAIA (arXiv:2311.12983)](https://arxiv.org/abs/2311.12983)一般性基准
- [Liu et al., AgentBench (arXiv:2308.03688)](https://arxiv.org/abs/2308.03688)多环境套件
