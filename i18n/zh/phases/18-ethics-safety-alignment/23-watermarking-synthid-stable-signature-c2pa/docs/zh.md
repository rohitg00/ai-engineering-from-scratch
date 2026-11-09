# 标记水 合成ID,稳定签名,C2PA

> 据了解,在2026年, 通过"责任的GENAI工具包" (Responsible GenAI Toolkit) 发行了2023年8月的图像水标,文本+视频2024年5月 (Gemini + Veo),文本开源2024年10月,并与Gemini 3 Pro一起实现了2025年11月的多媒体检测器. 文字水标将下一个代币的样本抽象概率不知不觉地调整;图像/视频水标存活压缩,切割,过,率变化. 稳定签名 (Fernandez et al., ICCV 2023, arXiv:2303.15435) 细调隐藏扩散解码器,使每个输出都包含固定信息;在 FPR<1e-6 中,被切割的 (内容的10%) 生成的图像被检测到90%以上. 后续"稳定签名不稳定" (arXiv:2405.07145,2024年5月) 细调消除水印,同时保持质量. C2PA 加密签署的,具有改性明显的元数据标准 (C2PA 2.2解释器 2025). 水标和C2PA是互补的:可以删除元数据,但具有更丰富的来源;水标通过转码仍然存在,但具有更少的信息.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, token-watermark embed + detect)
**Prerequisites:** Phase 10 · 04 (sampling), Phase 01 · 09 (information theory)
**Time:** ~75 minutes

## 学习目标

- 描述代币级水标 (SynthID文本式) 和可检测的机制.
- 描述稳定签名和2024年的移除攻击.
- 国家C2PA的作用以及为什么它是补充水标.
- 描述主要的限制:模型特定的信号,在抛词下强度和保持意义的攻击 (arXiv:2508.20228).

## 问题

2023-2024年,深度假冒和人工智能生成的内容将进入政治和消费者背景.水标是拟议的技术来源信号:创建时标记几代人,后者检测. 2025年证据:没有水标是无条件的强大,但与C2PA元数据层叠加,组合提供可用的来源故事.

## 概念

### 文字水标 (SynthID-text风格)

基尔堡等人2023机制,由谷歌生产:

1. 在每一步解码时,将前一个K代码加密起来,以产生词汇的伪随机分区为"绿色"和"红色"的集合.
2. 通过添加 δ 给绿色的logits来对绿色集合进行偏差样本.
3. 代子含有比偶然产生的更多的绿色代币.

检测:重新检查每个前,在生成中计算绿色代币,计算z分数.z分数为>0用于水标文本, ~0用于人类文本.

性能:
- 读者无法感知 (δ 足够小,质量损失是微不足道的).
- 通过访问词汇分区功能可检测.
- 转写文本破坏信号.

通过谷歌的"负责任GenAI工具包"2024年10月,

### 稳定签名 (图片)

费尔南德斯等人.ICCV 2023. 细调隐藏扩散解码器,使每一个生成的图像都包含嵌入隐藏表示中的固定二进制信息.检测通过神经解码器从隐藏中解码.在FPR<1e-6时,切割的图像被检测到90%以上.

2024年5月"稳定签名不稳定" (arXiv:2405.07145):微调解码器删除水印,同时保持图像质量.对抗后代微调是便宜的;水印的对抗强度有限.

### 综合ID统一检测器 (2025年11月)

双子座3 Pro:一个多媒体探测器,可以在一个API中读取文字,图像,音频和视频的SynthID信号.

### 化剂

内容来源和真实性联盟.加密签署的伪造性明显的元数据标准.C2PA 2.2解释器 (2025).C2PA明示记录来源声明 (谁创建,何时,什么变化) 签署的创作者密钥.

补充水标:
- 转换数据可以删除;水印不能 (很容易).
- 转载数据的数据是丰富的 (完整的来源链);水标携带比特.
- 基于平台的采用,水标自动嵌入.

谷歌将搜索,广告和"关于这个图像"都整合起来.

### 限制

- **Model-specific.**通过SynthID启用模型的SynthID水标代.没有SynthID的模型的一代没有水标,因此"没有SynthID信号"并不是认证真实性的证明.
- **Paraphrase.**文字水标没有保存含义的表达.
- **Transformation attacks.**文件的含义是: arXiv:2508.20228 (2025) 显示了破坏文本水标和许多图像水标的含义保护攻击.
- **Fine-tune removal.**根据"稳定签名不稳定",后代细调取消嵌入式水标.

### 欧盟人工智能法第50条

通过人工智能生成的内容标签的透明度法规 (第一个草案2025年12月,第二个草案2026年3月,预计2026年6月将最终通过[European Commission status page](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)) 该法规将于2026年4月起继续起草,时间表可能会发生变化.要求技术层的监管层.必须标记深度假.

### 在这个阶段的第18阶段

课程22-23讲述了模型所发射的信息 (私人数据,来源信号).课程27涵盖了培训数据治理.课程24是要求这些技术措施的监管框架.

```figure
an-watermark-greenlist
```

## 用它

`code/main.py`标记是整数0..N-1;标记是对 Hash定义的绿色集合的样本偏差.一个探测器计算了绿色标记 z-score.你可以观察1000代标的检测,观看对象的破坏信号,测量人类文本上的虚假阳性率.

## 运送它

这一课产生了`outputs/skill-provenance-audit.md`鉴于内容部署有 provenance 索赔,它审计:水标机制 (如果有的话),C2PA签署链 (如果有的话),每个内容的反抗性强度,以及每种模式覆盖性.

## 运动

1. 跑步`code/main.py`报告水标1000代币生成与人为作文的z分数. 确定 95%的可信度门时的虚假阳性率.

2. 执行一个抛物语攻击,以代码替换30%的代码.

3. 阅读Kirchenbauer等2023第6节关于强度. 为什么文字水标在表达中失败,但图像水标在剪切中存活下来?

4. 设计一个使用SynthID-text + C2PA元数据的部署.描述消费者看到的来源链.确定每个组件的一个故障模式.

5. 2024 年"稳定签名不稳定"结果显示,微调取消了图像水印.设计一个限制攻击的部署控制,例如,需要签署的微调检查站.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| SynthID | "Google's watermark" | Cross-modal provenance signal; text, image, audio, video |
| Token watermark | "Kirchenbauer-style" | Biased-sampling text watermark detectable via green-token z-score |
| Stable Signature | "image watermark" | Fine-tuned-decoder watermark; ICCV 2023 |
| C2PA | "the metadata standard" | Cryptographically signed tamper-evident provenance metadata |
| Paraphrase robustness | "does rewording break it" | Text watermark property; currently limited |
| Fine-tune removal | "adversarial unwatermark" | Attack that removes image watermark via decoder fine-tuning |
| Cross-modal detector | "unified SynthID" | November 2025 unified API across modalities |

## 进一步阅读

- [Kirchenbauer et al. — A Watermark for Large Language Models (ICML 2023, arXiv:2301.10226)](https://arxiv.org/abs/2301.10226)标志水标机制
- [Fernandez et al. — Stable Signature (ICCV 2023, arXiv:2303.15435)](https://arxiv.org/abs/2303.15435)图像水印纸
- ["Stable Signature is Unstable" (arXiv:2405.07145)](https://arxiv.org/abs/2405.07145)移除攻击
- [Google DeepMind — SynthID](https://deepmind.google/models/synthid/)跨模式水标
- [C2PA 2.2 Explainer (2025)](https://c2pa.org/specifications/specifications/2.2/explainer/Explainer.html)元数据标准
