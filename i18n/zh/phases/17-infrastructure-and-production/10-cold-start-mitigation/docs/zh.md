# 服务器无线LLM的冷启动减轻

> 一个大型模型需要几分钟才能从冷到服务:一个70B模型在新鲜节点上需要大约3-8分钟之前的第一代币. 在一个真正的无服务器世界里,这不是一个热点, 减轻功能在五层运行:预种的节点图像 (AWS上的Bottlerocket,双体弧),模型流 (NVIDIA Run:ai Model Streamer,本地在vLLM中),GPU内存快照 (Modal检查站,重启速度高达10倍),热池 (`min_workers=1`),层次加载 (ServerlessLLM的NVMe→DRAM→HBM管道,10-200x延迟降低),加上附加六个模式,直播迁移,移动输入代币 (KB) 而不是KV缓存 (GB).Modal将2~4个冷开始作为地板;Baseten 5-10个默认,下秒与预加热.本课程教你测量,预算和堆叠五层.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy cold-start path simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 03 (GPU Autoscaling)
**Time:** ~60 minutes

## 学习目标

- 列出冷启动减轻五层,并在每个层中指定一个工具或模式.
- 计算70B型号的冷启动时间总数为 (节点提供) + (重量下载) + (重量加载到HBM) + (发动机初始).
- 解释为什么直播迁移传输输入代币 (KB) 而不是KV缓存 (GB) 以及惩罚是什么 (重新计算).
- 指定热池交易 (为空置GPU付款或接受冷启动尾) 和 SLA 门值`min_workers > 0`成为强制性的.

## 问题

你的无服务器LLM终点在一夜之间变得零.

1. 卡宾特提供一个GPU节点: 45-60s.
2. 容器可以拍摄30GB的图像,重量为120-300s.
3. 发动机将重量加载到HBM:根据模型大小和存储速度45-120s.
4. 存器: 10-30s.

总数: 220-510s (约3-8分钟) 在一个代币回来之前.你的SLA是2s.你发送一个热池 (`min_workers=1`现在你支付一个空置的GPU24x7. 如果你的服务有5个产品,每个产品都有一个热复制,那么5 × 24 × 30 =3600个GPU-小时/月,无论一个用户是否打电话.

缓解冷启动是如何保持无服务器经济,同时近似始终开放的延迟.

## 概念

### 层1 预种节点图像 (Bottlerocket)

在 AWS 上,Bottlerocket 的双体积架构将操作系统与数据分开.`EC2NodeClass`通过NVMe,新节点启动,并且已经在本地NVMe上重量了. 步骤2和3的部分消失. 与卡宾特本土操作.

在GCP上:有预备容器层的自定义VM图像.在Azure上:有相同模式的管理磁盘快照.

### 层2 模式流 (Run:ai模型流器)

在回答第一个请求之前,不要加载完整的文件,而是将权重流入GPU内存层次,并立即开始处理,当第一个变压器区块成为居民.NVIDIA Run:ai Model Streamer在 vLLM 2026 中原生.它与S3,GCS和本地NVMe合作.通过重叠I/O和计算设置,大型模型的权重加载时间大约减少了一半.

### 层3  GPU内存快照 (Modal)

后续重启将直接消散到HBM  10倍快于重新启动.这是"在2秒内启动热的GPU"的最接近点.

### 层4 热池 (min_workers=1)

简单的减轻:总是准备好一个复制品.成本是1GPU的小时速24x7.$0.85-$为了避免30s冷开始,每小时1.50美元) 和宽松的大型 (为了避免5分钟冷开始,每小时付4美元).温池成为强制性的SLA门:通常在70B+模型上是TTFT P99 <60s.

### 五层 层次加载 (ServerlessLLM)

服务器无LLM将存储视为一个层次结构:NVMe (快速但大),DRAM (中型但层次),HBM (小但即时).重量预装到DRAM;按需加载到HBM.纸报告了冷负载上的延迟减少10-200倍,而无明的磁盘到HBM.生产采用是早期的,但与vLLM的集成存在.

### 层6 直播迁移 (奖金模式)

当一个节点不可用时 (点驱逐,节点排泄),传统模式是冷启动另一个复制和排泄请求队列.直播迁移将输入代币 (千字节) 移动到一个目标地带,该模型被加载,并重新计算KV缓存.重新计算比网络上传输GBKV缓存便宜.适用于分类部署.

### 热池的数学

对于一个 P99 TTFT SLA 的服务,问题不是"热池是/不是"而是"有多少热复制品,哪些路径得到它们".

- 高价值互动路径 (直播聊天,语音代理): `min_workers=1-2`现在,我们要去.
- 背景批量路径 (夜间分类):接受从规模到零,可承受5至10分钟冷开始.
- 优质级别:`min_workers`租户每位有专用容量.

### 在优化之前测量

对于70B模型在新节点上进行冷启动解剖学 (说明):

| Phase | Time | Mitigation |
|-------|------|-----------|
| Node provision | 50s | Bottlerocket + pre-seeded image, warm pool |
| Image pull | 180s | Pre-seeded data volume (eliminate) |
| Weights to HBM | 75s | Model streamer (halve); GPU snapshot (eliminate) |
| Engine init | 20s | Persistent CUDA graph cache |
| First forward | 3s | Min inherent latency |
| **Total cold** | **328s** | |
| **Total with mitigations** | **~15s** | 22x reduction |

### 你应该记住的数字

- 模特冷启动: 2-4秒 (使用GPU快照).
- 基本默认冷启动:5-10秒;以预加热的次下.
-  70B冷开始:3-8分钟.
- 运行:ai 流量模型:重量加载速度2倍.
- 服务器无LLM级载荷:延迟减少10-200倍 (纸号).

```figure
cold-start-pipeline
```

## 用它

`code/main.py`报告冷开始时间,热池成本和热池自偿的破产要求率.

## 运送它

这一课产生了`outputs/skill-cold-start-planner.md`鉴于SLA,模型大小和交通形状,选择哪些减轻措施.

## 运动

1. 跑步`code/main.py`计算比较低的热复制比通过SLO额外的请求降低付冷开始税的破产要求率.
2. 您将部署一个13B模型, P99 TTFT SLA3s. 选择最小减轻堆 (最小层) 实现这一目标.
3. 提前播放瓶子将消除图像拉力,但重量仍然从快照到HBM. 如果快照支持的NVMe以7GB/s读取,则计算70B模型的墙钟.
4. 双方都认为 什么是现实风险,以及减轻 (即时快照,加密,名区隔离)?
5. 设计一个层次的热池政策:为付费用户,试用用户和批量工作负载提供多少热复制?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Cold start | "the big pause" | Time from request to first token on a fresh replica |
| Warm pool | "always-on minimum" | `min_workers >= 1` to keep at least one replica ready |
| Pre-seeded image | "baked AMI" | Node image with container weights pre-resident |
| Bottlerocket | "AWS node OS" | AWS container-optimized OS with dual-volume snapshot support |
| Model streamer | "streaming load" | Overlap weights I/O with compute setup |
| GPU snapshot | "checkpoint to HBM" | Serialize post-load GPU state; deserialize on restart |
| Tiered loading | "NVMe + DRAM + HBM" | Hierarchy of storage tiers; load on demand |
| Live migration | "move tokens" | Transfer input (KB), recompute KV on destination |
| `min_workers` | "warm replicas" | Serverless minimum keep-alive count |
| Scale-to-zero | "full serverless" | No cost when idle; accept full cold-start tax |

## 进一步阅读

- [Modal — Cold start performance](https://modal.com/docs/guide/cold-start)莫达尔发布的基准和检查点架构.
- [AWS Bottlerocket](https://github.com/bottlerocket-os/bottlerocket)预先播种数据量快照模式.
- [NVIDIA Run:ai Model Streamer](https://github.com/run-ai/runai-model-streamer)重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量重量
- [Baseten — Cold starts](https://docs.baseten.co/deployment/autoscaling/cold-starts)预热的游戏手册.
- [ServerlessLLM paper (USENIX OSDI'24)](https://www.usenix.org/conference/osdi24/presentation/fu) 层次装载设计.
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) 活迁移,用于分类部署.
