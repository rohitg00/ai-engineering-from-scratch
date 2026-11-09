# 音频语言模型: 语到音频弗拉明戈3弧

> 语 (Radford等,2022年12月) 解决了语音识别 680k小时的弱监督多语言语音,简单的编码-解码变压器,这是一个让每次ASR发布都引用的基准. 但认可不是推理. 问"录音中的乐器是什么"或者"讲者表达了什么情感"或"在第三分钟发生了什么"需要听音理解,而不是转录. 音音频,萨尔蒙,LTU和NVIDIA的Audio Flamingo 3 (AF3,2025年7月) 逐步构建了这个堆:保持Whisper类编码器,起Q-formers,训练音频文本指令数据,添加链接思维推理. 这一课是个曲.

**Type:** Build
**Languages:** Python (stdlib, log-Mel spectrogram + audio Q-former skeleton), TypeScript
**Prerequisites:** Phase 6 (Speech and Audio), Phase 12 · 03 (Q-Former)
**Time:** ~180 minutes

## 学习目标

- 从波形计算一个"日志-梅尔"谱图:窗户,FFT,过银行,日志转换.
- 比较编码器选项: 语编码器,BEATs,AF-Whisper混合动力.
- 构建一个音频Q-former:N可学习的查询,交叉处理光谱补丁.
- 解释级 (Whisper-then-LLM) 与端到端音频-LLM训练:为什么端到端的尺度更好进行推理.

## 问题

语音识别是由Whisper解决的.音频的OCR是一种商品.但"商品"在转录时停止.如果模型无法推理它听到的内容时间,扬声器,情感,音乐结构,环境声音,仅仅转录就无法驱动产品的特性.

现在,我们要做什么?

1. 语:微笑转录,LLM解释转录. 对于纯语场景工作. 音乐,环境音频,多扬声器重叠,情感失败.

2. 终端音频LLM:一个音频编码器直接将音频代码输入到LLM中,跳过转录.保存音频信息 (情感,扬声器,环境).需要新的培训数据.

3. 混合音频编码器 + 文本解码器可以转录和推理.

## 概念

### 记录-Mel谱:输入功能

每个音频编码器都以相同的功能开始:

1. 复制样本到16kHz.
2. 短时间的福利尔转换,25ms窗户,10ms跳转.
3. 取出FFT结果的大小.
4. 应用MEL过器 (通常是0-8000Hz的80个过器) 变变化到感知频率.
5. 木压缩器$(\log(1 + x))$对于动态范围.

结果:一个2D形状阵列 (T, 80) 时T是时间框架的数量.对于30秒的片段,以100Hz的频率: (3000, 80).

### 语的编码器

语编码器是一个12层 ViT 式变压器,处理日志-Mel 谱程作为时间框架的序列.输出:每时间框架每一个隐藏状态向量.

对于ASR来说,Whisper的解码器是一种跨注意力变压器,它生成了在编码器输出上条件的文本代码.

对于ALM (音频-LLM) 则,您需要编码器输出作为输入到不同的LLM. 模式:语编码器结,Q-former可训练,LLM结或调节.

### 电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑系统,电脑,电脑系统,电脑,电脑,电脑,电脑,电脑,电脑,电脑,电脑,电脑,电脑等

微声是基于语音主导数据的训练.

贝茨 (Chen et al., 2022) 是一个在 AudioSet 上训练的自主监督变压器. 它在相同的参数数数量下捕获音乐和环境声音比Whisper更好.

 AF-Whisper (Audio Flamingo 3 的编码器):从 Whisper-large-v3编码器开始,并继续训练它在语音,声音和音乐在一起,因此一个编码器携带语言和声学信号.早期的系统如 SALMONN 通过连接 Whisper 和 BEAT 功能获得了相同的覆盖.

### 音频Q-former

像BLIP-2的视觉Q-former一样的模式. 一个固定的可学习查询数量 (通常是32或64) 通过音频编码器的输出框架进行交叉访问.查询成为LLM所消耗的音频代币.

训练配合阶段:仅Q-former,对音频文本对 (AudioCaps,Clotho) 的对比性+字幕损失. 训练阶段:端到端,解LLM,训练教学数据.

###  SALMONN,Qwen-Audio,AF3

萨尔蒙 (Tang等, 2023):语 + 跳声 + 旧Q + LLaMA. 首个具有认真推理能力的开放音频LLM. MMAU的基准显示0.55的复合.

文音频 (Chu等, 2023):类似的架构,训练在更丰富的数据集,调整为多转对话.

听,思考,理解 (Gong et al., 2023):明确的推理数据,重点关注视频片段的链接.较小但更集中.

音频弗拉明戈3 (Goel等,2025年7月):目前的开放SOTA. 7B LLM背骨 (Qwen2.5-7B),由Whisper-large-v3构建的AF-Whisper音频编码器,在LLM中进行了小型适配器层,在1M+音频文本指导对进行训练.MMAU 0.72,在一些子任务上匹配了专有边界.

AF3还引入了对音频的按需思考链:模型在最终答案之前可选择地发射思考代币 ("让我先确定仪器: ...").在复杂的推理任务上,精确度在启用思考时提高了3-5点.

### 轮对象与端到端

水管道:

1. 语转录了音频 →文字.
2. 法律法师理由超过文字.

非常适合"总结这个播客".
- "这首歌的情绪是什么?" 情绪在于声音,而不是词语.
- "谁说话,爱丽丝还是?" 需要说话者身份.
- "爆炸发生在什么时刻?" 时间的定位失去了文本中.
- 深fake检测需要声学功能.

音频和 AF3 处理音乐,环境和情感.

### 2026 生产配方

对于新的音频理解产品:

- 没有音乐,没有情感推断.
- 音乐,情感,多音箱或复杂的音频推理.

水更便宜,更简单,更有能力.

### 音频推理基准

根据"全球"的标准,MMAU (Massive Multimodal Audio Understanding) 是2024-2025年为音频推理的基准:

- 通过语音,音乐,环境声音进行1万个音频文字质量检测.
- 涵盖分类,时间推理,因果推理,无限的质量分析.
- 系统地错过了体管道的测试.

开放SOTA (AF3) 0.72;专有边界 ~0.78 (Gemini 2.5 Pro,Claude Opus 4.7). 差距比VideoMME的开放对关的三角形小,表明音频LLM正在成熟.

```figure
audio-text-ctc
```

## 用它

`code/main.py`其他:

- 在 stdlib 中实现 log-Mel 谱图计算:窗户,天真 DFT,Mel 过银行.
- 音频Q前骨架:给出编码器输出框架,计算Q,K,V,注意,并发射N代币.
- 玩具任务的结尾对结尾比较.

## 运送它

这一课产生了`outputs/skill-audio-llm-pipeline-picker.md`根据一个音频任务 (转录,音乐标签,情感推断,多音箱日记化,环境分类),它选择缩,端到端 AF3 或混合.

## 运动

1. 计算一个30秒的剪辑的日志-Mel谱图尺寸在16kHz,25ms窗口,10ms跳,80 Mel桶.

2. 贝茨的音频功能是什么?

3. 音频Q-former有64个查询对比32个:在哪个任务复杂度上64个付出?32个节省计算为什么?

4. 阅读AF3第4节关于按要求思考. 建议三项音频任务,

5. 如何向扬声器进行信号变化?

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Log-Mel spectrogram | "Mel features" | 2D (time, frequency) array of log-magnitude values after Mel filter banks |
| Audio Q-former | "Audio Perceiver" | Cross-attention bottleneck from audio encoder output to fixed-length queries feeding the LLM |
| Cascaded | "ASR-then-LLM" | Pipeline where Whisper transcribes and a text LLM reasons; loses acoustic information |
| End-to-end | "Audio-LLM" | Audio features enter the LLM directly via Q-former; preserves acoustic signal |
| BEATs | "Audio AudioSet encoder" | SSL transformer trained on AudioSet; strong on music + environmental sounds |
| MMAU | "Audio reasoning bench" | 10k QA pairs across speech, music, environment; 2024 eval standard |
| On-demand thinking | "Audio CoT" | Model can optionally emit reasoning tokens before final answer, lifts accuracy 3-5 pts |

## 进一步阅读

- [Radford et al. — Whisper (arXiv:2212.04356)](https://arxiv.org/abs/2212.04356)
- [Chu et al. — Qwen-Audio (arXiv:2311.07919)](https://arxiv.org/abs/2311.07919)
- [Goel et al. — Audio Flamingo 3 (arXiv:2507.08128)](https://arxiv.org/abs/2507.08128)
- [Tang et al. — SALMONN (arXiv:2310.13289)](https://arxiv.org/abs/2310.13289)
- [Gong et al. — LTU (arXiv:2305.10790)](https://arxiv.org/abs/2305.10790)
