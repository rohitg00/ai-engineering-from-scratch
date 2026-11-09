# 简素Pro:单元多模模型的离合编码器

> 统一多动态模型具有不可避免的紧张性. 了解需要语义特性 SigLIP或DINOv2输出向量富含概念级信息. 代人想要重建友好的代码, VQ代码, 两个目标在一个编码器中不能兼容. 詹努斯 (DeepSeek,2024年10月) 和詹努斯-普罗 (DeepSeek,2025年1月) 认为解决方案是停止尝试:分离两个编码器. 通过SIGLIP进行转换器体的分类,但通过VQ代码器生成路径理解. 在7B,Janus-Pro在Geneval上击败了DALL-E3,同时与MMMU上的LLaVA相匹配. 这一课解释了为什么两个编码器在一个失败的情况下工作.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, dual-encoder routing + shared-body signal)
**Prerequisites:** Phase 12 · 13 (Transfusion), Phase 12 · 14 (Show-o)
**Time:** ~120 minutes

## 学习目标

- 解释为什么单个共享编码器会损害理解或生成质量.
- 描述Janus-Pro的路由:输入侧面的SigLIP功能用于理解,输入和输出对VQ代币进行生成.
- 追踪数据混合规模,使得Janus-Pro在Janus没有成功的地方.
- 进行离合式 (Janus-Pro),连续式 (Transfusion) 和离合式 (Show-o) 架构的比较.

## 问题

统一模型在理解和生成中共享一个变体.之前的尝试 (Chameleon, Show-o, Transfusion) 都使用一个视觉代币器用于两方向.

- 优化用于重建 (生成):VQ-VAE捕获细粒度的像素细节,但产生具有较弱的语义一致性的代币.
- 优化用于语义 (理解):SigLIP嵌入式组 "猫"图像在"猫"代币附近,但不允许良好的重建.

为了实现这一目标,Show-o和Transfusion在一个方向上支付可见的质量税.

## 概念

### 离合视觉编码

简斯-普罗的架构分开了两个编码器:

- 了解路径.输入图像 → SigLIP-SO400m → 2层MLP →变体体.
- 生成路径.输入图像 (如果在现有图像上定制) → VQ代码符号化器 →代码ID →变压器体.
- 输出生成. 变压器 → VQ解码器 → 像素预测的图像代币.

变体体是共享的, 身体的上下下下都是具体的任务.

输入以提示格式解读:a `<understand>`通过SigLIP标签路线;`<generate>`通过VQ路线,或者路线是从任务中隐含的.

### 为什么这能有效

了解损失得到了SigLIP功能,Clip式预训练已经调整为语义相似性.该模型的感知基准比Show-o/Transfusion更好,因为输入功能更适合任务.

输出输出得到VQ代币,这些代币被调整为重建.图像质量在Show-o上提高,因为VQ代码清洁地复制到像素.

共享变压器体会看到两个输入分布 (SigLIP和VQ) 并学习使用两者. 声称:足够的数据+足够的参数,身体吸收了开关.

### 数据扩展  Janus vs Janus-Pro

简素 (原始, arXiv 2410.13848) 引入了脱,但在小规模 (1.3B参数,数据有限).

- 根据第7B条 (vs1.3B)
- 对于第1阶段 (排列) 起 90M图像-文本对,从 72M.
- 对于第二阶段 (统一) 起 72M,从 26M起.
- 增加了200万个图像生成指令样本,

结果:Janus-Pro-7B与MMMU (60.3对 ~ 58) 的LLaVA相匹配,并且在GenEval (0.80对 0.67) 上击败了DALL-E 3 .

### 斯流 正调流变体

简斯流 (arXiv 2411.07975) 将VQ生成路径换成直流生成路径 (连续). 分裂成为SigLIP-for-understanding + rectified-flow-for-generation.质量天花板进一步升高.架构仍然是脱的编码器-共享体.

### 共同体的工作

变压器机器处理一个统一的序列,但有两个输入分布.

- 为了理解:使用SigLIP功能 + 文字代币 → 发出自动下降的文字.
- 为了生成:消耗文字代币+ (可选图像VQ代币) →自动排放图像VQ代币.

机器的每块都没有特定的重量,这是你预计在Qwen或Llama内找到的文字式变压器,加上两个输入适配器.

很有趣的是,这意味着Janus-Pro的身体可以从预训练的LLM开始.Janus-Pro确实从DeepSeek-MoE-7B开始.

### 与国际体育大学相比

课程是2026年的后续课程.

- 产生的多模式预训练 (InternVL3脊柱).
- 离合编码路由 (SigLIP进入,VQ+扩散开头).
- 统一理解+生成+编辑.

国际通用电脑系统 (InternVL-U) 将Janus-Pro的建筑选择纳入更大的框架.分离码码的想法现在是规模统一模型的默认.

### 限制

脱码器增加了建筑复杂性.两个代币器进行训练,两个输入路径进行维护,两个设置故障模式.对于不需要生成的产品,Janus-Pro是过度工程的.

对于不需要了解的产品,Janus- Pro过度合格 选择稳定散3/流动模型.

对于需要两者都的产品, 努斯-普罗现在是参考的开放架构.

```figure
l5-janus-decouple
```

## 用它

`code/main.py`模拟了Janus-Pro路由:

- 两个假编码器:类似SigLIP (产生256维的语义向量) 和类似VQ (产生整数码).
- 根据任务标签选择编码器的提示路由器.
- 共同体 (stand-in) 处理代币序列,不管编码器是哪个编码器生成它们.
- 从第1阶段 (调整) 转向第3阶段 (指示调整) 的权重样本时间表.

打印3个示例的路径:图像QA,T2I,图像编辑.

## 运送它

这一课产生了`outputs/skill-decoupled-encoder-picker.md`由于需要统一的产品+在边界质量上理解,它选择了Janus-Pro,JanusFlow或InternVL-U,并提出了具体的数据规模建议.

## 运动

1. 解释为什么一个7B开放型号在生成上可以匹配一个边界专有型号,但在理解上不能.

2. 执行路由器函数:给出提示文本,分类为 `understand`或`generate`你怎么处理模糊的提示,比如"描述然后绘制"?

3. 变压器机体现在输出了什么,损失发生了什么变化?

4. 提出一个第四个任务,Janus-Pro架构可以使用一个更离合的编码器处理.

5. 阅读Janus-Pro 4.2节关于数据扩展. 哪个数据阶段最为促进T2I质量增长与Janus?

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Decoupled encoding | "Two visual encoders" | Separate tokenizer or encoder per direction: semantic for understanding, reconstruction for generation |
| Shared body | "One transformer" | Single transformer processes either encoder's output; no modality-specific weights |
| SigLIP for understanding | "Semantic features" | CLIP-family vision tower providing rich conceptual features but poor reconstruction |
| VQ for generation | "Reconstruction codes" | Vector-quantized tokens that decode cleanly back to pixels |
| JanusFlow | "Rectified-flow variant" | Janus-Pro with a continuous flow-matching generation head instead of VQ |
| Routing tag | "Task tag" | Prompt marker (`<understand>` / `<generate>`) that picks the input encoder |

## 进一步阅读

- [Wu et al. — Janus (arXiv:2410.13848)](https://arxiv.org/abs/2410.13848)
- [Chen et al. — Janus-Pro (arXiv:2501.17811)](https://arxiv.org/abs/2501.17811)
- [Ma et al. — JanusFlow (arXiv:2411.07975)](https://arxiv.org/abs/2411.07975)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Dong et al. — DreamLLM (arXiv:2309.11499)](https://arxiv.org/abs/2309.11499)
