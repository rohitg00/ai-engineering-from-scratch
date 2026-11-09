# 控制网,LORA和空调

> 文字本身是一个拙的控制信号.ControlNet允许你克隆预训练的扩散模型,并用深度地图,姿势骨架,形或边缘图像来引导它.LoRA允许你通过训练1000万参数来细节调整2B参数模型.他们一起将稳定扩散从玩具变成了2026年图像管道,将其发送到每个机构.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 10 (LLMs from Scratch — for LoRA foundation)
**Time:** ~75 minutes

## 问题

像"一个穿着红色衣服的女人在拥挤的街上散步狗"这样的提示没有给模型提供关于狗在哪里,女人在什么姿势,或者街道的视角的信息.文字注入了你需要的10%左右的图像.其余的图像是视觉的,不能用语言有效地描述.

训练一个新的条件模型从零开始每一个信号 (姿势,深度,,细分) 是禁止的.你想保持2.6B-param SDXL脊柱结,连接一个小侧网络,读取条件,让它推向脊柱的中间功能.那就是控制网.

你还想教模型新的概念 (你的脸,你的产品,你的风格) 而不需要重新训练完整的模型.你想要一个100倍小的三角形.那就是LoRA 低级适配器,连接到现有注意力重量.

控制网+LoRA+文字 = 2026 实践者工具包.大多数生产图像管道层 2-5 LoRA, 1-3 ControlNets,以及 SDXL / SD3 / Flux 基础上一个IP-适配器.

## 概念

![ControlNet clones the encoder; LoRA adds low-rank deltas](../assets/controlnet-lora.svg)

### 控制网 (Zhang等, 2023)

除原始的编码器. 除原始的编码器. 训练克隆接受额外的调节输入 (边缘,深度,姿势). 连接克隆回原始的解码器半个使用 *零转变* 跳转连接 (1×1 连接初始化为零 开始为无操作,学习三角形).

```
SD U-Net decoder:   ... ← orig_enc_features + zero_conv(controlnet_enc(condition))
```

零-conv init意味着控制网开始作为身份即使在训练之前也没有伤害. 1M (快速,条件,图像) 的火车与标准的扩散损失增加了三倍.

按modality ControlNets 作为小型侧模型 (SDXL 约360M,SD 1.5) 运输.

```
features += weight_a * control_a(depth) + weight_b * control_b(pose)
```

### 劳拉 (Hu等,2021年)

对于任何线性层$W \in \mathbb{R}^{d \times d}$在模型中,结$W$加入一个低级别的三角形:

```math
W' = W + \Delta W, \quad \Delta W = B A, \quad A \in \mathbb{R}^{r \times d}, \quad B \in \mathbb{R}^{d \times r}
```

随着$r \ll d$排名4-16是注意力标准,排名64-128是重型细调.$2 \cdot d \cdot r$没有$d^2$为了 SDXL 的关注$d=640$现在$r=16$整个模型中:LoRA通常是20-200MB与基 5GB相比.

在推断下,你可以扩展LORA:$W' = W + \alpha \cdot B A$现在,我们要去.$\alpha = 0.5\text{-}1.5$许多LoRA的堆积量是加上性的 (通常警告的是它们以非线性方式相互作用).

### 适应器 (Ye et al., 2023)

通过Clip图像编码器生成图像代币,将它们注入文本代币旁边的交叉注意力. ~ 20MB/基模型. 允许您"生成图像按照本参考的风格"而不用LoRA.

## 复合性矩阵

| Tool | What it controls | Size | When to use |
|------|------------------|------|-------------|
| ControlNet | Spatial structure (pose, depth, edges) | 70-360MB | Exact layout, composition |
| LoRA | Style, subject, concept | 20-200MB | Personalization, style |
| IP-Adapter | Style or subject from reference image | 20MB | No text can describe the look |
| Textual Inversion | Single concept as a new token | 10KB | Legacy, mostly replaced by LoRA |
| DreamBooth | Full fine-tune on a subject | 2-5GB | Strong identity, high compute |
| T2I-Adapter | Lighter ControlNet alternative | 70MB | Edge devices, inference budget |

控制网空间,洛拉语义.

```figure
v4-controlnet-zero
```

## 建立它

`code/main.py`在1-D上模拟两个机制:

1. **LoRA.**预训练的线性层$W$结它,训练一个低级的$BA$这样.$W + BA$显示出它是什么?$r = 1$足以学习一个级-1的纠正.

2. **ControlNet-lite.**预测器"结结结基础"和"侧网络"读取额外信号.侧网络的输出由一个可学习的尺度器启动到零 (我们的零-conv版本). 训练和观察门升.

### 步骤1:LoRA数学

```python
def lora(W, A, B, x, alpha=1.0):
    # W is frozen; A, B are the trainable low-rank factors.
    return [W[i][j] * x[j] for i, j in ...] + alpha * (B @ (A @ x))
```

### 步骤2:零点侧网络

```python
side_out = control_net(x, condition)
gated = gate * side_out  # gate initialized to 0
h = base(x) + gated
```

在步骤0中输出与基础相同.`gate`慢慢 没有灾难性漂移.

## 陷

- **Over-scaling LoRAs.** $\alpha = 2$或$\alpha = 3$果是一个常见的"强化"黑客,$\alpha \le 1.5$现在,我们要去.
- **ControlNet weight conflict.**使用Pose ControlNet在重量1.0和深度控制网在重量1.0通常过分.重量总量≈1.0是安全默认的.
- **LoRA on the wrong base.**由于注意力尺寸不匹配,SDXL LoRA在SD 1.5上默默无闻.
- **Textual Inversion drift.**通过一个检查点训练的代币,在另一个检查点上漂移得很差.
- **LoRA weight-merging and storage.**您可以将LoRA入基模型重量中,以更快地推断 (没有运行时间的增加),但您失去了扩展能力$\alpha$保持两种版本.

## 用它

| Goal | 2026 pipeline |
|------|---------------|
| Reproduce a brand's art style | LoRA trained on ~30 curated images at rank 32 |
| Put my face in a generated image | DreamBooth or LoRA + IP-Adapter-FaceID |
| Specific pose + prompt | ControlNet-Openpose + SDXL + text |
| Depth-aware composition | ControlNet-Depth + SD3 |
| Reference + prompt | IP-Adapter + text |
| Exact layout | ControlNet-Scribble or ControlNet-Canny |
| Background replace | ControlNet-Seg + Inpainting (Lesson 09) |
| Fast 1-step style | LCM-LoRA on SDXL-Turbo |

## 运送它

保存`outputs/skill-sd-toolkit-composer.md`技能接收一个任务 (输入资产:即时,可选参考图像,可选姿势,可选深度,可选) 并输出工具堆,权重和可复制的种子协议.

## 运动

1. **Easy.**在`code/main.py`根据" 洛拉"的排名`r`在哪个级别的 LoRA 完全匹配到一个级别-2的目标三角形?
2. **Medium.**训练两个不同的LoRA在两个目标转换. 加载它们在一起,显示它们的增量相互作用. 相互作用什么时候会打破线性?
3. **Hard.**使用扩散器堆:SDXL-base + Canny-ControlNet (重量0.8) +一种风格LoRA ($\alpha$根据堆重量变化,测量FID与即时合规性交换.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| ControlNet | "Spatial control" | Cloned encoder + zero-conv skips; reads a conditioning image. |
| Zero convolution | "Starts as identity" | 1×1 conv initialized to zero; ControlNet starts as no-op. |
| LoRA | "Low-rank adapter" | $W + BA$, $r \ll d$; 100x fewer params than a full fine-tune. |
| rank r | "The knob" | LoRA compression; 4-16 typical, 64+ for heavy personalization. |
| $\alpha$ | "LoRA strength" | Runtime scaling of the LoRA delta. |
| IP-Adapter | "Reference image" | Small image-conditioning adapter via CLIP-image tokens. |
| DreamBooth | "Full subject fine-tune" | Train the full model on ~30 images of a subject. |
| Textual Inversion | "New token" | Learn a new word embedding only; legacy, mostly replaced. |

## 产品说明:LoRA交换,控制网路线,多租户服务

实际的文字到图像SaaS在同一基点上服务数百个LoRA和几十个ControlNets.服务问题看起来非常像LLM多租金 (生产文献涵盖了LLM案例在连续批量和LoRAX / S-LoRA下):

- **Hot-swap LoRAs, do not merge.**合并$W' = W + \alpha \cdot B \cdot A$入基底,每步推断速度大约3-5%,但结.$\alpha$保持LORA在VRAM中作为R级的海域;扩散器暴露`pipe.load_lora_weights()`其他`pipe.set_adapters([...], adapter_weights=[...])`交换成本是`2 · d · r · num_layers` MB 尺度,次分.
- **ControlNet as a second attention lane.**克隆编码器与基层并行运行.重量1.0的两个控制网 = 每步额外的两个前进传递,而不是一个合并传递.批量大小的头部空间四旋翼下降.每步的预算为1.5x.
- **Quantized LoRAs too.**如果您量化了基数 (见课07号,Flux在8GB),LoRA三角形也可以清洁地量化到8位或4位.

流量特定:尼尔斯的Flux-on-8GB笔记本电脑量化了基数为4位;`pipe.load_lora_weights("user/style-lora")`) 在此次定量基础上`weight_name="pytorch_lora_weights.safetensors"`这就是大多数SaaS机构在2026年发布的食谱.

## 进一步阅读

- [Zhang, Rao, Agrawala (2023). Adding Conditional Control to Text-to-Image Diffusion Models](https://arxiv.org/abs/2302.05543)控制网
- [Hu et al. (2021). LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) LoRA (原来用于 LLM; 输出口).
- [Ye et al. (2023). IP-Adapter: Text Compatible Image Prompt Adapter](https://arxiv.org/abs/2308.06721) IP 适配器
- [Mou et al. (2023). T2I-Adapter: Learning Adapters to Dig Out More Controllable Ability](https://arxiv.org/abs/2302.08453)更轻的替代品对控制网.
- [Ruiz et al. (2023). DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation](https://arxiv.org/abs/2208.12242)梦幻.
- [HuggingFace Diffusers — ControlNet / LoRA / IP-Adapter docs](https://huggingface.co/docs/diffusers/training/controlnet)参考管道.
