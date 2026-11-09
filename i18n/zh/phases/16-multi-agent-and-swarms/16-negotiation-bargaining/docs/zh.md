# 谈判和谈判

> 经纪人谈判资源,价格,任务分配和条款.2026年基准设定很清楚:谈判场 (arXiv:2402.05863) 显示LLM可以通过人格操纵提高收益率20% (绝望);"衡量谈判能力" (arXiv:2402.15813) 显示买家比卖家更难,规模不帮助他们**OG-Narrator**投资率从26.67%提高到88.88%;大规模自主谈判竞赛 (arXiv:2503.06416) 进行了约180000次谈判,发现**chain-of-thought-concealing**通过隐藏对手的推理,代理人获胜;Bhattacharya et al. 2025 在哈佛谈判项目测量中,Llama-3最有效,Claude-3最具侵略性,GPT-4最公平.这个课程实现了合同网协议 (FIPA祖先,课程02),线程LLM类型的买家/卖家,运行了OG-叙述者类型的分解,并测量了交易率如何随着每个结构选择变化.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 02 (FIPA-ACL Heritage), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## 问题

两家代理商需要达成价格. 由于纯粹的语言提示,2024-2026年,LLCs以惊人的低率 (在 arXiv:2402.15813 中,紧密参数的交易中约27%) 达成交易. 规模并不能解决:GPT-4在谈判中结构上不比GPT-3.5更好;它在谈判的 *语言*上更好.

根据LLM的基本问题,LLM将两个工作组合在一起,决定报价和叙述报价.OG-Narrator分开了这些:确定性报价生成器计算了数量的动作;LLM只叙述.交易率跳到89%.

这反映了经典的多代理发现:脱离机制与通信层的胜利.合同网协议 (FIPA, 1996;史密斯, 1980) 是参考任务市场机制.将LLM插入叙述槽,你得到一个现代的LLM驱动任务市场.

## 概念

### 合同网,在一段

史密斯1980年合同网协议:**manager**广播**call for proposals (cfp)**其他**bidders**回答**propose**经理选择一个获胜者,并发送**accept-proposal**给获胜者**reject-proposal**获胜者完成工作. 选择性信息:**refuse**国际投资管理局编码这一点为`fipa-contract-net`互动协议.

### 为什么"OG讲述者"赢了

语言模型的谈判能力测量 (arXiv:2402.15813) 指出:

- 法律法规经常违反谈判规则 (以无意义的价格提供,忽略对方的ZOPA).
- 它们扎不好 (接受不好的首次报价;反报价比战略性).
- 规模本身并不能解决这些问题.更大的模型使类似的战略错误更可靠.

关于"OG-Narrator"的解体:

```
           ┌──────────────────┐        ┌──────────────────┐
  state  → │ offer generator  │ price → │  LLM narrator    │ → message
           │  (deterministic) │        │  (writes the     │
           │                  │        │   human-style    │
           └──────────────────┘        │   accompaniment) │
                                       └──────────────────┘
```

报价生成器是一个经典的谈判策略:鲁宾斯坦谈判模型,泽顿策略或简单的价格交换.LLM讲述.信息包含确定性价格和自然语言框架.

交易率上升,因为:
- 价格保持在谈判区.
- 是战略性的,而不是情感的.
- 法律士做出自己的技能:写作.

### 谈判Arena的发现

根据"法典"的标准, arXiv:2402.05863提供了标准.

- 通过采用个性化 ("我绝望能在周五之前销售") 个性化操纵是一种真正的策略.
- 公平/合作的代理人被敌对的代理人剥削;防御需要明确的反.
- 根据标准,在约40%的基准场景中,对称对合结果趋于不公平.

这不是"LLM是坏谈判者". 这就是"LLM谈判太像人类,包括可剥削的部分.

### 隐藏思想链

大规模自主谈判竞赛 (arXiv:2503.06416) 在许多LLM战略中进行了约180k的谈判.获奖者隐藏了他们的推理:

- 如果一个代理打印"我只会去"$75; my reservation price is $任何一个人可以看到的,
- 获胜者私下计算策略;输出道只包含了报价和最低要求的叙述.

对于"游戏理论" (Aumann 1976年关于理性和信息) 的2026年回声:揭示了你私人估值成本的回报.

工程的提取:将私人抓板的文本与公共信息的文本分开.

### 巴塔查里亚等2025年 模型排名

哈佛谈判项目指标 (原则性谈判,BATNA尊重,利益互惠):

- **Llama-3**在交易中最有效 (交易率+收益率).
- **Claude-3**谈判最具侵略性的谈判者 (高,迟到的让步).
- **GPT-4**配对中最公平 (最小的变化).

问题不是2026年4月哪个模型赢得了胜利. 问题是,不同的基模型具有持久的谈判风格.异性集体 (课 15) 将这作为多样性来源.

### 通过合同网 + LLM分配任务

现代的合同网的重用:

1. 管理员将任务分解成单元.
2. 广播`cfp`工作人员的任务描述.
3. 每个工人都回报了一份报价:`(price, eta, confidence)`价格可能是代币,计算单位或美元.
4. 管理者选择获奖者 (单项或多项,具体取决于任务) 和奖项.
5. 拒绝的工人可以自由投标其他任务.

由于协调是播放和响应,而不是同步聊天. 在生产中使用:微软代理框架的编排模式,一些LangGraph实现.

### 合资企业利益相关者互动谈判

果产品https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) 引入多方可得分游戏**secret scores**其他**minimum-acceptance thresholds**任何利益相关者都有私营公用事业;LLM必须从信息中推断这些信息.这是两党谈判的通用化到N党联盟的形成.对于具有异性工人能力的生产任务市场相关.

### 叙述与机制规则

在2024-2026年所有谈判基准中,一致的工程规则是:

> 让法师讲述,不要让法师计算出报价.

如果报价需要一个数字 (价格, ETA,数量),从谈判状态中确定性地生成它,并让LLM制作框架.如果报价需要一个提案结构 (任务分解,角色分配),让LLM起草它,但在发送之前根据一个方案和约束检查验证.

```figure
a5-og-narrator
```

## 建立它

`code/main.py`执行:

- `ContractNetManager`现在`ContractNetTask`现在`Bid`经理+投标人,广播公司,收集提案,授予.
- `og_narrator_bargain(state, rng)` OG-Narrator买家:决定性的Zeuthen风格让步到中点.
- `seller_response(state, rng)`确定性卖家反报政策 (对两种风格的结构性基础真理).
- `naive_llm_bargain(state, rng)`模拟全LLM交易者:选择高差异性价格,通常是超出ZOPA的.
- 测量:交易率超过1000个试验,每试验采样新鲜预订价格.

运行:

```
python3 code/main.py
npx tsx code/main.ts
```

预期产量:天真-LLM交易率~65-75%;OG-Narrator交易率~85-95%;15-25点差距是从叙述中分解产品生成的结构优势.加上一个有三个投标者和一个任务的合同网任务市场分配例子.

## 用它

`outputs/skill-bargainer-designer.md`设计谈判协议:谁生成报价 (定制性或LLM),谁讲述,私人剪辑板如何与公共信息分开,以及如何监测交易率.

## 运送它

生产谈判检查列表:

- **Separate scratchpad.**个人国家从来没有达到对方的背景.
- **Deterministic offer generation.**价格,数量,时间:计算,不要要求.
- **Validate all incoming offers**拒绝在协议边界的非ZOPA报价.
- **Bound rounds.**极限3-5次,在停滞时升级到中介.
- **Measure deal rate and payoff variance**交易率下降是症状,通常是迅速的漂移或对方攻击.
- **Log all rejected proposals**对于合同网经理来说,输入竞标者需要了解原因.

## 运动

1. 跑步`code/main.py`确认OG-Narrator比天真LLM在交易率.
2. 实施**persona-based payoff improvement**买家只在叙述中采用"绝望要买本周"角色,提供发电机不变.交易率或回报率是否改变?
3. 实现思想链**concealment**假设您不想通过道来模拟它,会发生什么?
4. 如何决定最低价格和最高质量的价格?你选择哪个奖项规则,为什么?
5. 阅读Bhattacharya et al. 2025 在哈佛谈判项目指标. 实施两个不同的风格的讨价还价者 (侵略性与公平). 在对称和不对称对称下衡量回报差异.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Contract Net | "Task market" | Smith 1980, FIPA 1996. cfp + propose + accept/reject. The canonical task-market. |
| ZOPA | "Zone of possible agreement" | Overlap between buyer's max and seller's min. Offers outside it cannot close. |
| BATNA | "Best alternative to a negotiated agreement" | Your fallback if this deal fails. Sets your reservation price. |
| OG-Narrator | "Offer generator + narrator" | Decomposition: deterministic offer, LLM narration. |
| Zeuthen strategy | "Risk-minimizing concession" | Classical offer-generator that concedes based on risk limits. |
| Rubinstein bargaining | "Alternating-offer equilibrium" | Game-theoretic model for infinite-horizon bargaining with discounting. |
| CoT concealment | "Hide your reasoning" | Winners in arXiv:2503.06416 kept private scratchpads; public channel shows offer only. |
| Persona manipulation | "Emotional posturing" | arXiv:2402.05863: ~20% payoff gain from desperation/urgency personas. |

## 进一步阅读

- [NegotiationArena](https://arxiv.org/abs/2402.05863)基准指标;人格操纵和剥削的发现
- [Measuring Bargaining Abilities of Language Models](https://arxiv.org/abs/2402.15813) OG-Narrator 和买家比卖家更难的结果
- [Large-Scale Autonomous Negotiation Competition](https://arxiv.org/abs/2503.06416) ~ 180k 谈判; 思想链隐获胜
- [LLM-Stakeholders Interactive Negotiation (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf)多方可得分游戏,有秘密工具
- [Smith 1980 — The Contract Net Protocol](https://ieeexplore.ieee.org/document/1675516)经典机制,电脑上IEEE交易
