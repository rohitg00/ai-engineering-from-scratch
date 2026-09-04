import re
from collections import Counter


class RulePattern:
    def __init__(self, pattern, template):
        self.regex = re.compile(pattern, re.IGNORECASE)
        self.template = template


PATTERNS = [
    RulePattern(r"my name is (\w+)", "Nice to meet you, {0}."),
    RulePattern(r"i (need|want) (.+)", "Why do you {0} {1}?"),
    RulePattern(r"i feel (.+)", "Why do you feel {0}?"),
    RulePattern(r"(hi|hello|hey)\b.*", "Hello. How can I help?"),
    RulePattern(r".*", "Tell me more about that."),
]


def rule_based_respond(user_input):
    for p in PATTERNS:
        m = p.regex.match(user_input.strip())
        if m:
            return p.template.format(*m.groups())
    return "I don't understand."


FAQ = [
    ("how do i reset my password", "Go to Settings > Security > Reset Password."),
    ("how do i cancel my order", "Go to Orders, find the order, click Cancel."),
    ("what is your return policy", "30-day returns on unused items."),
    ("when will my order arrive", "Check Orders for tracking info."),
]


def token_set(text):
    return set(re.findall(r"[a-z]+", text.lower()))


def faq_respond(user_input, threshold=0.3):
    user_tokens = token_set(user_input)
    best_score = 0.0
    best_answer = None
    for question, answer in FAQ:
        q_tokens = token_set(question)
        if not q_tokens or not user_tokens:
            continue
        jaccard = len(user_tokens & q_tokens) / len(user_tokens | q_tokens)
        if jaccard > best_score:
            best_score = jaccard
            best_answer = answer
    if best_score < threshold:
        return None, best_score
    return best_answer, best_score


def is_destructive(text):
    danger_words = ["delete", "cancel", "charge", "refund", "transfer"]
    return any(w in text.lower() for w in danger_words)


def hybrid_respond(user_input):
    if is_destructive(user_input):
        return "Destructive action detected. Routing to structured confirmation flow.", "rule"

    answer, score = faq_respond(user_input)
    if answer:
        return f"{answer}  (faq match={score:.2f})", "faq"

    return f"(would call LLM agent for: {user_input!r})", "agent"


def main():
    print("=== rule-based ELIZA-style ===")
    for msg in ["Hi there", "My name is Alex", "I want coffee", "I feel tired", "The sky is blue"]:
        print(f"  user : {msg}")
        print(f"  bot  : {rule_based_respond(msg)}")
    print()

    print("=== hybrid routing ===")
    for msg in ["how do i reset my password", "cancel my order", "what's the weather like", "I want a refund"]:
        response, route = hybrid_respond(msg)
        print(f"  [{route:5s}] {msg}")
        print(f"           -> {response}")


if __name__ == "__main__":
    main()
