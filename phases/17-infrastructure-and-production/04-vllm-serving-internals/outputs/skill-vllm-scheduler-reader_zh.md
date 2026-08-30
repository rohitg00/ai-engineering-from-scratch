---
name: vllm-scheduler-reader
description: 通过读取 vLLM 服务配置的调度器级旋钮进行诊断，识别 PagedAttention、continuous batching 和 chunked prefill 中的瓶颈。
version: 1.0.0
phase: 17
lesson: 04
tags: [vllm, paged-attention, continuous-batching, chunked-prefill, serving, scheduler]
---

给定 vLLM 服务配置（模型、dtype、硬件、`--gpu-memory-utilization`、`--max-num-batched-tokens`、`--enable-chunked-prefill`、`--speculative-model` 或 `--speculative-config`、最大并发数，以及观察到的 TTFT mean/P99、ITL mean/P99、吞吐量 tok/s 指标集），生成调度器级诊断。

生成：

1. 配置读取。对于每个标志，命名其控制的调度器行为和 2026 年默认值。标记任何设置为非默认值的标志并说明原因。
2. 瓶颈识别。将瓶颈分类为以下之一：PagedAttention 配置不足（KV 块饥饿）、continuous-batching 停滞（WAITING 队列增长）、chunked-prefill 尺寸不当（TTFT 尾部尖峰）、decode 计算受限（ITL 下限）或 HBM 受限（无法容纳批次）。用报告的指标证明。
3. 旋钮推荐。具体的、有序的操作——要翻转哪个标志、要尝试哪个值、要观察哪个指标。不要在没有先耗尽调度器级调优的情况下建议“尝试更多 GPU”。
4. 兼容性检查。对于 vLLM v0.18.0  specifically：标记 `--enable-chunked-prefill` + `--speculative-model` 组合为硬不兼容。如果两者都需要，推荐 V1 中的 N-gram GPU 推测解码作为记录的例外。
5. 接下来阅读什么。根据诊断发现的内容，指向 vLLM v0.18.0 发布说明、PagedAttention 论文或 Aleksa Gordic V1 调度器演练之一。

硬性拒绝：
- 在没有四个核心指标（TTFT、ITL、吞吐量、并发）的情况下进行诊断。拒绝并要求提供指标集。
- 在未检查推测解码配置的情况下推荐 `--enable-chunked-prefill`。
- 将 `DCGM_FI_DEV_GPU_UTIL` 视为扩缩容信号。vLLM 预分配 KV；占空比数字具有误导性。

拒绝规则：
- 如果报告的吞吐量在 H100 上低于 100 tok/s，瓶颈可能不是 vLLM——检查客户端分词器、Python GIL 或请求级序列化。
- 如果 `--gpu-memory-utilization` 设置为低于 0.7，拒绝进一步调优——运维人员选择将 HBM 闲置，修复方法是在翻转调度器标志之前提高上限。
- 如果运维人员要求 draft-model 推测下的推测解码 + chunked-prefill 配方，拒绝并命名 v0.18.0 不兼容性。指向 Phase 17 · 05 的 EAGLE-3。

输出：一页调度器诊断，列出标志、瓶颈、有序推荐、兼容性说明和下一步阅读指针。以“接下来测量什么”段落结束，根据识别的瓶颈命名 P99 ITL、块分配率或 WAITING 队列深度之一。
