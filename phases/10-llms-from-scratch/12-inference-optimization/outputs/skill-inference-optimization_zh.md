---
name: skill-inference-optimization
description: 诊断和优化 LLM 推理服务的吞吐量、延迟和成本
version: 1.0.0
phase: 10
lesson: 12
tags: [inference, kv-cache, batching, speculative-decoding, vllm, optimization]
---

# LLM 推理优化模式

两个阶段：prefill（计算受限，并行）和 decode（内存受限，顺序）。
每个优化针对一个或两个阶段。

```
请求 -> Prefill（处理提示） -> Decode（生成 token） -> 回复
              |                            |
         计算受限               内存受限
         优化：融合，           优化：批处理，
         前缀缓存              量化、投机解码
```

## 决策框架

### 步骤 1：识别你的瓶颈

测量工作负载的 ops:byte 比率：

| ops:byte | 瓶颈 | 优化方向 |
|----------|-------|-----------------|
| < 50 | 内存 | 量化 KV cache，增加批次大小 |
| 50-200 | 过渡 | 两者都重要，从批处理开始 |
| > 200 | 计算 | 内核融合、张量并行、FP8 |

### 步骤 2：选择你的引擎

- **默认**：vLLM（最广泛的模型支持、PagedAttention、OpenAI 兼容 API）
- **多轮/结构化输出**：SGLang（RadixAttention 前缀缓存、约束解码）
- **最大 NVIDIA 吞吐量**：TensorRT-LLM（内核融合、H100 上 FP8）

### 步骤 3：按顺序应用优化

1. **KV cache** -- 始终开启，无缺点
2. **连续批处理** -- 始终开启，无缺点（vLLM/SGLang 默认执行）
3. **前缀缓存** -- 如果你有共享系统提示则启用（大多数聊天机器人都有）
4. **量化** -- KV cache INT8/FP8 以最小质量损失减少 2-4 倍内存
5. **投机解码** -- 当延迟比吞吐量更重要时添加
6. **张量并行** -- 当模型无法放入一个 GPU 时跨 GPU 拆分

## KV cache 内存公式

```
每 token = 2 * 层数 * kv 头数 * 头维度 * 每参数字节数
总计 = 每 token * 序列长度 * 并发用户数
```

常见模型快速参考（BF16）：

| 模型 | 每 token | 100 用户 @ 4K |
|-------|-----------|----------------|
| Llama 3 8B | 32 KB | 12.5 GB |
| Llama 3 70B | 320 KB | 125 GB |
| Llama 3 405B | 504 KB | 197 GB |

## 投机解码检查清单

- 草稿模型应比目标模型小 5-10 倍（例如，70B 用 8B 草稿）
- 接受率 > 70% 才有有意义的加速
- 在可预测文本上最佳（代码、结构化输出、自然语言）
- 在创意/采样密集型任务上最差（低温有帮助）
- 大多数工作负载：EAGLE > draft-target > n-gram

## 常见错误

- 以 batch=1 运行 decode（内存受限，GPU 计算 95% 空闲）
- 分配连续 KV cache 块（使用 PagedAttention，接近零浪费）
- 当 80% 请求共享相同系统提示时忽略前缀缓存
- 为模型权重过度配置 GPU 内存，不给 KV cache 留空间
- 测量吞吐量而不测量延迟（10 秒 TTFT 的高吞吐量无用）
- 在高温下使用投机解码（接受率降至 50% 以下）

## 监控检查清单

- 首 token 时间 (TTFT)：prefill 延迟，交互式使用目标 < 500ms
-  token 间延迟 (ITL)：decode 速度，流式传输目标 < 50ms
- 吞吐量 (token/秒)：所有并发用户总计
- KV cache 利用率：已分配 cache 的使用百分比
- 批次利用率：每次迭代填充的批次槽百分比
- 队列深度：等待批次槽的请求数
