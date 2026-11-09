# 视频语言模型:暂时标志和地图

> 视频不是一堆照片. 一个5秒的剪辑有因果顺序,动作动词和事件时间, 视频-LLaMA (Zhang等,2023年6月) 发送了首个具有视频接地的开放视频-LLM. 视频聊天和视频-LLaVA扩大了模式. 到2025年,Qwen2.5VL的时间调整M-RoPE将与边境专业型号的差距缩小. 每个系统都以不同的方式解决时间代币 每片的Q-former,每框的 concat-pool,每代币的时间一致的M-RoPE. 这一课程阅读了模式,构建了一个统一对动态框架样本,

**Type:** Build
**Languages:** Python (stdlib, frame sampler + temporal-grounding evaluator), TypeScript
**Prerequisites:** Phase 12 · 08 (LLaVA-OneVision)
**Time:** ~180 minutes

## 学习目标

- 解释为什么时间定位编码会独立于视觉编码器改变视频VLM性能.
- 根据每秒代币与地面准确度进行统一,动态FPS和事件驱动的框架样本测试.
- 描述Q前每片 (Video-LLaMA) 与聚合每框 (Video-LLaVA) 与时间一致的M-RoPE每代币 (Qwen2.5-VL) 设计.
- 举个视频基准:视频MME,TempCompass,EgoSchema,视频MMMU.

## 问题

一分钟的视频30FPS为1800.每为196个视觉代币 (ViT-B为224),这比2024年代任何LLM文本大352k代币.

减少三种策略:

1. 副样本框架 (依据内容为1-8FPS).
2. 积极组合每个框架的补丁代币 (3x3或4x4双线积分).
3. 通过Q-former压缩,它拍摄了16个片,输出了64个代币.

每个交易都不同. 副样本输出时间细节. 聚合输出空间细节. 问元输出了两个小点,但节省了代币.

时间位置编码是另一轴:模型如何知道5个框架是在6个框架之前出现的? 选项包括简单的1D时间 RoPE (Video-LLaMA),学习时间嵌入式 (Video-LLaVA),以及时间调整的M-RoPE (Qwen2.5-VL,全3D).

## 概念

### 视频-LLaMA:每片Q-former+音频分支

视频-LLaMA (2023) 是第一个开放的视频-LLM.

- 速度为16个片,速度为2FPS (因此8秒).
- 视频Q-former,通过16个框架进行交叉监视 -> 32个学习查询 -> LLM.
- 接音频分支:波形 -> 图像结合音频编码器 -> 音频Q-former -> 32个查询 -> LLM.

强度:视听结合推理. 弱点:固定剪辑长度,没有任意的时间定位.

### 视频聊天和视频-LLaVA

视频聊天保留了视频-LLaMA的想法,但放弃了音频和简化.视频-LLaVA (Lin等,2023) 在图像和视频框架上训练了单个视觉编码器 ("投影前的配列"),从而提供统一的表示.这两者都是冷的CLIP编码器 + MLP + LLM.

两者都不是长视频处理器.

### 文2.5VL和时间配合的M-RoPE

文2.5-VL保留了文2-VL的M-RoPE (多动旋转位置嵌入) 并将其时间轴与绝对时间相对.每个补丁符号都携带一个 (t, h, w) 位置,其中t遵循实际时间标志 (而不是框架指数).文2.5-Omni (课 12.20) 后来将其音频和视频版本命名为TMRoPE,时间相对齐多动旋转ROPE.

简单的时间嵌入的关键区别:

- 模型看到"4.2秒"而不是"15段".
- 每个视觉代币以其时间标签独立旋转.
- 如果您在此采样2FPS和4FPS,时机调整的M-RoPE将在原生地处理不均的间隔.

时间调整的M-RoPE可以实现"猫跳什么秒钟?"的查询.模型可以输出"4.2秒钟".视频-LLaMA只能说"在剪辑中早期".

### 框架采样策略

单一:样本N框架在持续时间内均.简单,损失运动峰值.

动态FPS:基于运动强度的样本适应性.光学流量或框架差异化选择高运动段进行更密集的样本采集.Qwen2.5VL在此上运行.

活动驱动:运行轻量检测器, 查看更多的行动发生的地方.

键盘+背景:拍摄边界的样本+几个相邻的框架.用于电影内容.

### 每个的集成

在每幅576个图像的1FPS和576个代币时,一个5分钟的剪辑是172,800个代币. 这超越了Qwen2.5-VL-72B的128k文本,所以你必须首先放下每幅的图像速度或积分代币.

两行数组的数量减少到每一个图片的64个代币 -> 5 分钟的19200个代币.

对于空间细节不太重要的代理工作流程,更积极地组装 (6x6 -> 16个图像).

### 四个视频基准

- 视频中小企业:全面视频理解,短+中+长.
- 时间:精细的时间推理,"之前"/"之后"的问题.
- 长视野的第一人视频.
- 视频-MMMU:多模式多学科视频问题.

它们强调不同的轴 TempCompass是关于订单, EgoSchema是关于3+分钟的推理, VideoMME跨度.

### 接地输出格式

时间接地输出格式:

- 简单的分析,但不准确.
- 结构化JSON: `{"event": "jump", "start": 4.1, "end": 4.3}`文2.5VL是这辆车的.
- 基于代币:特殊`<time>4.1</time>`某些视频模型使用此方法; Qwen2.5-VL 相反,在M-RoPE位置ID和答案中编码时间.

基于代币的使用最准确. Qwen2.5VL 的 JSON输出格式直接解析.

### 2026 年最佳实践

2026年视频VLM:

- 编码器:SigLIP 2或本地分辨率 ViT,在LLM中与时间相一致的M-RoPE (Qwen2.5-VL).
- 模样:动态FPS (根据运动为1-4),最大盖.
- 单个图像组合:3×3双线.
- 输出:结构化JSON,时间+事件字段.
- 标准:视频中小企业+时间准一般;长视野EgoSchema.

```figure
video-temporal-patches
```

## 用它

`code/main.py`包括:

- 统一和动态FPS框架样本仪.
- 玩具时间定位评估器:在时间T时出现"基本真理"事件,以及模型输出结果,
- 视频-LLaMA (16个,Q-前),视频-LLaVA (8个,MLP),Qwen2.5-VL (动态FPS +时间调整M-RoPE) 的比较.

## 运送它

这一课产生了`outputs/skill-video-vlm-frame-planner.md`视频任务 (监控,行动识别,时间定位,总结) 时,它选择了图像样本,聚合因素,输出格式和预期精度级别.

## 运动

1. 为了做三分钟的演示,选择制服与动态FPS.

2. 时间调整的M-RoPE增加了一个简单的时间嵌入表不能做的具体内容.

3. 写一个JSON图案,用于时间定位,一个VLM可以学习发射.包括错误案例.

4. 阅读视频-LLaVA的第3节"在投影之前的配合".

5. 鉴于视频MME排名榜,到2026年,顶级开放模型和顶级专有模型之间的差距是多少?

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Temporal grounding | "Time-localized answers" | VLM outputs a specific timestamp range for when an event happens |
| Time-aligned M-RoPE | "TMRoPE" | 3D rotary position whose temporal axis follows absolute timestamps; Qwen2.5-VL uses it for video, and Qwen2.5-Omni names its audio and video form TMRoPE |
| Dynamic FPS | "Motion-aware sampling" | Sample more frames in high-motion segments, fewer in static ones |
| Frame pooling | "Spatial compress per frame" | Reduce patches per frame with bilinear interpolation before the LLM |
| Video Q-former | "Clip compressor" | Cross-attention bottleneck mapping N frames to K learned queries |
| VideoMME | "Video bench" | Comprehensive short/medium/long video benchmark, 2500+ samples |

## 进一步阅读

- [Zhang et al. — Video-LLaMA (arXiv:2306.02858)](https://arxiv.org/abs/2306.02858)
- [Li et al. — VideoChat (arXiv:2305.06355)](https://arxiv.org/abs/2305.06355)
- [Lin et al. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Qwen Team — Qwen2.5-VL (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Lin et al. — VILA-1.5 (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
