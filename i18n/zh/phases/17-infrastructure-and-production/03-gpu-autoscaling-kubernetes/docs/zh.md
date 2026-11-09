# 在 Kubernetes 上自动扩展GPU 卡珀特,KAI定制器,帮派定制器

> 没有一个层. 卡珀特供应节点动态 (低于1分钟,比集群自动测量器快40%). 卡伊计划器处理团队安排,拓意识和等级队列,它防止7/8的部分分配陷,其中七个节点在一个缺失的GPU上等待和燃烧. 应用级自动量化器 (NVIDIA Dynamo Planner, llm-d Workload Variant Autoscaler) 根据推理特定信号进行量化,排队深度,KV缓存使用,而不是CPU/DCGM工作周期. 经典的HPA陷是这样的`DCGM_FI_DEV_GPU_UTIL`作为一个任务周期测量:100%可以是10个请求或100个. vLLM预先分配KV缓存,所以内存永远不会触发缩放.`WhenEmptyOrUnderutilized`在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户在线用户网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站网站

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy queue-depth autoscaler simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~75 minutes

## 学习目标

- 绘制三个自动扩展层 (节点配置,团队安排,应用级别) 并命名每个层使用的工具.
- 解释原因`DCGM_FI_DEV_GPU_UTIL`是vLLM的错误HPA信号,并命名两个替代 (排队深度,KV缓存使用).
- 描述团队规划和部分分配故障模式 KAI Scheduler 防止 (7 个8 个GPU 置).
- 提及卡珀特集团政策 (`WhenEmptyOrUnderutilized`) 终止GPU工作,并指出2026年安全的替代方案.

## 问题

你的团队在Kubernetes上提供了法学服务.`DCGM_FI_DEV_GPU_UTIL`现在,我们在电脑上看到一个电脑,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它,它可以使用它可以使用它,它可以使用它,它可以使用它,它可以使用它可以使用它,它可以使用它,它可以使用它,它可以使用它可以使用它,它可以使用它,它可以使用它可以使用它.

单独使用 Cluster Autoscaler 为节点. 一个 1M-代币提示到达凌晨2点; 集群花费3分钟的节点配置, 请求时间.

单独的,你部署一个70B模型需要8个GPU在2个节点上.集群有7个GPU免费,分散在3个节点上,需要1个.集群Autoscaler为1个缺失的GPU提供一个节点.7个保留的GPU停留4分钟,燃烧钱,而Kubernetes得到最后一个GPU.

两个层,三个不同的故障模式. 2026年 GPU 意识到自动扩展不是"启动HPA". 它是构成节点配置,团队规划,和应用信号自动扩展.

## 概念

### 层1 节点供应 (卡普门特)

卡宾特在45-60秒内观察待定的 pods和储备节点 (集群自动测量器通常需要90-120秒用于GPU节点).它根据数据的动态选择实例类型.`NodePool`限制如果你的小组需要8个H100,并且集群没有匹配的节点,

**The consolidation trap**卡宾特的默认`consolidationPolicy: WhenEmptyOrUnderutilized`对于 GPU 池来说,它会终止运行 GPU 节点,将 pods 迁移到更便宜的正确尺寸实例.对于推断工作负载,这意味着驱逐运行请求和重新加载70B 模型在新节点上.损失是数分钟的容量加上请求失败.

对于GPU池的安全设置:

```yaml
disruption:
  consolidationPolicy: WhenEmpty
  consolidateAfter: 1h
```

让卡宾特在一个小时后整合真正空的节点,但从来没有驱逐出一个正在运行的工作.

### 层2 帮派安排 (KAI安排器)

卡伊定制器 (随后改名为"卡普"项目) 处理默认的 kube-scheduler 不:

**Gang scheduling**计划所有或什么都.一个需要8个GPU的分布式推理器,或者8个GPU都开始在一起,或者没有.没有这个,你得到了部分分配陷:8个子中的7个开始,等待无限时间,烧钱.

**Topology awareness**知道哪些GPU共享NVLink,这些GPU都坐在同一架子上,它们之间有InfiniBand. 根据此,放置 pods.一个DeepSeek-V3 67B的子平行工作负载必须保持在一个NVLink域;KAI Scheduler尊重这一点.

**Hierarchical queues**多个团队以优先级和配额竞争同一个GPU池.A团队的生产只会在优先规则允许的情况下被B团队的训练工作先进.

作为二级调度器,KAI与 kube-scheduler一起部署;您注释工作负载使用它.Ray和vLLM生产堆都集成.

### 层3 应用级信号

**The HPA trap**其他`DCGM_FI_DEV_GPU_UTIL`测量GPU是否在每个样本中段工作.100%的利用可能意味着10个同时请求或100个;GPU无论如何都忙.在工作周期上进行扩展是盲目扩展.

更糟糕的是,vLLM和类似的引擎预先分配KV缓存 (高达 `--gpu-memory-utilization`记忆使用率即使是一次请求,也保持接近90%.

**2026 replacement signals**其他:

- 排队深度 (等待预填的请求数量).
- 存储器存储器使用量 (区块的多少分量被分配到活跃序列中).
- 按复制 P99 TTFT (您的SLA信号).
- 产量 (每秒满足所有SLO的要求).

根据NVIDIA 动态规划器和 llm-d 工作负载变量自动测量器的使用,它们完全取代了HPA.

### 什么时候使用

| Scale decision | Tool |
|----------------|------|
| Add/remove nodes | Karpenter |
| Schedule multi-GPU jobs | KAI Scheduler |
| Add/remove replicas | Dynamo Planner / llm-d WVA (or custom HPA on queue depth) |
| Choose GPU type | Karpenter NodePool |
| Preempt low-priority | KAI Scheduler queues |

### 解密的预填/解码复杂化了一切

如果运行分类的预填/解码 (阶段17·17),则有两个类,具有不同的扩展触发器:排列深度的预填尺度,KV缓存压力上的解码尺度. llm-d将这些分开.`Services`试着把一个HPA放在两者面前.

### 寒冷开始也在这个地方重要

卡宾特的45-60秒加热加上20GB模型负载加上发动机 init意味着零请求需要2-5分钟.保持一个温暖的池 (`min_workers=1`) 对于SLO关键路径,或在应用层使用Modal样式的检查点.

### 你应该记住的数字

- 卡珀特节点供应: ~ 45-60s vs 集群自动测量器 ~ 90-120s (GPU节点).
- 卡伊计划器防止部分分配废物 7/8陷.
- `DCGM_FI_DEV_GPU_UTIL`作为HPA信号:断裂;使用队列深度或KV利用.
- 匠`WhenEmptyOrUnderutilized`停止运行GPU工作. 使用`WhenEmpty + consolidateAfter: 1h`为了推断.

```figure
autoscaling
```

## 用它

`code/main.py`模拟一个在一个破裂的GPU工作负载上进行三层自动扩展器. 进行了天真的HPA (职务周期),排队深度HPA和KAI团队计划的扩展. 报告未满的请求,空置GPU分钟和复合分数.

## 运送它

这一课产生了`outputs/skill-gpu-autoscaler-plan.md`鉴于集群拓,工作负载形状和SLO,它设计了一个三层的自动扩展计划.

## 运动

1. 跑步`code/main.py`在一个繁忙的工作量下, 无辜的职务周期HPA会放下排队深度HPA捕获的请求? 区别来自于什么?
2. 设计一个Karpenter NodePool,用于H100 SXM5上服务Llama 3.3 70B FP8的集群. 指定 `capacity-type`现在`disruption.consolidationPolicy`现在`consolidateAfter`并且可以将非GPU工作负载远离这些节点.
3. 诊断 是卡宾特,Kube-Scheduler,或KAI Scheduler?哪些指标证实?
4. 选择一个信号,以自动化分类的预填和一个不同的信号,以解码.
5. 计算成本`WhenEmptyOrUnderutilized`在24×7生产服务中,平均每天有60次请求降低事件,P99 TTFT>10s.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Karpenter | "the node provisioner" | Kubernetes node autoscaler; sub-minute provisioning |
| Cluster Autoscaler | "the old scaler" | Kubernetes node autoscaler predecessor; slower, group-based |
| KAI Scheduler | "the GPU scheduler" | Secondary scheduler for gang + topology + queues |
| Gang scheduling | "all or nothing" | Schedule N pods atomically or defer all of them |
| Topology awareness | "rack-aware" | Place pods based on NVLink/IB/rack placement |
| `DCGM_FI_DEV_GPU_UTIL` | "GPU utilization" | Duty-cycle metric; NOT a scaling signal for LLMs |
| Queue depth | "waiting requests" | Correct HPA signal for prefill-bound scaling |
| KV cache utilization | "memory pressure" | Correct HPA signal for decode-bound scaling |
| Consolidation | "Karpenter consolidation" | Node termination to cheaper instance type |
| `WhenEmpty + 1h` | "safe consolidation" | Policy that doesn't evict running GPU jobs |

## 进一步阅读

- [KAI Scheduler GitHub](https://github.com/kai-scheduler/KAI-Scheduler)设计文件和配置示例.
- [Karpenter Disruption Controls](https://karpenter.sh/docs/concepts/disruption/)整合政策语义和GPU安全的默认.
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) 动力计划器扩展信号.
- [Ray docs — KAI Scheduler for RayClusters](https://docs.ray.io/en/latest/cluster/kubernetes/k8s-ecosystem/kai-scheduler.html)射线集成模式.
- [AWS EKS Compute and Autoscaling Best Practices](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-compute.html)管理-库伯内特斯具体指导.
- [llm-d GitHub](https://github.com/llm-d/llm-d) 工作负载变量自动尺设计.
