# 生产服务堆  KV卸载和缓存知路线

> 提供堆线路由器,引擎和可观察性在一个Kubernetes部署中,并将KV缓存作为可以离开GPU的资源. 脱载KV将KV缓存从GPU内存中提取出来,并在查询和引擎中重复使用 (CPUDRAM,然后是磁盘/Ceph).  vLLM的生产堆是参考部署; LMCache是卸载层. 通过连接器API (v0.9.0+) 实现了无同步和可插入的 vLLM 0.11.0 KV脱载连接器 (2026年1月). 脱载路径通常隐藏于请求路径,尽管缓存错失和促销可以增加端到端延迟. LMCache即使没有共享的预写,也很有价值. 当GPU没有KV插槽时,预先请求可以从CPU恢复,而不是重新计算预填. 发布的 16x H100 (80GB HBM) 基准值在 4 a3-highgpu-4g:当KV缓存超过HBM时,本土CPU脱载和LMCache都会显著提高吞吐量;在低KV足迹时,所有配置都与小的上空成本相匹配.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy KV-spill simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 06 (SGLang/RadixAttention)
**Time:** ~60 minutes

## 学习目标

- 图表vLLM生产堆层:路由器,发动机,KV脱载,可观测性.
- 解释KV脱载连接器API (v0.9.0+) 以及如何隐藏0.11.0异步路径脱载延迟.
- 量化LMCache CPU-DRAM帮助 (KV > HBM) 与增加上 (KV足够小以适合HBM) 的时间.
- 根据部署限制,选择原生vLLM CPU脱载和LMCache连接器.

## 问题

您的vLLM服务显示 GPU 处于100%HBM,随着同步升级时都会出现预先事件.请求被驱逐出境,排队,并在一分钟内重新填写相同的2K代码提示. GPU 计算用于冗余的预填;产量远低于原始产量.

增加更多的GPU成本是线性的.增加更多的HBM是不可能的.但CPUDRAM便宜一个插座的延迟量比HBM差于512GB+但对于"暂时热"KV缓存很好.

LMCache 将KV缓存提取到CPUDRAM,以使先发请求快速恢复,并且在发动机中重复的预先设在不需要每一个发动机重新填充的情况下共享缓存.

## 概念

### 机生产堆

`github.com/vllm-project/production-stack`是参考库伯尼特斯部署:

- **Router**缓存意识 (阶段17 · 11) 消耗KV事件.
- **Engines**vLLM工作者:每一个GPU或每一个TP/PP组.
- **KV cache offload** LMCache部署或本地连接器.
- **Observability**普罗梅蒂乌斯的痕,格拉法纳仪表板,OTel的痕迹.
- **Control plane**服务发现,配置,不断更新.

作为Helm图+运营商.

### 电动电源脱载连接器API (v0.9.0+)

vLLM 0.9.0 引入了可插入的KV缓存后端的连接器API.你的引擎将块放入连接器;连接器存储它们 (RAM,磁盘,对象存储,LMCache).请求需要一个块,连接器将其重新加载.

vLLM 0.11.0 (2026年1月) 增加了一个异步的脱载路径 脱载可以发生在背景下,因此在普通情况下,引擎不会被阻塞. 端到端延迟和吞吐量仍然取决于工作负载形状,KV缓存击率和系统压力;vLLM自己的笔记指出,自定义核脱载可以降低低击率的吞吐量,以及异步调度已有熟悉的互动问题.

### 原产CPU脱载对 LMCache

**Native vLLM CPU offload**存储KV块在主机内存器内.快速实现,零网络跳转.不交叉引擎.

**LMCache connector**库存区块在共享的LMCache服务器 (CPU DRAM + Ceph/S3级). 区块可访问任何引擎. 16x H100基准发布.

当一个发动机具有HBM压力时选择本机.当多个发动机共享预写时选择LMCache (RAG与共同的系统提示,多租户共享模板).

### 基准行为

测试的16xH100 (80GBHBM) 分布在4a3-highgpu-4g测试中:

- 低KV足迹 (短提示,低同步性):所有配置都匹配基线,LMCache增加了3-5%的总费用.
- 适度足迹:LMCache开始帮助在引擎中重复使用前.
- 基动力超过HBM:原产CPU脱载和LMCache都大幅提高吞吐量;由于跨引擎共享,LMCache更大收益.

### 当LMCache是决定性的时

- 服务多租户,系统提示将被租户共享.
- 在文件块中重复查询.
- 基型KV重用减少过剩工作的相同基础上的细调变体 (LoRA).
- 预先加重工作负载:从CPU恢复比重装更便宜.

### 什么时候 NOT 启用

- 低压的HBM 你支付的费用没有福利.
- 短文本 (<1K代币) 转移时间 > 重新填写.
- 单租户单次工作量 没有再利用

### 集成与分类分类服务

17 期 · 17 分类分组服务 + LMCache 化合物:KV从预填池转移到未使用 LMCache 中的池地解码;随后的查询从 LMCache 拉开. 17 期 · 11 缓存意识的路由器可以向与本地 OR LMCache 共享缓存匹配的引擎进行路由.

### 你应该记住的数字

- 连接器API已发送.
- 无机载荷路径;端到端延迟影响取决于工作负载,KV击速率和系统压力 (不是绝对的保证).
- 16x H100基准:KV足迹超过HBM时,LMCache有助于.
- 低压HBM:3-5%的上层费用,没有效益.

```figure
zero-sharding
```

## 用它

`code/main.py`报告避免过度填充,吞吐量增加和破解式HBM使用.

## 运送它

这一课产生了`outputs/skill-vllm-stack-decider.md`鉴于工作负载的形状和vLLM部署,决定原生对LMCache对任何一个.

## 运动

1. 跑步`code/main.py`什么时候使用HBM开始付钱?
2. 租户共享6K代币系统提示,每小时查询200个.
3. 设计HA策略 (复制,返回原始).
4. 对于4K标记KV的70BFP8 (500MB),读取时间与重新填充时间是多少?
5. 辩论vLLM 0.11.0异步路径是否"自由" 顶部路径藏在哪里?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Production-stack | "the reference deployment" | vLLM's Kubernetes Helm chart + operator |
| Connector API | "KV backend interface" | vLLM 0.9.0+ pluggable KV store interface |
| Native CPU offload | "engine-local spill" | Store KV in host RAM of same engine |
| LMCache | "cluster KV cache" | Cross-engine KV cache server on CPU DRAM + disk |
| 0.11.0 async | "non-blocking offload" | Offload hidden behind engine stream |
| Preemption | "evict to make room" | KV cache shuffle when HBM full |
| Prefix reuse | "same system prompt" | Multiple queries share beginning; cache hit |
| Ceph tier | "disk tier" | Durable storage below DRAM in the cache hierarchy |

## 进一步阅读

- [vLLM Blog — KV Offloading Connector (Jan 2026)](https://blog.vllm.ai/2026/01/08/kv-offloading-connector.html)
- [vLLM Production Stack GitHub](https://github.com/vllm-project/production-stack) 头盔图+操作员
- [LMCache for Enterprise-Scale LLM Inference (arXiv:2510.09665)](https://arxiv.org/html/2510.09665v2)
- [LMCache GitHub](https://github.com/LMCache/LMCache)连接器的实施
- [vLLM 0.11.0 release notes](https://github.com/vllm-project/vllm/releases)异步路径细节.
