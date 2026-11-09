# 深度搜索V3架构通行

> 阶段10 · 第14课每一个开放模型都会转动的六个建筑. 探V3 (12月2024年,共671B参数,37B活跃) 将所有六个变动增加了四个:多头潜伏注意力,辅助无损负载平衡,多 टोकन预测和双管训练. 这一课程将DeepSeek-V3的架构从上到下,并从发布的配置中取出每个参数数数. 截至最后,你就可以解释为什么671B/37B比率是合适的投注,

**Type:** Learn
**Languages:** Python (stdlib, parameter calculator), Rust
**Prerequisites:** Phase 10 · 14 (open-model walkthroughs), Phase 10 · 17 (NSA), Phase 10 · 18 (MTP), Phase 10 · 19 (DualPipe)
**Time:** ~75 minutes

## 学习目标

- 阅读DeepSeek-V3配置的顶部到底,并用六个GPT-2按和四个DeepSeek特定的添加来解释每个字段.
- 导出总参数数 (671B),活参数数 (37B) 和每个参数的贡献组件.
- 在128k文本中计算MLA的KV缓存足迹,并与GQA的相同活性参数密集型模型进行比较.
- 说明DeepSeek特定的四项创新 (MLA,MTP,辅助无损路由,DualPipe) 以及每个目标的建筑/培训堆的一部分名称.

## 问题

果V3是第一个开放的边界模型,其架构与拉马家族有意义地不同. 拉马3405B是"GPT-2有六个旋转. "深度搜索V3是GPT-2有六个旋转加上四个. 阅读Llama 3配置是阅读DeepSeek配置的热点,但深层结构,注意力区块的形状,路由逻辑,训练时间目标,

学习的回报:DeepSeek-V3的开放权重版本改变了"边界能力"在开放模型中意味着什么. 架构是许多2026年培训运行所复制的蓝图.理解它是任何涉及边界LLM培训或推断的角色的桌子.

## 概念

### 变化不变的核心,再次

果版V3仍然是自动降级的.它仍然堆叠解码区块.每个区块仍然有注意力加上MLP加上两个RMSNorms.它仍然使用SwiGLU在MLP中.它仍然使用RoPE.预规.重量绑定嵌入式.与每个Llama或Mistral相同的基线.

### 转变:MLA而不是GQA

从10 · 14阶段开始,你知道GQA通过将K和V分为Q头群的KV缓存缩小了.多头隐形注意力 (MLA) 进一步了:K和V被压缩成共享的低级隐形表示 (the `kv_lora_rank`存储器只存储隐藏的,通常每层每代币512个浮动,而不是8 x 128 = 1024个浮动.

在128k背景下, DeepSeek-V3与MLA (一个共享的隐藏`c^{KV}`通过可吸收到后续的子中的上升投影,K和V都来自此隐藏的:

```
kv_cache = num_layers * kv_lora_rank * max_seq_len * bytes_per_element
         = 61 * 512 * 131072 * 2
         = 7.6 GB
```

假设GQA基线 (Llama 3 70B形状,8KV头,头128) 将支付:

```
kv_cache = 2 * 61 * 8 * 128 * 131072 * 2
         = 30.5 GB
```

在128k文本上,MLA比Llama-3-70B类型的GQA缓存小4倍.

折扣:MLA每一个注意力计算 (每一个人) 增加一个减压步骤.额外的计算与节省的带宽相比较小.长文本推断的净胜利.

### 路由:无损辅助负载平衡

导路器决定哪些顶级专家处理每个代币.一个天真的路由器集中太多的工作在少数专家上,让其他人置.标准解决方案:添加辅助损失术语,惩罚负载不平衡.这有效,但略有降低了主任务性能.

通过简单的规则,将每个专家的偏见条款添加到路由器的记录中,`e`度下降`bias_e`训练保持干净,专家负载保持平衡.

影响主要损失:没有可测量. 对MoE架构的影响:清洁,没有辅助损失超参数调节.

### 密集训练+免费训练

从10 · 18阶段,你知道DeepSeek-V3添加了D=1 MTP模块,预测代币前面的两个位置.在推断时,训练模块被重定为一个投机式解码草案,接受80%以上.在训练时,每个隐藏状态都在D+1 = 2目标上监督,提供更密集的信号.

参数:671B主机上14B. 总费:2.1%.

### 训练:双管

从10期 19期你知道DualPipe是一个双向管道,它覆盖前后的块,与跨节点通讯.在DeepSeek-V3的2,048-H800尺度上,它恢复了1F1B将失去的约245kGPU小时.

### 配置,个别的领域

这里是 DeepSeek-V3 配置 (简单):

```
hidden_size: 7168
intermediate_size: 18432   (dense MLP hidden size, used on first few layers)
moe_intermediate_size: 2048 (expert MLP hidden size)
num_hidden_layers: 61
first_k_dense_layers: 3    (first 3 layers use dense MLP)
num_attention_heads: 128
num_key_value_heads: 128   (formally equal to num_heads under MLA, but
                           the real compression is in kv_lora_rank)
kv_lora_rank: 512          (MLA latent dimension)
num_experts: 256            (MoE expert count per block)
num_experts_per_tok: 8      (top-8 routing)
shared_experts: 1           (always-on shared expert per block)
max_position_embeddings: 163840
rope_theta: 10000.0
vocab_size: 129280
mtp_module: 1               (1 MTP module at depth 1)
```

分析一下:

- `hidden_size=7168`嵌入式尺寸
- `num_hidden_layers=61`积的总深度
- `first_k_dense_layers=3`其他58个使用 MoE.
- `num_attention_heads=128`查询标题: 128个.
- `kv_lora_rank=512`:K和V被压缩到这种隐形尺寸,并被解压缩为每头.
- `num_experts=256, num_experts_per_tok=8`据悉,每一块中海工程部门都有256名专家,
- `shared_experts=1`对于每一个代币,除了256个被调整的专家之外,每一个代币都有1个常见专家.
- `moe_intermediate_size=2048`由于有256个,所以它比密集的MLP更小.

### 参数会计

整个计算在`code/main.py`标题:

- 嵌入:`vocab * hidden = 129280 * 7168 = ~0.93B`现在,我们要去.
- 首先有3个密集块:注意力 (计算器简化计算中每块的MLA (~84M) +密集的SwiGLUMLP (`3 * 7168 * 18432 = ~396M`总量约为1.4B.
- 58个MoE区块:与MLA (~84M) 关注 +256名专家 (`3 * 7168 * 2048 = ~44M`根据"每块"的标准,每块的标准,包括所有专家.
- 计算器使用0.8B的密集备用.

大总数:计算器与主机的发布的671B相比达到~664B. Hugging Face检查点为685B,因为它在671B上方添加了14B MTP模块.剩下的~1%的差距来自简化:计算器跳过了MLA中脱的RoPE尺寸,脱的输出头和几个小子.

按前进的活跃参数:

- 注意:每层84M * 61 = ~5.1B (所有层都燃烧).
- 活跃的MLP:第一3层密集 (`3 * 396M = ~1.2B`), 58个MoE层,每个层有8个路由+1个共享专家 (`9 * 44M = ~396M`总的来说,我们每层都在24B左右.
- 嵌入+标准: ~0.9B.
- 总活动:计算器比发布的37B大约30B.大部分差距是注意力:全 MLA,其 RoPE 尺寸和更广泛的查询和键头,比简单的计数大.MTP 模块不计向37B.

### 平均值

密度比率为18倍 (活性参数为总量的5.5%).DeepSeek-V3是最稀有的边界MoE模型,它已经运送了开放权重.混合型8x7B在比率为13/47 (28%) 密度更高.Llama 4 Maverick在比率为17B/400B (4.25%) 相当.深度Seek的投注:在边界规模上,较低激活率的更多专家产生更好的质量每活跃-FLOP.

### 探V3坐的地方

| Model | Total | Active | Ratio | Attention | Novel ideas |
|-------|------|-------|-------|-----------|-------------|
| Llama 3 70B | 70B | 70B | 100% | GQA 64/8 | — |
| Llama 4 Maverick | 400B | 17B | 4.25% | GQA | — |
| Mixtral 8x22B | 141B | 39B | 27% | GQA | — |
| DeepSeek V3 | 671B | 37B | 5.5% | MLA 512 | MLA + MTP + aux-free + DualPipe |
| Qwen 2.5 72B | 72B | 72B | 100% | GQA 64/8 | YaRN extension |

### 接下来:R1,V4

根据V3背骨的推理训练,R1使用相同的架构.所改变的是训练后的配方 (可验证任务的大规模RL),而不是训练前的架构.

预计DeepSeek-V4 (如果它发货) 将保留MLA + MoE + MTP并添加DSA (DeepSeek Sparse Attention),该系统是NSA的继承者,从10 · 17阶段.

```figure
moe-routing
```

## 用它

`code/main.py`运行它,将其输出与纸张的数字进行比较,并使用它在假设变体上 (256 专家对512 ,前8对前16 ,MLA 排名 512对1024).

什么要看:

- 总参数数与公布的671B.
- 活跃参数数与公布的37B.
-  MLA 与 GQA 的比较.
- 按层次分类,看看参数预算实际上是什么.

## 运送它

这一课产生了`outputs/skill-deepseek-v3-reader.md`鉴于DeepSeek家族模型 (V3,R1或任何未来的变体),它产生了组件按组件的架构读取,该模型将配置的每个领域命名,从组件按参数计算中推出,并确定该模型使用的四种DeepSeek特定创新中哪个.

## 运动

1. 跑步`code/main.py`计算器的总参数估计与已发表的671B相比较,并确定 delta来自哪里.

2. 修改配置,以使用MLA级别 256而不是512. 在128k文本中计算出所产生的KV缓存大小.它购买了多少个百分比的减小,每头表达性成本是多少?

3. 根据 DeepSeek-V3 的推测,它可以使用一个假设的 (512 专家, 8 专家) 变异.

4. 阅读深度搜索-V3技术报告 (arXiv:2412.19437) 的2.1节. 解释为什么K和V解压矩阵可以"吸收"后续的子中,以推断时间效率.

5. 根据 DeepSeek-V3 的数据,FP8 训练是最重要的.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MLA | "Multi-Head Latent Attention" | Compress K and V into a shared low-rank latent (kv_lora_rank, typically 512), decompress per head on-the-fly; KV cache stores only the latent |
| kv_lora_rank | "MLA compression dim" | The size of the shared latent for K and V; DeepSeek-V3 uses 512 |
| First k dense layers | "Early layers stay dense" | The first few MoE-model layers skip the MoE router and run a dense MLP for stability |
| num_experts_per_tok | "Top-k routing" | How many routed experts fire per token; DeepSeek-V3 uses 8 |
| Shared experts | "Always-on experts" | Experts that process every token regardless of routing; DeepSeek-V3 uses 1 |
| Auxiliary-loss-free routing | "Bias-adjusted load balance" | Per-expert bias terms adjusted during training to keep expert load balanced without adding a loss term |
| MTP module | "Extra prediction head" | Transformer block predicting $t+2$ from $h^{(1)}$ and $E(t+1)$; denser training, free speculative-decoding draft |
| DualPipe | "Bidirectional pipeline" | Training schedule that overlaps forward/backward compute with cross-node all-to-all |
| Active parameter ratio | "Sparsity" | active_params / total_params; DeepSeek-V3 hits 5.5% |
| FP8 training | "8-bit training" | Training storage and many compute ops in FP8; roughly halves memory vs BF16 at a small quality cost |

## 进一步阅读

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437)完整的建筑,培训和结果文件
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3)配置文件和部署说明
- [DeepSeek-V2 paper (arXiv:2405.04434)](https://arxiv.org/abs/2405.04434)引入MLA的前任
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948)V3的架构的推理训练继承者
- [Native Sparse Attention (arXiv:2502.11089)](https://arxiv.org/abs/2502.11089)深度寻找家庭关注的未来方向
- [DualPipe repository](https://github.com/deepseek-ai/DualPipe)培训时间表的参考
