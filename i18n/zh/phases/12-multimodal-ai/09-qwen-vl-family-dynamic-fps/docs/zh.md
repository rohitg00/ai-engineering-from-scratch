# 文-VL家庭和动态-FPS视频

> wen-VL家族 wen-VL (2023年),Qwen2-VL (2024年),Qwen2.5-VL (2025年),Qwen3-VL (2025) 是2026年最具影响力的开放视觉语言模型系. 每一代都做出了一个决定性的建筑投注,其余的开放生态系统在十二个月内复制了:通过M-RoPE进行原生动态分辨率,通过绝对的时间调整进行动态FPS样本采集,在ViT中的窗口注意力,以及结构化代理输出格式. 通过Qwen3-VL,该配方已经稳定了:一个2D-RoPE-ViT编码器,具有原生面比输入,一个MLP投影器进入一个大型Qwen3语言基础,以及强调OCR,地面和代理行为作为一流目标的培训阶段. 这一课是按时间序列读取家庭,

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, M-RoPE encoder + dynamic-FPS sampler)
**Prerequisites:** Phase 12 · 06 (patch-n'-pack)
**Time:** ~120 minutes

## 学习目标

- 计算M-RoPE的三轴旋转 (时间,高度,宽度) 并解释为什么需要三轴旋转.
- 选择一个动态FPS样本采集策略,
- 列出四个Qwen-VL代升级的顺序,以及每个升级的功能.
- 通过Qwen2.5VL式的JSON代理输出格式,并从VLM响应中分析结构化工具的呼叫.

## 问题

文-VL于2023年8月出货,作为LLaVA-1.5和BLIP-2的直接反应.文团队的目标差距是三倍:分辨率,视频和结构性输出.

解析度:LLaVA-1.5 运行于336x336. 照片很好,对于一个中文发票或密集的电子表格截图来说是无用的. 文-VL 的第一个创新是448x448和地面边界框输出,让模型指向东西.

视频:视频-LLaMA堆了每一个框架的编码器,然后将它们输送到LLM. 它适用于短片,而不是多分钟的视频,时间轴是信号.

结构化输出:LLaVA发射了自由形式文本.一个代理需要JSON.Qwen-VL训练在明确的JSON输出格式,包括边界框坐标作为文本.

每一代Qwen-VL都延伸了三个轴之一.

## 概念

### 文-VL (2023年8月)

第一代:OpenCLIP ViT-bigG/14作为编码器 (2.5B参数),LLama兼容的Q-Former (1步,含256个查询),Qwen-7B基础.贡献:

- 解析度为448x448 (然后为开放的VLM提供SOTA).
- 接地:训练在图像和文本对进行明确的坐标标输出. "猫在 <box>112, 204), (280, 344)</box>".
- 从一开始就进行了中文+英语多语言培训.

当时的标准:与GPT-4V在英语上竞争,在中国上占主导地位.

### wen2-VL (2024年9月) M-RoPE和本地分辨率

文2-VL 取代了固分分 + Q-Former 堆,并用了原生动分辨率 ViT 编码器.

- 视频可接受任何可乘以28 (补丁14与2x空间合并) 的 HxW. 图像在1120x672 (40x24合并补丁) 产生960个视觉代币.没有尺寸,没有,没有缩影图.
- 对于图像 t=0,视频 t=frame_index. RoPE 每个代币都具有3D位置 (t, h, w) 而不是1D. RoPE每轴的频率按查询/关键向量旋转.没有位置嵌入表.
- 放弃Q-Former,在合并的补丁代币上使用2层MLP.
- 视频具有动态FPS. 视频默认的样本在1-2FPS,但模型接受任意的框架计数.

结果:Qwen2-VL-7B在多个多模式基准上匹配GPT-4o,并在 DocVQA (94.5 vs 88.4) 上击败了它.

### wen2.5-VL (2025年2月) 动态FPS+绝对时间

动态FPS不仅仅是"需要更多的框架".

- 位置ID中的绝对时间.而不是框架指标 (框架0,1,2...),M-RoPE的时间轴遵循实际时间标签,因此两个框架 ID之间的差距追踪它们之间的秒钟. "在0:04时,猫跳跃".没有额外的文本代币携带时间,因此编码不添加序列长度.
- 动态FPS. 测试速度为1FPS,用于缓慢的镜头,用于行动的FPS为4+ FPS. 用户或训练师选择;M-RoPE适应.
- 空间注意力为吞吐量 (区块内) 提供窗口;全球注意力每几层.
- 经过工具调用数据训练: "{\"工具\": \"点击\", \"符号\": [380, 220]}". 代理准备出盒.
- 按MRoPE-v2扩展. 按最大输入尺寸扩展位置,使10分钟的视频不会耗尽频段.

基准:Qwen2.5-VL-72B在大多数视频基准上超过GPT-4o,在文档上匹配Gemini 2.0,并为GUI接地设置了开放型号SOTA (ScreenSpot: 84%的准确度与GPT-4o的38%).

### 文3-VL (2025年11月)

文3-VL是一个逐步升级,而不是重新发明:更大的LLM脊柱 (Qwen3-72B),扩大了培训数据,改善了OCR,通过Qwen3"思考模式"进行了更强的推理.

后代的结论:到2025年,Qwen-VL架构已经稳定. 其他代代的计算和数据规模,而不是原始.

### 数学上,M-RoPE

经典的ROPE旋转查询`q`尺寸`d`按位置`m`使用对联坐标:

```math
\begin{aligned}
q_{\text{rot}}[2i] &= q[2i] \cos(m \theta_i) - q[2i+1] \sin(m \theta_i) \\
q_{\text{rot}}[2i+1] &= q[2i] \sin(m \theta_i) + q[2i+1] \cos(m \theta_i) \\
\theta_i &= 10000^{-2i/d}
\end{aligned}
```

光将隐藏的暗光分为三段.`d = 96`按时间点分配32个,高度32个,宽32个.每个带按自己的轴位置旋转.一个 (t=5,h=10,w=20) 的补丁得到旋转.`R_t(5)`现在`R_h(10)`现在`R_w(20)`它们的三条带.

文字代码使用`t = text_index, h = 0, w = 0`视频片使用 视频片使用`t = frame_time, h = row, w = col`单个图像使用`t = 0`现在,我们要去.

优势:一个位置编码处理文本,图像和视频,而不需要分类代码或不同的位置表.

### 动态-FPS样本抽取逻辑

视频时间`T`秒和目标代币预算`B`其他:

1. 计算你能负担的最大FPS:`fps_max = B / (T * tokens_per_frame)`现在,我们要去.
2. 选择一个目标FPS`{1, 2, 4, 8}`这满足了`fps <= fps_max`现在,我们要去.
3. 如果运动高 (光流论或用户明确要求),请选择更高的FPS. 如果运动低,请选择更低.
4. 在选定的FPS上均样本;在秒钟内设置每个框架的M-RoPE时间ID从其时间标签.

wen2.5VL 暗示了这种逻辑;`fps`参数:一个60秒的动作序列,4FPS,每框81个代币 =19440个代币,可在32k环境中管理.

### 结构化代理输出

文2.5VL的代理培训明确针对结构化工具调用:

```
{
  "tool": "mouse_click",
  "coords": [1024, 512],
  "button": "left",
  "modifier": null
}
```

解析是决定性的:JSON.parse对模型的输出.比较自由形式的"点击 (1024, 512) "要求进行regex和模糊处理.这就是为什么Qwen2.5-VL的ScreenSpot分数从Qwen2-VL的55%跳到84%.

```figure
mm-mrope-axes
```

## 用它

`code/main.py`执行:

- 对于包装序列混合文本,图像补丁和视频框架的M-RoPE位置计算.
- 动态FPS样本:给出 (持续时间,预算,运动_水平),选择FPS并发射框架时间标记.
- 玩具 Qwen2.5-VL JSON输出解析器,它处理工具调用响应,使用坐标字段.

运行它,然后在5分钟的视频中,

## 运送它

这一课产生了`outputs/skill-qwen-vl-pipeline-designer.md`视频任务 (监控,代理,行动识别,可访问性) 则会发出Qwen2.5VL配置 (框架预算,FPS策略,窗口注意力旗,代理输出模式) 和延迟估计.

## 运动

1. 计算一个补丁的M-RoPE旋转 (t=3,h=5,w=7) 隐藏48 (16个条,底线theta 10000).显示每个条的前三对旋转角.

2. 通过10分钟的安全摄像头在1FPS录制,产生多少个图像?在3x分辨率的384分辨率,共有多少个代币?Qwen2.5VL的默认32k环境处理它吗?

3. 选择FPS为30秒的网球集会,对30秒的食谱演示,对30秒的UI代理录音.

4. 简单的MLP为什么在2025年工作,而不是2023年? (提示:数据规模和编码器质量)

5. 解析3个Qwen2.5-VL JSON工具调用输出到Python字体中.错误的JSON有什么缺陷,Qwen厨师书建议什么恢复策略?

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| M-RoPE | "Multimodal RoPE" | 3D rotary position embedding with temporal, height, and width bands in the hidden dim |
| Dynamic FPS | "Smart sampling" | Frame sampling rate chosen per video based on motion, duration, and token budget |
| Absolute time encoding | "Time-aligned M-RoPE" | Temporal position IDs set from each frame's timestamp, so the model sees actual seconds, not frame index, with no extra tokens |
| Window attention | "Local attention" | Spatial self-attention restricted to small windows for speed; global attention added periodically |
| Structured agent output | "JSON mode" | Training data supervision teaching the VLM to emit parseable JSON with coords and tool names |
| min_pixels / max_pixels | "Resolution bounds" | Per-request Qwen2.5-VL controls bounding total pixel count and therefore token count |
| Grounding | "Point-at-it" | Outputting bounding-box coordinates as text tokens; used since Qwen-VL v1 |

## 进一步阅读

- [Bai et al. — Qwen-VL (arXiv:2308.12966)](https://arxiv.org/abs/2308.12966)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Qwen Team — Qwen3-VL (arXiv:2511.21631)](https://arxiv.org/abs/2511.21631)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
