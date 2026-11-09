# 工坊级自主研究

> 萨卡纳的AI科学家 v2 (Yamada等, arXiv:2504.08066) 运行了整个研究循环:假设,代码,实验,数字,写作,提交. 这是第一个在ICLR 2025研讨会上进行的纸质合格同行审查的系统. 独立评估 (Beel等人) 发现, 42% 的实验失败于编码错误, 萨卡纳的医生警告说,该代码基础执行了LLM编写的代码, 这两个图片的两半都是重点.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, research-loop state-machine toy)
**Prerequisites:** Phase 15 · 03 (AlphaEvolve), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## 问题

研究是一个无限任务.与AlphaEvolve的算法搜索或DGM的基准限制自我修改不同,研究结果没有机器可检查的正确度标准.论文由评论员评判,而不是单元测试.这使循环更难关闭,并且更有价值,因为研究是复合进步的所在.

通过从人类创作的模板开始,AI科学家v1 (Sakana,2024) 关闭了循环. 法律法师在固定架子内进行了实验. AI科学家 v2 (Yamada等, 2025) 通过使用视觉语言模型批评循环的代理树搜索来删除模板要求. 该系统产生想法,实施实验,产生数字,写论文,并反复评论者的反.

专业评审判决:在ICLR 2025研讨会上接受了一份v2生成的论文 (含披露).独立评价判决:系统远非可靠.这两者都是真的.

## 概念

### 建筑

1. **Idea generation.**专业士提出了基于主题和先前文献的研究想法. v1使用模板; v2使用在假设领域的代理搜索.
2. **Novelty check.**文献检索步骤检查了这个想法是否已发表.这是Beel等人评估发现错误标签的步骤.
3. **Experiment plan.**经纪人起草了实验协议,并编写了代码.
4. **Execution.**在比尔等的测量中, 42% 的实验在这个阶段失败于编码错误.
5. **Figure generation.**视觉语言模型读取生成的数字并重新写出它们以确保清晰度.这是v2的关键技术补充.
6. **Writeup.**法律士编写一篇论文,与内部审查员进行反复.
7. **Optional: submission.**报纸提交给一个场所.

### 工作室接受结果意味着什么

一份v2生成的论文在ICLR 2025研讨会上通过了同行评审.作者向计划委员会披露了论文的起源.接受是数据点;它不是声称系统"进行研究"的许可.

重要背景:研讨会论文比主要会议论文低.同行评审很;在任何一天都会接受小部分提交.一个成功是概念证明,而不是可靠性声明.Nature 2026论文记录了端到端循环,它本身是由人类研究人员共同撰写的;它不是"系统写了一篇 Nature论文".

### 独立评估发现的结果

贝尔等人 (arXiv:2502.14297) 进行了外部评估.

- **Experiment failures.**42%的实验因编码错误 (不良进口,形状不匹配,未定义变量) 失败.
- **Novelty mislabeling.**文献检索步骤经常标记既定概念为新奇.
- **Presentation-quality gap.**视觉语言的形象批评产生了出版级的视觉,掩盖了潜在的实验弱点.

对于这一阶段,最后一个发现是重要的.一个系统,在没有做出说服力的研究的情况下产生令人信服的结果,比一个明显失败的系统更危险,更安全.

### 沙箱逃走问题

萨卡纳自己的存储库 README警告说:

> 由于该软件的性质,它执行了LLM生成的代码,我们无法保证安全. 有危险的包裹的风险,不受控制的网络访问,以及不预期的过程的产卵.

没有一个沙盒,严格限制文件系统,网络和过程操作,任何自主导的研究代理都可以将数据泄露,烧毁计算或重写自己.

由于其评估器紧密,AlphaEvolve的沙盒故事更容易.AI Scientist v2的循环运行开放式代码,具有开放式目标.这就是为什么它需要更强大的隔离 (Docker最小;seccomp/gVisor优先) 和离开系统之前手动审查每个提交.

### 在边境堆中,v2

| System | Target | Output kind | Evaluator | Known failure |
|---|---|---|---|---|
| AlphaEvolve | algorithms | code | unit + benchmark | bounded by evaluator rigor |
| DGM | agent scaffolding | code | SWE-bench | reward hacking |
| AI Scientist v2 | research papers | text + code + figures | peer review (weak) | experiment failures, mislabeling, polish masking weakness |

系统的安全性控制系统 (沙箱,审查,披露) 完成了大部分安全工作.

```figure
mx-research-loop
```

## 用它

`code/main.py`模拟v2循环作为状态机:想法 →新奇检查 →实验 →图像 →写作 →评论 →接受或述.每个状态具有可配置的故障概率,从Beel等研究结果中抽取.运行模拟器为N循环并计算:

- 许多想法都会得到提交.
- 磨纸隐藏了多少件临界实验缺陷.
- 如何重新尝试预算,

## 运送它

`outputs/skill-ai-scientist-sandbox-review.md`检查任何由研究循环代理产生的东西,

## 运动

1. 跑步`code/main.py`根据"环节运行"的部分,产生了"清洁"的纸. 根据"试验失败缺陷"的部分,产生了"清洁"的纸.

2. 违约的数据已经使用了Beel等的42% /25%.`--experiment-failure 0.20 --novelty-mislabel 0.10`然后是`--experiment-failure 0.60 --novelty-mislabel 0.40`两次运行之间,抛光但缺陷的股票如何转移?

3. 阅读Sakana的AI科学家 v2 repo README关于沙箱要求. 举个两个额外的限制 (除了Docker) 你会申请多天自动运行.

4. 阅读Beel等人 第4节关于表达质量差距. 设计一个额外的评估器,可以捕获看起来很好,但实验上有缺陷的论文.

5. 提出一个对研究人员产生的研究结果进行人为审查的协议,比"博士阅读每篇论文"更好.

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| AI Scientist v1 | "Sakana's templated research agent" | Filled experiments into a fixed scaffold |
| AI Scientist v2 | "Template-free research agent" | Agentic tree search with VLM figure critique |
| Agentic tree search | "Branching research agent" | Expands multiple experiment plans in parallel; prunes by internal critic |
| Vision-language critique | "VLM polish on figures" | Multimodal model reads figures and rewrites them for clarity |
| Literature retrieval | "Novelty check" | Searches prior work to confirm idea novelty — documented to mislabel |
| Polish masking | "Pretty paper, broken research" | Presentation quality exceeds experimental quality; hides weaknesses |
| Sandbox escape | "LLM code breaks out" | Agent-executed code does things the loop designer did not intend |

## 进一步阅读

- [Yamada et al. (2025). The AI Scientist-v2](https://arxiv.org/abs/2504.08066)纸
- [Sakana blog on the Nature 2026 publication](https://sakana.ai/ai-scientist-nature/)供应商总结与同行评审背景.
- [Beel et al. (2025). Independent evaluation of The AI Scientist](https://arxiv.org/abs/2502.14297)外部评估数字.
- [Sakana AI Scientist v1 paper](https://arxiv.org/abs/2408.06292)模板前身.
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy)更广泛的开放研究机构框架.
