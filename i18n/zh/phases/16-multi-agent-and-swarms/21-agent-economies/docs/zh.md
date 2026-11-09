# 代理经济,代币激励,声誉

> 长远自主代理 (METR的1小时到8小时工作曲线) 需要经济代理.**5-layer stack**是: **DePIN**物理计算**Identity**其他类型的资本**Cognition**子,子,子,子,子,子**Settlement**总结:**Governance**生产代理激励网络包括:**Bittensor**(TAO子网络奖励任务特定模型),**Fetch.ai / ASI Alliance**(ASI-1 Mini LLM + FET代币),以及**Gonka**学术工作:AAMAS 2025的分散式LAMAS使用 **Shapley-value credit attribution**为了公平地奖励贡献者;谷歌研究提出"大型语言模型机制设计"**token auctions**这一课程建立了一个最小的代理市场,将Shapley值的信用归因应应用于多代理管道,并进行了第二价格代币拍卖,以便游戏理论机器具体地落地.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 16 (Negotiation and Bargaining), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## 问题

经纪人共同创造价值,但需要单独奖励时,多代理系统变得复杂. 经典机制 平等的分开,最后的贡献者取一切 是不公平的或可玩的. 通过Shapley价值观,基于联盟的奖励是公平的, 根据"中国经济发展"的指导,

超越信用归因,该领域转向了实际的经济代理:Bittensor TAO奖励挖矿计算来调整子网特定模型,Fetch.ai/ASI奖励ASI-1迷你LLM使用FET代币,Gonka重新分配转former证明工作到生产人工智能任务.

这一课将代理经济作为一个特定的问题家庭 信用归因,机制设计和声誉 ,并构建每个与最小的数学,

## 概念

### 五层的代理经济堆

1. **DePIN (physical compute).**分散的基础设施,租用GPU,存储,带宽,比特ensor子网络,Render网络,Akash. 不是特征者,特征者使用它.
2. **Identity.**据W3C分离式识别器 (DID) 显示,每个代理都具有独立于任何平台的持久身份. 声誉来自于DID. 代理网络协议 (ANP) 使用DID作为发现层.
3. **Cognition.**其他阶段的构建就是这样.
4. **Settlement.**账户抽象 (ERC-4337) 允许代理人从自己的余额支付天然气,而无需持有ETH. 代理人可以为服务支付,相互支付或计算.
5. **Governance.**代理DAO:由人类和代理人投票对协议变更的治理结构,投票权与声誉有关.

不是每个生产系统都使用五个.Bittensor使用1,2,部分3,部分4,没有一个.OpenAI代理除了3个,都没有使用.

### ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,

**Bittensor (TAO).**矿工提交模型输出.验证器将它们排名;权重分数分配了TAO奖励.每个子网都有自己的评估.经济课程:为特定任务的输出质量付费,而不是使用的计算.

**Fetch.ai / ASI Alliance.**作为一个"FET"的代理,FET.ai的代理可以在FET中调用另一个任务,并支付FET.

**Gonka.**变压器证明工作:"工作"是变压器的前进通行.矿工通过运行已知正确输出 (从训练数据) 的推断任务来获得收入.资源生产的PoW而不是基于哈希的PoW.

截至2026年4月,所有三种产品均为生产级. 付款分布不同. 比特器对子网验证器的质量进行了奖励; 通过付费用户测量的Fetch奖励实用性; Gonka奖励可验证的推断工作.

### 石灰值信用归因

现在,我们有三位代理人合作, 输出率为0.8.

石普利值:满足四个定理 (效率,对称性,线性,零) 的独特信用分配.`i`其他:

```
shapley(i) = (1/N!) * sum over all orderings O of (v(S_i_O ∪ {i}) - v(S_i_O))
```

在哪里`S_i_O`是之前的代理群`i`在顺序中`O`实际上:列出所有变量,记录每个变量中的每个代理的边际贡献,平均.

对于N=3的代理,有6个变量.对于N=10,3.6M ,所以实际上你采样排序而不是编写.

### 集成二价拍卖

谷歌研究 ("大型语言模型机制设计") 为集成LLM产品提出了二价代币拍卖. 设置:N代理人每一个提出完成;每个有个别的值被选中. 拍卖商选择了最高价值的提案,并支付了第二最高价值. 在单调的聚合下 (价值取决于选择哪个提案,而不是多少投标),这是真实的 代理投标他们的真实价值.

为什么这对LLM系统很重要:你可以将完成任务外包给多个代理商,价格不同;拍卖会选择最好的 + 公平的报酬,代理商没有动机报告错误.

### 声誉资本

根据证实贡献,获得了DID相关的声誉分数.

```math
\text{rep}(i, t+1) = \alpha \cdot \text{rep}(i, t) + (1 - \alpha) \cdot \text{contribution\_quality}(i, t)
```

具有衰变因素`alpha`接近 1. 声誉:

- 对于路由决策来说,阅读便宜 ("将艰难任务发送给高代表代理").
- 造成本高昂 (随着时间的推移积累,与DID相关).
- 可减小:未能验证的贡献减小.

### 亚马斯2025分散式拉马斯

拉马斯提案 (AAMAS 2025) 结合了:DID身份,Shapley值信用归因和简单的拍卖机制.关键要求:分散信用归因步骤使系统可审计并不受单点操纵的影响.

### 经济在哪里崩

- **Price oracle manipulation.**如果可以玩信用函数,代理人会玩它.
- **Sybil attacks.**一个运营商把N个假代理起来,以膨胀自己的贡献.
- **Verification cost.**如果验证是便宜的 (小型的法定律师),它可以被玩弄;如果昂贵 (人群),系统不会扩展.
- **Regulatory overhang.**代理经济与金融监管交叉. 比特森索,费奇和冈卡都在2026年开始在某些司法管辖区的法律灰色区域运营.

### 当代理经济有意义时

- **Open networks with heterogeneous operators.**没有一个团队控制所有的代理人.
- **Verifiable outputs.**没有验证,信贷归因是猜测.
- **Long-horizon workflows.**一次任务不会从声誉积累中受益.
- **Tokenized payments are legally viable**在您的管辖范围内.

在封闭的企业系统中,经济学更容易分配 (管理人员分配工作,指标是内部的).经济学文献主要适用于开放网络.

```figure
swarm-auction
```

## 建立它

`code/main.py`执行:

- `shapley(value_fn, agents)`精确的Shapley计算通过小N的编号.
- `second_price_auction(bids)`真实机制; 获奖者是第二位最高的.
- `Reputation`                                                                                                                                                                                                                                                              
- 演示1:三名代理合作,恰恰是莎普利的信用.
- 五个代理人投标一个任务槽;第二价拍卖选中赢家 + 付款.
- 演示 3:100轮任务分配给异质代表的代理人; 代表权重的路由跳动随机.

运行:

```
python3 code/main.py
npx tsx code/main.ts
```

预期产量:每个代理的Shapley值;拍卖结果显示出真实报价平衡;重复路由显示在加热后随机增长10%到20%的质量.

## 用它

`outputs/skill-economy-designer.md`设计一个最小代理经济:身份层的选择,信用归因机制,支付机制,声誉规则.

## 运送它

管理2026年的代理经济:

- **Start with reputation, not tokens.**凭借代币,人们的声誉便宜,而且仅仅是有价值的.
- **Verify before you reward.**没有独立的验证步骤,永远不要分配信用.
- **Shapley-sample, not Shapley-exact.**样本100-1000次;精确的清单不计量.
- **Cap decay factor and floor reputation.**无限的腐蚀会抹去合法贡献者;过度缓慢的腐蚀会奖励过时的高反应剂.
- **Audit mechanisms adversarially.**在打开网络之前,运行红队场景. 每个机制都有游戏理论;你想找到洞穴,而不是攻击者.

## 运动

1. 跑步`code/main.py`确认Shapley值总值到总值 (效率定理).改变值函数;Shapley分配是否改变预期方向?
2. 运用Shapley *样本* (Monte Carlo对K序列).K如何影响近似准确性?比较为精确为N=4.
3. 在拍卖之前,实施联盟形成步骤:代理人可以合并成团队并作为一个单位进行竞标.哪些联盟形成?结果比个人竞标更好吗?
4. 读一读Google研究机制设计文章. 确定一个假设,如果被违反,会破坏真相.在LLM设置中,失败模式是什么样子?
5. 阅读AAMAS 2025分散的LAMAS论文. 执行他们的Shapley步骤超过10个代理人在合成任务. 精确计算需要多长时间? 抽样得到了多近100抽奖?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| DePIN | "Decentralized physical infrastructure" | Token-incentivized compute/storage/bandwidth. Bittensor, Akash, Render. |
| DID | "Decentralized identifier" | W3C spec for portable IDs. Agent reputation binds to DID, not to a platform. |
| ERC-4337 | "Account abstraction" | Contract accounts that can sponsor gas, enabling agent payments. |
| Shapley value | "Fair credit attribution" | Unique allocation satisfying efficiency, symmetry, linearity, null. |
| Second-price auction | "Vickrey auction" | Truthful mechanism: winner pays second-highest bid. Monotone aggregation compatible. |
| Reputation capital | "Accumulated quality score" | DID-bound score from confirmed contributions; decays over time. |
| Agentic DAO | "Agents + humans govern" | DAO with agent voters as first-class, voting power tied to reputation. |
| TAO / FET / GPU credits | "Token denominations" | Bittensor TAO, Fetch.ai FET, various DePIN tokens. |

## 进一步阅读

- [The Agent Economy](https://arxiv.org/abs/2602.14219) 2026年5层代理经济堆调查
- [Google Research — Mechanism design for large language models](https://research.google/blog/mechanism-design-for-large-language-models/)单调聚合的代币拍卖
- [AAMAS 2025 — decentralized LaMAS](https://www.ifaamas.org/Proceedings/aamas2025/pdfs/p2896.pdf) 石灰值信用归类
- [Bittensor TAO documentation](https://docs.bittensor.com/)子网结构和奖励分配
- [Fetch.ai / ASI Alliance](https://fetch.ai/)ASI-1迷你法学和FET代币
- [W3C Decentralized Identifiers (DIDs) spec](https://www.w3.org/TR/did-core/)身份基础
