# 和! 推理

> 投机解码 (阶段10·15) 在一个序列内并行化代币. 多代理框架在整个序列中并行,但强加明确的协调 (投票,分分类子任务). 霍格威尔德! 推理 (Rodionov等人, arXiv:2504.06261) 还有其他功能:与 SHARED 密钥值缓存相对并行运行相同的LLM的 N 实例. 每个工人都会立即看到其他工人的代币. 现代推理模型可以通过共享缓存进行自我协调, 这种方法是实验性的,但它开辟了一个完全新的推理平行性轴, 这一课实践了两个工人的霍格威尔德! 模拟器在Stdlib Python中,并解释了为什么共享缓存协作来自现有模型的推理能力.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 10 · 12 (inference optimization), Phase 10 · 15 (speculative decoding)
**Time:** ~60 minutes

## 学习目标

- 描述三个常见的平行LLM拓 (投票,子任务,霍格威尔德!) 以及每个目标的问题的名字.
- 描述霍格威尔德的核心设置:多名员工,一个共享的KV缓存,自动调整的即时协调.
- 根据工人数量计算Hogwild的墙时速度`N`任务水平平行性`p`协调总费`c`现在,我们要去.
- 执行一个玩具问题上的两个工人Hogwild!模拟器,并观察新兴任务分类.

## 问题

现代的LLM通过产生长链的推理来解决困难问题. 步骤逻辑的5000个代币是常见的,在深层数学问题上发生了数万个代币.在70B模型上的35个代币/秒解码时,50k代币是24分钟.互动模型不是.

预测解码 (阶段10·15) 通过在一个序列内并行化,使您获得3-5倍的速度.之前的自行降解解码的序列依赖性是硬天花板.每个新代币取决于每个先前代币.

问题是:我们可以在序列中并行化吗?我们可以在同一问题上运行相同模型的多个副本,让它们合作,让它们分开工作吗?

之前的工作:投票集团 (运行N模型,选择多数答案),思维树 (分支推理路径和重组),多代理框架 (分配每个代理子任务,使用协调员).这些都帮助特定任务领域.它们都引入了明确的协调机械投票规则,分支和调逻辑,代理到代理消息协议.

霍格威尔德! 推理采用了不同的方法. 工人共享一个KV缓存. 每个工人都会立即看到其他工人的代币, 工人没有任何培训或细节调整 想出如何分工. 现代推理模型 (QwQ,DeepSeek-R1,Claude-family推理模式) 可以读取共享缓存,说"我看到工人2已经处理了基因案例,所以我会在诱导步骤上工作".

速度提升将在2026年4月开始依赖工作负载,并且是实验性的.

## 概念

### 设置

启动N员工进程,所有运行相同的LLM. 代替每员工KV缓存,保持一个共享缓存. 当员工 `i`产生标志`t_j`作为一个工作者,`k`现在,它会读取存储库的现状 (包括所有N员工迄今为止所生成的所有内容).

工作人员在步骤时间上竞争写代币.没有每个工作者位置指数.缓存是一个单个成长序列.顺序由写到达时间决定.

### 为什么协调出现

工人分享一个提示. 通常是这样的:"你是N个例子之一,一起解决这个问题. 每个实例都会阅读共享记忆, 避免过剩的工作". 提示加上共享缓存是足够的. 推理模型读取缓存,注意到问题已经尝试过哪些部分,并 (通常但并不总是) 转向未被探索的部分.

霍格威尔德!论文 (罗迪诺夫等人,2025) 报告了如下观察:

- 工人通过缓存编制计划,并通过缓存将其传达给其他工人.
- 工人注意到其他工人的推理错误,
- 工人适应计划失败,并提出替代方案.
- 当被要求检查是否有失业时,

现在的行为源于模型已经有了推理能力.

### 命名

该论文的名称是基于Hogwild! SGD (Recht et al., 2011),一个异步更新优化器.比喻:SGD的异步工人都写到共享参数向量;Hogwild!Inference的工人都写到共享的KV缓存.这两者都依赖于实验式融合而不是同步化保证.

### PE使得这种方法易于处理

转动位置嵌入式 (RoPE, Su等. 通过Q和K向量旋转编码位置信息. 由于旋转查询和旋转键之间的注意力分数仅取决于它们的相对距离,因此整个缓存输入块可以在不需要重新计算的情况下转移到新的偏移:转换查询,而不是重新转换每个缓存键. 霍格威尔德! 输入每一个缓存块上一次:在位置查询中`i_q`并且一个从`i_k`根据工作者看来,查询由相对距离旋转.`i_q - i_k`通过移动单个代币到不同的位置将改变它们的旋转,仍然需要重新计算.

在学习位置或绝对位置模型中,Hogwild!在每一次同时写作时都需要缓存无效. RoPE使缓存保持稳定.

### 时间的数量

让我们`T_serial`让一个工人独自解决问题.`p`现在,我们可以将其变为一个任务级平行式分数.`c`需要按步骤协调的总费 (阅读扩展缓存,决定要写什么).

单职员工时间: `T_serial`现在,我们要去.
工作者霍格威尔德!时间,如果协调是免费的: `T_serial * ((1 - p) + p / N)`经典的阿姆达尔.
协调总费:`T_serial * ((1 - p) + p / N) + c * steps_per_worker`现在,我们要去.

为了让一个工人能产生生长,`c`在一个步骤的解码时间相比较小.在产生5k+代币的推理模型上,工人可以承担数百个协调代币,但仍然可以领先.在短聊天任务上,协调占主导地位,而Hogwild!比串行更糟.

### 具体的例子

问题: 10万个思想链的代币.`p = 0.7`具有可并行的内容 (不同的证明策略,不同的案例分析)`c = 200`工作人员的协调总费.`N = 4`工人:

- 序列时间:10000个解码步骤.
- 霍格威尔德时间: 10000 * (0.3 + 0.7 / 4) + 200 * 4 = 10000 * 0.475 + 800 = 5550 解码步骤.
- 速度: 10000 / 5550 = 1.8x.

对于更长的推理问题 (50k代币),协调上费率会减免,加快速度会增加2.5-3x.

### 什么时候要到达霍格威尔德!

- 长时间推理问题 (数千个代币),任务可以在独立的子目标中并行.
- 没有理性模型不能自我协调.
- 单节点部署,可容纳共享缓存和N工作者进程的足够的VRAM.缓存是共享的,但每个工作者都有自己的激活内存.

### 什么时候不应该

- 短暂的互动聊天,协调的空头主导.
- 没有平行化的任务 (单一线性证明,单一编译). N=1是最大的.
- 没有协调的模型.
- 跨节点部署.共享缓存需要非常快速的跨工作者同步. 内部节点是好的; 跨节点是延迟灾难.

### 实验状态

截至2026年4月,Hogwild!是一个开源PyTorch实现的研究方法.生产采用尚未发生.三个阻塞者:

1. 共同的KV缓存管理在同时的过程中是非微不足道的工程.
2. 紧急协调依赖于任务;仍在建立基准.
3. 速度相比,可预测解码已经提供了什么, 两者可以结合,

值得知道,值得尝试,还没有投注任何产品.

```figure
continuous-batching
```

## 建立它

`code/main.py`执行一个玩具Hogwild!模拟器:

- 两个工人过程,每个都具有确定性"LLM",产生了几个代币类别之一 (工作代币,观察代币,坐标代币) 有已知概率.
- 共有缓存 (仅仅是代币列表) 两个工作者都能读写.
- 简单的协调逻辑:当一个工人看到他已经在一个类别中产生了足够的工作代币时,他选择了不同的类别.

模拟器运行以固定步骤预算,并报告:

- 产生的工作代币总数
- 墙壁时间总数 (工人步骤数量).
- 有效的加快一个工人的速度.
- 哪个工人写了哪个标志.

### 步骤1:共享缓存

简单的锁定 (Python `threading.Lock`) 在实际实现中,我们用计数器模拟.

### 步骤2:工人循环

每个工人,每一步:

- 读取当前共享缓存.
- 根据已经存在的标志,决定要写什么类型的标志.
- 写一个代币.

### 步骤3:协调的论

如果类别X已经有K代币在缓存中,而工人的预期类别是X,工人会转换为类别Y. 这是一个替代于"注意这个已经被覆盖了,做别的东西"的推理模式行为.

### 测量速度

运行模拟器,使用N=1工人和N=2工人,相同的总步骤预算. 计算生成的工作标记.由于协调驱动任务分类,N=2应该产生大约1.5-1.8倍的工作标记.

### 五步:强调协调

减少协调论的敏感性.再运行. 观察到如果没有良好的协调,N=2会过剩地产生相同的代币,速度下降到1. 这与论文的观察一致:只有工人有自我协调的推理能力才能有效.

## 用它

根据"德克斯"的标准,该技术将在2026年4月开始生产. 德克斯/HSE/IST的参考实现基于PyTorch,针对DeepSeek-R1和QwQ模型的单节点多进程设置.

实践性采用途径:

1. 分析您的推理任务工作负载. 测量探索性 (多个策略,案例分析,搜索) 与线性的代币的比例.
2. 如果探索占据主导地位, 运行一个两个工人Hogwild!实验.
3. 如果改善率低于1.3倍,你就处于协调主导的状态.
4. 如果改善超过1.5x,按到N=4并再次测量.

结合投机解码:每一个Hogwild!工作者可以独立使用规范解码.两个加快速度大约乘以3x规范解码和1.8xHogwild!高达5.4x,比天真单人解码更有效.

## 运送它

这一课产生了`outputs/skill-parallel-inference-router.md`考虑到一个推理工作负载配置文件 (代币预算,任务平行性配置文件,模型家族,部署目标),它在投票,思维树,多代理,霍格威尔德!和投机解码策略之间进行路线.

## 运动

1. 跑步`code/main.py`确认N=2Hogwild!配置在同一墙时产生比N=1基线更多的工作代码.

2. 减少协调论的强度 (设置`coordination_weight=0.1`解释原因:当工人无法协调时,他们重复努力.

3. 计算预期的Hogwild!速度,为50k代币推理任务`p=0.8, c=500`对于一个1k代币聊天任务,`p=0.3, c=200`为什么一个是胜利,另一个是失利?

4. 阅读Hogwild!论文第4节 (初步评估). 鉴定作者报告的两个失败模式. 描述如何更好的协调提示可以减轻每个模式.

5. 结合Hogwild!与玩具中的猜测解码:每个工人内部使用2代币的规范解码. 报告乘法加快.当两个工人都想延长相同的共享缓存前时,会出现什么会计问题?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hogwild! | "Parallel workers, shared cache" | N instances of the same LLM running concurrently with one shared KV cache; emergent coordination via self-prompting |
| Shared KV cache | "The coordination medium" | A single growing KV buffer that all workers read and write; enables instant token visibility across workers |
| Emergent coordination | "No training needed" | Reasoning-capable LLMs can read the shared cache and divide work without any fine-tuning or explicit protocol |
| Coordination overhead (c) | "Tokens spent orienting" | The per-worker cost of reading the extended cache and deciding what to do; must stay small vs total decode time |
| Parallelizable fraction (p) | "What can run in parallel" | Task-level parallelism: the fraction of the total work that is not intrinsically sequential |
| RoPE enables Hogwild! | "Rotary positions are shift-invariant" | Because positions are rotations, writing into a shared cache does not require recomputing prior tokens |
| Voting ensemble | "Run N, pick the majority" | The simplest parallel inference topology; useful for classification, less for long-form reasoning |
| Tree of thought | "Branch and prune" | Reasoning strategy that explores multiple branches and prunes; explicit coordination logic |
| Multi-agent framework | "Assign sub-tasks" | Each agent gets a role; a coordinator orchestrates; heavy protocol overhead |

## 进一步阅读

- [Rodionov et al. — Hogwild! Inference: Parallel LLM Generation via Concurrent Attention (arXiv:2504.06261)](https://arxiv.org/abs/2504.06261)霍格威尔德论文,QwQ和DeepSeek-R1的初步评估
- [Recht, Re, Wright, Niu — Hogwild!: A Lock-Free Approach to Parallelizing Stochastic Gradient Descent (arXiv:1106.5730, NeurIPS 2011)](https://arxiv.org/abs/1106.5730)原始的霍格威尔德!
- [Su et al. — RoFormer: Enhanced Transformer with Rotary Position Embedding (arXiv:2104.09864)](https://arxiv.org/abs/2104.09864) RoPE,使共享缓存推断可处理的属性
- [Yao et al. — Tree of Thoughts: Deliberate Problem Solving with Large Language Models (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601)思维树推理策略Hogwild!坐标直对
- [Leviathan et al. — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192)推测解码,在序列内平行性Hogwild!
- [Hogwild! reference PyTorch implementation](https://github.com/eqimp/hogwild_llm)论文实验的唯一来源
