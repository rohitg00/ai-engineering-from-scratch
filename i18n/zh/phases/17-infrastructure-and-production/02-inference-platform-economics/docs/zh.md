# 推理平台经济 烟花,一起,基底,模特,复制,任何规模

> 2026 年推断市场不再是GPU 租时间.它分为定制 (Groq,Cerebras,SambaNova),GPU 平台 (Baseten, Together, Fireworks, Modal) 和API 首选市场 (Replicate,DeepInfra).$1/hr per GPU on May 1, 2026, and $根据10T+代币/日的4B估值, 按数量驱动的模型工作.$300M Series E at $2026年1月5B. 竞争定位规则很简单:烟花优化延迟,一起优化目录宽度,Basen优化企业抛光,Modal优化Python-原生DX,复制优化多模达达,Anyscale优化分布式Python. 这一课给你一个可以交给创始人的矩阵.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy per-call economics comparator)
**Prerequisites:** Phase 17 · 01 (Managed LLM Platforms), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~60 minutes

## 学习目标

- 列出三个市场细分 (定制,GPU平台,API首) 并将每个供应商映射到一个细分.
- 解释为什么"每代币"API定价模型向服务引擎的成本曲线压缩而不是硬件的成本曲线.
- 计算每次请求的有效成本,至少在三个供应商中计算,并解释每分钟 (Baseten, Modal) 什么时候超过每代币.
- 确定哪个平台是给定的工作负载的默认正确的 (无服务器爆发,稳定高吞吐量,精细调节的变体,多模式).

## 问题

您评估了管理的超级级平台.您决定需要一个更窄,更快的供应商. 烟花为延迟, 合并为宽度, 贝塞顿为一个精细调节的定制模型. 现在您有六个真正的选择, 价格页面不排列. 烟花显示.$/M tokens; Baseten shows $演出节目$/second; Replicate shows $没有模拟工作负载,你不能把它们相比.

更糟糕的是,每个价格表格背后的商业模式是不同的. 烟花在共享GPU上运行了自己的定制引擎 (FireAttention);每代币的速度反映了它们的利用曲线. 基给你提供了Trus+专用GPU;每分钟反映了独占性. 模特是真实的 Python 无服务器 每秒的发票,低于秒的冷开始. 产出相同 (LLM响应),三个不同的成本函数.

这一课模拟了六个,告诉你每一个人当胜利.

## 概念

### 三个部分

**Custom silicon**Groq (LPU),Cerebras (WSE),SambaNova (RDU).通常比 GPU 基于同一模型的集群快 5-10倍解码.高的每代币价格 (Groq在 Llama-70B 上是2025年底的 ~ 0.99 美元/M),但对于延迟敏感的使用案例来说是不可击败的.Groq是语音代理和实时翻译的生产选择.

**GPU platforms**Baseten,Together, Fireworks,Modal,Anyscale.运行在NVIDIA (H100,H200,B200在2026年) 或有时AMD. "原料GPU租" (RunPod,Lambda) 和"超级级管理服务" (Bedrock) 之间的经济层.

**API-first marketplaces**复制,深度信息,开路由器,FAL. 广的目录,预测或秒支付,强调时间到第一次通话.

### 烟花 延迟优化的GPU平台

- 根据标准,在同等配置上,该系统的延迟速度低于vLLM的4倍.
- 对于非互动工作负载,批量级为50%的无服务器率.
- 精细调节的模型与基本模型相同的速度提供了真正的区别,而不是为您的LoRA收取溢价的提供商.
- 2026年中期:按需加增1美元1小时的GPU租金,从2026年5月1日起.
- 金融信号:400亿美元的估值,每天处理10万多个代币.

###  宽度优化

- 超过200个模型,包括在上游发布后几天内发布的开源版本.
- "AI原生云"定位量和目录.
- 推理+细调+训练在一个API中.

###  企业-波兰-优化

- 托拉斯框架:包含依赖性,秘密的模型包装,服务配置在一个表格中.
- 按分钟计费,可缓解冷启动.
- 标准化, HIPAA准备好,一般的金融科技和医疗保健选择.
- $5B valuation, January 2026 Series E ($公司的资本公司,IVP,NVIDIA.

### 模拟  字符串原生优化

- 纯Python中的基础设施作为代码.`@modal.function(gpu="A100")`并且只有一次命令.
- 低温为2~4秒,小型车型则<1秒.
- $87M Series B at $1.1B估值 (2025). 在独立调查中,开发者经验得分最强.

### 复制 多模宽度

- 预测费用,是图像,视频和音频模型的默认平台.
- 集成生态系统 (Zapier,Vercel,CMS插件).
- 在每代币的利率上,LLM较少竞争力,但在多元化品种上获胜.

### 任何规模的射线原生

- 基于Ray;RayTurbo是Anyscale专有推断引擎 (与vLLM竞争).
- 最适合分布式Python工作负载,其中推断步骤是一个更大的图中的节点.
- 管理了雷集群,与雷空气和雷服务密切集成.

### 每个奖金时,每分钟的比分

每个代币是有意义的,当工作负载是延迟不敏感和爆你只支付你使用的东西. 每分钟是有意义的,当利用率是高的和可预测的,你打败每代币一旦你和GPU.

严格规则:在专用GPU持续使用的工作负载超过30%时,每分钟 (Baseten,Modal) 开始超过每代币 (Fireworks, Together).在此下,每代币获胜,因为你避免为空付款.

### 定制发动机是真正的沟

根据VLLM和SGLang的定义,VLLM+SGLang的产品均占产品开源推理的80%左右,平台层的区别是DX,归因和SLA.

### 你应该记住的数字

- 烟花GPU租: $1/小时加息,从2026年5月1日起.
- 烟花声称:在相当配置上,延迟比vLLM低4倍.
- 合计:比在 LLM上复制品便宜50-70%.
- 基质估值: $5B (Series E, Jan 2026, $周围的300米.
- 资产估值:1.1亿美元 (B系列,2025年).
- 每分钟的比率超过持续使用率的30%

```figure
cost-per-token
```

## 用它

`code/main.py`报告 报告 报告 报告 报告 报告 报告 报告 报告 报告 报告$/day and effective $运行它,以找到每代币和每分钟之间的平衡.

## 运送它

这一课产生了`outputs/skill-inference-platform-picker.md`根据工作负载配置,SLA和预算,选择主要推断平台并命名下位.

## 运动

1. 跑步`code/main.py`根据"H100"的70B模型,巴塞顿 (每分钟) 比"烟花" (每代币) 更多.
2. 您的产品提供图像生成,聊天,语音与文字,
3. 假如您的 40% 的流量转移到批量级 (50%折扣).
4. 监管的客户需要SOC 2类型II+HIPAA+专用GPU.哪三个平台是可行的,哪个在FinOps中赢得胜利?
5. 根据Llama 3.1 70B的1000个预测, 价格比较于火箭无服务器, 随需, 专用Baseten和复制API.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Custom silicon | "non-GPU chips" | Groq LPU, Cerebras WSE, SambaNova RDU — optimized for decode |
| FireAttention | "Fireworks engine" | Custom attention kernel; marketed at 4x lower latency than vLLM |
| Truss | "Baseten's format" | Model packaging manifest; dependencies + secrets + serving config |
| Per-token | "API pricing" | Charge by tokens consumed; pay for no idle |
| Per-minute | "dedicated pricing" | Charge by wall-clock GPU time; wins at high utilization |
| Per-prediction | "Replicate pricing" | Charge per model invocation; common for image/video |
| RayTurbo | "Anyscale engine" | Proprietary inference on Ray; competes with vLLM on Ray clusters |
| Batch tier | "50% off" | Non-interactive queue at reduced rate; common on Fireworks, OpenAI |
| Fine-tuned at base rate | "Fireworks LoRA" | Charge LoRA-served requests at base model's rate (differentiator) |

## 进一步阅读

- [Fireworks Pricing](https://fireworks.ai/pricing)每代币的价格,批次级别,GPU租.
- [Baseten Pricing](https://www.baseten.co/pricing/)每分钟的利率,承诺能力,企业层次.
- [Modal Pricing](https://modal.com/pricing)每秒GPU速度和免费级别.
- [Together AI Pricing](https://www.together.ai/pricing)模型目录和每代币价格.
- [Anyscale Pricing](https://www.anyscale.com/pricing)雷土博和雷管理价格.
- [Northflank — Fireworks AI Alternatives](https://northflank.com/blog/7-best-fireworks-ai-alternatives-for-inference)比较评估.
- [Infrabase — AI Inference API Providers 2026](https://infrabase.ai/blog/ai-inference-api-providers-compared)供应商景观.
