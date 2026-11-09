# 任何流媒体多元模型

> GPT-4o 运输出了大多数开放模型无法复制的产品:一个听到声音,看到视频,并实时回复的代理. 开放生态系统的答案在2024年底是MIO (Wang等人,2024年9月). 通过MIO,文字,图像,语音和音乐都被标记,在交织的序列上训练一个因果变革器,并产生任何方式. 任何GPT (Zhan等人,2024年2月) 是概念的证明;MIO是扩大规模;统一-IO 2 (Allen AI,2023年12月) 是视觉+行动基础的表弟. 这一课中,有四个代币,一个变压器,

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, four-modality token allocator + streaming decode loop)
**Prerequisites:** Phase 12 · 11 (Chameleon), Phase 6 (Speech and Audio)
**Time:** ~120 minutes

## 学习目标

- 设计一个共享词汇库,可以容纳文字,图像,语音和音乐代币,
- 对于压缩+重建交易,比较SEED-Tokenizer (图像) 和SpeechTokenizer残余-VQ (言语).
- 解释一个四阶段的课程,
- 举个三个开放式任何菜谱及其主要的折扣:MIO,AnyGPT,Unified-IO 2.

## 问题

统一多模式模型很容易被声称,而且很难在规模上构建.到2024年,大多数"任何到任何"系统都被管道:视觉模型 →文本表示 →语音模型 →音频.每次跳跃都会失去信息,增加延迟,并复杂化训练.GPT-4o的演示视频显示了一个单个模型替代方案,后续反应;开放系统追踪了几个月.

工程挑战:

- 代币化必须存在于每个模式, 压缩不损失, 足以重建, 并以变压器能消耗的速度生产代币.
- 一个单词库必须为文本 (32k+),图像 (8k+),语音 (4k+),音乐 (8k+) 配置空间.至少有五万多个条目.
- 培训数据必须涵盖每个输入输出对 (文字→图像,图像→语音,语音→图像等) 或模型必须组成.
- 输入必须流出代币足够快,以实现对话延迟 (<500ms时间到第一音频字节).

## 概念

### 对于四种方式的四个代币化器

子的标记器堆:

- 文字:标准BPE,词汇~32000.
- 图像:SEED-Tokenizer (2023),一个单独的图像代币器,具有8192条输入代码簿,每张图像发射32个代币.
- 语音:语音托基尼泽残留-VQ (2023),将16kHz波形编码成8个层次代码书;第一层是粗的内容,后层添加了 prosody 和扬声器身份.MIO保持了内容水平加上前三个音调水平,每个 1024 个代码,因此 4096 个语音标识.
- 音乐:类似的残余VQ (Meta的 MusicGen / Encodec家族),4-8代码书.MIO本身不运送音乐代码器 (其第四种方式是视频,像通过图像代码器的框架);本课的玩具添加音乐来展示一种新方式如何声称身份范围.

每种模式都产生整数代币.这些代币在共享词汇中获得不同 ID 范围:

```
text:   0..31999
image:  32000..40191  (8192 image tokens)
speech: 40192..44287  (4 codebooks x 1024 speech tokens)
music:  44288..52479  (8192 music tokens, the toy's extension)
sep:    52480..52485  (<image>, <speech>, <music>, </...>)
```

总数:大约52k词汇. 输入嵌入和输出投影覆盖了它.

### 流式解码

语音生成使用残留VQ.变压器预测基层 (层0) 语音代码;并行解码的残留定量器预测后层.每个层0代码大约为50ms的音频在16kHz.

流量模式:

1. 用户在麦克风中说话;实时音频代码器每50ms就发出语音代码.
2. 随着其到达,MIO 消耗代币 (即时预填+增量前).
3. 输出代币随着生成而流出;一个平行语音解码器将它们转换为50-150ms延迟的音频样本.
4. 时间到第一音频字节:MIO论文没有延迟数.下面的预算使这个设计最好是300ms左右,而GPT-4o的 ~250ms.

迷你Omni (arXiv:2408.16725),GLM-4-Voice (arXiv:2412.02612),和Moshi (arXiv:2410.00037) 是互补流通语音LLM设计.

### 四阶段课程

国际教育局的培训课程:

1. 阶段1 排列.大规模的模式对体:文字图像,文字言语,文字音乐.每个对使用自己的代号词汇部分.训练共享词汇.
2. 阶段 2  交互式.多种方式交互式文件 (图像+视频的博客,转录的播客等).
3. 增强语音数据,提升语音质量,而不损失文本能力.
4. 阶段4 SFT. 指示调整各种模式:VQA,字幕写作,叙述,语音对话.

错过一个阶段会降低特定的能力:跳过第二阶段,模型失去跨模式背景;跳过第三阶段,语言不佳.

### 视觉思想链

作为推理步骤,模型发射中间图像代币.为"猫爬树吗?"模型:

1. 发射`<image>`图像的图像或图案.
2. 发出分析图的文字.
3. 发出了最后的答案.

预示中介图像作为一个划痕板. 基准在空间推理任务上改进. 这个想法反映了文字推理的思想链.

### 任何竞争对手

- 任何GPT (arXiv:2402.12226):四种模式 (文字,图像,语音,音乐),类似的设计.
- 统一IO 2 (arXiv:2312.17172):增加视觉行动输出,深度,正常. 更多任务多样性,规模较小.
- 简单的方法: 简单的方法: 简单的方法: 简单的方法:
-  (arXiv:2305.11846):可复合的扩散;通过共享的隐形.

任何GPT是它的概念祖先.

### 延迟预算

对于对话产品,每个组件的延迟是重要的:

- 微信到音频代码: ~50ms.
- 预填 (音频代币+历史):在8B模型上 ~100ms.
- 输出标志: ~50ms.
- 并行残留VQ+语音解码器: ~100-150ms.

总时间到第一个音频字节: ~300ms最小.GPT-4o声称 ~250ms.Moshi声称 160ms.MIO和AnyGPT都没有发布测量数据,所以把这个预算作为估计,而不是基准.

### 为什么任何人都会坚持

即使在2026年,任何开放式模型都会在两个轴上追踪闭式模型:

- 语音质量.残余VQ代码器是损失的;与ElevenLabs类语音相比,对话语音听起来是机器人.
- 问模型"唱你看到的歌"仍然比纯视力任务更经常失败.

这些是开放的研究问题.Qwen3-Omni (课时12.20) 是2025年最先进的开放尝试.

```figure
any-to-any-stream
```

## 用它

`code/main.py`其他:

- 定义了四种模式词汇分配,并打印了它.
- 通过代币器路由器路由多模进口 (文字,图像,音频片段,音乐) 的列表.
- 模拟传输解码,以计算延迟.
- 计算预期的时间到第一个音频字节,给出编码器,预填和解码器延迟.

## 运送它

这一课产生了`outputs/skill-any-to-any-pipeline-auditor.md`鉴于对话性产品规格 (入门方式,出门方式,延迟目标),它审计了MIO家族设计选择,并计算了延迟预算.

## 运动

1. 您的产品接受语音输入,并返回语音输出. 终端延迟预算目标是什么?列出花时间的组件.

2. 语音托基尼泽残留-VQ使用8本代码书. 提出为什么平行解码残留水平是必要的 (相对于连续) 以及它带来的延迟节约.

3. 您的词汇有32k文字+8k图像+4k语音. 添加8k音乐和10个分离器.隐藏 dim4096的嵌入矩阵参数成本是多少?

4. 视觉思想链发出了中间的图像.

5. 阅读Moshi (arXiv:2410.00037).描述其"内在单独论"技术,并与MIO的视觉链思想进行比较.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Any-to-any | "Multimodal in/out" | A single model that accepts and emits text, image, speech, and music in any direction |
| Residual-VQ | "Speech tokenizer stack" | Multi-codebook tokenization where each layer adds information; base layer is content, later layers are prosody |
| SEED-Tokenizer | "Image codes" | Discrete image tokenizer with an 8192-entry codebook and 32 tokens per image, used by MIO |
| Chain-of-visual-thought | "Visual scratchpad" | The model generates an intermediate image as a reasoning step before its final answer |
| Time-to-first-audio-byte | "TTFAB" | Latency from user voice to first audio output; <500ms for conversational feel |
| Four-stage curriculum | "Training recipe" | Alignment -> interleaved -> speech-enhanced -> SFT, in that order |

## 进一步阅读

- [Wang et al. — MIO (arXiv:2409.17692)](https://arxiv.org/abs/2409.17692)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Lu et al. — Unified-IO 2 (arXiv:2312.17172)](https://arxiv.org/abs/2312.17172)
- [Wu et al. — NExT-GPT (arXiv:2309.05519)](https://arxiv.org/abs/2309.05519)
- [Tang et al. — CoDi (arXiv:2305.11846)](https://arxiv.org/abs/2305.11846)
