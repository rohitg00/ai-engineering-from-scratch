# 装体VLA:RT-2,OpenVLA, π0,GR00T

> 模型第一次在厨房机器人上读取一个网站的食谱并执行它是RT-2 (谷歌DeepMind,2023年7月). RT-2 透了作为文本代币的行为,在网络数据和机器人操作数据上共同调整了VLM,并证明了网络规模的视觉语言知识转移到机器人控制. 开放VLA (2024年6月) 发送了开放7B参考. 物理智能的 π0 系列 (2024-2025) 增加了与流量匹配的行动专家. 据悉,NVIDIA的GR00T N1 (2025年3月) 提供了双系统 (系统1/系统2) 控制,用于规模化的人类型机器人. 视觉语言行动的VLA原始模式,一个看到,阅读和行动的单一模型,是这一阶段理解模型和15阶段自主系统之间的桥梁.

**Type:** Learn
**Languages:** Python (stdlib, action tokenizer + VLA inference skeleton), TypeScript
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 15 (Autonomous Systems, referenced)
**Time:** ~180 minutes

## 学习目标

- 描述行动代码化:分离式代码 (RT-2),快速有效的行动代码,连续的流量匹配行动 (π0).
- 解释为什么在网络+机器人数据上进行共调使一般知识转移到新任务保持.
- 对于同一机器人任务,比较OpenVLA (7B Llama+VLM开放), π0 (流量匹配) 和GR00T N1 (双系统).
- 举个Open X-Embodiment数据集及其作为RT-X培训集的作用.

## 问题

机器人从自然语言指令中完成任务自1970年代以来一直是研究目标.20世纪20年代的答案:视觉语言行动 (VLA) 模型.VQA使用的VLM架构相同,但输出是操作 (联合扭矩,终端效应器姿势,单独命令) 而不是文字.

针对VLA的挑战:

1. 动作空间是连续的 (结合角,力量) 和高维度的 (7-DOF臂 + 3-DOF抓住器 = 30 Hz 10 个).
2. 机器人特定训练数据稀缺.开放X-Embodiment有1M轨迹;网络文本图像为5B+.
3. 控制频率是重要的. 30 Hz 控制循环意味着每次操作的预算33ms.
4. 错误的行为损害了硬件,人或财产.

## 概念

### 行动代号化 (RT-2)

RT-2 的技巧:将每个联合目标表示为一个量化文本代币.将正常化 [-1, 1] 范围分为 256 个桶,将每个桶映射到一个词汇识别器.每一步控制时,一个10DOF 动作变成10个代币.

配调一个PaLM-X VLM在混合物上:

- 网络图像与文本对 (标题,VQA).
- 机器人演示,作为代币的行动.

模型看到"挑起红立方体" (语言) →图像 (视觉) →10代令行动序列 (分辨关联目标).网络预训练保留了一般知识传输:RT-2可以跟踪"向快速移动的对象"即使"快速移动"不在训练数据中.

在RT-2纸上,在3-5Hz的偏移,由VLM自动降解码限制.

### 开放VLA 开放7B引用

开放VLA (Kim等同,2024年6月) 是开放重量RT-2相当. 7B Llama脊柱,DINOv2 + SigLIP双视觉编码器,在256个桶内进行动作代码化.

训练在开放的X-Embodiment上 (970k轨迹在22个机器人).

射率:A100上4-5Hz,量化. 足够快,用于缓慢的操纵,而不是高频控制.

### 快速代码器 快速解码行动

珀茨及其他研究人员 (2024) 表明,单双bin代码化是不有效的. 大多数行动集群在一个小区域的bin空间. FAST (频率域行动序列代码化器) 通过DCT压缩行动序列并量化系数.

通过30步的行动轨迹,将成为10个快速代币,而不是300个分离式bin代币. 推理速度在不失去质量的情况下提高3-5倍.

### π0和流量匹配操作

物理智能 π0 (Black et al.,2024年10月) 将单独的行动代币取代为流量匹配行动专家:

- 一个小的动作变压器读取VLM的隐藏状态,通过调整流程输出一个连续的50步的动作序列.
- 动作头部的流量相匹配损失;VLM预训练保持不变.
- 射:在5个指标步骤中发射的全动作序列,有效控制50 Hz.

果的果:在各种操作任务中,它比OpenVLA和Octo更好.

速的增长率为0.5和速的增长率.

### G00T N1 双系统人形

对于人形机器人 (>30DOF,全身) 来设计NVIDIA的GR00T N1 (2025年3月):

- 系统2:一个大型VLM阅读场景+指令,以 ~ 1 Hz 产生高水平的子目标.
- 系统1:一个小型的动作头变压器,以低级50-100Hz联合命令,以子目标为条件.

卡内曼的快速和慢思考的分区图:系统2计划,系统1行动. 优势:慢的VLM规模规划不会阻碍快速控制;系统1保持小的延迟.

通过G00T N1.7 (2025年底) 改进数据扩展.G00T通过Omniverse的真实数据进行细调.

### 开放的X体

训练数据.RT-X (2023年10月) 组装了22个机器人中1M轨迹的22个数据集.

- ALOHA / 桥 V2 / Droid / RT-2 厨房 / 语言表.
- 每个样本: (机器人状态,摄像头视图,指示,行动序列).
- 训练卫生:统一行动空间,正常化关节范围,改变摄像头的尺寸.

开放VLA和 π0 训练在开放X-Embodiment. 域空白与任何特定机器人通过LoRA细调在100-1000个任务特定演示中被关闭.

### 配合调整与仅使用机器人

协 fin 调结将网络 VQA 数据与机器人轨迹混合在一起. 比例很重要:过多的 VQA,模型忘记了行动;过多的机器人数据,模型失去了一般知识.

 RT-2 的比率: ~1:1. OpenVLA: ~0.5:1网络到机器人. π0:类似.

只有机器人训练产生了任务特定模型,但在分配之外的指示上失败. 兼整调是"从左边取出红立方体 (演示中) "和"从左边取出第三大物体 (新文法) "之间的区别.

### 安全和行动限制

每个生产VLA船只都配备:

- 硬关节限制 (不能超过规格的扭矩).
- 速度限制 (柔软剪切).
- 工作空间界限 (终端效应器不能离开表).
- 批发新任务的人员.

它们在VLA之外作为控制层检查.VLA的输出是建议,而不是命令.

```figure
mm-action-tokens
```

## 用它

`code/main.py`其他:

- 实施256bin行动代币化和脱代币化.
- 基于DCT+量化的FAST代码符号图.
- 通过每个操作步骤的代币数量 (分离bin,FAST,连续流量)
- 打印RT-2 → OpenVLA → π0 → GR00T的谱系总结.

## 运送它

这一课产生了`outputs/skill-vla-action-format-picker.md`鉴于机器人任务 (操纵,导航,人形整体),选择分离bin+RT-2,FAST+OpenVLA,流量匹配+ π0,或双系统+GR00T.

## 运动

1. 通过10DOF的手臂,控制速度为30Hz. 单独的子代码在256个桶中发射多少代码每秒? 7BVLM能跟上吗?

2. 快速标记将30步轨迹压缩到10个标记.如果轨迹具有高频运动 (例如鼓声),用户会失去什么?

3. 通过5步调解 π0 的流量相匹配头.

4. 根据GR00T的系统1/系统2分开卡内曼的地图. 提出一个不同的分开 (系统3?) 可以帮助双脚步行.

5. 阅读开放X体体4节关于数据集策划. 列出防止域名泄漏的三个策划规则.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| VLA | "Vision-language-action" | Model that takes image + instruction and outputs action commands |
| Action tokenization | "Discrete bins" | Quantize continuous joint targets into 256 bins per dim, each a vocab ID |
| FAST tokenizer | "Frequency action tokens" | DCT + quantize to compress 30-step trajectories to ~10 tokens |
| Co-fine-tune | "Mix web + robot" | Train on web VQA data alongside robot demos to preserve general knowledge |
| Flow-matching action head | "π0 continuous output" | Small transformer that outputs a 50-step action sequence via rectified flow |
| System 1 / System 2 | "Dual-system control" | Large VLM plans slowly, small action head acts quickly; GR00T pattern |
| Open X-Embodiment | "RT-X dataset" | 1M-trajectory cross-robot dataset; the training corpus |

## 进一步阅读

- [Brohan et al. — RT-2 (arXiv:2307.15818)](https://arxiv.org/abs/2307.15818)
- [Kim et al. — OpenVLA (arXiv:2406.09246)](https://arxiv.org/abs/2406.09246)
- [Black et al. — π0 (arXiv:2410.24164)](https://arxiv.org/abs/2410.24164)
- [NVIDIA — GR00T N1 (arXiv:2503.14734)](https://arxiv.org/abs/2503.14734)
- [Open X-Embodiment Collab — RT-X (arXiv:2310.08864)](https://arxiv.org/abs/2310.08864)
