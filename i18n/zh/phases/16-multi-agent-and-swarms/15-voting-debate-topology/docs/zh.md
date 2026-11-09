# 投票,自主一致性和辩论拓

> 最便宜的集成:样本N独立代理,多数投票.王等. 2022自律性这样做了,一个模型采样N次.多代理扩展它**heterogeneous**为了逃脱单种植的代理人 不同的模型,不同的提示,不同的温度,不同的背景.除了多数投票之外,辩论的拓学问题:多代理银行 (arXiv:2503.01935,ACL 2025) 评估了星/链/树/图表协调并发现**graph best for research**根据"合作税"的规定,在过去的4个代理人中,有"协调税". AgentVerse (ICLR 2024) 记录了两个新兴模式:志愿者行为和合规行为,合规既是一种特征 (寻找共识),也是一个风险 (团体思维,24课).本课程将拓空间映射,构建每个变体,并测量协调税.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 14 (Consensus and BFT)
**Time:** ~75 minutes

## 问题

辩论可以提高准确性 (Du et al., arXiv:2305.14325).

1. 谁和谁谈话 (拓学).
2. 几次弹 (Du 2023:弹和代理都独立重要).
3. 药物是否异质 (不同基模型可以破坏单种植).
4. 存在否对抗声音 (钢管对草管).

团队"运行5个代理和投票"在一个任务上经常退缩而对待一个代理.失败不是随机的.他们跟踪拓和异性.这个课程是拓地图.

## 概念

### 单个模型的基线

张及其他研究人员在2022年 (自律改善思想推理链) 采样了相同的模型N次在温度>0和多数投票在推理路答案.GSM8K的结果:在单个贪解码中获得N=40样本的实质性收益.自律是单代理投票的前身.

极限:自相一致性使用一个基模型.错误是通过构建相关的.如果模型有系统偏见,所有N样本都会分享它.

### 多代理投票,异质扩展

取代N样本用N *不同的*代理.不同的基模型 (Claude,GPT,Llama),不同的提示,不同的工具访问. 优势:无关错误.成本:不同的代理成本不同;协调它们增加了总费用.

异质辩论的2026年法典名称是**A-HMAD** 异质多代理辩论. 并不是普遍采用的,但论文使用这个术语来表示"不同模式辩论,这减少了单种植崩的相关错误".

### 它们的四个拓

```
star                chain               tree                graph

    ┌─A─┐           A─B─C─D         ┌──A──┐              A───B
    │   │                           │     │              │ × │
    B   C                           B     C              D───C
    │   │                          / \   / \
    D   E                         D   E F   G           (fully connected)
```

星座:一个枢纽,其他所有人都只与枢纽交谈.相当于没有后通道的监督员工.
链:线性,每个代理都能看到前一个输出.
树:层次,由层次代理系统使用 (课程 06).
图:任何一个. 包括完全连接的小伙子和任意的DAG.

### 协调税 (多代理银行)

多代理位 (MARBLE, ACL 2025, arXiv:2503.01935) 在包括研究,编码和规划在内的任务套件上标记了恒星,链,树,图表.主要测量结果:

- **Graph**信息流向任何人,代理人可以互相批评.
- **Star**快速答复的实际任务中获胜.
- **Chain**逐步管道的胜利 (逐步精炼).
- **Coordination tax**图表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表表

对于4个代理的限额来说,这是一种经验性而不是基本的限额.它反映了2026年LLM环境能力:每个代理的环境都充满了同行产品,并且当每个人都能看到每个人的后,添加代理N+1的边际值会下降.

### 许多代理商的辩论策略 ("我们应该疯狂吗?")

arXiv:2311.17371是2023年MAD战略调查.其他研究人员复制的关键发现:MAD变体 (结构性类似于自相一致性 (独立采样+集) 在使用相同的预算时通常表现得不一致.MAD在代理人真正异质性和辩论有对立结构时最有帮助 (一个代理人反对).

### 代理 变化模式

经验人员:https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) 文件文件指出,即使没有明确的设计,也存在两种行为,这些行为来自多代理辩论:

- **Volunteer.**代理人提供帮助 ("我可以采取下一步") 没有提醒.有用:它将工作分配给最有能力的代理人进行子任务.
- **Conformity.**经纪人调整自己的立场,使其与批评者相匹配,即使批评者是错误的.

合规性是为什么辩论到达协议奖励欺凌者.

### 异质性:实际的按移动精度

实际文献中的2024-2026年模式:将N代理中的一个换成不同的基模型,比增加N1的精度增加更大.直觉是单种,每个新的独立错误源价值超过额外的相关样本.

在极限中,异质性比多数性更大.三种不同的模型在大多数具有清洁的基础真相的任务上,

### 评审团的方法

根据"西比尔框架" (引用于明斯基-LLM文献) 正式化了"陪审团" (Jury) ,是一个小组专业代理人通过投票在每个阶段来精细化答案.与普通多数投票不同,陪审团的角色是:一个代理人进行反审,一个提供文本,一个评审团的可靠性.陪审团方法是平凡投票 (廉价,单独文化倾向) 和完整的MAD (昂贵,符合性倾向) 之间的中点.

### 投票与辩论主导

- 投票相近是有意义的.
- 代理人可以访问不同的来源或工具 (异性可用).
- 轮子是有限的 (2-3典型) 有一个独立的法官或验证者.
- 预算允许3-5个代理人. 在图表拓学上,协调税占主导地位.

### 投票与辩论伤害时

- 调查人员会一致地回答最自信的答案,而不是最正确的答案.
- 单种文化使得共识毫无意义.
- 轮子无限,每次都会有符合性.
- 只有一个具有N=5的自律性的代理,更便宜,更准确.

```figure
sw-debate-topology
```

## 建立它

`code/main.py`执行:

- `run_star(agents, hub, question)`各工人中心调查,总计.
- `run_chain(agents, question)` 顺序精炼
- `run_tree(root, children, question)`层次性,深度-2集成.
- `run_graph(agents, question, rounds)`全面辩论,有限的轮回.
- 编写异性数:每个代理都有一个`error_bias`表明其系统性错误.
- 测量带,每个拓在N=3,5,7运行,并报告 (准确性,总_代码,壁表_模拟).

运行:

```
python3 code/main.py
npx tsx code/main.ts
```

预期输出:顶级表 × N → (精度,代币,延迟). 在研究类型任务上,图表在 N=3-5 时获胜;在快速事实任务上,星星获胜;在 N=7 的图表显示协调税 (延迟比精度更快膨胀).

## 用它

`outputs/skill-topology-picker.md`是一个阅读任务描述的技能,并建议一个拓学 (星/链/树/图),一个N (代理人数),一个异质性配置文件 (使用的基模型) 和一个圆的界限.

## 运送它

对于任何组件:

- 开始**self-consistency at N=5**根据一个强大的基调模型.
- 升级到**heterogeneous voting at N=3**如果准确性重要, 测量三角洲.
- 只有升级到**debate topology**如果任务有结构 (研究,多步骤) 和有限的轮子是可行的.
- 总是记录少数群体. 当少数群体持久地对时,你会得到多样性信号.
- 通过"十倍成本更好的准确性"是商业决定.

## 运动

1. 跑步`code/main.py`图表表顶级的协调税曲线:准确度与N,代币与N.曲线在哪个N上曲折?
2. 如何将完全相同的偏见基线与14课单种植攻击的A-HMAD相比?
3. 增加一个"评判"角色,它不会投票,只能获得最终共识.
4. 您可以通过快速改变,引发相反的行为吗?
5. 阅读多代理位 (arXiv:2503.01935) 第4节 (拓学实验).使用你的带,从纸上复制一个任务的"图表-获胜-研究"结果.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Self-consistency | "Sample N times, vote" | Wang 2022. Single model, N temperature>0 samples, majority vote on reasoning paths. |
| Heterogeneity | "Different models" | Ensemble of different base models or prompt families. Breaks monoculture. |
| MAD | "Multi-agent debate" | Generic term for agents exchanging critiques over rounds. See Du 2023. |
| A-HMAD | "Adversarial Heterogeneous MAD" | MAD variant emphasizing different models + adversarial structure. |
| Topology | "Who talks to whom" | Star, chain, tree, graph. Determines information flow. |
| Coordination tax | "Diminishing returns" | Above ~4 agents on graph, cost grows faster than quality. |
| Volunteer behavior | "Unprompted help" | AgentVerse emergent pattern: an agent offers to take a step. |
| Conformity behavior | "Agreement under pressure" | AgentVerse emergent pattern: an agent aligns with a critic. |
| Jury | "Small specialized panel" | Sibyl-style ensemble with roles (examiner, context, scorer). |

## 进一步阅读

- [Wang et al. — Self-Consistency Improves Chain of Thought Reasoning](https://arxiv.org/abs/2203.11171)单个模型的基准
- [Du et al. — Improving Factuality and Reasoning via Multiagent Debate](https://arxiv.org/abs/2305.14325) 两种代理和轮子都独立重要
- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935)标题表表图最适合研究,管道链
- [Should we be going MAD?](https://arxiv.org/abs/2311.17371) MAD战略调查;发现MAD经常因同等预算而失败于自律性
- [AgentVerse (ICLR 2024)](https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf)志愿者和合规性新出现模式
- [MARBLE repo](https://github.com/ulab-uiuc/MARBLE) 参考基准实施
