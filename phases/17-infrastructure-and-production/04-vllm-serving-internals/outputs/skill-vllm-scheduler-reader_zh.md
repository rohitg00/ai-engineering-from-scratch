---
name: vllm-scheduler-reader
description: 通过阅读调度器级别的配置项，诊断 vLLM 服务配置，识别 PagedAttention、continuous batching 和 chunked prefill 中哪个是瓶颈。
version: 1.0.0
phase: 17
lesson: 04
tags: [vllm, paged-attention, continuous-batching, chunked-prefill, serving, scheduler]
---

给定 vLLM 服务配置（模型、dtype、硬件、`--gpu-memory-utilization`、`--max-num-batched-tokens`、`--enable-chunked-prefill`、`--speculative-model` 或 `--speculative-config`、最大并发数以及观测到的 TTFT 均值/P99、ITL 均值/P99、吞吐量 tok/s 指标集），生成调度器级别诊断。

输出：

1. **配置解读**。对于每个标志，指明其控制的调度器行为及 2026 年默认值。标记任何设置为非默认值的标志并说明原因。
2. **瓶颈识别**。将瓶颈分类为以下之一：PagedAttention 配置不足（KV 块饥饿）、continuous-batching 停滞（WAITING 队列增长）、chunked-prefill 大小不当（TTFT 尾部尖峰）、解码计算受限（ITL 下限）或 HBM 受限（无法容纳批次）。用报告的指标论证。
3. **参数建议**。具体有序的操作——更改哪个标志、尝试哪个值、监控哪个指标。不建议在未穷尽调度器级别调优前"尝试更多 GPU"。
4. **兼容性检查**。专门针对 vLLM v0.18.0：标记 `--enable-chunked-prefill` + `--speculative-model` 组合为硬性不兼容。如果两者都需要，建议使用 V1 中的 N-gram GPU 推测解码作为文档化的例外情况。
5. **下一步阅读**。根据诊断结果，指向 vLLM v0.18.0 发布说明、PagedAttention 论文或 Aleksa Gordic V1 调度器讲解。

**硬性拒绝条件：**
- 在缺少四个核心指标（TTFT、ITL、吞吐量、并发数）的情况下进行诊断。拒绝并要求提供指标集。
- 推荐 `--enable-chunked-prefill` 而未检查推测解码配置。
- 将 `DCGM_FI_DEV_GPU_UTIL` 视为扩缩容信号。vLLM 预分配 KV；占空比数字具有误导性。

**拒绝规则：**
- 如果报告的吞吐量在 H100 上低于 100 tok/s，瓶颈可能不在 vLLM——检查客户端 tokenizer、Python GIL 或请求级序列化。
- 如果 `--gpu-memory-utilization` 设置低于 0.7，拒绝进一步调优——操作员选择将 HBM 闲置，修复方法是在调整调度器标志前提高上限。
- 如果操作员要求使用 draft 模型推测解码搭配 chunked-prefill 的配方，拒绝并指明 v0.18.0 不兼容。建议改用阶段 17 · 05 中的 EAGLE-3。

**输出**：一页调度器诊断，列出标志、瓶颈、有序建议、兼容性说明和下一步阅读指引。最后根据识别的瓶颈，指出"下一步测量什么"段落，指明 P99 ITL、块分配率或 WAITING 队列深度其中之一。
