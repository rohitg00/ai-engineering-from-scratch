# 12 · 视频理解管线（场景、问答、搜索）

> Twelve Labs 将 Marengo + Pegasus 产品化；VideoDB 交付了视频 CRUD API；AI2 的 Molmo 2 公开了开放 VLM 权重；Gemini 长上下文原生支持数小时视频；TimeLens-100K 定义了大体量时间定位（temporal grounding）。2026 年的管线已趋于成熟：场景切割（scene segmentation）、逐场景描述+嵌入（caption + embedding）、转写对齐（transcript alignment）、多向量索引（multi-vector index），以及返回 (start, end) 时间戳与帧预览的问答。本综合实战要求摄入 100 小时视频、达到公开基准、并衡量计数与动作类问题上的幻觉。

**类型：** 综合实战
**语言：** Python（管线），TypeScript（界面）
**前置：** 第四阶段（CV）、第六阶段（语音）、第七阶段（Transformer）、第十一阶段（LLM 工程）、第十二阶段（多模态）、第十七阶段（基础设施）
**涉及阶段：** P4 · P6 · P7 · P11 · P12 · P17
**时长：** 30 小时

## 问题

长视频问答（long-form video QA）是 2026 年规模下带宽最密集的多模态问题。Gemini 2.5 Pro 可以原生读取 2 小时视频，但要将 100 小时视频摄入为可查询语料库，仍然需要场景级索引。生产形态组合了场景切割（TransNetV2 或 PySceneDetect）、用视觉语言模型（VLM）做逐场景描述（Gemini 2.5、Qwen3-VL-Max 或 Molmo 2）、转写对齐（Whisper-v3-turbo 带单词时间戳），以及将描述嵌入、帧嵌入、转写嵌入并列存储的多向量索引。查询管线返回 (start, end) 时间戳加帧预览。

基准是公开的（ActivityNet-QA、NeXT-GQA）外加你自建的 100 条查询集。计数类和动作类问题上的幻觉是已知难点；本综合实战需显式衡量它。

## 概念

摄入时三条管线并行运行。**场景切割**将视频切分为场景。**VLM 描述**为每个场景生成描述文字，并从关键帧提取帧嵌入。**ASR 对齐**产生词级时间戳。三条流按 (scene_id, time range) 汇合。每个场景在 Qdrant 多向量索引中获得三种向量：描述嵌入（caption embedding）、关键帧嵌入（keyframe embedding）、转写嵌入（transcript embedding）。

查询时，自然语言问题同时命中三种向量；结果通过 RRF 融合（reciprocal rank fusion）；时间定位适配器（TimeLens 风格）在命中场景内精修 (start, end) 窗口。VLM 合成器（Gemini 2.5 Pro 或 Qwen3-VL-Max）接收查询+命中场景+裁剪帧，并输出带时间戳引用和帧预览的回答。

关键在于幻觉度量。计数类（"有多少人进入房间？"）和动作类（"厨师是在搅拌前倒油的吗？"）问题以不可靠著称。需将正确率与描述类问题分开报告。

## 架构

```
video file / URL
      |
      v
PySceneDetect / TransNetV2  (场景切割)
      |
      +--- 逐场景关键帧 --- VLM 描述 + 帧嵌入
      |                            (Gemini 2.5 Pro / Qwen3-VL-Max / Molmo 2)
      |
      +--- 音频轨道 --- Whisper-v3-turbo ASR + 词级时间戳
      |
      v
多向量 Qdrant: {caption_emb, keyframe_emb, transcript_emb}
      |
查询:
  对三种向量分别执行稠密查询 -> RRF 融合 -> top-k 场景
      |
      v
TimeLens / VideoITG 时间定位（在场景内精修 start/end）
      |
      v
VLM 合成: 查询 + top 场景 + 帧预览
      |
      v
答案 + (start, end) 时间戳 + 帧缩略图 + 引用
```

## 技术栈

- 场景切割：TransNetV2（2024-26 年最新）或 PySceneDetect
- ASR：Whisper-v3-turbo 通过 faster-whisper，带词级时间戳
- VLM 描述与回答合成器：Gemini 2.5 Pro 或 Qwen3-VL-Max 或 Molmo 2
- 时间定位：基于 TimeLens-100K 训练的适配器或 VideoITG
- 索引：Qdrant 多向量支持（描述/帧/转写）
- 界面：Next.js 15，配合 HTML5 播放器和场景缩略图
- 评测：ActivityNet-QA、NeXT-GQA、自建 100 条人工标注问答集
- 幻觉基准：计数和动作类子集，含人工标签

## 动手构建

1. **摄入遍历器。** 接受 YouTube URL 或本地 MP4。必要时降采样到 720p。持久化 `{video_id, file_path}`。

2. **场景切割。** 运行 TransNetV2 或 PySceneDetect，产生 `[{scene_id, start_ms, end_ms, keyframe_path}]`。目标 100 小时：约 6k-8k 个场景。

3. **ASR 通道。** 在音频上运行 Whisper-v3-turbo；导出词级时间戳；按场景切分为转录片段。

4. **VLM 描述。** 逐场景调用 Gemini 2.5 Pro（或 Qwen3-VL-Max），传入关键帧和简短描述模板。产出描述文字+帧嵌入。

5. **多向量索引。** Qdrant collection 含三个命名向量。载荷：`{video_id, scene_id, start_ms, end_ms, keyframe_url}`。

6. **查询。** 自然语言问题执行三次稠密查询；用 RRF 融合合并；top-k=5 场景。

7. **时间定位。** 对 top 场景运行 TimeLens 风格适配器，在场景内精修 (start, end) 窗口。

8. **VLM 合成。** 调用 Gemini 2.5 Pro，传入查询+top-3 场景片段（图片或短视频）+转写文本。要求输出 `(video_id, start_ms, end_ms)` 引用。

9. **评测。** 运行 ActivityNet-QA 和 NeXT-GQA。构建 100 条自建查询集。报告总体正确率+按类别细分（计数、动作、描述）。

## 使用演示

```
$ video-qa ask --url=https://youtube.com/watch?v=X "how many cars pass the intersection in the first minute?"
[scene]    23 scenes detected
[asr]      transcript complete, 4m12s
[index]    69 vectors written (23 scenes x 3)
[query]    top scene: scene 3 [01:32-01:54], confidence 0.84
[ground]   refined window: [00:12-00:58]
[synth]    gemini 2.5 pro, 1.4s
answer:    5 cars pass the intersection between 00:12 and 00:58.
citations: [scene 3: 00:12-00:58]
          [frame preview at 00:14, 00:27, 00:44, 00:51, 00:57]
```

## 交付标准

`outputs/skill-video-qa.md` 是交付物。给定 YouTube URL 或上传视频，管线完成场景索引构建，并以带时间戳引用回答提问。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | 时间定位 IoU | 预留定位集上的交并比 |
| 20 | 问答准确率 | NeXT-GQA 及自建 100 条 |
| 20 | 摄入吞吐量 | 每美元花费摄入的视频小时数 |
| 20 | 界面与引用的用户体验 | 时间戳链接、缩略图条、跳转到帧 |
| 15 | 幻觉率 | 单独报告计数和动作类准确率 |
| **100** | | |

## 练习

1. 将描述环节的 Gemini 2.5 Pro 换为 Qwen3-VL-Max。在人工评分的 50 场景样本上报告描述质量差异。

2. 将逐场景帧嵌入简化为一个池化向量（而非多向量）。度量检索性能的退化程度。

3. 构建"计数严审"模式：合成器为每个计数实例提取时间戳，用户点击验证。度量用户验证是否能降低幻觉。

4. 基准测试摄入成本：三种 VLM 选择下的"每美元可处理视频小时数"。找到最优解。

5. 添加说话人分离转写：在音频上运行 pyannote 说话人分离，按说话人分别嵌入转写文本。演示"Alice 对 X 说了什么？"类查询。

## 关键术语

| 术语 | 常见说法 | 实际含义 |
|------|-----------------|------------------------|
| 场景切割（Scene segmentation） | "镜头检测" | 在镜头边界处将视频切分为场景 |
| 多向量索引（Multi-vector index） | "描述+帧+转写" | Qdrant collection 中按表示类型命名向量 |
| 时间定位（Temporal grounding） | "到底什么时候发生的" | 精修查询答案的 (start, end) 窗口 |
| 帧嵌入（Frame embedding） | "视觉表示" | 关键帧的向量嵌入；用于场景视觉相似度 |
| RRF 融合 | "倒数排名融合" | 跨多个排序列表的合并策略；经典混合检索技巧 |
| 计数幻觉（Counting hallucination） | "数错了" | VLM 在"多少个 X"问题上的已知失效模式 |
| ActivityNet-QA | "视频问答基准" | 长视频问答的准确率评测基准 |

## 延伸阅读

- [AI2 Molmo 2](https://allenai.org/blog/molmo2) — 开放 VLM 权重
- [TimeLens (CVPR 2026)](https://github.com/TencentARC/TimeLens) — 大规模时间定位
- [Gemini Video 长上下文](https://deepmind.google/technologies/gemini) — 托管参考实现
- [VideoDB](https://videodb.io) — 视频 CRUD API 参考
- [Twelve Labs Marengo + Pegasus](https://www.twelvelabs.io) — 商业参考
- [TransNetV2](https://github.com/soCzech/TransNetV2) — 场景切割模型
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) — 经典开源替代方案
- [ActivityNet-QA](https://arxiv.org/abs/1906.02467) — 参考评测基准
