# 涂料,外涂料和图像编辑

> 文字到图像创造了新的东西.涂料修复了旧的东西.在生产中,70%的可收费图像工作是编辑.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 8 · 08 (ControlNet & LoRA)
**Time:** ~75 minutes

## 问题

客户端发送一个完美的产品照片,背景上有一个分散注意力的标志.你想删除标志,让其他的所有内容都像素相同.你不能从零开始运行文字到图像.结果将会有不同的颜色,不同的照明,不同的产品角度.你想再生 *只有*面具区域,你希望再生尊重周围的环境.

这就是涂料.

- **Inpainting.**罩内再生, 保持像素外.
- **Outpainting.**罩外面 (或外面) 再生,保持内部.
- **Image editing.**恢复整个图像,但保持对原始的语义或结构性忠诚度 (SDEdit,InstructPix2Pix).

它们使用了相同的原理, 它们使用了相同的原理, 它们使用了相同的方法,

## 概念

![Inpainting: mask-aware denoising with context-preserving reinjection](../assets/inpainting.svg)

### 简单的做法 (以及为什么它是错误的)

通过面具运行标准的文字到图像. 在每一步采样时,用前方传播的清洁图像取代无面膜的噪音隐藏区域. 它运行不好. 边界的文物流血,因为模型没有有关在面膜区域的信息.

### 适当的涂料模型

运行改造的U-网, 采用9个输入频道, 而不是4个:

```
input = concat([ noisy_latent (4ch), encoded_image (4ch), mask (1ch) ], dim=channel)
```

另外,这些频道是VAE编码的源图像的副本,加上一个单频道面具.在训练时,你随机地掩盖图像的区域,并训练模型只表示面具区域,而未掩盖的区域则作为清洁的条件信号.在推断时,模型可以"看到"周围面具区域的内容并产生一致的完成.

它们都使用9通道 (或模拟) 输入.`StableDiffusionInpaintPipeline`现在`FluxFillPipeline`现在,我们要去.

### 免费编辑

添加噪音到源图片中等程度`t`然后从 `t`没有再训练,选择开始`t`为了创造自由而交易忠诚:

- `t/T = 0.3`→几乎与源头相同,小的风格变化
- `t/T = 0.6`→ 修改量度较小,保持粗的结构
- `t/T = 0.9`→ 由于近噪音,最小的源源保存

### 导读Pix2Pix (布鲁克斯等, 2023)

调整一个扩散模型`(input_image, instruction, output_image)`在推断时,对输入图像和文本指令进行条件 ("让它落日"",添加龙").两个CFG尺度:图像尺度和文本尺度.

### 复刻 (Lugmayr等, 2022)

保持标准无条件扩散模型.在每一步反转时,再样本偶尔跳回更的状态,再生.避免边界文物.当你没有训练有素的涂料模型时使用.

```figure
inpaint-mask-reinject
```

## 建立它

`code/main.py`在5维数据上,我们将一个DDPM训练在5维混合数据上,每个样本是5个浮动从两个集群中的一个.在推断时,我们"掩盖"5个维度中的2个,每一步都注射了无声前进的无声三个,并只再生了掩盖的维度.

### 步骤1:5-DDPM数据

```python
def sample_data(rng):
    cluster = rng.choice([0, 1])
    center = [-1.0] * 5 if cluster == 0 else [1.0] * 5
    return [c + rng.gauss(0, 0.2) for c in center], cluster
```

### 步骤2:在所有5个线上进行列车断

标准的DDPM. 网输出预测5D噪音输入5D噪音输入.

### 步骤3:在推断时,面具意识的反向

```python
def inpaint_step(x_t, mask, clean_image, alpha_bars, t, rng):
    # replace unmasked dims with a freshly noised version of the clean source
    a_bar = alpha_bars[t]
    for i in range(len(x_t)):
        if not mask[i]:
            x_t[i] = math.sqrt(a_bar) * clean_image[i] + math.sqrt(1 - a_bar) * rng.gauss(0, 1)
    # ...then run the normal reverse step on x_t
```

实际的图像涂料使用9通道输入,因为纹理一致性更重要.

### 步骤4:外涂

涂料是涂料面具倒:掩盖新的 (以前没有) 布,填补其余的原始.相同的训练目标.

## 陷

- **Seams.**简单的方法会留下可见的边界,因为梯度信息不会通过面具流动.
- **Mask leakage.**如果调整图像的未蒙面区域质量低或噪音,它会污染面具内部的产物.
- **CFG interacts with mask size.**低调度,低调度,低调度,低调度.
- **SDEdit fidelity cliff.**开始的`t/T = 0.5`为了`t/T = 0.6`检查和检查点.
- **Prompt mismatch.**提示应该描述整个图像,而不仅仅是新内容.

## 用它

| Task | Pipeline |
|------|----------|
| Remove object, small mask | SD-Inpaint or Flux-Fill, standard prompt |
| Replace sky | SD-Inpaint + "blue sky at sunset" |
| Extend canvas | SDXL outpaint mode (8px feather) or Flux-Fill with outpaint mask |
| Regenerate hand / face | SD-Inpaint with prompt re-describing the subject + ControlNet-Openpose |
| Change style of one region | SDEdit at `t/T=0.5` on masked region |
| "Make it sunset" | InstructPix2Pix or Flux-Kontext |
| Background replacement | SAM mask → SD-Inpaint |
| Ultra-high-fidelity | Flux-Fill or GPT-Image (hosted) for hardest cases |

通过SAM (Meta's Segment Anything, 2023) + 扩散油漆,将2026年的背景删除管道进行.SAM 2 (2024) 在视频上工作.

## 运送它

保存`outputs/skill-editing-pipeline.md`技能采用原始图像+编辑描述+可选面具 (或 SAM提示) 输出:面具生成方法,基模型,CFG尺度 (图像+文本),SDEdit-t或涂料模式,以及QA检查清单.

## 运动

1. **Easy.**在`code/main.py`面膜的尺寸分数从0.2到0.8之间.
2. **Medium.**执行重涂:每次10次倒车步骤,跳回5步 (添加噪音) 并重新表现.测量它是否减少了面具边缘的边界残留.
3. **Hard.**使用拥抱面部扩散器进行比较:SD 1.5 涂料 + 控制网-开放面部 vs 流动.1- 填写20个面部再生任务. 分别进行遵守和身份保护.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Inpainting | "Fill the hole" | Regenerate inside a mask; keep outside pixels. |
| Outpainting | "Extend the canvas" | Regenerate outside the canvas; keep inside. |
| 9-channel U-Net | "Proper inpainting model" | U-Net with `noisy \| encoded-source \| mask` as input. |
| SDEdit | "Img2img with noise level" | Noise to time `t`, denoise with new prompt. |
| InstructPix2Pix | "Text-only edits" | Fine-tuned diffusion on (image, instruction, output) triples. |
| RePaint | "No retraining" | Re-noise periodically during reverse to reduce seams. |
| SAM | "Segment Anything" | Mask generator by clicks or boxes; pairs with inpaint. |
| Flux-Kontext | "Edit with context" | Flux variant that accepts a reference image + instruction for edits. |

## 制作说明:编辑管道对延迟敏感

编辑图像的用户预计将在5秒内进行回路.在10242时进行30步的SDXL-Inpaint是L4上3-4秒,加上SAM面具生成 (~200ms) 和VAE编码/解码 (~500ms组合).在生产框架中,这是TTFT绑定而不是吞吐量绑定的批量1,低同步性,尽量减少每个阶段:

- **SAM-H is the slow one.**在10242时,SAM-H是~200ms;在SAM-ViT-B时,SAM-H是~40ms,质量损失较小.SAM 2 (视频) 增加了时间的上空费用;不要用于单次图像编辑.
- **Skip the encode when possible.** `pipe.image_processor.preprocess(img)`如果您有以前的 latenc (典型的反复编辑 UI),直接通过 `latents=...`跳过一个VAE编码.
- **Mask dilation matters for throughput too.**面具的小部分意味着大部分U-Net前进通行都是浪费的 (不面具的像素无论如何都被紧).`diffusers` `StableDiffusionInpaintPipeline`运行全 U-Net不管;只有9通道正确涂料的变体利用隐蔽计算.
- **Flux-Kontext is the 2025 answer.**单一前进过渡`(source_image, instruction)`没有单独的面具,没有SDEdit噪声扫描. 在H100上,它在1.5秒内发出编辑.建筑课:崩阶段.

## 进一步阅读

- [Lugmayr et al. (2022). RePaint: Inpainting using Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2201.09865)无培训的涂料.
- [Meng et al. (2022). SDEdit: Guided Image Synthesis and Editing with Stochastic Differential Equations](https://arxiv.org/abs/2108.01073) 死亡
- [Brooks, Holynski, Efros (2023). InstructPix2Pix](https://arxiv.org/abs/2211.09800)编辑文本说明.
- [Kirillov et al. (2023). Segment Anything](https://arxiv.org/abs/2304.02643)SAM,面具来源.
- [Ravi et al. (2024). SAM 2: Segment Anything in Images and Videos](https://arxiv.org/abs/2408.00714)视频 SAM.
- [Hertz et al. (2022). Prompt-to-Prompt Image Editing with Cross-Attention Control](https://arxiv.org/abs/2208.01626)注意力级编辑.
- [Black Forest Labs (2024). Flux.1-Fill and Flux.1-Kontext](https://blackforestlabs.ai/flux-1-tools/) 2024 年工具
