# 上下文工程：窗口、预算、记忆与检索

> 提示词工程只是一个子集。上下文工程才是全局。提示词是你输入的一串文本。上下文是进入模型窗口的一切：系统指令、检索到的文档、工具定义、对话历史、few-shot 示例以及提示词本身。2026 年最优秀的 AI 工程师都是上下文工程师。他们决定放什么进去、不放什么进去，以及以什么顺序放。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 10 (LLMs from Scratch)、Phase 11 第 01-02 课
**Time:** 约 90 分钟
**Related:** Phase 11 · 15 (Prompt Caching)——缓存友好的布局是上下文工程的延伸。Phase 5 · 28 (Long-Context Evaluation) 介绍如何用 NIAH/RULER 测量 lost-in-the-middle 现象。

## 学习目标

- 计算上下文窗口各组件（系统提示词、工具、历史记录、检索文档、生成预留空间）的 token 预算
- 实现上下文窗口管理策略：对话历史的截断、摘要和滑动窗口
- 对上下文组件进行优先级排序，使模型的注意力最大化集中在最相关的信息上
- 构建一个上下文组装器，根据查询类型和可用窗口空间动态分配 token

## 问题所在

Claude Opus 4.7 拥有 200K token 窗口（beta 版为 1M）。GPT-5 有 400K。Gemini 3 Pro 有 2M。Llama 4 声称有 10M。这些数字听起来很庞大，直到你把它们填满。

以一个编码助手为例的真实拆解。系统提示词：500 token。50 个工具的工具定义：8,000 token。检索到的文档：4,000 token。对话历史（10 轮）：6,000 token。当前用户查询：200 token。生成预算（最大输出）：4,000 token。总计：22,700 token。这仅占 128K 窗口的 18%。

但注意力开销并不随上下文长度线性扩展。拥有 128K token 上下文的模型要支付二次方的注意力开销（在原始 Transformer 中是 O(n^2)，尽管大多数生产模型使用高效注意力变体）。更重要的是，检索准确率会下降。"Needle in a Haystack"（大海捞针）测试表明，模型难以找到放置在长上下文中间的信息。Liu 等人（2023）的研究显示，LLM 对位于长上下文开头和结尾的信息检索准确率接近完美，但对位于中间位置（上下文的 40-70% 处）的信息，准确率下降 10-20%。这种 "lost-in-the-middle" 效应因模型而异，但影响当前所有架构。

实际的教训是：拥有 200K token 的可用空间并不意味着使用 200K token 是有效的。精心筛选的 10K token 上下文往往优于倾倒进去的 100K token 上下文。上下文工程就是在上下文窗口内最大化信噪比的学科。

你放入窗口的每一个 token，都会挤掉一个本可以承载更多相关信息的 token。每一个无关的工具定义、每一轮过时的对话、每一段无法回答问题的检索文本——它们中的每一个都会让模型在该任务上的表现略微变差。

## 核心概念

### 上下文窗口是一种稀缺资源

把上下文窗口想象成 RAM，而不是磁盘。它快速且可直接访问，但容量有限。你不可能把所有东西都放进去。你必须做出选择。

```mermaid
graph TD
    subgraph Window["Context Window (128K tokens)"]
        direction TB
        S["System Prompt\n~500 tokens"] --> T["Tool Definitions\n~2K-8K tokens"]
        T --> R["Retrieved Context\n~2K-10K tokens"]
        R --> H["Conversation History\n~2K-20K tokens"]
        H --> F["Few-shot Examples\n~1K-3K tokens"]
        F --> Q["User Query\n~100-500 tokens"]
        Q --> G["Generation Budget\n~2K-8K tokens"]
    end

    style S fill:#1a1a2e,stroke:#e94560,color:#fff
    style T fill:#1a1a2e,stroke:#0f3460,color:#fff
    style R fill:#1a1a2e,stroke:#ffa500,color:#fff
    style H fill:#1a1a2e,stroke:#51cf66,color:#fff
    style F fill:#1a1a2e,stroke:#9b59b6,color:#fff
    style Q fill:#1a1a2e,stroke:#e94560,color:#fff
    style G fill:#1a1a2e,stroke:#0f3460,color:#fff
```

每个组件都在争夺空间。增加更多工具定义，就意味着对话历史的空间变少。增加更多检索到的上下文，就意味着 few-shot 示例的空间变少。上下文工程就是分配这一预算以最大化任务性能的艺术。

### Lost-in-the-Middle

这是上下文工程中最重要的实证发现。模型对上下文开头和结尾的信息注意力更好。位于中间的信息获得的注意力分数更低，更容易被忽略。

Liu 等人（2023）对此进行了系统测试。他们把一篇相关文档放在 20 篇无关文档中的不同位置，并测量回答准确率。当相关文档位于第一或最后时，准确率为 85-90%。当它位于中间（20 篇中的第 10 篇）时，准确率下降到 60-70%。

这带来了直接的工程启示：

- 把最重要的信息放在最前面（系统提示词、关键指令）
- 把当前查询和最相关的上下文放在最后（近因偏好有帮助）
- 把上下文的中间区域视为最低优先级区域
- 如果必须把某些信息放在中间，请在结尾重复其要点

```mermaid
graph LR
    subgraph Attention["Attention Distribution Across Context"]
        direction LR
        P1["Position 0-20%\nHIGH attention\n(system prompt)"]
        P2["Position 20-40%\nMODERATE"]
        P3["Position 40-70%\nLOW attention\n(lost in middle)"]
        P4["Position 70-90%\nMODERATE"]
        P5["Position 90-100%\nHIGH attention\n(current query)"]
    end

    style P1 fill:#51cf66,color:#000
    style P2 fill:#ffa500,color:#000
    style P3 fill:#ff6b6b,color:#fff
    style P4 fill:#ffa500,color:#000
    style P5 fill:#51cf66,color:#000
```

### 上下文组件

**系统提示词**：设定角色、约束和行为规则。它放在最前面，并在各轮对话中保持不变。Claude Code 的系统提示词（含工具定义和行为指令）大约占用 6,000 token。保持精简。系统提示词中的每个词都会在每次 API 调用中重复出现。

**工具定义**：每个工具占用 50-200 token（名称、描述、参数 schema）。50 个工具每个 150 token，在对话开始之前就已占用 7,500 token。动态工具选择——只包含与当前查询相关的工具——可以将这一数字减少 60-80%。

**检索上下文**：来自向量数据库的文档、搜索结果、文件内容。检索质量直接决定响应质量。糟糕的检索比没有检索更糟——它会用噪音填满窗口，并主动误导模型。

**对话历史**：之前的每条用户消息和助手响应。随对话长度线性增长。一段 50 轮、每轮 200 token 的对话会产生 10,000 token 的历史。其中大部分与当前查询无关。

**Few-shot 示例**：展示期望行为的输入/输出对。两三个精心挑选的示例对输出质量的提升往往超过数千 token 的指令。但它们占用空间。

**生成预算**：为模型响应预留的 token。如果你把窗口填满，模型就没有空间作答。至少为生成预留 2,000-4,000 token。

### 上下文压缩策略

**历史摘要**：不是逐字保留之前所有轮次，而是定期对对话进行摘要。"我们讨论了 X，决定了 Y，用户想要 Z" 用 100 token 取代了占用 2,000 token 的 10 轮对话。当历史超过某个阈值（例如 5,000 token）时运行摘要。

**相关性过滤**：对每篇检索到的文档与当前查询进行相关性打分，丢弃低于阈值者。如果你检索了 10 个片段但只有 3 个相关，就丢弃另外 7 个。3 个高度相关的片段胜过 10 个平庸的片段。

**工具裁剪**：对用户查询的意图进行分类，只包含与该意图相关的工具。代码问题不需要日历工具。日程安排问题不需要文件系统工具。这可以把工具定义从 8,000 token 减少到 1,000。

**递归摘要**：对于非常长的文档，分阶段摘要。先摘要每个章节，再对这些摘要进行摘要。一份 50 页的文档变成一份 500 token、抓住关键要点的摘要。

### 记忆系统

上下文工程涵盖三个时间尺度。

**短期记忆**：当前对话。直接存储在上下文窗口中。随每一轮增长。通过摘要和截断进行管理。

**长期记忆**：跨对话持久保存的事实和偏好。"用户偏好 TypeScript。" "项目使用 PostgreSQL。" 存储在数据库中，在会话开始时检索。Claude Code 将其存储在 CLAUDE.md 文件中。ChatGPT 将其存储在其记忆功能中。

**情景记忆**：可能相关的过去具体交互。"上周二，我们在 auth 模块中调试过类似的问题。" 以嵌入向量形式存储，当当前对话与过去的情景匹配时检索。

```mermaid
graph TD
    subgraph Memory["Memory Architecture"]
        direction TB
        STM["Short-term Memory\n(current conversation)\nDirect in context window"]
        LTM["Long-term Memory\n(facts, preferences)\nDB -> retrieved on session start"]
        EM["Episodic Memory\n(past interactions)\nEmbeddings -> retrieved on similarity"]
    end

    Q["Current Query"] --> STM
    Q --> LTM
    Q --> EM

    STM --> CW["Context Window"]
    LTM --> CW
    EM --> CW

    style STM fill:#1a1a2e,stroke:#51cf66,color:#fff
    style LTM fill:#1a1a2e,stroke:#0f3460,color:#fff
    style EM fill:#1a1a2e,stroke:#e94560,color:#fff
    style CW fill:#1a1a2e,stroke:#ffa500,color:#fff
```

### 动态上下文组装

关键洞察：不同的查询需要不同的上下文。静态系统提示词 + 静态工具 + 静态历史是浪费的。最好的系统会针对每个查询动态组装上下文。

1. 对查询意图进行分类
2. 选择相关工具（而非全部工具）
3. 检索相关文档（而非固定集合）
4. 包含相关历史轮次（而非全部历史）
5. 添加与任务类型匹配的 few-shot 示例
6. 按重要性排序：关键信息放最前，重要信息放最后，可选项放中间

这就是优秀的 AI 应用与卓越的 AI 应用之间的区别。模型是相同的。上下文才是决定性因素。

```figure
lost-in-the-middle
```

## 动手构建

### 步骤 1：Token 计数器

无法度量就无法预算。构建一个简单的 token 计数器（使用空白切分进行近似，因为精确计数取决于分词器）。

```python
import json
import numpy as np
from collections import OrderedDict

def count_tokens(text):
    if not text:
        return 0
    return int(len(text.split()) * 1.3)

def count_tokens_json(obj):
    return count_tokens(json.dumps(obj))
```

### 步骤 2：上下文预算管理器

核心抽象。预算管理器跟踪每个组件使用的 token 数量并强制执行限额。

```python
class ContextBudget:
    def __init__(self, max_tokens=128000, generation_reserve=4000):
        self.max_tokens = max_tokens
        self.generation_reserve = generation_reserve
        self.available = max_tokens - generation_reserve
        self.allocations = OrderedDict()

    def allocate(self, component, content, max_tokens=None):
        tokens = count_tokens(content)
        if max_tokens and tokens > max_tokens:
            words = content.split()
            target_words = int(max_tokens / 1.3)
            content = " ".join(words[:target_words])
            tokens = count_tokens(content)

        used = sum(self.allocations.values())
        if used + tokens > self.available:
            allowed = self.available - used
            if allowed <= 0:
                return None, 0
            words = content.split()
            target_words = int(allowed / 1.3)
            content = " ".join(words[:target_words])
            tokens = count_tokens(content)

        self.allocations[component] = tokens
        return content, tokens

    def remaining(self):
        used = sum(self.allocations.values())
        return self.available - used

    def utilization(self):
        used = sum(self.allocations.values())
        return used / self.max_tokens

    def report(self):
        total_used = sum(self.allocations.values())
        lines = []
        lines.append(f"Context Budget Report ({self.max_tokens:,} token window)")
        lines.append("-" * 50)
        for component, tokens in self.allocations.items():
            pct = tokens / self.max_tokens * 100
            bar = "#" * int(pct / 2)
            lines.append(f"  {component:<25} {tokens:>6} tokens ({pct:>5.1f}%) {bar}")
        lines.append("-" * 50)
        lines.append(f"  {'Used':<25} {total_used:>6} tokens ({total_used/self.max_tokens*100:.1f}%)")
        lines.append(f"  {'Generation reserve':<25} {self.generation_reserve:>6} tokens")
        lines.append(f"  {'Remaining':<25} {self.remaining():>6} tokens")
        return "\n".join(lines)
```

### 步骤 3：Lost-in-the-Middle 重排序

实现重排序策略：最重要的条目放在最前和最后，最不重要的放在中间。

```python
def reorder_lost_in_middle(items, scores):
    paired = sorted(zip(scores, items), reverse=True)
    sorted_items = [item for _, item in paired]

    if len(sorted_items) <= 2:
        return sorted_items

    first_half = sorted_items[::2]
    second_half = sorted_items[1::2]
    second_half.reverse()

    return first_half + second_half

def score_relevance(query, documents):
    query_words = set(query.lower().split())
    scores = []
    for doc in documents:
        doc_words = set(doc.lower().split())
        if not query_words:
            scores.append(0.0)
            continue
        overlap = len(query_words & doc_words) / len(query_words)
        scores.append(round(overlap, 3))
    return scores
```

### 步骤 4：对话历史压缩器

对旧的对话轮次进行摘要，以回收 token 预算。

```python
class ConversationManager:
    def __init__(self, max_history_tokens=5000):
        self.turns = []
        self.summaries = []
        self.max_history_tokens = max_history_tokens

    def add_turn(self, role, content):
        self.turns.append({"role": role, "content": content})
        self._compress_if_needed()

    def _compress_if_needed(self):
        total = sum(count_tokens(t["content"]) for t in self.turns)
        if total <= self.max_history_tokens:
            return

        while total > self.max_history_tokens and len(self.turns) > 4:
            old_turns = self.turns[:2]
            summary = self._summarize_turns(old_turns)
            self.summaries.append(summary)
            self.turns = self.turns[2:]
            total = sum(count_tokens(t["content"]) for t in self.turns)

    def _summarize_turns(self, turns):
        parts = []
        for t in turns:
            content = t["content"]
            if len(content) > 100:
                content = content[:100] + "..."
            parts.append(f"{t['role']}: {content}")
        return "Previous: " + " | ".join(parts)

    def get_context(self):
        parts = []
        if self.summaries:
            parts.append("[Conversation Summary]")
            for s in self.summaries:
                parts.append(s)
        parts.append("[Recent Conversation]")
        for t in self.turns:
            parts.append(f"{t['role']}: {t['content']}")
        return "\n".join(parts)

    def token_count(self):
        return count_tokens(self.get_context())
```

### 步骤 5：动态工具选择器

只包含与当前查询相关的工具。先分类意图，再过滤。

```python
TOOL_REGISTRY = {
    "read_file": {
        "description": "Read contents of a file",
        "tokens": 120,
        "categories": ["code", "files"],
    },
    "write_file": {
        "description": "Write content to a file",
        "tokens": 150,
        "categories": ["code", "files"],
    },
    "search_code": {
        "description": "Search for patterns in codebase",
        "tokens": 130,
        "categories": ["code"],
    },
    "run_command": {
        "description": "Execute a shell command",
        "tokens": 140,
        "categories": ["code", "system"],
    },
    "create_calendar_event": {
        "description": "Create a new calendar event",
        "tokens": 180,
        "categories": ["calendar"],
    },
    "list_emails": {
        "description": "List recent emails",
        "tokens": 160,
        "categories": ["email"],
    },
    "send_email": {
        "description": "Send an email message",
        "tokens": 200,
        "categories": ["email"],
    },
    "web_search": {
        "description": "Search the web for information",
        "tokens": 140,
        "categories": ["research"],
    },
    "query_database": {
        "description": "Run a SQL query on the database",
        "tokens": 170,
        "categories": ["code", "data"],
    },
    "generate_chart": {
        "description": "Generate a chart from data",
        "tokens": 190,
        "categories": ["data", "visualization"],
    },
}

def classify_intent(query):
    query_lower = query.lower()

    intent_keywords = {
        "code": ["code", "function", "bug", "error", "file", "implement", "refactor", "debug", "test"],
        "calendar": ["meeting", "schedule", "calendar", "appointment", "event"],
        "email": ["email", "mail", "send", "inbox", "message"],
        "research": ["search", "find", "what is", "how does", "explain", "look up"],
        "data": ["data", "query", "database", "chart", "graph", "analytics", "sql"],
    }

    scores = {}
    for intent, keywords in intent_keywords.items():
        score = sum(1 for kw in keywords if kw in query_lower)
        if score > 0:
            scores[intent] = score

    if not scores:
        return ["code"]

    max_score = max(scores.values())
    return [intent for intent, score in scores.items() if score >= max_score * 0.5]

def select_tools(query, token_budget=2000):
    intents = classify_intent(query)
    relevant = {}
    total_tokens = 0

    for name, tool in TOOL_REGISTRY.items():
        if any(cat in intents for cat in tool["categories"]):
            if total_tokens + tool["tokens"] <= token_budget:
                relevant[name] = tool
                total_tokens += tool["tokens"]

    return relevant, total_tokens
```

### 步骤 6：完整上下文组装流水线

把所有部分连接起来。给定一个查询，动态组装最优上下文。

```python
class ContextEngine:
    def __init__(self, max_tokens=128000, generation_reserve=4000):
        self.budget = ContextBudget(max_tokens, generation_reserve)
        self.conversation = ConversationManager(max_history_tokens=5000)
        self.system_prompt = (
            "You are a helpful AI assistant. You have access to tools for "
            "code editing, file management, web search, and data analysis. "
            "Use the appropriate tools for each task. Be concise and accurate."
        )
        self.knowledge_base = [
            "Python 3.12 introduced type parameter syntax for generic classes using bracket notation.",
            "The project uses PostgreSQL 16 with pgvector for embedding storage.",
            "Authentication is handled by Supabase Auth with JWT tokens.",
            "The frontend is built with Next.js 15 using the App Router.",
            "API rate limits are set to 100 requests per minute per user.",
            "The deployment pipeline uses GitHub Actions with Docker multi-stage builds.",
            "Test coverage must be above 80% for all new modules.",
            "The codebase follows the repository pattern for data access.",
        ]

    def assemble(self, query):
        self.budget = ContextBudget(self.budget.max_tokens, self.budget.generation_reserve)

        system_content, _ = self.budget.allocate("system_prompt", self.system_prompt, max_tokens=1000)

        tools, tool_tokens = select_tools(query, token_budget=2000)
        tool_text = json.dumps(list(tools.keys()))
        tool_content, _ = self.budget.allocate("tools", tool_text, max_tokens=2000)

        relevance = score_relevance(query, self.knowledge_base)
        threshold = 0.1
        relevant_docs = [
            doc for doc, score in zip(self.knowledge_base, relevance)
            if score >= threshold
        ]

        if relevant_docs:
            doc_scores = [s for s in relevance if s >= threshold]
            reordered = reorder_lost_in_middle(relevant_docs, doc_scores)
            doc_text = "\n".join(reordered)
            doc_content, _ = self.budget.allocate("retrieved_context", doc_text, max_tokens=3000)

        history_text = self.conversation.get_context()
        if history_text.strip():
            history_content, _ = self.budget.allocate("conversation_history", history_text, max_tokens=5000)

        query_content, _ = self.budget.allocate("user_query", query, max_tokens=500)

        return self.budget

    def chat(self, query):
        self.conversation.add_turn("user", query)
        budget = self.assemble(query)
        response = f"[Response to: {query[:50]}...]"
        self.conversation.add_turn("assistant", response)
        return budget


def run_demo():
    print("=" * 60)
    print("  Context Engineering Pipeline Demo")
    print("=" * 60)

    engine = ContextEngine(max_tokens=128000, generation_reserve=4000)

    print("\n--- Query 1: Code task ---")
    budget = engine.chat("Fix the bug in the authentication module where JWT tokens expire too early")
    print(budget.report())

    print("\n--- Query 2: Research task ---")
    budget = engine.chat("What is the best approach for implementing vector search in PostgreSQL?")
    print(budget.report())

    print("\n--- Query 3: After conversation history builds up ---")
    for i in range(8):
        engine.conversation.add_turn("user", f"Follow-up question number {i+1} about the implementation details of the system")
        engine.conversation.add_turn("assistant", f"Here is the response to follow-up {i+1} with technical details about the architecture")

    budget = engine.chat("Now implement the changes we discussed")
    print(budget.report())

    print("\n--- Tool Selection Examples ---")
    test_queries = [
        "Fix the bug in auth.py",
        "Schedule a meeting with the team for Tuesday",
        "Show me the database query performance stats",
        "Search for best practices on error handling",
    ]

    for q in test_queries:
        tools, tokens = select_tools(q)
        intents = classify_intent(q)
        print(f"\n  Query: {q}")
        print(f"  Intents: {intents}")
        print(f"  Tools: {list(tools.keys())} ({tokens} tokens)")

    print("\n--- Lost-in-the-Middle Reordering ---")
    docs = ["Doc A (most relevant)", "Doc B (somewhat relevant)", "Doc C (least relevant)",
            "Doc D (relevant)", "Doc E (moderately relevant)"]
    scores = [0.95, 0.60, 0.20, 0.80, 0.50]
    reordered = reorder_lost_in_middle(docs, scores)
    print(f"  Original order: {docs}")
    print(f"  Scores:         {scores}")
    print(f"  Reordered:      {reordered}")
    print(f"  (Most relevant at start and end, least relevant in middle)")
```

## 实际应用

### Harness 管理的上下文

Claude Code 采用分层方式管理上下文。系统提示词包含行为规则和工具定义（约 6K token）。当你打开一个文件时，其内容作为上下文注入。当你搜索时，结果被添加。旧的对话轮次被摘要。CLAUDE.md 提供跨会话持久化的长期记忆。

关键工程决策：Claude Code 不会把你的整个代码库倾倒进上下文。它按需检索相关文件。这就是实践中的上下文工程。

### 动态上下文加载

Cursor 将你的整个代码库索引为嵌入向量。当你输入查询时，它使用向量相似度检索最相关的文件和代码块。只有这些片段进入上下文窗口。一个 50 万行的代码库被压缩为 5-10 个最相关的代码块。

这就是模式：全部嵌入，按需检索，只包含有用的内容。

### 助手的长期记忆

ChatGPT 将用户偏好和事实存储为长期记忆。在每次对话开始时，检索相关记忆并包含在系统提示词中。"用户偏好 Python" 只花费 5 个 token，却在多次对话中节省了数百 token 的重复指令。

### RAG 即上下文工程

检索增强生成是形式化的上下文工程。与其把知识塞进模型权重（训练）或系统提示词（静态上下文），不如在查询时检索相关文档并将其注入上下文窗口。整个 RAG 流水线——分块、嵌入、检索、重排序——的存在就是为了解决一个问题：把正确的信息放进上下文窗口。

## 上线发布

本课产出 `outputs/prompt-context-optimizer.md`——一个可复用的提示词，用于审计上下文组装策略并推荐优化。输入你的系统提示词、工具数量、平均历史长度和检索策略，它会识别 token 浪费并提出改进建议。

它还产出 `outputs/skill-context-engineering.md`——一个决策框架，用于根据任务类型、上下文窗口大小和延迟预算来设计上下文组装流水线。

## 练习

1. 为 ContextBudget 类添加一个 "token 浪费检测器"。它应标记占用预算超过 30% 的组件，并针对每种组件类型提出具体的压缩策略（摘要历史、裁剪工具、重排序文档）。

2. 为检索上下文实现语义去重。如果两篇检索到的文档相似度超过 80%（按词重叠或嵌入向量的余弦相似度计算），只保留得分较高的那篇。测量这一操作回收了多少 token 预算。

3. 构建一个 "上下文回放" 工具。给定一段对话记录，通过 ContextEngine 回放它，并可视化预算分配如何逐轮变化。绘制每个组件随时间的 token 使用情况。找出上下文开始被压缩的那一轮。

4. 实现基于优先级的工具选择器。不是二元的包含/排除，而是为每个工具分配与当前查询的相关性得分。按相关性降序包含工具，直到工具预算耗尽。比较包含 5、10、20 和 50 个工具时的任务性能。

5. 构建一个多策略上下文压缩器。实现三种压缩策略（截断、摘要、关键句提取），并在 20 篇文档的集合上进行基准测试。测量压缩比与信息保留之间的权衡（压缩后的版本是否仍包含查询的答案？）。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|----------------------|
| 上下文窗口 | "模型能读多少" | 模型在单次前向传播中处理的最大 token 数（输入 + 输出）——GPT-5 为 400K，Claude Opus 4.7 为 200K（beta 版 1M），Gemini 3 Pro 为 2M |
| 上下文工程 | "高级提示词工程" | 决定什么进入上下文窗口、以什么顺序、以什么优先级的学科——涵盖检索、压缩、工具选择和记忆管理 |
| Lost-in-the-middle | "模型会忘记中间的内容" | 实证发现：LLM 对上下文开头和结尾的注意力更好，位于中间的信息准确率下降 10-20% |
| Token 预算 | "你还剩多少 token" | 对上下文窗口容量在各组件（系统提示词、工具、历史、检索、生成）之间的显式分配，并设定每个组件的限额 |
| 动态上下文 | "动态加载内容" | 根据意图分类、相关工具选择和检索结果，为每个查询以不同方式组装上下文窗口 |
| 历史摘要 | "压缩对话" | 用简洁摘要取代逐字的旧对话轮次，在保留关键信息的同时降低 token 开销 |
| 工具裁剪 | "只包含相关工具" | 对查询意图进行分类，只包含匹配的工具定义，将工具 token 开销降低 60-80% |
| 长期记忆 | "跨会话记住" | 存储在数据库中并在会话开始时检索的事实和偏好——CLAUDE.md、ChatGPT Memory 及类似系统 |
| 情景记忆 | "记住具体的过去事件" | 以嵌入向量形式存储的过去交互，当当前查询与过去的对话相似时检索 |
| 生成预算 | "留给答案的空间" | 为模型输出预留的 token——如果上下文把窗口填满，模型就没有空间响应 |

## 延伸阅读

- [Liu et al., 2023 -- "Lost in the Middle: How Language Models Use Long Contexts"](https://arxiv.org/abs/2307.03172)——关于位置相关注意力的权威研究，表明模型难以处理长上下文中间的信息
- [Anthropic's Contextual Retrieval blog post](https://www.anthropic.com/news/contextual-retrieval)——Anthropic 如何进行上下文感知的分块检索，将检索失败率降低 49%
- [Simon Willison's "Context Engineering"](https://simonwillison.net/2025/Jun/27/context-engineering/)——命名这一学科并将其与提示词工程区分开来的博文
- [LangChain documentation on RAG](https://python.langchain.com/docs/tutorials/rag/)——作为上下文工程模式的检索增强生成的实践实现
- [Greg Kamradt's Needle in a Haystack test](https://github.com/gkamradt/LLMTest_NeedleInAHaystack)——揭示所有主流模型位置相关检索失败的基准测试
- [Pope et al., "Efficiently Scaling Transformer Inference" (2022)](https://arxiv.org/abs/2211.05102)——为什么上下文长度决定内存和延迟，以及 KV cache、MQA 和 GQA 如何改变预算计算。
- [Agrawal et al., "SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills" (2023)](https://arxiv.org/abs/2308.16369)——推理的两个阶段使长提示词在 TTFT 上昂贵但在 TPOT 上便宜；上下文打包权衡背后的基本事实。
- [Ainslie et al., "GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints" (EMNLP 2023)](https://arxiv.org/abs/2305.13245)——分组查询注意力论文，在生产解码器中将 KV 内存削减 8 倍且无质量损失。