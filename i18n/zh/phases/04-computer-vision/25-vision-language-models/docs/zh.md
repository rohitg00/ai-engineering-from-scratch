# 视觉-语言模型 — ViT-MLP-LLM 模式

> 视觉编码器将图像转换为 token。MLP 投影器将这些 token 映射到 LLM 的嵌入空间。其余工作由语言模型完成。这一模式——ViT-MLP-LLM——是 2026 年所有生产级 VLM 的基础。

**Type:** Learn + Use
**Languages:** Python
**Prerequisites:** Phase 4 Lesson 14（ViT）、Phase 4 Lesson 18（CLIP）、Phase 7 Lesson 02（自注意力）
**Time:** 约 75 分钟

## 学习目标

- 陈述 ViT-MLP-LLM 架构，并解释三个组件各自的贡献
- 在参数量、上下文长度和基准性能方面比较 Qwen3-VL、InternVL3.5、LLaVA-Next 和 GLM-4.6V
- 解释 DeepStack：为什么多层 ViT 特征比单一最后一层特征能更好地收紧视觉-语言对齐
- 用跨模态错误率（CMER）在生产环境中度量 VLM 幻觉，并对信号采取行动

## 问题所在

CLIP（Phase 4 Lesson 18）为图像和文本提供了一个共享嵌入空间，这足以支持零样本分类和检索。但它无法回答“这张图里有多少辆红色汽车？”，因为 CLIP 不生成文本——它只计算相似度得分。

视觉-语言模型（VLM）——Qwen3-VL、InternVL3.5、LLaVA-Next、GLM-4.6V——将 CLIP 系列的图像编码器接入一个完整的语言模型。模型看到图像加上问题后生成答案。2026 年，开源 VLM 在多模态基准（MMMU、MMBench、DocVQA、ChartQA、MathVista、OSWorld）上已可与 GPT-5 和 Gemini-2.5-Pro 匹敌甚至超越。

三件套（ViT、投影器、LLM）是标准配置。模型之间的差异在于用哪个 ViT、哪个投影器、哪个 LLM，以及训练数据和对齐方案。理解了这个模式后，替换任何组件都是机械性操作。

## 概念

### ViT-MLP-LLM 架构

```mermaid
flowchart LR
    IMG["Image<br/>(H x W x 3)"] --> ViT["Vision encoder<br/>(ViT, CLIP-L,<br/>SigLIP, DINOv3)"]
    ViT --> FEATS["Image tokens<br/>(N, d_vit)"]
    FEATS --> PROJ["Projector<br/>(2-4 layer MLP<br/>or Q-former)"]
    PROJ --> VTOK["Image tokens<br/>in LLM space<br/>(N, d_llm)"]
    TXT["Text prompt"] --> TOK["LLM tokenizer"]
    TOK --> TTOK["Text tokens<br/>(M, d_llm)"]
    VTOK --> CONCAT["Interleave<br/>or concat"]
    TTOK --> CONCAT
    CONCAT --> LLM["Decoder LLM<br/>(Qwen3, LLaMA, etc.)"]
    LLM --> OUT["Text answer"]

    style ViT fill:#dbeafe,stroke:#2563eb
    style PROJ fill:#fef3c7,stroke:#d97706
    style LLM fill:#dcfce7,stroke:#16a34a
```

1. **视觉编码器** — 一个预训练的 ViT（CLIP-L/14、SigLIP、DINOv3 或微调变体）。产出 patch token。
2. **投影器** — 一个小型模块（2-4 层 MLP，或 Q-former），将视觉 token 映射到 LLM 的嵌入维度。大部分微调都发生在这里。
3. **LLM** — 一个 decoder-only 语言模型（Qwen3、Llama、Mistral、GLM、InternLM）。按顺序读取视觉 + 文本 token，生成文本。

原则上这三个部分都可训练。实践中，视觉编码器和 LLM 基本保持冻结，只训练投影器——用很低的成本获得数十亿参数规模的信号。

### DeepStack

普通投影只使用 ViT 的最后一层。DeepStack（Qwen3-VL）从 ViT 的多个深度采样特征并将它们堆叠。较深的层承载高层语义；较浅的层承载细粒度的空间和纹理信息。将两者同时输入 LLM，弥合了“图像里有什么”（语义）与“具体在哪里”（空间定位）之间的差距。

### 三个训练阶段

现代 VLM 分阶段训练：

1. **对齐** — 冻结 ViT 和 LLM。仅在图像-描述对上训练投影器。教会投影器将视觉空间映射到语言空间。
2. **预训练** — 解冻全部参数。在大规模图文交错数据（5 亿对以上）上训练。构建模型的视觉知识。
3. **指令微调** — 在精选的（图像、问题、答案）三元组上微调。教会对话行为和任务格式。这一步把“具备视觉感知的 LM”变成可用的助手。

大多数 LoRA 微调以阶段 3 为目标，使用小规模标注数据集。

### 模型家族比较（2026 年初）

| 模型 | 参数量 | 视觉编码器 | LLM | 上下文 | 优势 |
|-------|--------|----------------|-----|---------|-----------|
| Qwen3-VL-235B-A22B（MoE） | 235B（22B 激活） | 定制 ViT + DeepStack | Qwen3 | 256K | 通用 SOTA，GUI agent |
| Qwen3-VL-30B-A3B（MoE） | 30B（3B 激活） | 定制 ViT + DeepStack | Qwen3 | 256K | 更小的 MoE 替代方案 |
| Qwen3-VL-8B（dense） | 8B | 定制 ViT | Qwen3 | 128K | 生产级 dense 默认选择 |
| InternVL3.5-38B | 38B | InternViT-6B | Qwen3 + GPT-OSS | 128K | MMBench / MMVet 表现强 |
| InternVL3.5-241B-A28B | 241B（28B 激活） | InternViT-6B | Qwen3 | 128K | 与 GPT-4o 相当 |
| LLaVA-Next 72B | 72B | SigLIP | Llama-3 | 32K | 开放，易于微调 |
| GLM-4.6V | ~70B | 定制 | GLM | 64K | 开源，OCR 强 |
| MiniCPM-V-2.6 | 8B | SigLIP | MiniCPM | 32K | 适合边缘部署 |

### 视觉 agent

Qwen3-VL-235B 在 OSWorld 上达到全球顶尖性能——OSWorld 是衡量**视觉 agent**操作 GUI（桌面、移动端、网页）能力的基准。模型看到截图，理解 UI，并发出动作（点击、输入、滚动）。结合工具调用，它能闭环完成常见桌面任务。2026 年大多数“AI PC”演示背后运行的就是这类系统。

### Agent 能力 + RoPE 变体

VLM 需要知道某一帧**何时**出现在视频中。Qwen3-VL 从 T-RoPE（时间旋转位置编码）演进到**基于文本的时间对齐**——在视频帧之间穿插显式的时间戳文本 token。模型看到“`<timestamp 00:32>` 帧，提示词”，并能推理时间关系。

### 对齐问题

爬取的数据集中有 12% 的图文对包含未完全扎根于图像的描述。在此类数据上训练的 VLM 会悄悄学会幻觉——捏造物体、误读数字、虚构关系。在生产环境中，这是最主要的失败模式。

Skywork.ai 提出了**跨模态错误率（CMER）**来追踪这一问题：

```
CMER = fraction of outputs where the text confidence is high but the image-text similarity (via a CLIP-family checker) is low
```

CMER 高意味着模型在自信地陈述图像中不存在的内容。监控 CMER 并将其作为生产 KPI，在他们的部署中将幻觉率降低了约 35%。诀窍不是“修复模型”，而是“将高 CMER 的输出路由到人工审核”。

### 使用 LoRA / QLoRA 微调

对 70B VLM 进行全量微调超出大多数团队的能力范围。在注意力 + 投影器层上使用 LoRA（rank 16-64），或使用 4-bit 基础权重的 QLoRA，单张 A100 / H100 即可运行。成本：5,000-50,000 条样本，约 $100-$5,000 的算力，2-10 小时训练。

### 空间推理仍然薄弱

当前 VLM 在空间推理基准（上下、左右、计数、距离）上的得分仅为 50-60%。如果你的用例依赖“哪个物体在哪个物体之上”，务必充分验证——通用 VLM 的表现低于人类。对于纯空间任务，优于 VLM 的替代方案：专用的关键点 / 姿态估计器、深度模型，或结合框几何后处理的检测模型。

```figure
v4-vlm-projector
```

## 动手构建

### 第 1 步：投影器

你最常训练的部分。带 GELU 的 2-4 层 MLP。

```python
import torch
import torch.nn as nn


class Projector(nn.Module):
    def __init__(self, vit_dim=768, llm_dim=4096, hidden=4096):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(vit_dim, hidden),
            nn.GELU(),
            nn.Linear(hidden, llm_dim),
        )

    def forward(self, x):
        return self.net(x)
```

输入是一个 `(N_patches, d_vit)` 的 token 张量。输出是 `(N_patches, d_llm)`。LLM 将输出的每一行仅当作另一个 token 处理。

### 第 2 步：端到端组装 ViT-MLP-LLM

最小化 VLM 前向传播的骨架。真实代码使用 `transformers`；这里只是概念性的结构。

```python
class MinimalVLM(nn.Module):
    def __init__(self, vit, projector, llm, image_token_id):
        super().__init__()
        self.vit = vit
        self.projector = projector
        self.llm = llm
        self.image_token_id = image_token_id  # placeholder token in text prompt

    def forward(self, image, input_ids, attention_mask):
        # 1. vision features
        vision_tokens = self.vit(image)                     # (B, N_patches, d_vit)
        vision_embeds = self.projector(vision_tokens)       # (B, N_patches, d_llm)

        # 2. text embeddings
        text_embeds = self.llm.get_input_embeddings()(input_ids)  # (B, M, d_llm)

        # 3. replace image placeholder tokens with vision embeds
        merged = self._merge(text_embeds, vision_embeds, input_ids)

        # 4. run LLM
        return self.llm(inputs_embeds=merged, attention_mask=attention_mask)

    def _merge(self, text_embeds, vision_embeds, input_ids):
        out = text_embeds.clone()
        expected = vision_embeds.size(1)
        for b in range(input_ids.size(0)):
            positions = (input_ids[b] == self.image_token_id).nonzero(as_tuple=True)[0]
            if len(positions) != expected:
                raise ValueError(
                    f"batch item {b} has {len(positions)} image tokens but vision_embeds has {expected} patches."
                    " Every sample in the batch must be pre-padded to the same number of image placeholder tokens.")
            out[b, positions] = vision_embeds[b]
        return out
```

文本中的 `<image>` 占位 token 会被替换为真实的图像嵌入——LLaVA、Qwen-VL 和 InternVL 使用的都是同一模式。

### 第 3 步：CMER 计算

一个轻量级的运行时检查。

```python
import torch.nn.functional as F


def cross_modal_error_rate(image_emb, text_emb, text_confidence, sim_threshold=0.25, conf_threshold=0.8):
    """
    image_emb, text_emb: embeddings of image and generated text (normalised internally)
    text_confidence:     mean per-token probability in [0, 1]
    Returns:             fraction of high-confidence outputs with low image-text alignment
    """
    image_emb = F.normalize(image_emb, dim=-1)
    text_emb = F.normalize(text_emb, dim=-1)
    sim = (image_emb * text_emb).sum(dim=-1)        # cosine similarity
    high_conf_low_sim = (text_confidence > conf_threshold) & (sim < sim_threshold)
    return high_conf_low_sim.float().mean().item()
```

将 CMER 作为生产 KPI。按端点、按提示类型、按客户进行监控。CMER 上升表明模型开始在某些输入分布上产生幻觉。

### 第 4 步：玩具 VLM 分类器（可运行）

演示投影器可以被训练。输入伪造的“ViT 特征”，用一个微型的 LLM 风格 token 预测类别。

```python
class ToyVLM(nn.Module):
    def __init__(self, vit_dim=32, llm_dim=64, num_classes=5):
        super().__init__()
        self.projector = Projector(vit_dim, llm_dim, hidden=64)
        self.head = nn.Linear(llm_dim, num_classes)

    def forward(self, vision_tokens):
        projected = self.projector(vision_tokens)
        pooled = projected.mean(dim=1)
        return self.head(pooled)
```

在合成（特征，类别）对上不到 200 步即可拟合——足以证明投影器模式有效。

## 使用它

2026 年生产团队使用 VLM 的三种方式：

- **托管 API** — OpenAI Vision、Anthropic Claude Vision、Google Gemini Vision。零基础设施，但有供应商风险。
- **开源自托管** — 通过 `transformers` 和 `vllm` 部署 Qwen3-VL 或 InternVL3.5。完全掌控，前期投入更大。
- **领域微调** — 加载 Qwen2.5-VL-7B 或 LLaVA-1.6-7B，在 5k-50k 条自定义样本上做 LoRA，用 `vllm` 或 `TGI` 提供服务。

```python
from transformers import AutoProcessor, AutoModelForVision2Seq
import torch
from PIL import Image

model_id = "Qwen/Qwen3-VL-8B-Instruct"
processor = AutoProcessor.from_pretrained(model_id)
model = AutoModelForVision2Seq.from_pretrained(model_id, torch_dtype=torch.bfloat16, device_map="auto")

messages = [{
    "role": "user",
    "content": [
        {"type": "image", "image": Image.open("plot.png")},
        {"type": "text", "text": "What does this chart show?"},
    ],
}]
inputs = processor.apply_chat_template(messages, add_generation_prompt=True, tokenize=True, return_dict=True, return_tensors="pt").to("cuda")
generated = model.generate(**inputs, max_new_tokens=256)
answer = processor.decode(generated[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
```

`apply_chat_template` 隐藏了 `<image>` 占位 token 的分词处理；模型在内部完成合并。

## 交付它

本课产出：

- `outputs/prompt-vlm-selector.md` — 根据准确率、延迟、上下文长度和预算，在 Qwen3-VL / InternVL3.5 / LLaVA-Next / API 之间做出选择。
- `outputs/skill-cmer-monitor.md` — 生成用于为生产级 VLM 端点添加跨模态错误率监测的代码，包括按端点的仪表盘和告警阈值。

## 练习

1. **（简单）** 在五张图像上用任意开源 VLM 运行三个提示词（“这是什么？”、“数一数物体”、“描述场景”）。手工将每个答案评为正确 / 部分正确 / 幻觉。计算一个初步的类 CMER 比率。
2. **（中等）** 在 500 张带描述的目标领域图像上，用 LoRA（rank 16）微调 Qwen2.5-VL-3B 或 LLaVA-1.6-7B。比较零样本与微调后的 MMBench 风格准确率。
3. **（困难）** 将 VLM 的图像编码器从默认的 SigLIP/CLIP 替换为 DINOv3。只重新训练投影器（冻结 LLM + 冻结 DINOv3）。测量密集预测任务（计数、空间推理）是否有所提升。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| ViT-MLP-LLM | “VLM 模式” | 视觉编码器 + 投影器 + 语言模型；2026 年所有 VLM |
| 投影器 | “桥梁” | 将视觉 token 映射到 LLM 嵌入空间的 2-4 层 MLP（或 Q-former） |
| DeepStack | “Qwen3-VL 的特征技巧” | 堆叠多层 ViT 特征，而非仅用最后一层 |
| 图像 token | "<image> 占位符” | 文本流中被投影后的视觉嵌入替换的特殊 token |
| CMER | “幻觉 KPI” | 跨模态错误率；当文本置信度高但图文相似度低时数值升高 |
| 视觉 agent | “会点击的 VLM” | 结合工具调用操作 GUI（OSWorld、移动端、网页）的 VLM |
| Q-former | “固定数量 token 桥梁” | BLIP-2 风格的投影器，产出固定数量的视觉查询 token |
| 对齐 / 预训练 / 指令微调 | “三个阶段” | 标准 VLM 训练流程 |

## 延伸阅读

- [Qwen3-VL Technical Report (arXiv 2511.21631)](https://arxiv.org/abs/2511.21631)
- [InternVL3.5 Advancing Open-Source Multimodal Models (arXiv 2508.18265)](https://arxiv.org/html/2508.18265v1)
- [LLaVA-Next series](https://llava-vl.github.io/blog/2024-05-10-llava-next-stronger-llms/)
- [BentoML: Best Open-Source VLMs 2026](https://www.bentoml.com/blog/multimodal-ai-a-guide-to-open-source-vision-language-models)
- [MMMU: Multi-discipline Multimodal Understanding benchmark](https://mmmu-benchmark.github.io/)
- [VLMs in manufacturing (Robotics Tomorrow, March 2026)](https://www.roboticstomorrow.com/story/2026/03/when-machines-learn-to-see-like-experts-the-rise-of-vision-language-models-in-manufacturing/26335/)