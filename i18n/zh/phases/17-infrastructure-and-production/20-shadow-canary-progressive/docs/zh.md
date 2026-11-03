# 阴影交通,加拿大陆部署和LLM的逐步部署

> 应用程序的部署结合了软件部署最困难的部分:无单元测试,分散故障模式,信号延迟. 序列是 (1) 影子模式 复制的提示请求候选模型,记录,与零用户影响比较;捕获明显的分布问题,但不是质量保证; (2) 化推广 渐进的流量转移 10% → 25% → 50% → 75% → 100% 每一步都有门;跟踪延迟百分比,成本/请求,错误/拒绝率,输出长度分布,用户反率; (3) 稳定后A/B测试不同的替代方案. 由于GPU FP非关联性加上批量大小差异,具有相同输入的运行中高达15%的精度变化. 成本是变量,不是常量 一个20%更好的模型可以每次调用成本高出3倍. 转型速度是决定性的:如果转型需要重新部署,你太慢了. 政策生活在配置/旗中;模型生活在注册表中,注册表有注册表;反转 = 翻转政策 + 逆转门 + 缩旧模型在几秒钟内.

**Type:** Learn
**Languages:** Python (stdlib, toy canary-progression simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 21 (A/B Testing)
**Time:** ~60 minutes

## 学习目标

- 区分影子模式 (零冲击比较),加拿大 (现场流量进步),A/B (稳定证实比较).
- 列出五项专为LLM的加拿大标准 (延迟,成本/请求,错误/拒绝,输出长度分布,用户反).
- 解释为什么LLM非决定性 (高达15%) 改变了"稳定"在推广中意味着什么.
- 设计一个需要几秒钟 (政策转换) 而不是几小时 (重新部署) 的反转路径.

## 问题

你发出了新车型. 离线评估显示了3%的准确度,你将其转换到生产中. 在24小时内,成本上升了40%,用户指下降了8%,三个客户的门票报告了"奇怪的答案". 你回头. 再部署需要3小时. 你的周末是破产的.

影模式在任何用户看到之前就会发现成本上40%的. 利将在指下移动时停止在10%的水平. 政策旗倒车将需要30秒. 纪律是填补"离线评估看起来很好"和"真实用户很开心"之间的差距.

## 概念

### 影子模式

申请人收到与生产相同的请求;输出记录,而不是返回用户.用户影响零.记录:

- 产量含量 (与生产差异).
- 代币计数 (成本分数).
- 延迟.
- 拒绝和错误.

捕获:成本升高,长度回归,明显的拒绝变化,严重的错误. 没有捕获: 质量的德尔塔用户会感觉. 影子是一个烟雾测试,而不是质量测试.

### 卡纳里地区的部署

随着门的转移,流量逐步转移.典型的进步:1% → 10% → 25% → 50% → 75% → 100%.每步5个指标的门:

1. **Latency percentiles** P50, P95, P99. 违规性:鱼的P99> 1.5x基线.
2. **Cost per request**混合. 违规:超过原线20%
3. **Error / refusal rate**5xx加上明确拒绝.
4. **Output length distribution**平均值+P99. 违规性:分布转移.
5. **User-feedback rate**指/票票申请. 违规:1.5倍的基线.

### 无决定主义是新的变化

相同的输入产生的输出不相同.

-  GPU FP非关联性 (浮点降低顺序因批量而异).
- 批量差异 (在128批量和16批量时相同的提示).
- 采样 (温度 > 0).

测量:在相同的评估集中,可进行最大15%的精度变化.在推出中"稳定"意味着指标在预期变化范围内,不与基线相同.设置门在噪音地面以上.

### 成本是变量

通过"更好的"模型,每次通话都会有3倍的成本.成本/请求是五个门口之一.

### 滚动是武器

- 政策标志 (功能标志系统):配置中的翻转百分比;需要几秒钟.
- 模型点 (注册表消化):点模型不会自动升级.
- 翻转=反转旗+设置固定的消化到之前.

如果你的堆需要重新部署,然后在滚动之前修复.

### 工具

**Argo Rollouts**现在,**Flagger** Kubernetes 渐进式交货控制器. 集成到Istio/Linkerd权重路由.

**Istio weighted routing**服务网层面的交通分区.

**KServe / Seldon Core**模型提供内置的菜.

**Feature flags**发射,暗,旗,释放.

### 计量序列

卡纳里门根据流量量每5-15分钟检查.1%的1000个req/min (10个req/min对卡纳里) 每5-15分钟窗口提供50-150个数据点足以延迟,但对用户反来说很噪音.10%的数据大约增加了10倍.进步应该停顿足以在每个步骤上积累足够的样本.

### 选项:A/B

如果新模型明显不同 (不同行为,不同的成本曲线,不同的音调),在加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加拿大加

### 你应该记住的数字

- 鱼进展:1% → 10% → 25% → 50% → 75% → 100%.
- 无决定性性上限:在相同输入中,可达15%的连续变异.
- 五个可取量指标:延迟,成本,错误/拒绝,输出长度,用户反.
- 成本门:超过原线20%是违规行为.
- 秒钟,不是几个小时.

```figure
i4-canary-ramp
```

## 用它

`code/main.py`报告中,哪个阶段的推出停止,哪个门启动.

## 运送它

这一课产生了`outputs/skill-rollout-runbook.md`鉴于候选模型,基线和风险耐受性,设计了 shadow→canary→100%计划.

## 运动

1. 跑步`code/main.py`鱼在哪个阶段停止?
2. 您的新型号在线上获得3%的准确度,但成本/请求是+18%.
3. 设计一个不到60秒的回滚,并列出所需的基础设施.
4. 没有确定性在你的评估中显示 ±7% 设置鱼门,所以你不会错误报警.你使用什么乘法?
5. 影子模式在鱼之前,成本上升了40%.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Shadow mode | "duplicate to new" | Zero-impact send-to-candidate for logging |
| Canary | "progressive traffic" | Gradual user-exposed rollout with gates |
| Gates | "rollout checks" | Metric thresholds that block progression |
| Non-determinism | "LLM variance" | Irreducible run-to-run differences |
| Policy flag | "flag flip rollback" | Config-level rollback, seconds not hours |
| Model pin | "registry digest" | Immutable reference to a model version |
| Argo Rollouts | "K8s progressive" | Kubernetes-native canary/rollback controller |
| KServe | "inference K8s" | Model serving with canary primitives |
| Istio weighted | "mesh split" | Service-mesh traffic splitter |

## 进一步阅读

- [TianPan — Releasing AI Features Without Breaking Production](https://tianpan.co/blog/2026-04-09-llm-gradual-rollout-shadow-canary-ab-testing)
- [MarkTechPost — Safely Deploying ML Models](https://www.marktechpost.com/2026/03/21/safely-deploying-ml-models-to-production-four-controlled-strategies-a-b-canary-interleaved-shadow-testing/)
- [APXML — Advanced LLM Deployment Patterns](https://apxml.com/courses/mlops-for-large-models-llmops/chapter-4-llm-deployment-serving-optimization/advanced-llm-deployment-patterns)
- [Argo Rollouts docs](https://argo-rollouts.readthedocs.io/)
- [Flagger docs](https://docs.flagger.app/)
