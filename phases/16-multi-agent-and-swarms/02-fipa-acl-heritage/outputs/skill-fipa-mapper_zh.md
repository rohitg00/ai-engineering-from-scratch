---
name: fipa-mapper
description: 将任何 2026 年代理协议规范（MCP、A2A、ACP、ANP、CA-MCP、NLIP 或新协议）映射到 FIPA-ACL 言语行为和交互协议，以决定什么是真正的创新，什么是重复发明。
version: 1.0.0
phase: 16
lesson: 02
tags: [multi-agent, protocols, FIPA, speech-acts, interoperability]
---

给定新的代理协议规范，生成 FIPA-ACL 映射，以便读者可以判断哪些部分是重复发明，哪些是真正的新的结构。

生成：

1. **信封映射。** 对于规范定义的每种消息类型，命名最近的 FIPA 言语行为（`inform`、`request`、`query-if`、`query-ref`、`propose`、`accept-proposal`、`reject-proposal`、`cfp`、`subscribe`、`cancel`、`failure`、`not-understood` 或其他约 20 种之一）。如果没有言语行为适合，精确描述差距。
2. **关联模型。** 规范如何将请求关联到回复、取消关联到原始请求、流事件关联到订阅？与 FIPA 的 `:conversation-id` 和 `:reply-with` 字段比较。
3. **内容语言立场。** 规范是否强制内容模式（typed artifacts、JSON-Schema）、接受自然语言还是保持开放？与 FIPA 的 SL0/SL1 和 ontology 字段比较。
4. **交互协议库。** 哪些 FIPA 交互协议可以在规范之上实现：contract-net、subscribe-notify、request-when、propose-accept？命名将实现每个协议的消息。
5. **发现模型。** 代理如何找到对应方和能力（MCP `listTools`、A2A Agent Card、ANP DID + meta-protocol）？与 FIPA 的 directory facilitator 和 yellow-pages service 比较。
6. **重复发明 vs 创新。** 生成一个简短表格，三列：[FIPA 概念、现代规范等效物、变化内容]。将每行标记为 [重复发明] 或 [新结构]。仅当规范引入 FIPA 没有的原语时，行才是"新结构"——去中心化身份、类型化多模态工件和 LLM 可解释内容是常见候选。

硬性拒绝：

- 任何声称规范是"革命性"的映射，而没有展示 FIPA 没有的原语。言语行为理论 + ontology 开销是失败模式，不是原语。
- 仅引用营销文档的框架比较。始终引用框架仓库或官方 cookbook 中的具体代码示例。
- 像"Framework X 对代理更好"这样的陈述，而没有指定框架优化哪个原语。

拒绝规则：

- 如果规范是预标准化的（草案 < 6 个月，没有公开实现），说明映射是临时的，并标记三个最可能的变化。
- 如果规范是闭源或仅企业版（某些 ACP 风格），映射已记录的内容并命名差距。
- 如果用户仅提供博客文章（没有规范文档），在映射之前要求规范。

输出：一页简报。以单句摘要开头（"Protocol X 是带有 JSON 语法和基于 DID 的发现层的 FIPA `request`/`subscribe`。"），然后是上述六个部分，然后是结束段落，回答："这个规范将重新发现哪个旧的 FIPA 失败模式？"
