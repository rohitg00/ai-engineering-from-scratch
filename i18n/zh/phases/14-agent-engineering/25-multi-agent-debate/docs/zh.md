# 多代理商辩论和合作

> 杜等人 (ICML 2024,"思想社会") 运行了N模型实例,独立提出答案,然后在R轮中反复批评彼此,以融合.改善事实性,遵循规则,推理.节省拓学在代币成本上击败了全网网.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 05 (Self-Refine and CRITIC)
**Time:** ~60 minutes

## 学习目标

- 解释辩论协议:N提案者,R轮,汇聚在一个共享的答案.
- 描述为什么争论会改善事实,规则和推理.
- 解释稀少的拓:不是每个辩论者都需要互相见面.
- 实施一个关于一个编写的LLM的SDLL辩论,其中包括全网和稀缺的变体;衡量代币成本与准确性.

## 问题

自我清理 (课05) 是一种自我批评模式. 风险群思. 批评 (课05) 在外部工具中不总是可用. 辩论引入第三种模式:多种实例,交叉批评,通过分歧的融合.

## 概念

### 思想社会 (Du et al., ICML 2024)

- 模型实例独立提出答案.
- 在R轮中,每个模型都会阅读其他模型的建议并批评它们.
- 模型根据批评更新了他们的答案.
- 在R轮之后,返回相近的答案.

由于成本,原始实验使用了N=3,R=2.随着更多的代理和更多的重题 (MMLU,GSM8K,象棋移动有效性,传记生成) 的精度提高.

跨型组合比单个模型辩论更好:ChatGPT + Bard 合一 > 单独.

### 光顶点

"通过缩通信拓学改进多代理辩论" (arXiv:2406.11776, 2024-2025) 显示,全网辩论并不总是最佳.缩拓学 (星,环,枢纽和口) 可以以较低的代币成本匹配精度.每个辩论者只看到一小组同行.

影响:

- 满网N=5,R=3 =5 ×3 =15个提案,每一个阅读4个同行 =60个评论.
- 星座N=5,R=3 (一个中心+4个口) =15个提案,口号只读到中心 =12个批评行动.

### 辩论有什么帮助

- **Factuality.**独立的提案,反检查减少了幻觉.
- **Rule-following.**,一个模型错过了一个规则,其他人抓住了它.
- **Open-ended reasoning.**许多框架限制了正确的答案.

### 当辩论痛

- **Latency-sensitive UX.**没有的延迟.
- **Cost-sensitive scale.**按问题每一个N × R代码.
- **Simple factual lookups.**一次查询比五次辩论便宜.

### 2026 实用实例

- **Anthropic orchestrator-workers**一个由合成步骤组成的辩论的变体.
- **LangGraph supervisor**中央路由器+专业代理可以作为节点实现辩论.
- **OpenAI Agents SDK**代理人向前向后转移,以进行反复批评.
- **Multi-agent evals**对辩论+评估信号的评估优化器.

### 在这个模式出现错误的地方

- **Convergence collapse.**所有代理人都会在第一个错误答案上聚合,
- **Hub failure.**在恒星拓中,一个坏的枢纽会破坏所有人.
- **Prompt homogenization.**所有代理都使用相同的提示,它们都产生相同的答案.

```figure
debate-converge
```

## 建立它

`code/main.py`执行了SDLIB辩论:

- `Debater`专业的专业知识 (专业的专业知识)
- `FullMeshDebate`其他`SparseDebate`跑步者.
- 问题是三个:一个是事实性的,一个是基于规则的,一个是推理性的.
- 标准: 接近答案,转到接近,总批评行动.

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

产量:每项协议的准确性和成本;少量匹配的 2/3 问题以更低的成本.

## 用它

- **Anthropic orchestrator-workers**对于 2-3 个工人来说,
- **LangGraph**对于国家多轮辩论,
- **Custom**对于研究或专业准确性保证.

## 运送它

`outputs/skill-debate.md`设置一个多代理辩论,设置可组装的拓学,N,R,并设置一个趋同规则.

## 运动

1. 实施"强制不一致"规则:在第1轮,每个辩论者都必须提出一个不同的建议.
2. 增加一个以信心为重量的聚合物:辩论者回来 (答案,信心);聚合物按信心重量.
3. 换一个"代理"换一个不同观点的法学士.
4. 根据你的3个问题,测量全网格与稀少的代币成本.
5. 读一读"心智协会"的论文.把玩具转移到N=5,R=3.什么会打断?什么会变得更好?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Debate | "Multi-agent critique" | N proposers, R rounds of cross-critique, converge |
| Full mesh | "Everyone reads everyone" | Every debater reads every peer each round |
| Sparse topology | "Limited peer view" | Debaters read only a subset of peers |
| Hub-and-spoke | "Star topology" | One central debater, N-1 spokes read only the hub |
| Convergence | "Agreement" | Debaters converge on a shared answer |
| Society of Minds | "Du et al. debate paper" | ICML 2024 multi-agent debate method |

## 进一步阅读

- [Du et al., Improving Factuality and Reasoning in Language Models through Multiagent Debate (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325)多代理论坛
- [Sparse Communication Topology (arXiv:2406.11776)](https://arxiv.org/abs/2406.11776)稀有的拓结果
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) 作为辩论变体的管弦乐员工
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651)单个模型的自我批判对手
