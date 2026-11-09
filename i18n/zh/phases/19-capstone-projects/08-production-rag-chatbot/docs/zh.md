#  生产RAG聊天机器人为规范垂直

> 哈维,格林,孟达布尔和拉马云都在2026年运行相同的生产形式. 摄入与 docling 或 Unstructured 和 ColPali 视觉. 混合搜索. 换级别,换级别,换级别,换级别,换级别,换级别,换级别,换级别,换级别,换级别,换级别,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级,换级. 通过快速缓存使用Clode Sonnet 4.7进行合成,以60至80%的击率. 警卫用拉马警卫4和NeMo警卫轨. 警兰格斯和城. 通过RAGAS进行200个问题金色测试. 建立一个受监管的领域 (法律,临床,保险), 终点是通过金色的组,红色的团队,

**Type:** Capstone
**Languages:** Python (pipeline + API), TypeScript (chat UI, pipeline scaffold)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**五·七·十一·十二·十七·十八
**Time:** 30 hours

## 问题

监管领域RAG (法律合同,临床试验协议,保险政策) 是2026年最流行的生产形式,因为ROI显而易见, 哈维 (艾伦和奥维) 建立了它,是合法的. 值得尊敬的船只是开发人员的档案. 格林报道了企业搜索. 模式是:摄入高效率,使用重排取混合物,通过引用执行和快速缓存合成,使用多层安全保护,并持续监测漂移.

难的是不是模型. 它们是: 专利认可的合规性 (HIPAA,GDPR,SOC2),引用级审计性,成本控制 (当高的缓存率时,即时缓存购买60-90%折扣),通过RAGAS忠诚度检测幻觉,以及当源文件更新而没有索引追赶时的漂移检测. 这块顶石要求你把全部运送到一个200个问题金色套装上,

## 概念

管道有两个侧面.**Ingestion**文件:docling或Unstructured分析结构文件;ColPali处理视觉丰富的文件;块获得总结,标签和基于角色的访问标签.向量进入pgvector +pgvector scale (低于50M向量) 或Qdrant Cloud;稀疏BM25沿线运行. **Conversation**: 兰格格拉夫处理内存和多转;每个查询都运行混合检索,与bge-reranker-v2-gemma-2b进行排列,与Claude Sonnet 4.7 (即时缓存) 合成,通过Llama Guard 4和NeMo Guardrails输出,并发出引用结的响应.

评估堆有四层.**Golden set**为了准确性,请问:**Red team**为了安全,我们需要在线观看.**RAGAS**对于忠诚度/答案相关性/文本精度,每轮自动. **Drift dashboard**看到每周的检索质量和幻觉得分.

快速缓存是成本杆.Claude 4.5+和GPT-5+支持缓存系统提示+检索文本.在60-80%的查询率下,每次查询成本下降3-5倍.管道必须设计为稳定的预先 (系统提示+重新排名文本首先) 实现高的缓存击率.

## 建筑

```
documents (contracts, protocols, policies)
      |
      v
docling / Unstructured parse + ColPali for visuals
      |
      v
chunks + summaries + role-labels + jurisdiction tags
      |
      v
pgvector + pgvectorscale  +  BM25 (Tantivy)
      |
query + role + jurisdiction
      |
      v
LangGraph conversational agent
   +--- retrieve (hybrid)
   +--- filter by role + jurisdiction
   +--- rerank (bge-reranker-v2-gemma-2b or Voyage rerank-2)
   +--- synthesize (Claude Sonnet 4.7, prompt cached)
   +--- guard (Llama Guard 4 + NeMo Guardrails + Presidio output PII scrub)
   +--- cite + return
      |
      v
eval:
  RAGAS faithfulness / answer_relevance / context_precision (online)
  Langfuse annotation queue (sampled)
  Arize Phoenix drift (weekly)
  red team suite (pre-release)
```

## 堆

- 摄入:结构化文件的不结构化.io或文件文件;视觉丰富的PDF文件的ColPali
- 矢量DB:pgvector +pgvectorscale在50M矢量以下;否则Qdrant Cloud
- 车:坦蒂维 BM25 具有场面重量
- 编排:LlamaIndex工作流程 (吞) + 拉格格拉夫 (对话)
- 排名重定:bge-reanker-v2-gemma-2b自主主机或Voyage排名重定-2主机
- 专业学历:Claude Sonnet 4.7 随时缓存;回落 Llama 3.3 70B 自主托管
- 果:RAGAS 0.2在线,深度果用于幻觉和 jailbreak套件
- 可观察性:Langfuse自主主机,注释队列;Arize Phoenix为漂移
- 防护轨道:Llama Guard 4输出分类器,NeMo Guardrails v0.12政策,Presidio PII扫描
- 符合性:部分部分的角色基础访问标签;GDPR/HIPAA的管辖权标签

```figure
canary-rollout
```

## 建立它

1. **Ingestion.**通过无结构或文件编写,分析您的文件 (1000-10000份文件进行认真构建).对于扫描/视觉重页,通过ColPali进行路由.制作摘要,角色标签,司法权标签的部分.

2. **Index.**密集嵌入式 (Voyage-3或 Nomic-embed-v2) 在pgvector + pgvector尺度.BM25侧索引通过Tantivy.作为有效载荷的角色和管辖权过器.

3. **Hybrid retrieve.**首先按角色+管辖权进行过;然后以平行密度+BM25;与相互级别融合结合;前20转级;前5转级.

4. **Synthesize with prompt caching.**系统提示 + 缓存标题中的静态政策; 作为缓存扩展重新排名的文本;用户问题作为未缓存后. 目标在稳定状态中60-80%.

5. **Guardrails.**拉马卫队4在输入;NeMo卫队轨道阻域外问题或政策禁止的主题;Presidio在输出中除意外的PII;引用执行后过.

6. **Golden set.**200个问题/答案对由领域专家标记 (答案,引用). 准确引用匹配的分数代理,答案正确性,忠诚性 (RAGAS).

7. **Red team.**50个对抗提示: jailbreaks (PAIR,TAP),PII泄密尝试,域外泄露,跨管辖区泄露.通过/失败和严重程度的分数.

8. **Drift dashboard.**鱼每周都会追踪检索质量.

9. **Cost report.**语法:即时缓存的击中率,每个查询的代币,按阶段分类的$/查询.

## 用它

```
$ chat --role=analyst --jurisdiction=GDPR
> what is the data-retention obligation for EU user profiles under our contract?
[retrieve]  hybrid top-20 filtered to GDPR + analyst-role
[rerank]    top-5 kept
[synth]     claude-sonnet-4.7, cache hit 74%, 0.8s
answer:
  The contract (Section 12.4, Master Services Agreement dated 2024-03-11)
  obligates EU user profile deletion within 30 days of termination per GDPR
  Article 17. The DPA amendment (DPA-v2.1, Section 5) extends this to 14 days
  for "restricted" category data.
  citations: [MSA-2024-03-11 s12.4, DPA-v2.1 s5]
```

## 运送它

`outputs/skill-production-rag.md`通过实时漂移监测观察,使用符合规范的标签部署的受规范域的聊天机器人.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RAGAS faithfulness + answer relevance | Online scores on the golden set (200 Q/A) |
| 20 | Citation correctness | Fraction of answers with verifiable source anchors |
| 20 | Guardrail coverage | Llama Guard 4 pass rate + jailbreak suite results |
| 20 | Cost / latency engineering | Prompt-cache hit rate, p95 latency, $/query |
| 15 | Drift monitoring dashboard | Phoenix live dashboard with weekly retrieval-quality trend |
| **100** | | |

## 运动

1. 在一个不同司法管辖区下建立第二个体积片 (例如,HIPAA与GDPR).在20个问题跨司法管辖区调查中,展示角色+司法管辖区过防止交叉泄漏.

2. 测量一个星期的生产流量中即时缓存的击中率. 确定哪些查询打破缓存前. 重组.

3. 通过10k代币总结缓冲,添加多转记忆,测量对话增长时信任是否下降.

4. 换了Claude Sonnet 4.7换成Llama 3.3 70B自主托管,测量$/查询和忠诚度.

5. 加入"不确定性"模式:如果重排的最高分数低于门值,代理人说"我没有自信的引用"而不是回答.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Prompt caching | "Cached system + context" | Claude/OpenAI feature: cached prefix tokens discounted 60-90% on hit |
| RAGAS | "RAG evaluator" | Automated scoring of faithfulness, answer relevance, context precision |
| Golden set | "Labeled eval" | 200+ expert-labeled Q/A with citations; the ground truth |
| Jurisdiction tag | "Compliance label" | GDPR/HIPAA/SOC2 scope attached to chunks; enforced by retrieval filter |
| Citation faithfulness | "Grounded answer rate" | Fraction of claims backed by retrievable source spans |
| Drift | "Retrieval quality decay" | Weekly change in nDCG or citation score; alert threshold 5% |
| Red team | "Adversarial eval" | Pre-release jailbreak, PII extraction, off-domain probes |

## 进一步阅读

- [Harvey AI](https://www.harvey.ai)参考法定生产堆
- [Glean enterprise search](https://www.glean.com)企业规模的参考RAG
- [Mendable documentation](https://mendable.ai)开发人员文件RAG参考
- [LlamaCloud Parse + Index](https://docs.cloud.llamaindex.ai/llamaparse/getting_started)管理摄入
- [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)成本杆指标
- [RAGAS 0.2 documentation](https://docs.ragas.io/)可行RAG评估框架
- [Arize Phoenix](https://github.com/Arize-ai/phoenix)参考漂移可观测性
- [Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/)2026年安全分类
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/)政策铁路框架
