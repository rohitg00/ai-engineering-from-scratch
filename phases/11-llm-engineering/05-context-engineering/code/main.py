import json
import numpy as np
from collections import OrderedDict


def count_tokens(text):
    if not text:
        return 0
    return int(len(text.split()) * 1.3)


def count_tokens_json(obj):
    return count_tokens(json.dumps(obj))


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
        lines.append(f"\n  Context Budget Report ({self.max_tokens:,} token window)")
        lines.append("  " + "-" * 55)
        for component, tokens in self.allocations.items():
            pct = tokens / self.max_tokens * 100
            bar = "#" * int(pct * 2) if pct >= 0.5 else ""
            lines.append(f"    {component:<25} {tokens:>6} tokens ({pct:>5.1f}%) {bar}")
        lines.append("  " + "-" * 55)
        lines.append(f"    {'Used':<25} {total_used:>6} tokens ({total_used/self.max_tokens*100:.1f}%)")
        lines.append(f"    {'Generation reserve':<25} {self.generation_reserve:>6} tokens")
        lines.append(f"    {'Remaining':<25} {self.remaining():>6} tokens")
        return "\n".join(lines)


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
        if self.turns:
            parts.append("[Recent Conversation]")
            for t in self.turns:
                parts.append(f"{t['role']}: {t['content']}")
        return "\n".join(parts)

    def token_count(self):
        return count_tokens(self.get_context())

    def stats(self):
        return {
            "live_turns": len(self.turns),
            "summaries": len(self.summaries),
            "tokens": self.token_count(),
        }


TOOL_REGISTRY = {
    "read_file": {
        "description": "Read contents of a file from disk",
        "tokens": 120,
        "categories": ["code", "files"],
    },
    "write_file": {
        "description": "Write content to a file on disk",
        "tokens": 150,
        "categories": ["code", "files"],
    },
    "search_code": {
        "description": "Search for patterns across the codebase",
        "tokens": 130,
        "categories": ["code"],
    },
    "run_command": {
        "description": "Execute a shell command and return output",
        "tokens": 140,
        "categories": ["code", "system"],
    },
    "create_calendar_event": {
        "description": "Create a new event on the calendar",
        "tokens": 180,
        "categories": ["calendar"],
    },
    "list_emails": {
        "description": "List recent emails from inbox",
        "tokens": 160,
        "categories": ["email"],
    },
    "send_email": {
        "description": "Compose and send an email message",
        "tokens": 200,
        "categories": ["email"],
    },
    "web_search": {
        "description": "Search the web for information",
        "tokens": 140,
        "categories": ["research"],
    },
    "query_database": {
        "description": "Run a SQL query against the database",
        "tokens": 170,
        "categories": ["code", "data"],
    },
    "generate_chart": {
        "description": "Generate a visualization from data",
        "tokens": 190,
        "categories": ["data", "visualization"],
    },
}


def classify_intent(query):
    query_lower = query.lower()

    intent_keywords = {
        "code": ["code", "function", "bug", "error", "file", "implement", "refactor", "debug", "test", "fix", "class", "module"],
        "calendar": ["meeting", "schedule", "calendar", "appointment", "event", "tuesday", "tomorrow"],
        "email": ["email", "mail", "send", "inbox", "message", "reply"],
        "research": ["search", "find", "what is", "how does", "explain", "look up", "documentation"],
        "data": ["data", "query", "database", "chart", "graph", "analytics", "sql", "stats"],
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


class ContextEngine:
    def __init__(self, max_tokens=128000, generation_reserve=4000):
        self.max_tokens = max_tokens
        self.generation_reserve = generation_reserve
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
            "Error logging uses structured JSON format with correlation IDs.",
            "The vector search index uses HNSW with 128 dimensions and cosine distance.",
        ]

    def assemble(self, query):
        budget = ContextBudget(self.max_tokens, self.generation_reserve)

        budget.allocate("system_prompt", self.system_prompt, max_tokens=1000)

        tools, tool_tokens = select_tools(query, token_budget=2000)
        tool_text = json.dumps(list(tools.keys()))
        budget.allocate("tools", tool_text, max_tokens=2000)

        relevance = score_relevance(query, self.knowledge_base)
        threshold = 0.05
        relevant_docs = [
            doc for doc, score in zip(self.knowledge_base, relevance)
            if score >= threshold
        ]

        if relevant_docs:
            doc_scores = [s for s in relevance if s >= threshold]
            reordered = reorder_lost_in_middle(relevant_docs, doc_scores)
            doc_text = "\n".join(reordered)
            budget.allocate("retrieved_context", doc_text, max_tokens=3000)

        history_text = self.conversation.get_context()
        if history_text.strip():
            budget.allocate("conversation_history", history_text, max_tokens=5000)

        budget.allocate("user_query", query, max_tokens=500)

        return budget

    def chat(self, query):
        self.conversation.add_turn("user", query)
        budget = self.assemble(query)
        response = f"[Simulated response to: {query[:50]}...]"
        self.conversation.add_turn("assistant", response)
        return budget


def run_budget_demo():
    print("=" * 60)
    print("  STEP 1: Context Budget Manager")
    print("=" * 60)

    budget = ContextBudget(max_tokens=128000, generation_reserve=4000)
    budget.allocate("system_prompt", "You are a helpful assistant. " * 20, max_tokens=500)
    budget.allocate("tools", json.dumps(list(TOOL_REGISTRY.keys())), max_tokens=2000)
    budget.allocate("retrieved_docs", "The project uses PostgreSQL. " * 50, max_tokens=3000)
    budget.allocate("history", "user: How do I fix this?\nassistant: Check the logs." * 10, max_tokens=5000)
    budget.allocate("query", "Fix the authentication bug in the JWT validation module", max_tokens=500)
    print(budget.report())


def run_reorder_demo():
    print(f"\n{'=' * 60}")
    print("  STEP 2: Lost-in-the-Middle Reordering")
    print("=" * 60)

    docs = [
        "Doc A: PostgreSQL connection pooling (most relevant)",
        "Doc B: Redis caching layer (somewhat relevant)",
        "Doc C: CSS styling guide (not relevant)",
        "Doc D: Database migration scripts (relevant)",
        "Doc E: CI/CD pipeline config (slightly relevant)",
        "Doc F: API authentication flow (relevant)",
        "Doc G: Frontend routing (not relevant)",
    ]
    scores = [0.95, 0.60, 0.05, 0.80, 0.30, 0.75, 0.10]

    reordered = reorder_lost_in_middle(docs, scores)

    print(f"\n  Original order (by insertion):")
    for doc, score in zip(docs, scores):
        print(f"    {score:.2f}  {doc}")

    print(f"\n  Reordered (high relevance at start + end, low in middle):")
    for i, doc in enumerate(reordered):
        position = "START" if i < 2 else "END" if i >= len(reordered) - 2 else "middle"
        print(f"    [{position:>6}]  {doc}")


def run_conversation_demo():
    print(f"\n{'=' * 60}")
    print("  STEP 3: Conversation History Compression")
    print("=" * 60)

    conv = ConversationManager(max_history_tokens=200)

    exchanges = [
        ("How do I set up the database?", "Run docker-compose up to start PostgreSQL. Then run the migrations with npm run migrate."),
        ("What about the environment variables?", "Copy .env.example to .env and fill in DATABASE_URL and JWT_SECRET."),
        ("The migrations are failing with a connection error.", "Check that PostgreSQL is running on port 5432 and the DATABASE_URL matches."),
        ("Fixed it. Now how do I seed test data?", "Run npm run seed which loads fixtures from the test/fixtures directory."),
        ("Can I run the tests now?", "Yes, run npm test. Make sure the test database is separate from development."),
    ]

    for i, (user_msg, assistant_msg) in enumerate(exchanges):
        conv.add_turn("user", user_msg)
        conv.add_turn("assistant", assistant_msg)
        stats = conv.stats()
        print(f"\n  After turn {i + 1}:")
        print(f"    Live turns: {stats['live_turns']}, Summaries: {stats['summaries']}, Tokens: {stats['tokens']}")

    print(f"\n  Final context:")
    for line in conv.get_context().split("\n"):
        print(f"    {line}")


def run_tool_selection_demo():
    print(f"\n{'=' * 60}")
    print("  STEP 4: Dynamic Tool Selection")
    print("=" * 60)

    test_queries = [
        "Fix the bug in auth.py where JWT tokens expire too early",
        "Schedule a meeting with the design team for next Tuesday at 2pm",
        "Show me the database query performance stats and generate a chart",
        "Search for best practices on error handling in Python",
        "Send an email to the team about the deployment schedule",
        "Read the config file and check for database connection settings",
    ]

    print(f"\n  All tools: {list(TOOL_REGISTRY.keys())} ({sum(t['tokens'] for t in TOOL_REGISTRY.values())} total tokens)")

    for q in test_queries:
        tools, tokens = select_tools(q)
        intents = classify_intent(q)
        all_tokens = sum(t["tokens"] for t in TOOL_REGISTRY.values())
        savings = all_tokens - tokens
        print(f"\n  Query: {q[:60]}...")
        print(f"    Intents: {intents}")
        print(f"    Selected: {list(tools.keys())}")
        print(f"    Tokens: {tokens} (saved {savings} by pruning)")


def run_full_pipeline_demo():
    print(f"\n{'=' * 60}")
    print("  STEP 5: Full Context Assembly Pipeline")
    print("=" * 60)

    engine = ContextEngine(max_tokens=128000, generation_reserve=4000)

    queries = [
        "Fix the bug in the authentication module where JWT tokens expire too early",
        "What is the best approach for implementing vector search with PostgreSQL?",
        "Schedule a team standup meeting for tomorrow morning",
    ]

    for q in queries:
        print(f"\n  Query: {q}")
        budget = engine.chat(q)
        print(budget.report())

    print(f"\n  --- After building up conversation history ---")
    for i in range(6):
        engine.conversation.add_turn("user", f"Follow-up question {i+1} about the database migration and authentication setup")
        engine.conversation.add_turn("assistant", f"Detailed response {i+1} covering the technical architecture and implementation steps")

    budget = engine.chat("Now implement all the changes we discussed in the previous turns")
    print(budget.report())
    conv_stats = engine.conversation.stats()
    print(f"\n  Conversation state: {conv_stats['live_turns']} live turns, {conv_stats['summaries']} summaries, {conv_stats['tokens']} tokens")


def run_relevance_demo():
    print(f"\n{'=' * 60}")
    print("  STEP 6: Relevance Scoring + Filtering")
    print("=" * 60)

    knowledge = [
        "Python 3.12 introduced type parameter syntax for generic classes.",
        "The project uses PostgreSQL 16 with pgvector for embedding storage.",
        "Authentication is handled by Supabase Auth with JWT tokens.",
        "The frontend is built with Next.js 15 using the App Router.",
        "API rate limits are set to 100 requests per minute per user.",
        "The deployment pipeline uses GitHub Actions with Docker builds.",
        "Test coverage must be above 80% for all new modules.",
        "Error logging uses structured JSON format with correlation IDs.",
    ]

    query = "How do I fix the JWT authentication token expiry bug?"
    scores = score_relevance(query, knowledge)

    print(f"\n  Query: {query}")
    print(f"\n  Relevance scores:")
    for doc, score in sorted(zip(knowledge, scores), key=lambda x: -x[1]):
        marker = "*" if score >= 0.05 else " "
        print(f"    {marker} {score:.3f}  {doc[:70]}...")

    threshold = 0.05
    included = sum(1 for s in scores if s >= threshold)
    excluded = len(scores) - included
    print(f"\n  Threshold {threshold}: {included} included, {excluded} excluded")
    print(f"  Token savings: ~{excluded * 20} tokens from excluded docs")


if __name__ == "__main__":
    run_budget_demo()
    run_reorder_demo()
    run_conversation_demo()
    run_tool_selection_demo()
    run_full_pipeline_demo()
    run_relevance_demo()
