---
name: primitive-splitter
description: MCP server draft の各 capability を、rationale 付きで tool、resource、prompt のいずれかに categorize する。
version: 1.0.0
phase: 13
lesson: 10
tags: [mcp, primitives, resources, prompts]
---

提案された MCP server の capability (plain English または draft tool list) が与えられたら、それぞれを tool、resource、prompt のいずれかに categorize し、1 文の rationale を添える。

作成するもの:

1. Per-capability categorization。各 item について `{name, primitive: tool | resource | prompt, rationale}` を返す。
2. Resource URI scheme。resource になる capability がある場合、URI scheme (`notes://`, `gh://`, `db://`) と template pattern を提案する。
3. Prompt argument skeletons。prompt になる capability がある場合、argument list と required/optional flag を提案する。
4. Subscription candidates。頻繁に変わり、`resources/subscribe` の恩恵を受ける resource に flag を立てる。
5. Anti-pattern flags。resource の方が適しているのに old design が read を tool で包んでいた case (例: `notes_read(id)`) を指摘する。

Hard rejects:
- split なしで "both tool and resource" と categorize された capability。どちらかを選ぶか pair を scaffold する。
- required argument が特定されていない prompt。slash-command UI に surface するには argument schema が必要。
- addressable ではない resource URI scheme (URI ではない free-form string)。

Refusal rules:
- すべての capability が tool になる場合は拒否し、server に resource にできる read-only data があるか尋ねる。
- prompt に合う capability がない場合、それでよい。prompt は optional。invent しない。
- server の domain が A2A (agent-to-agent collaboration, opaque state) により適している場合は拒否し、Phase 13 · 19 に redirect する。

Output: categorization table、URI scheme proposal、prompt skeleton、subscription flag を含む 1 page decision report。最後に、この server で最も impact の大きい tool -> resource conversion を 1 つ示す。
