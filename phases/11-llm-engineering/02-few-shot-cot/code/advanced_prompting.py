import json
import re
import os
from collections import Counter
from openai import OpenAI


GSM8K_EXAMPLES = [
    {
        "question": (
            "Janet's ducks lay 16 eggs per day. She eats three for breakfast "
            "every morning and bakes muffins for her friends every day with four. "
            "She sells every remaining egg at the farmers' market for $2. "
            "How much does she make every day at the farmers' market?"
        ),
        "reasoning": (
            "Janet's ducks lay 16 eggs per day. She eats 3 and bakes with 4, "
            "using 3 + 4 = 7 eggs. So she has 16 - 7 = 9 eggs left. "
            "She sells each for $2, so she makes 9 * 2 = $18 per day."
        ),
        "answer": "18",
    },
    {
        "question": (
            "A robe takes 2 bolts of blue fiber and half that much white fiber. "
            "How many bolts in total does it take?"
        ),
        "reasoning": (
            "It takes 2 bolts of blue fiber. "
            "Half of 2 is 1, so it takes 1 bolt of white fiber. "
            "In total, 2 + 1 = 3 bolts."
        ),
        "answer": "3",
    },
    {
        "question": (
            "Josh decides to try flipping a house. He buys a house for $80,000 "
            "and puts $50,000 in repairs. This increased the value of the house "
            "by 150%. How much profit did he make?"
        ),
        "reasoning": (
            "The house cost $80,000. Repairs cost $50,000. "
            "Total investment: 80,000 + 50,000 = $130,000. "
            "The value increased by 150% of $80,000: 80,000 * 1.5 = $120,000. "
            "New value: 80,000 + 120,000 = $200,000. "
            "Profit: 200,000 - 130,000 = $70,000."
        ),
        "answer": "70000",
    },
    {
        "question": (
            "James writes a 3-page letter to 2 different friends twice a week. "
            "How many pages does he write a year?"
        ),
        "reasoning": (
            "He writes to 2 friends, so 2 letters each time. "
            "Each letter is 3 pages, so 2 * 3 = 6 pages per session. "
            "He does this twice a week: 6 * 2 = 12 pages per week. "
            "In a year (52 weeks): 12 * 52 = 624 pages."
        ),
        "answer": "624",
    },
    {
        "question": (
            "Every day, Wendi feeds each of her chickens three cups of mixed "
            "chicken feed, containing seeds, mealworms, and vegetables. She gives "
            "the chickens their feed in three separate meals. In the morning, she "
            "gives her flock of chickens 15 cups of feed. In the afternoon, she "
            "gives her chickens another 25 cups of feed. How many cups of feed "
            "does she need to give her chickens in the final meal of the day if "
            "the carry-over from prior feedings was 35 cups?"
        ),
        "reasoning": (
            "Morning feed: 15 cups. Afternoon feed: 25 cups. "
            "Total so far: 15 + 25 = 40 cups. "
            "Carry-over: 35 cups. Effective fed: 40 - 35 = 5 cups net new. "
            "Wait, let me re-read. She has a flock. Morning: 15 cups. Afternoon: 25 cups. "
            "Total given so far: 15 + 25 = 40 cups. "
            "With 35 cups carry-over, total available is 40 + 35 = 75 cups. "
            "Actually, carry-over means leftover from before. "
            "Each chicken gets 3 cups/day. Number of chickens: 15/? "
            "Morning she gives 15 cups. Each meal is 1/3 of daily feed. "
            "So 15 cups in morning = 1/3 of total daily. Total daily = 45 cups. "
            "She gave 15 + 25 = 40 cups in first two meals. "
            "Remaining: 45 - 40 = 5 cups. But carry-over is 35 cups. "
            "She needs 5 - 35 = needs to give negative? No. "
            "Total needed for last meal: the daily total minus what was already fed. "
            "15 chickens (since 15 cups / 1 cup per chicken per meal = 15 chickens). "
            "Daily total: 15 * 3 = 45 cups. Given: 15 + 25 = 40. "
            "Last meal needs: 45 - 40 = 5 cups. But the carry-over is extra, not a reduction. "
            "She needs to give 45 - 40 + 35 = 40 cups. Wait. "
            "Hmm, with 35 cups carry-over from prior feedings already counted: "
            "She needs to provide 45 - 35 = 10 total new cups today. "
            "She already gave 15 + 25 = 40. That's way more than 10. "
            "The question asks how many cups in the final meal. "
            "Let me just compute: total daily = 15 * 3 = 45. "
            "Already given: 15 + 25 = 40. Last meal: 45 - 40 = 5."
        ),
        "answer": "5",
    },
]


def extract_answer(text):
    if not text:
        return None
    patterns = [
        r"[Tt]he answer is[:\s]*\$?([\d,]+\.?\d*)",
        r"[Tt]he answer is[:\s]*([\d,]+\.?\d*)",
        r"#### ([\d,]+\.?\d*)",
        r"= \$?([\d,]+\.?\d*)\s*$",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1).replace(",", "")
    numbers = re.findall(r"[\d,]+\.?\d*", text)
    if numbers:
        return numbers[-1].replace(",", "")
    return None


def build_cot_prompt(question, examples, num_examples=3):
    system = (
        "You are a precise math problem solver. "
        "For each problem, show your step-by-step reasoning clearly. "
        "After your reasoning, state your final answer on the last line "
        "in exactly this format: 'The answer is [number]'."
    )

    example_text = ""
    for ex in examples[:num_examples]:
        example_text += f"Q: {ex['question']}\n"
        example_text += f"A: {ex['reasoning']} The answer is {ex['answer']}.\n\n"

    user = f"{example_text}Q: {question}\nA:"
    return system, user


def build_zero_shot_cot_prompt(question):
    system = (
        "You are a precise math problem solver. "
        "Show your step-by-step reasoning. "
        "End with: 'The answer is [number]'."
    )
    user = f"Q: {question}\nA: Let's think step by step."
    return system, user


def build_zero_shot_prompt(question):
    system = (
        "You are a precise math problem solver. "
        "Give only the final numerical answer. "
        "End with: 'The answer is [number]'."
    )
    user = f"Q: {question}\nA:"
    return system, user


def call_llm(client, model, system, user, temperature=0.0):
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        max_tokens=1024,
    )
    return response.choices[0].message.content


def zero_shot_solve(question, client, model):
    system, user = build_zero_shot_prompt(question)
    text = call_llm(client, model, system, user, temperature=0.0)
    return extract_answer(text), text


def zero_shot_cot_solve(question, client, model):
    system, user = build_zero_shot_cot_prompt(question)
    text = call_llm(client, model, system, user, temperature=0.0)
    return extract_answer(text), text


def few_shot_cot_solve(question, examples, client, model, num_examples=3):
    system, user = build_cot_prompt(question, examples, num_examples)
    text = call_llm(client, model, system, user, temperature=0.0)
    return extract_answer(text), text


def self_consistency_solve(question, examples, client, model, n_samples=5):
    system, user = build_cot_prompt(question, examples)

    answers = []
    reasonings = []
    for _ in range(n_samples):
        text = call_llm(client, model, system, user, temperature=0.7)
        reasonings.append(text)
        answer = extract_answer(text)
        if answer is not None:
            answers.append(answer)

    if not answers:
        return None, 0.0, reasonings, Counter()

    vote_counts = Counter(answers)
    best_answer = vote_counts.most_common(1)[0][0]
    confidence = vote_counts[best_answer] / len(answers)

    return best_answer, confidence, reasonings, vote_counts


def generate_initial_thoughts(question, client, model, breadth=3):
    system = (
        "You are a math problem solver exploring different solution approaches. "
        "Generate one distinct approach to solving this problem. "
        "Show your partial reasoning. Do not give the final answer yet."
    )
    thoughts = []
    for i in range(breadth):
        user = (
            f"Problem: {question}\n\n"
            f"Generate approach #{i + 1} (use a different strategy than previous approaches). "
            f"Think about: arithmetic breakdown, working backwards, estimation, "
            f"or algebraic formulation."
        )
        text = call_llm(client, model, system, user, temperature=0.9)
        thoughts.append(text)
    return thoughts


def evaluate_thought(thought, question, client, model):
    system = (
        "You are a math reasoning evaluator. "
        "Score the following partial reasoning on a scale from 0.0 to 1.0. "
        "Consider: correctness of arithmetic, logical coherence, "
        "progress toward the answer. "
        "Respond with ONLY a number between 0.0 and 1.0."
    )
    user = f"Problem: {question}\n\nReasoning so far:\n{thought}\n\nScore:"
    text = call_llm(client, model, system, user, temperature=0.0)
    try:
        score = float(re.search(r"([\d.]+)", text).group(1))
        return min(max(score, 0.0), 1.0)
    except (AttributeError, ValueError):
        return 0.5


def extend_thought(thought, question, client, model, breadth=2):
    system = (
        "You are a math problem solver continuing a line of reasoning. "
        "Take the partial reasoning below and extend it further toward a solution. "
        "Show your continued reasoning. If you reach the final answer, "
        "state it as: 'The answer is [number]'."
    )
    extensions = []
    for i in range(breadth):
        user = (
            f"Problem: {question}\n\n"
            f"Reasoning so far:\n{thought}\n\n"
            f"Continue this reasoning (approach #{i + 1}):"
        )
        text = call_llm(client, model, system, user, temperature=0.8)
        extensions.append(f"{thought}\n\n{text}")
    return extensions


def tree_of_thought_solve(question, client, model, breadth=3, depth=3):
    thoughts = generate_initial_thoughts(question, client, model, breadth)
    scored = [(t, evaluate_thought(t, question, client, model)) for t in thoughts]
    scored.sort(key=lambda x: x[1], reverse=True)

    for current_depth in range(1, depth):
        next_thoughts = []
        top_k = min(2, len(scored))
        for thought, score in scored[:top_k]:
            extensions = extend_thought(thought, question, client, model, breadth)
            for ext in extensions:
                ext_score = evaluate_thought(ext, question, client, model)
                next_thoughts.append((ext, ext_score))
        if next_thoughts:
            scored = sorted(next_thoughts, key=lambda x: x[1], reverse=True)

    best_thought = scored[0][0] if scored else ""
    return extract_answer(best_thought), best_thought


def react_solve(question, client, model, max_steps=5):
    system = (
        "You are a math problem solver that can use a calculator. "
        "For each step, output exactly one of:\n"
        "Thought: [your reasoning]\n"
        "Action: calculate [expression]\n"
        "Answer: [final number]\n\n"
        "When you need to compute something, use Action: calculate. "
        "You will receive the result as an Observation. "
        "When you have the final answer, use Answer:."
    )

    conversation = f"Q: {question}\n"
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": conversation},
    ]

    for step in range(max_steps):
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.0,
            max_tokens=512,
        )
        text = response.choices[0].message.content.strip()
        messages.append({"role": "assistant", "content": text})

        answer_match = re.search(r"Answer:\s*\$?([\d,]+\.?\d*)", text)
        if answer_match:
            return answer_match.group(1).replace(",", ""), text

        calc_match = re.search(r"Action:\s*calculate\s+(.+)", text)
        if calc_match:
            expression = calc_match.group(1).strip()
            try:
                result = eval(expression, {"__builtins__": {}}, {})
                observation = f"Observation: {result}"
            except Exception as e:
                observation = f"Observation: Error - {e}"
            messages.append({"role": "user", "content": observation})

    full_text = "\n".join(
        m["content"] for m in messages if m["role"] == "assistant"
    )
    return extract_answer(full_text), full_text


def solve_with_escalation(question, examples, client, model):
    single_answer, single_text = few_shot_cot_solve(
        question, examples, client, model
    )

    sc_answer, confidence, reasonings, votes = self_consistency_solve(
        question, examples, client, model, n_samples=5
    )

    if confidence >= 0.8:
        return {
            "answer": sc_answer,
            "method": "self_consistency",
            "confidence": confidence,
            "votes": dict(votes),
            "reasoning": reasonings[0],
        }

    tot_answer, tot_reasoning = tree_of_thought_solve(
        question, client, model, breadth=3, depth=2
    )

    return {
        "answer": tot_answer,
        "method": "tree_of_thought",
        "confidence": None,
        "votes": dict(votes),
        "reasoning": tot_reasoning,
    }


def run_comparison(questions, expected_answers, examples, client, model):
    methods = {
        "zero_shot": lambda q: zero_shot_solve(q, client, model),
        "zero_shot_cot": lambda q: zero_shot_cot_solve(q, client, model),
        "few_shot_cot": lambda q: few_shot_cot_solve(q, examples, client, model),
        "self_consistency": lambda q: (
            self_consistency_solve(q, examples, client, model, n_samples=5)[:2]
        ),
    }

    results = {name: {"correct": 0, "total": 0} for name in methods}

    for i, (question, expected) in enumerate(zip(questions, expected_answers)):
        print(f"\nProblem {i + 1}: {question[:60]}...")
        for name, solver in methods.items():
            answer, *_ = solver(question)
            is_correct = str(answer) == str(expected)
            results[name]["total"] += 1
            if is_correct:
                results[name]["correct"] += 1
            status = "CORRECT" if is_correct else f"WRONG (got {answer}, expected {expected})"
            print(f"  {name:20s}: {status}")

    print("\n" + "=" * 50)
    print("ACCURACY SUMMARY")
    print("=" * 50)
    for name, counts in results.items():
        acc = counts["correct"] / counts["total"] * 100 if counts["total"] > 0 else 0
        print(f"  {name:20s}: {acc:.1f}% ({counts['correct']}/{counts['total']})")

    return results


def build_structured_prompt(question, context=None):
    system = """<role>
You are a precise mathematical problem solver with expertise in word problems.
</role>

<rules>
- Show all arithmetic steps explicitly
- Use one line per calculation
- State units where applicable
- End with exactly: 'The answer is [number]'
- If the problem is ambiguous, state your interpretation before solving
</rules>

<output_format>
## Interpretation
[One sentence restating the problem]

## Solution
[Step-by-step calculations]

## Answer
The answer is [number].
</output_format>"""

    user_parts = []
    if context:
        user_parts.append(f"<context>\n{context}\n</context>")
    user_parts.append(f"<problem>\n{question}\n</problem>")

    return system, "\n\n".join(user_parts)


def prompt_chain_solve(question, client, model):
    extract_system = (
        "Extract the key numerical values and relationships from this math problem. "
        "List each as: [variable]: [value] [unit]. "
        "Then list each relationship as: [description]."
    )
    facts = call_llm(client, model, extract_system, question, temperature=0.0)

    solve_system = (
        "You are a math solver. Given the extracted facts below, "
        "set up and solve the equations step by step. "
        "End with: 'The answer is [number]'."
    )
    solve_user = f"Facts:\n{facts}\n\nOriginal problem: {question}"
    solution = call_llm(client, model, solve_system, solve_user, temperature=0.0)

    verify_system = (
        "Verify this math solution by plugging the answer back into "
        "the original problem. Does it check out? "
        "If yes, restate: 'The answer is [number]'. "
        "If no, solve it correctly and state: 'The answer is [number]'."
    )
    verify_user = f"Problem: {question}\n\nProposed solution:\n{solution}"
    verified = call_llm(client, model, verify_system, verify_user, temperature=0.0)

    return extract_answer(verified), {
        "facts": facts,
        "solution": solution,
        "verification": verified,
    }


TEST_QUESTIONS = [
    {
        "question": (
            "Natalia sold clips to 48 of her friends in April, "
            "and then she sold half as many clips in May. "
            "How many clips did Natalia sell altogether in April and May?"
        ),
        "answer": "72",
    },
    {
        "question": (
            "Weng earns $12 an hour for babysitting. Yesterday, she just "
            "did 50 minutes of babysitting. How much did she earn?"
        ),
        "answer": "10",
    },
    {
        "question": (
            "Betty is saving money for a new wallet which costs $100. "
            "Betty has only half of the money she needs. Her parents decided "
            "to give her $15 for that purpose, and her grandparents twice as "
            "much as her parents. How much more money does Betty need to buy "
            "the wallet?"
        ),
        "answer": "5",
    },
    {
        "question": (
            "Julie is reading a 120-page book. Yesterday, she was able to "
            "read 12 pages and today, she read twice as many pages as yesterday. "
            "If she wants to read half of the remaining pages tomorrow, "
            "how many pages should she read?"
        ),
        "answer": "42",
    },
    {
        "question": (
            "James writes a 3-page letter to 2 different friends twice a week. "
            "How many pages does he write a year?"
        ),
        "answer": "624",
    },
]


if __name__ == "__main__":
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", "your-api-key"))
    model = "gpt-4o"

    print("=" * 60)
    print("ADVANCED PROMPTING PIPELINE")
    print("Few-Shot + CoT + Self-Consistency + Tree-of-Thought")
    print("=" * 60)

    questions = [t["question"] for t in TEST_QUESTIONS]
    expected = [t["answer"] for t in TEST_QUESTIONS]

    print("\n--- Technique Comparison ---")
    run_comparison(questions, expected, GSM8K_EXAMPLES, client, model)

    print("\n\n--- Escalation Pipeline ---")
    for test in TEST_QUESTIONS[:2]:
        print(f"\nQ: {test['question'][:80]}...")
        result = solve_with_escalation(
            test["question"], GSM8K_EXAMPLES, client, model
        )
        print(f"  Method: {result['method']}")
        print(f"  Answer: {result['answer']} (expected: {test['answer']})")
        print(f"  Confidence: {result['confidence']}")

    print("\n\n--- Prompt Chaining ---")
    for test in TEST_QUESTIONS[:2]:
        print(f"\nQ: {test['question'][:80]}...")
        answer, chain = prompt_chain_solve(test["question"], client, model)
        print(f"  Answer: {answer} (expected: {test['answer']})")
        print(f"  Steps: extract -> solve -> verify")

    print("\n\n--- ReAct ---")
    for test in TEST_QUESTIONS[:2]:
        print(f"\nQ: {test['question'][:80]}...")
        answer, trace = react_solve(test["question"], client, model)
        print(f"  Answer: {answer} (expected: {test['answer']})")

    print("\n\nDone.")
