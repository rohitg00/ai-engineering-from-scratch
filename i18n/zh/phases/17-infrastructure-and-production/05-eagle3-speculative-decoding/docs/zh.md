# 3 生产中的投机解码

> 投机解码将快速的草案模型与目标模型结合起来. 草案提出K代币;目标在单个前期中验证;接受的代币是免费的. 2026年,EAGLE-3是生产级变体,它训练了一个预稿头,在目标模型的隐藏状态而不是原始代币,在一般聊天中推进接受率alpha到0.6-0.8带. 如果阿尔法下降到0.55以下,投机解码在高同步率下是净负的,因为每一个被拒绝的草案都需要第二个目标前进. 这课教你先测量阿尔法,然后翻旗.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy acceptance-rate simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 10 · 18 (Multi-Token Prediction)
**Time:** ~60 minutes

## 学习目标

- 举个猜测解码的三个代,并解释EAGLE-3与EAGLE-2以及经典的草案模型所发生的变化.
- 定义接受率alpha,从alpha和K (草案长度) 计算预期加速,并确定目标同步率的破解式alpha.
- 解释为什么在vLLM 2026中投机解码是选择式 (不是默认的) 以及为什么在没有测量alpha的情况下启动它是生产反模式的原因.
- 写出测量计划:哪个基准,哪个提示分布,哪个同步点,哪个指标要进入.

## 问题

解码是基于内存的.在运行Llama 3.3 70B FP8的H100上,每个解码步骤都会读取HBM的所有重量70GB,并发出每序列的一个代币.在解码期间,GPU计算几乎是无效的.

投机解码利用差距.使用廉价的草案模型生成K候选代币,然后要求目标模型在单次前进传递中验证所有K.每个验证的代币实际上是免费的 (将其抵免成一批K前进的代币,目标无论如何都必须做).

经典的草案模型方法采用相同家族的较小模型 (Llama 3.2 1B 草案为Llama 3.3 70B). 虽然它有效,但接受率是中等的, ,然后-2,然后-3将轻微的导弹头直接放在目标模型的内部状态上, 这就是为什么阿尔法从0.4的草案模型到0.6-0.8的EAGLE-3.

鱼:EAGLE-3将加入VLLM2026年.`speculative_config`没有标志,没有加速. 没有测量Alpha的团队通常会看到尾声延迟变得更糟,而不是更好.

## 概念

### 什么是投机解码实际上买

没有规范解码,每代币成本是一个目标前. 通过草案长度K和接受alpha的规范解码,每个目标前的预期代币是`1 + K * alpha`速度是`(1 + K * alpha) / (1 + epsilon)`对于K=5,alpha=0.7: `(1 + 5*0.7) / (1 + 0.1) = 4.5 / 1.1 = 4.1x`实际数字的集群大约2到3倍,因为Alpha在生产流量上很少高,而epsilon在高批量量上生长.

### 为什么阿尔法是唯一重要的指标

拒绝的代币不会消失 它们强迫第二个目标向前,以获得第一个拒绝的代币. 在一个工作负载上,Alpha下降到0.4,你支付的草案总费加上验证加上重新滚动. 在高同步率 (例如 256 同步) 上,解码批量已经足够大,以至于"仅仅目标"和"仅仅验证目标"之间的内存带宽差距缩小. 在2026年大部分硬件上,

根据工作量,Alpha变化. 在ShareGPT类型的通用聊天中,在ShareGPT上训练的EAGLE-3达到0.6-0.8. 在特定领域的流量 (代码,医疗,法律) 上,一般数据训练的草案负责人下降到0.4-0.6. 训练一个特定领域的草稿头恢复阿尔法 与目标细节调整相比,这是一个轻松的,快速的训练工作. 7 · 16阶段和 10 · 15阶段的值较高 (0,85以上). 它们是与草案的训练数据相匹配的聊天基准的每代币率. 根据自己的流量来测量阿尔法.

### 子一眼的几代人

- **Classic draft model**基础设施简单 两个型号加载,每一个目标向前运行K.
- **EAGLE-1 (2024)**目标上面的小参数上层.
- **EAGLE-2 (2025)**根据图文的定义,该图文的长度可适应,基于树木的图文 (在一个目标传输中检查多个分支).
- **EAGLE-3 (2025-2026)**预备主机训练多个目标层 (不仅仅是最后),更好的排列.

### 2026年生产配方

1. 测量基线TTFT,ITL,在目标同步时的吞吐量.
2. 通过vLLM启用EAGLE-3草案`speculative_config`检查一个标准.
3. 记录接受率 alfa. vLLM V1 报告`spec_decode_metrics.accepted_tokens_per_request`按要求的草稿长度划分,得到阿尔法.
4. 如果生产流量分布的alpha <0.55 值,则禁用规格解码或训练一个特定领域的EAGLE-3草案.
5. 在生产同时,再运行.确认P99ITL没有变得更糟.

### 产量陷:P99尾

平均ITL下降了,如果不调节,P99可能会变得更糟.拒绝的草案会引发两次通过序列 (草案+验证失败+重滚).在全批次下,这些两个通过会串行.看P99 ITL,而不是P50.

### 已经部署EagLE-3的地区

谷歌在2025年部署了AI概述中的投机解码 (相同质量,更快的响应).`speculative_config`作为记录式接口,其特征矩阵标志着投机式解码与碎片预填相容.SGLang支持EAGLE-3作为预写重工作负载的建议草案路径.

### 在一行中打破平数

预期加速:`S(alpha, K) = (1 + K*alpha) / (1 + verify_overhead)`设置`S = 1`解决了alpha: `alpha_breakeven = verify_overhead / K`对于典型的verify_overhead ~0.15和K=5: `alpha_breakeven = 0.03`但这是原始解码数学. 在高同步时,验证上空费用增加,并且解码批量已经 amortizes 连续性内存读数,所以有效的alpha_breakeven 实际上上上升到0.45-0.55.

### 什么时候不使用推测解码

- 批发-1的离线生成,延迟不重要.
- 非常短的输出 (低于50个代币). 草案总费和验证成本占主导地位.
- 专业域没有专业训练的招聘负责人.
- 假设每个功能对构成. 检查vLLM兼容性矩阵为你的版本:v0.18.0标志着可预测解码兼容的碎片预填.

```figure
mx-speculative-tree
```

## 用它

`code/main.py`模拟一个在一系列alpha值和草案长度K中进行解码循环,并且没有猜测解码.它打印了破解式alpha,测量速度和尾声行为.在几种 (alpha,K) 组合上运行它,以查看猜测解码在哪里停止付费.

## 运送它

这一课产生了`outputs/skill-eagle3-rollout.md`鉴于目标模型,流量分布描述和同步目标,它产生了一个阶段化的EAGLE-3部署计划基准线,启用配置,测量alpha,关键在alpha >=0.55,看P99ITL.

## 运动

1. 跑步`code/main.py`在K=5时,你需要什么alpha来加速2x? 3x?
2. 想象一下,生产流量分为70%的通用聊天,30%的代码.通用聊天达到0.7的阿尔法, EAGLE-3在ShareGPT上训练;代码达到0.4的阿尔法.
3. 阅读全文`speculative_config`文件. 列出三个模式 (草案模型,EAGLE,N-gram) 并检查每个模式在vLLM版本中包含哪些功能.
4. 3启用后,平均ITL下降了25%,但P99ITL上升了15%.
5. 计算Eagle-3预备头的内存成本. 如何与经典预备机运行Llama 3.2 1B相比?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Speculative decoding | "draft plus verify" | Propose K tokens with a cheap model, verify all K in one target forward |
| Acceptance rate alpha | "spec accept rate" | Fraction of draft tokens accepted by the target; the only metric that matters |
| Draft length K | "spec k" | How many tokens the draft proposes per target forward; typical 4-8 |
| Verify overhead epsilon | "spec overhead" | Extra cost to verify-and-reroll vs a plain target forward; grows with batch |
| EAGLE-3 | "latest EAGLE" | 2025-2026 variant; trains draft head on multiple target layers; alpha 0.6-0.8 on general chat |
| `speculative_config` | "vLLM spec config" | The explicit opt-in in vLLM V1; no default means no acceleration |
| N-gram spec decode | "N-gram draft" | GPU-side draft using N-gram lookups in the prompt; chunked-prefill-compatible |
| Break-even alpha | "no-op alpha" | Alpha at which spec decode gives zero speedup; watch this at production concurrency |
| Rejected-draft two-pass | "reroll cost" | Two target forwards when drafts reject; drives P99 tail |

## 进一步阅读

- [vLLM — Speculative Decoding docs](https://docs.vllm.ai/en/latest/features/spec_decode/) 权威来源`speculative_config`并且在V1中兼容零碎预填充.
- [vLLM Speculative Config API](https://docs.vllm.ai/en/latest/api/vllm/config/speculative/)准确的场所.
- [EAGLE paper (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077)原始的EagLE草案头格式.
- [EAGLE-2 paper (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858)适应性草图和树木.
- [UC Berkeley EECS-2025-224](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2025/EECS-2025-224.html)具有投机解码的高效LLM系统.
- [BentoML — Speculative Decoding](https://bentoml.com/llm/inference-optimization/speculative-decoding)生产部署检查清单.
