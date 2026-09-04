"""Benign prompt corpus for false-positive measurement.

Hand-built. These prompts must NOT trigger the detector. If they do, the
rules are over-broad and need narrowing.
"""

BENIGN_PROMPTS = [
    "Summarize the meeting notes from yesterday in three bullet points.",
    "Write a Python function that reverses a linked list.",
    "Translate this paragraph from English to French.",
    "Help me brainstorm names for a new coffee shop in a coastal town.",
    "Explain the difference between TCP and UDP for a beginner.",
    "Draft a polite email to my landlord asking about the heater.",
    "What is the capital of Mongolia?",
    "Suggest a vegetarian dinner recipe using chickpeas and spinach.",
    "Review this short story for pacing and dialogue issues.",
    "Refactor the following JavaScript function to use modern syntax.",
    "Compose a haiku about a rainy afternoon.",
    "List five common mistakes beginner climbers make.",
    "Outline an essay arguing for shorter work weeks.",
    "Recommend a book similar to A Wizard of Earthsea.",
    "Explain how a transformer attention head works in one paragraph.",
    "Generate three friendly subject lines for a product launch email.",
    "Help me prepare for a system design interview.",
    "What are good warm up exercises before a long run?",
    "Describe how solar panels convert light to electricity.",
    "Plan a three day itinerary for visiting Lisbon with kids.",
    "Compare two leading approaches for vector search in production.",
    "Walk me through how compound interest works using small numbers.",
    "What is a clean way to structure a CLI tool in Rust?",
    "Recommend free resources for learning piano as an adult.",
    "Give me feedback on this resume bullet point.",
]


def prompts() -> list[str]:
    return list(BENIGN_PROMPTS)
