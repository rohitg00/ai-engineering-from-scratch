# 监测人员:兰格斯,城,奥皮克

> 龙 (MIT)  6M+安装/月,追踪+提示管理+评估+会议重播.阿里兹 (Elastic 2.0)  深度特异性代理评估,RAG相关性,开放式自动仪器化.彗星Opik (Apache 2.0) 自动提示优化,护,LLM法官幻觉检测.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 23 (OTel GenAI)
**Time:** ~45 minutes

## 学习目标

- 举个三个顶级的自主主机器人可观测平台及其许可证,
- 区分每个人都最强大的:Langfuse (即时mgmt + 会议),Phoenix (RAG + 自动仪器),Opik (优化 + 护).
- 解释为什么89%的组织报告到2026年将有代理可观察性.
- 实施一个由线路到仪表板的线路,包括法师评审.

## 问题

您仍然需要一个平台,可以吸收跨度,运行评估,存储提示版本和表面回归.

## 概念

### 拉恩福斯 (MIT)

- 个月安装6M+SDK,GitHub星星为19k+
- 功能:追踪,即时管理,版本化+游乐场,评估 (LLM作为评审,用户反,定制),会议重复.
- 2025年6月:以前的商业模块 (LLM-as-a-judge,注释队列,即时实验,游乐场) 在MIT下开源.
- 最强的:端到端可观测性,紧密的快速管理循环.

### 鱼 (弹性许可证 2.0)

- 具体的特征评估:痕迹集群,异常检测,RAG检索相关性.
- 基于原生开放式传输的自动仪器.
- 配对管理的Arize AX生产.
- 没有即时版本 作为一个漂移/行为回归工具与更广泛的平台一起定位.
- 最强的:RAG相关性,行为漂移,异常检测.

### 彗星奥皮克 (Apache 2.0)

- 通过A/B实验进行自动化快速优化.
- 防护护 (PII编辑,现场限制).
- 士的幻觉检测.
- 根据彗星自身的测量标准:在 23.44s 与 Langfuse 327.15s 的Opik 记录 + 评估 (~ 14x 差距)  取出供应商的标准作为方向性.
- 最强用于:优化循环,自动化实验,防护.

### 产业数据

根据马克思 (2026年实地分析):89%的组织有代理可观察性;质量问题是生产的最大障碍 (32%的受访者引用它们).

### 选择一个

| Need | Pick |
|------|------|
| All-in-one with prompt management | Langfuse |
| Deep RAG evaluation + drift | Phoenix |
| Automated optimization + guardrails | Opik |
| Open licensing, no ELv2 | Langfuse (MIT) or Opik (Apache 2.0) |
| Datadog / New Relic integration | Any — they all export OTel |

### 在这个模式出现错误的地方

- **No eval strategy.**没有评估的追踪只是昂贵的伐木.
- **Self-rolled LLM-judge without grounding.**法官需要外部工具来验证事实.
- **Prompt versions not tied to traces.**当子退后,你不能分离到导致的提示.

```figure
wb-trace-ingest
```

## 建立它

`code/main.py`执行一个STDlib追踪收集器+LLM评审员:

- 摄入基因AI形状的.
- 按会议组,标签失败运行 (防护轨道旅行,低信心评估).
- 写作的法师法官,在一个类别上评分代理的反应.
- 像仪表板这样的总结:失败率,最大的失败原因,评估分数分布.

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

输出:每次会议的评分和失败分类,与兰格斯/尼克斯/奥皮克所显示的相匹配.

## 用它

- **Langfuse**通过 OTel 或其 SDK 进行自主托管或云端;
- **Arize Phoenix**自主托管;自动工具OpenInference.
- **Comet Opik**自主托管或云;自动化优化循环.
- **Datadog LLM Observability**对于已经运行Datadog的混合运营+ML团队.

## 运送它

`outputs/skill-obs-platform-wiring.md`选择一个平台,将其追踪+评估+提示版本传输到现有代理中.

## 运动

1. 导出一周的OTel痕迹到Langfuse云.哪些会议失败了?为什么?
2. 写一个法师法官的专业 (事实正确性,语调,范围遵守).测试50个线索.
3. 让我们比较Langfuse的快速版本与尼克斯的追踪集群.
4. 读一读奥皮克的护文件,向你的代理人之一运行一个 PII编辑护.
5. 忽略出售商发布的数字, 测量自己的数字.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Tracing | "Spans collector" | Ingest OTel / SDK spans; index by session |
| Prompt management | "Prompt CMS" | Versioned prompts tied to traces |
| LLM-as-judge | "Automated eval" | Separate LLM scores agent output against a rubric |
| Session replay | "Trace playback" | Step through past runs for debugging |
| RAG relevancy | "Retrieval quality" | Does the retrieved context match the query |
| Trace clustering | "Behavioral grouping" | Cluster similar runs for drift detection |
| Guardrail enforcement | "Policy at log time" | PII/toxicity/scope checks on logged content |

## 进一步阅读

- [Langfuse docs](https://langfuse.com/)追踪,评估,提示
- [Arize Phoenix docs](https://docs.arize.com/phoenix)自动仪器,漂移
- [Comet Opik](https://www.comet.com/site/products/opik/)优化+防护
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)三种方案都消耗
