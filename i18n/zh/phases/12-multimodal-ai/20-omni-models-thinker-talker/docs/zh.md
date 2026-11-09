# 模:Qwen2.5 - 模和思想家-谈话者分区

> 2024年5月的GPT-4o产品演示不仅因为底层模型而造成破坏,而是由于产品形状语音接口, 开放生态系统在2024年和2025年期间一直在努力达到该产品表面. 文2.5-Omni (2025年3月) 是参考开放设计:一个Thinker (大型发达文字变压器) 加上一个Talker (并行发达语音变压器),通过流媒体语音代币连接. 迷你Omni简化了它,莫希匹配了它的延迟,GLM-4-Voice扩展到中国. 这一课讲述了"思考者-谈话者"架构和延迟预算,

**Type:** Build
**Languages:** Python (stdlib, streaming pipeline latency simulator + VAD loop), TypeScript
**Prerequisites:** Phase 12 · 19 (audio-LLMs), Phase 12 · 16 (any-to-any)
**Time:** ~180 minutes

## 学习目标

- 分开推断管道为Thinker (文本推理) 和 Talker (言语合成) 并解释为什么并行流动工作.
- 计算对话交互的时间到第一音频字节 (TTFAB) 预算,分别分别分别.
- 描述TMRoPE在思考器内视觉,音频和文本中编码的时间一致位置.
- 举个实时对话模式,半双和全双,并解释VAD转换如何驱动半双交换.

## 问题

实时语音助理必须做很多事情,快速:

1. 听用户说话,实时语音标记,声活动检测 (VAD) 知道他们什么时候说话.
2. 选择性地看. 摄像头输入速度为2~4FPS, 流入智能思维器,
3. 想想,根据谈话历史编写一个答案.
4. 语音.合成音频代码,解码到波形,流向用户的扬声器.

每一步都增加了延迟.对话感需要总回路 <500ms 以下,用户停止注意到延迟.GPT-4o声称约250ms.Moshi ~160ms.Qwen2.5-Omni ~350-500ms.

任何组件都需要流动. 没有什么可以"分组所有然后解码".

## 概念

### 思考者和说话者

文2.5-Omni的分解:

- 思考器:一个7B-80B文本生成变压器. 消耗交织的文本 + 图像 + 音频代码. 输出代表要说什么的文本代码.
- 语音器:一个较小的语音生成变压器 (200M-1B).消耗了Thinker的文本输出代币以及最近的语音文本代币.输出了分离式语音代币 (残余VQ指数).
- 语音解码器:是一款流浪形解码器 (SNAC,MoVQGAN家族),可实时将语音代码传输到音频样本.

分离是重要的.思考者必须很大,才能有好推理.说话者可能很小,因为他的工作是当地的.

运行两者并行:

1. 思考者发出了文字符号$t_i$现在,我们要去.
2. 谈话者消费$t_i$通过流媒体发射语音标记$s_i, s_{i+1}, \ldots, s_{i+k}$现在,我们要去.
3. 语音解码器使用语音代码,
4. 在思考者在文字符号上的时候$t_{i+3}$谈话者已经播放了音频.$t_0, \ldots, t_{i+2}$现在,我们要去.

### 时间对齐的多模态位置

思考者需要从对话历史中集成图像框架 (达到,说,4FPS),音频框架 (达到50个框架/秒),以及文本.一个天真的序列顺序 (所有图像,然后所有音频,然后文本) 失去了时间排列.

TMRoPE将每个代币分配绝对时间标签.视觉代币在t=2.3s.音频代币在t=2.32s.用户的文字代币"停止"在t=2.35s. RoPE按时间标签旋转注意力;模型认为它们是暂时同步的.

这就是"他挥手问候"的基础设施, 模型可以在同一概念时看到视频框架和音频.

### 流媒体语音合成

语音代币必须流动.迷你Omni (Xie & Wu, 2024) 引入了"语音模型可以在流媒体中听到,思考,谈话":思维输出代币和谈话输出代币在同一序列中交互.思维执行下一个文本代币后,谈话器会发射.没有批量界限.

莫希 (Défossez等,2024年10月) 是最快的开放实现. 160ms TTFAB在单个A100上.架构:单个7B变压器,在交替位置发出文字和语音代码,具有"内部单独语音"来分离思考流和语音流.这是有效的思考+谈话者与仔细训练融合成一个模型.

### 和转变

语音活动检测在输入侧进行.

- 半双:用户说话,模型听话.模型说话,用户听话.通过VAD沉默检测 (~200ms) 清晰的传递.
- 双重:两者都可以同时说话.模型可以回频道 ("-") 或打断.更难.莫希支持这一点.

默认支持半双,通过沉默门进行转换. 完全双需要应用层处理.

### 文3-奥姆尼 (2025年11月)

后者:Qwen3-80B Thinker,更大的Talker,改进了TMRoPE-v2. 延迟接近GPT-4o的250ms. 开放重量. 基板上的基准与双子 2.0 Live竞争.

### 生产延迟预算

对于典型的流媒体互动:

- 电话 -> 音频代码:40-80ms.
- 在7B时,100-200ms,在70B时,更多.
- 首先,一个思想家的短信代码:40ms.
- 谈话器处理第一个文本代币:20ms.
- 首次发言代码发行:40ms.
- 剩余VQ解码:30ms.
- 语音波形解码:50-80ms.

总TTFAB:7B时320-490ms,70B时600-900ms.边界质量通常意味着70B+;因此边界延迟差距.

### 标记率数学

在16kHz语音和50Hz基语音代码时,输出每秒需要50个语音代码.说话者必须发射 ≥50个代码/秒才能跟上.在H100上典型的LLM吞吐量为30-80个代码/秒时,一个小的 (200-300M) 讲话器足够快;一个7B讲话器会落后.

这就是为什么有小型专用Talker模型,而不是"只使用主模型".

```figure
l5-thinker-talker
```

## 用它

`code/main.py`其他:

- 模拟一个思想家-谈话者管道,
- 计算TTFAB用于可配置的模型尺寸和微信样本率.
- 显示半双转,与VAD沉默门.

## 运送它

这一课产生了`outputs/skill-omni-streaming-budget.md`鉴于真实时语音产品的目标TTFAB和功能集 (视觉,双语,全双语),选择Qwen2.5-Omni,Qwen3-Omni,Moshi或Mini-Omni,并将Thinker/Speaker进行尺寸.

## 运动

1. 在7B思考器和300M谈话器上,写出每个组件的延迟.

2. Qwen2.5Omni使用TMRoPE.描述模型在 t=1s 时看到用户开始说话的提示,而相机在 t=1.2s 时捕获手势.

3. 支持全双重,模型需要在听话时发射音频. 建议一种教训数据格式来教导这一点.

4. 阅读莫希的论文第4节. 描述"内在单词"的分离,以及为什么它避免了思想家和说话者分离.

5. 计算吞吐量预算:一个谈话器必须发射代币的速度是多少,以保持16kHz的语音速度在50基层代币/秒?

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Thinker | "Reasoning brain" | Large text-generating transformer producing what to say |
| Talker | "Speech-generating mouth" | Small transformer producing discrete speech tokens from Thinker's text |
| TTFAB | "Latency budget" | Time-to-first-audio-byte: from user speech end to first audio sample out |
| TMRoPE | "Time-aligned RoPE" | Position encoding using absolute timestamps across vision, audio, text |
| Half-duplex | "Turn-taking" | User and model alternate; VAD silence detects user-done |
| Full-duplex | "Simultaneous" | Model can speak and listen at the same time; backchannel capable |
| Inner monologue | "Moshi separation" | Single-model design where thinking-stream and speaking-stream interleave |

## 进一步阅读

- [Xu et al. — Qwen2.5-Omni (arXiv:2503.20215)](https://arxiv.org/abs/2503.20215)
- [Qwen Team — Qwen3-Omni (arXiv:2509.17765)](https://arxiv.org/html/2509.17765v1)
- [Xie & Wu — Mini-Omni (arXiv:2408.16725)](https://arxiv.org/abs/2408.16725)
- [Défossez et al. — Moshi (arXiv:2410.00037)](https://arxiv.org/abs/2410.00037)
- [Zeng et al. — GLM-4-Voice (arXiv:2412.02612)](https://arxiv.org/abs/2412.02612)
