# 视觉指令调整

> 拉瓦 (四月2023年) 是地球上最多复制的多式建筑. 它用2层MLP取代BLIP-2的Q-Former,用天真的代币连接取代Flamingo的门禁交叉注意力,并从仅仅是文字的标题中训练了GPT-4生成的158k视觉指令转折. 任何在2023年至2026年之间建造VLM的实践者都会构建一些LLaVA的变体. 光-1,5是MLP投影机和336px编码器的交换. 为了高分辨率输入,LLaVA-NeXT增加了AnyRes. 单一的图像,多个图像和视频. 这一课阅读了食谱,应用了投影机,并解释了"简单的获胜"的原因.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, projector + instruction-template builder)
**Prerequisites:** Phase 12 · 02 (CLIP), Phase 11 (LLM Engineering — instruction tuning)
**Time:** ~180 minutes

## 学习目标

- 构建一个2层的MLP投影机,将ViT补丁嵌入式 (dim 1024) 映射到LLM的嵌入式 dim (dim 4096).
- 按照LLaVA的两阶段配方进行操作: (1) 在558万个字幕对等上进行投影器对齐, (2) 在158万个GPT-4生成的转折上进行视觉指令调整.
- 构建一个LLaVA格式提示符,使用图像代币定位符,系统提示符和用户/助理转.
- 解释为什么社区从Q-Former转移到MLP,

## 问题

蓝皮-2的Q-Former (课时12.03) 将图像压缩到32个代币. 清洁,高效,适合基准. 但它有两个问题.

首先,Q-Former可以训练,但其丢失并不是最终任务.第一阶段训练ITC+ITM+ITG.第二阶段训练LM损失.查询学习一些中间表示,LLM然后必须解码.信息在瓶中丢失.

第二,Q-Former需要188万个参数,在LLaVA的2023级别上,你必须与你的目标LLM共同设计.改变LLM,重新训练Q-Former.改变视觉编码器,重新训练.每个组合都是一个独立的研发项目.

简单的LLaVA答案是令人尬的:取了ViT的576个补丁代币,`1024 → 4096 → 4096`没有瓶,没有阶段1预训练, 只是训练MLP直接LM损失.

数据来自哪里?LLaVA的第二个见解:使用GPT-4 (仅用于文字) 来生成指令数据.为图像提供GPT-4的COCO标题和边界框数据,要求它产生对话,描述和复杂的推理问题.158k的指令响应免费转换.没有人注释.

结果是,VLM在8架A100上运行了一天,在MMMU上击败了Flamingo,并发出了一个可以扩展社区的开放检查点.到2023年底,它已经产生了50多个叉子.

## 概念

### 建筑

杆-1,5在7B:
- 视觉编码器:CLIP ViT-L/14 @ 336 (在1阶段冷,可在2阶段冷).
- 投影机:具有GELU激活的2层MLP,`1024 → 4096 → 4096`现在,我们要去.
- 法律法师:Vicuna-7B v1.5 (一个13B变体使用Vicuna-13B;后来的叉子转移到Llama-3.1-8B).

转发图像+文字提示:

```
img -> ViT -> 576 patches of dim 1024
patches -> MLP -> 576 tokens of dim 4096
prompt: system + "<image>" placeholder + user question
replace <image> token with the 576 projected tokens
feed the full sequence to the LLM
decode response
```

图像占据了LLM文本的576个代币.在2048文本上,留下了1472个代币.在32k文本上,这是一个圆形错误.

### 阶段1:投影机的配线

结ViT.结LLM. 训练只有2层MLP. 数据集:558k图像标题对 (LAION-CC-SBU). 损失:标题上的语言建模,根据投影图像代币.

在单个时代中,在128批次中,这在几个小时内完成.投影器学习将ViT空间映射到LLM空间.没有具体任务的监督.

### 阶段2:视觉指令调整

解投影机 (仍然可以训练).解LLM (通常完全,有时LoRA).训练158k视觉指导转折.

等人通过:
1. 拍摄一个COCO图片.
2. 摘出文本描述 (5个字幕+界限框列表).
3. 通过三个提示模板向GPT-4发送:
   - 对话: "用户和助理之间就此图像进行反复对话".
   - 详细描述: "给出图片的丰富,详细描述.
   - 复杂的推理: "问一个需要对图像进行推理的问题,然后回答".
4. 解析GPT-4的输出成 (指令,响应) 双.

任何这些都直接触及图像,只有文字描述.GPT-4幻觉可信的图像内容.一些噪音,但它奏效:158万转折足以解锁对话.

### 为什么社区复制了这

- 没有1阶段的损失,整个LM损失.
- 投影机在几个小时内运行,而不是几天.
- 通过重新训练只能将投影机进行更换 (LLaVA-Llama2,LLaVA-Mistral,LLaVA-Llama3).
- 视觉指令数据管道使用GPT-4,并且为新域进行再生便宜.

### 拉瓦-1.5 和拉瓦-下XT

拉瓦-1.5 (2023年10月) 补充:
- 混合在指令调整中,将学术任务数据 (VQA,OKVQA, RefCOCO) 进行调整.
- 系统更快.
- 两个层的MLP投影机代替原始单线层,以及Clip ViT-L/14在336px (576代币) 而不是224px (256代币).训练序列保持在2048代币.
- 报纸中有一种分网HD变体,后来LLaVA-NeXT以AnyRes为代号.

拉瓦-内XT (2024年1月) 补充道:
- AnyRes:将高分辨率图像分为336x336种植的2x2或1x3网格,加上一个全球低分辨率小图片.每个收获变成576个代币.一个2x2网格加上小图片每张图片产生约2880个视觉代币.一个1x3网格有更少的收获,因此成本更少的代币.OCR和图表任务跳跃.
- 较好的指令数据混合与 ShareGPT4V (高质量的GPT-4V标题)
- 强大的基础法学 (Mistral-7B, Yi-34B).

### 视频

12.08课程涵盖OneVision的深度.短版本:相同的投影机,但以一个模型的单一图像,多图像和视频课程进行培训,共享视觉标志预算.

### 与Q-Former的比较

| | Q-Former (BLIP-2) | MLP (LLaVA) |
|---|---|---|
| Visual tokens per image | 32 | 576 (base) or about 2880 (AnyRes, 2x2 grid) |
| Trainable params | 188M + LM | ~22M (7B) + LM |
| Stage 1 loss | ITC+ITM+ITG | LM only |
| LLM drop-in | Requires retrain | Swap with minimal retrain |
| Multi-image | Awkward | Natural (concat) |
| Video | Awkward | Natural (per-frame concat) |
| Token budget | Small | Large |

简单化和代币灵活性是MLP的胜利.Q-Former在代币预算中获胜.到2023年底,代币预算不再是约束力的约束 (LLM背景增长到32k-128k+) 而简单性占据主导地位.

### 提示格式

```
A chat between a curious human and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the human's questions. USER: <image> Describe this image in detail. ASSISTANT: The image shows ...
```

`<image>`在代币化之前,它被取代为576个视觉代币 (或大约2880个2x2 AnyRes格格).代币化器看到比它训练的序列长一点,但LLM处理新输入,因为第一阶段教了它.

### 参数经济

--------
- 临床检查 (CLIPS ViT-L/14 @ 336: 303M (冷阶段1,通常未冷阶段2).
- 投影机 (2x线性): ~22M可训练.
- 星7B:7B
- 总数:7.3B参数. 训练可在第二阶段进行:全7B+22M投影机.

训练费用:第2阶段:在8xA100上工作20小时.这是一个节点,可重复的关键号码.

```figure
mm-llava-projector
```

## 用它

`code/main.py`执行:

1. 纯Python中的2层MLP投影机 (玩具尺寸为16 → 32 → 32).
2. 快速构建管道:系统快速`<image>`换成N预测代币+用户转换+助手生成位数.
3. 视觉化器为在LLM背景下576代币视觉区块的外观 (占2k/32k/128k背景的占比).

## 运送它

这一课产生了`outputs/skill-llava-vibes-eval.md`由于LLaVA家族检查点,它运行了10个即时振动式套件 (3个字幕,3个VQA,2个推理,2个拒绝) 并报告了一个可以读取的人类的分数卡.不是基准;一个烟雾测试来确认投影机和LLM的连接良好.

## 运动

1. 计算2层MLP投影器的可训练参数数量`1024 → 4096 → 4096`通过GELU和偏差,它代表了LLaVA-13B的多少分?

2. 构建一个"拒绝"案例的LLaVA提示图片 图片包含一个私人. 写出预期的助理反应. 为什么LLaVA应该拒绝这种零射击,以及需要什么培训数据来加强拒绝?

3. 阅读LLaVA-NeXT博客的AnyRes部分.计算在AnyRes上1344x672图像的视觉代币数量.将其与336x336的基 576代币进行比较.

4. 视觉指令调整 (视觉指令调整) 直接进入第二阶段,则会发生什么?

5. 对于一个新领域 (医疗X射线,卫星图像),描述四步数据管道生成域指示.每一步可能会发生什么问题?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Projector | "MLP bridge" | 2-layer MLP with GELU mapping ViT dim to LLM dim |
| Image token | "<image> placeholder" | Prompt marker replaced by N projected visual tokens before inference |
| Visual instruction tuning | "LLaVA stage 2" | Training on GPT-4-generated (image, instruction, response) triplets |
| Stage 1 alignment | "Projector pretraining" | Freeze ViT and LLM, train projector with LM loss on captions |
| AnyRes | "Multi-crop tiling" | Split high-res image into a tile grid and concatenate each tile's visual tokens |
| LLaVA-Instruct | "GPT-4-generated" | 158k instruction-response pairs synthesized from COCO captions + GPT-4 |
| Vision encoder freeze | "Backbone locked" | CLIP weights do not update in stage 1, sometimes not in stage 2 either |
| ShareGPT4V | "Better captions" | 1M dense captions generated by GPT-4V, used for higher-quality alignment |
| VQA | "Visual question answering" | Task of answering a free-form question about an image |
| Prismatic VLMs | "Design-space paper" | Karamcheti 2024 ablation systematically testing projector and data choices |

## 进一步阅读

- [Liu et al. — Visual Instruction Tuning (arXiv:2304.08485)](https://arxiv.org/abs/2304.08485)LLaVA纸
- [Liu et al. — Improved Baselines with Visual Instruction Tuning (arXiv:2310.03744)](https://arxiv.org/abs/2310.03744) LLaVA-1.5.
- [Chen et al. — ShareGPT4V (arXiv:2311.12793)](https://arxiv.org/abs/2311.12793)密集字幕数据集.
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865)设计空间的排放.
- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326)统一单个图像,多个图像,视频.
