# 马龙和早期融合代币单独的多模型号

> 我们迄今为止所看到的每一个VLM都将图像和文字分开. 视觉代币来自视觉编码器,流入投影器,然后在LLM内部见到文字. 视觉和文本词汇从来没有重叠. 马龙 (Meta,2024年5月) 问:如果他们做了呢? 训练一个VQ-VAE,将图像转化为一个单独的代币的序列, 每个多元文件都是一连串的文字代币和图像代币, 副作用:模型可以在单次推断调用中生成混合模式输出交换的文本和图像代币. 这一课就读了早期融合论文,并构建了一个玩具版本.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, VQ-VAE tokenizer + interleaved decoder)
**Prerequisites:** Phase 12 · 05, Phase 8 (Generative AI)
**Time:** ~180 minutes

## 学习目标

- 解释为什么共享词汇+单次损失改变模型的功能.
- 描述一个VQ-VAE如何将图像代号化为与变压器下一个代号目标相容的单独序列.
- 给Chameleon的训练稳定技巧命名:QK-Norm,放弃位置,LayerNorm订单.
- 比较马龙与BLIP-2的Q-Former方法,

## 问题

基于适配器的VLM (LLaVA,BLIP-2,Qwen-VL) 将文字和图像视为两个不同的东西.`embed(text_token)`通过一个图像`visual_encoder(image) → projector → ... pseudo_tokens`模型有两个输入路径,

造成的三个后果:

1. 法律法师只能消耗图像,而不是发射它们.
2. 混合模拟文件 (像文章中的交替段落和图像) 很难,您要么在模型之外分析多模拟输入,要么在链上生成.
3. 视觉代币和文字代币生活在隐藏空间的不同区域,

马莱恩拒绝了这个前提:图像只是来自共享词汇中的单独代币的序列. 训练模型在交织的文档上,一个损失,一个自动降解码器,然后你可以免费解锁混合模式生成.

## 概念

### 视频标记器 VQ-VAE

标记器是一个向量定量化变量自动编码器.

- 编码器:CNN+ViT将图像映射到空间特征地图,例如32x32的特征256.
- 编码书:K向量学会的词汇 (Chameleon使用8192),也是256的.
- 量化:对于每个空间特征,按L2距离查找最近的代码簿入口.用整数指数取代连续特征.
- 解码器:CNN将数量化功能转换为像素.

培训:VAE重建损失+承诺损失+代码簿损失.代码簿指标为图像形成单独的字母.

对于马里昂:一个图像变成32*32=1024个代币,从8192的词汇中提取.把这些图像ID放在与文本BPE代币相同的ID空间中.马里昂的单个代币器有65,536个输入,并且该数量已经包括8192个图像代码和像图像分离器这样的特殊代币.变压器看到一个序列,一个损失.

### 共同的词汇库

梅伦的词汇库结合了文字代币,图像代币和模式分离器.每个代币都有单个ID.输入嵌入层将每个ID映射到D-dim隐藏的向量.输出投影地图隐藏在语音符号中.软max选择下一个代币,无论如何.

分离器的重要:`<image>`其他`</image>`标签将图像标记序列括号. 在生成时,如果模型发射`<image>`后游软件知道下1024个代币是VQ指数,

### 混合动力发电

推理是分享词汇中的下一个标志预测. 举个例子提示:"画一只猫,描述它".

```
<image> 4821 1029 2891 ... (1024 image tokens) </image>
The cat is orange, sitting on a windowsill...
```

模型自主选择序列它可能产生图像,然后文字,然后文字,或者插入.同一个解码器,同一个损失.

马里昂重新打开了模型输出方式的问题.

### 训练稳定性 QK-Norm,退出,LayerNorm订单

马龙的论文记录了三个技巧:

- 应用LayerNorm到查询和注意力内关键投影,点产品之前.防止在深度的逻辑大小爆炸.使用多个2024后的大型模型.
- 放弃位置.每次剩余添加后放弃,不仅仅是注意力和MLP之后.当图像代币的梯度可以占主导地位时需要更多的规律化.
- 层规则排序.在残留分支上预LN (标准),加上最后块的跳转连接上额外LN.稳定了最终层梯度流.

没有这些技巧,34B-param马龙训练在多个检查点上分离.与他们相结合.训练配方是建筑的贡献.

### 标记器重建天花板

复制PSNR在每512x512图像的8192个代码簿输入和1024个代码上,达到26-28 dB左右.这足以识别图像生成,但明显比持续空间扩散更差 (稳定扩散3达到32+ dB).

代币化器是瓶.更好的代币化器 (MAGVIT-v2,IBQ,SBER-MoVQGAN) 提高了天花板.Emu3 (课 12.12) 通过更好的代币化器实现了SDXL质量生成.

### 马里昂vsBLIP-2 / LLaVA

马龙 (早期融合,共用词语):
- 一个失败,一个解码器.
- 产生混合模式输出.
- 标记器是质量上限.
- 价格高昂:在推断路径上生成的图像每次 VQ-VAE解码器.

蓝光-2/LLaVA (后期融合,分开塔):
- 视觉进入,短信出发.
- 复制预先训练的法学士.
- 没有标记器瓶理解.
- 便宜:单一前进通行.

如果您需要图像生成,查梅伦家族,如果您只需要理解,适配器-VLM更简单,并且使用更多预先训练的计算.

### 福和AnyGPT

福 (Adept, 2023) 是一个相关的方法:完全跳过单独的视觉编码器,通过LLM的输入投影输入原始图像补丁,就像它们是代币,没有代币.比Chameleon简单,失去了共享语音输出生成.

AnyGPT (Zhan et al., 2024) 将马里昂扩展到四种模式:文字,图像,语音,音乐.每个人都用相同的VQ-VAE技巧,共享变压器.任何一代.在课 12.16中详细介绍.

```figure
vq-codebook
```

## 用它

`code/main.py`构建一个玩具端到端早期合模型:

- 一个小的VQ-VAE式量化器,将8×8补丁映射到代码簿指数 (K=16).
- 共有 (文字 ids 0..31) + (图像 ids 32..47) + (分隔符 48, 49).
- 玩具自行降解器 (大图表) 训练用合成标题+图像标记序列.
- 采样循环,以交换文字 + 图像代码发出提示.

代码故意将变压器保持小 (大小) 位,以便您可以追踪信号流程的端到端.

## 运送它

这一课产生了`outputs/skill-tokenizer-vs-adapter-picker.md`鉴于产品规格 (仅理解与理解+生成,所需图像质量,成本预算),它选择马龙家族 (早期融合) 和LLaVA家族 (晚融合) 之间,并通过数量规则证明了这一点.

## 运动

1. 马里昂使用K=8192代码簿的输入和每512x512图片的1024个代码.估计压缩比与24位RGB图像.它是损失的吗?多么损失?

2. 一个4K图像 (3840x2160) 与相同的VQ-VAE密度产生多少个图像代币?一个ameleon型模型可以在一个推断调用中生成4K图像吗?什么首先打破了文本,代币器质量或KV缓存?

3. 实现QK-Norm在纯 Python 中. 鉴于64维查询和键,显示LayerNorm前后的点产品.为什么大小控制在深度上很重要?

4. 阅读马龙2.3节关于训练稳定性.描述了在34B没有QK-Norm的论文中确切的故障模式. "标准爆炸"的签名是什么?

5. 扩展玩具解码器以发出混合模式响应,只需提供文本提示.测量模型如何经常选择图像-第一与文本-第一给定训练-数据分布 60% 文本-第一 / 40% 图像-第一.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Early fusion | "Unified tokens" | Images converted to discrete tokens sharing the transformer's vocabulary from step one |
| VQ-VAE | "Image tokenizer" | CNN + ViT + codebook that maps images to integer indices the transformer can predict |
| Shared vocabulary | "One dictionary" | A single token ID space covering text + image + modality separators |
| QK-Norm | "Attention stabilizer" | LayerNorm applied to query and key before their dot product, prevents norm blowup |
| Mixed-modality generation | "Text + image output" | Inference that autonomously produces interleaved text and image tokens in one pass |
| Codebook size | "K entries" | Number of discrete vectors the VQ-VAE can quantize to; trades compression for fidelity |
| Tokenizer ceiling | "Reconstruction limit" | Best PSNR achievable by decoding VQ tokens; bounds the model's image quality |

## 进一步阅读

- [Chameleon Team — Chameleon: Mixed-Modal Early-Fusion Foundation Models (arXiv:2405.09818)](https://arxiv.org/abs/2405.09818)
- [Aghajanyan et al. — CM3 (arXiv:2201.07520)](https://arxiv.org/abs/2201.07520)
- [Yu et al. — CM3Leon (arXiv:2309.02591)](https://arxiv.org/abs/2309.02591)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Adept — Fuyu-8B blog (adept.ai)](https://www.adept.ai/blog/fuyu-8b)
