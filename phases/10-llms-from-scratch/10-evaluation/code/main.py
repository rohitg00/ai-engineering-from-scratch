import json
from collections import Counter

import numpy as np


class EvalCase:
    def __init__(self, input_text, expected, metadata=None):
        self.input_text = input_text
        self.expected = expected
        self.metadata = metadata or {}


class EvalSuite:
    def __init__(self, name, cases, scorers):
        self.name = name
        self.cases = cases
        self.scorers = scorers

    def run(self, model_fn):
        results = []
        for case in self.cases:
            prediction = model_fn(case.input_text)
            scores = {}
            for scorer_name, scorer_fn in self.scorers.items():
                scores[scorer_name] = scorer_fn(prediction, case.expected)
            results.append({
                "input": case.input_text,
                "expected": case.expected,
                "prediction": prediction,
                "scores": scores,
            })
        return results


def exact_match(prediction, expected):
    return 1.0 if prediction.strip().lower() == expected.strip().lower() else 0.0


def token_f1(prediction, expected):
    pred_tokens = set(prediction.lower().split())
    exp_tokens = set(expected.lower().split())
    if not pred_tokens or not exp_tokens:
        return 0.0
    common = pred_tokens & exp_tokens
    precision = len(common) / len(pred_tokens)
    recall = len(common) / len(exp_tokens)
    if precision + recall == 0:
        return 0.0
    return 2 * (precision * recall) / (precision + recall)


def llm_judge_simulated(prediction, expected):
    pred_words = set(prediction.lower().split())
    exp_words = set(expected.lower().split())
    if not exp_words:
        return 0.0
    overlap = len(pred_words & exp_words) / len(exp_words)
    length_penalty = min(1.0, len(prediction) / max(len(expected), 1))
    return round(overlap * 0.7 + length_penalty * 0.3, 3)


class ELOTracker:
    def __init__(self, k=32, initial_rating=1500):
        self.ratings = {}
        self.k = k
        self.initial_rating = initial_rating
        self.history = []

    def _ensure_player(self, name):
        if name not in self.ratings:
            self.ratings[name] = self.initial_rating

    def expected_score(self, rating_a, rating_b):
        return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))

    def record_match(self, player_a, player_b, outcome):
        self._ensure_player(player_a)
        self._ensure_player(player_b)

        ea = self.expected_score(self.ratings[player_a], self.ratings[player_b])
        eb = 1 - ea

        if outcome == "a":
            sa, sb = 1.0, 0.0
        elif outcome == "b":
            sa, sb = 0.0, 1.0
        else:
            sa, sb = 0.5, 0.5

        self.ratings[player_a] += self.k * (sa - ea)
        self.ratings[player_b] += self.k * (sb - eb)

        self.history.append({
            "a": player_a, "b": player_b,
            "outcome": outcome,
            "rating_a": round(self.ratings[player_a], 1),
            "rating_b": round(self.ratings[player_b], 1),
        })

    def leaderboard(self):
        return sorted(self.ratings.items(), key=lambda x: -x[1])


def perplexity(log_probs):
    if not log_probs:
        return float("inf")
    avg_neg_log_prob = -np.mean(log_probs)
    return float(np.exp(avg_neg_log_prob))


def token_log_probs_simulated(text, model_quality=0.8):
    np.random.seed(hash(text) % 2**31)
    tokens = text.split()
    log_probs = []
    for i, token in enumerate(tokens):
        base_prob = model_quality
        if len(token) > 8:
            base_prob *= 0.6
        if i == 0:
            base_prob *= 0.7
        prob = np.clip(base_prob + np.random.normal(0, 0.1), 0.01, 0.99)
        log_probs.append(float(np.log(prob)))
    return log_probs


def summarize_results(results, threshold=0.8):
    all_scores = {}
    for r in results:
        for metric, score in r["scores"].items():
            all_scores.setdefault(metric, []).append(score)

    summary = {}
    for metric, scores in all_scores.items():
        arr = np.array(scores)
        summary[metric] = {
            "mean": round(float(np.mean(arr)), 3),
            "median": round(float(np.median(arr)), 3),
            "std": round(float(np.std(arr)), 3),
            "min": round(float(np.min(arr)), 3),
            "max": round(float(np.max(arr)), 3),
            "pass_rate": round(float(np.mean(arr >= threshold)), 3),
            "n": len(scores),
        }
    return summary


def print_summary(summary, suite_name="Eval"):
    print(f"\n{'=' * 60}")
    print(f"  {suite_name} Summary")
    print(f"{'=' * 60}")
    for metric, stats in summary.items():
        print(f"\n  {metric}:")
        print(f"    Mean:      {stats['mean']:.3f}")
        print(f"    Median:    {stats['median']:.3f}")
        print(f"    Std:       {stats['std']:.3f}")
        print(f"    Range:     [{stats['min']:.3f}, {stats['max']:.3f}]")
        print(f"    Pass rate: {stats['pass_rate']:.1%} (threshold >= 0.8)")
        print(f"    N:         {stats['n']}")


def demo_model_good(prompt):
    responses = {
        "What is the capital of France?": "Paris",
        "What is 2 + 2?": "4",
        "Who wrote Hamlet?": "William Shakespeare",
        "What language is PyTorch written in?": "Python and C++",
        "What is the boiling point of water?": "100 degrees Celsius",
        "What is the speed of light?": "299792458 meters per second",
        "Name the largest planet.": "Jupiter",
        "What year did World War 2 end?": "1945",
    }
    return responses.get(prompt, "I don't know")


def demo_model_bad(prompt):
    responses = {
        "What is the capital of France?": "Paris is the capital city of France",
        "What is 2 + 2?": "The answer is four",
        "Who wrote Hamlet?": "Shakespeare",
        "What language is PyTorch written in?": "Python",
        "What is the boiling point of water?": "212 Fahrenheit",
        "What is the speed of light?": "About 300 million m/s",
        "Name the largest planet.": "The largest planet is Jupiter",
        "What year did World War 2 end?": "World War 2 ended in 1945",
    }
    return responses.get(prompt, "Unknown")


def demo_model_random(prompt):
    np.random.seed(hash(prompt) % 2**31)
    words = ["yes", "no", "maybe", "42", "Paris", "unknown", "error"]
    return words[np.random.randint(len(words))]


def run_eval_demo():
    print("=" * 60)
    print("  STEP 1: Eval Framework")
    print("=" * 60)

    cases = [
        EvalCase("What is the capital of France?", "Paris"),
        EvalCase("What is 2 + 2?", "4"),
        EvalCase("Who wrote Hamlet?", "William Shakespeare"),
        EvalCase("What language is PyTorch written in?", "Python and C++"),
        EvalCase("What is the boiling point of water?", "100 degrees Celsius"),
        EvalCase("What is the speed of light?", "299792458 meters per second"),
        EvalCase("Name the largest planet.", "Jupiter"),
        EvalCase("What year did World War 2 end?", "1945"),
    ]

    suite = EvalSuite(
        name="General Knowledge",
        cases=cases,
        scorers={
            "exact_match": exact_match,
            "token_f1": token_f1,
            "llm_judge": llm_judge_simulated,
        },
    )

    results_good = suite.run(demo_model_good)
    results_bad = suite.run(demo_model_bad)
    results_random = suite.run(demo_model_random)

    print_summary(summarize_results(results_good), "Model A (concise, exact)")
    print_summary(summarize_results(results_bad), "Model B (verbose, paraphrase)")
    print_summary(summarize_results(results_random), "Model C (random)")


def run_elo_demo():
    print(f"\n{'=' * 60}")
    print("  STEP 2: ELO Tournament")
    print("=" * 60)

    cases = [
        EvalCase("What is the capital of France?", "Paris"),
        EvalCase("What is 2 + 2?", "4"),
        EvalCase("Who wrote Hamlet?", "William Shakespeare"),
        EvalCase("What language is PyTorch written in?", "Python and C++"),
        EvalCase("What is the boiling point of water?", "100 degrees Celsius"),
        EvalCase("What is the speed of light?", "299792458 meters per second"),
        EvalCase("Name the largest planet.", "Jupiter"),
        EvalCase("What year did World War 2 end?", "1945"),
    ]

    models = {
        "concise": demo_model_good,
        "verbose": demo_model_bad,
        "random": demo_model_random,
    }

    elo = ELOTracker(k=32)
    model_names = list(models.keys())

    for case in cases:
        for i in range(len(model_names)):
            for j in range(i + 1, len(model_names)):
                name_a, name_b = model_names[i], model_names[j]
                pred_a = models[name_a](case.input_text)
                pred_b = models[name_b](case.input_text)

                score_a = token_f1(pred_a, case.expected)
                score_b = token_f1(pred_b, case.expected)

                if score_a > score_b + 0.01:
                    outcome = "a"
                elif score_b > score_a + 0.01:
                    outcome = "b"
                else:
                    outcome = "tie"

                elo.record_match(name_a, name_b, outcome)

    print("\n  ELO Leaderboard (after pairwise comparisons):")
    for rank, (name, rating) in enumerate(elo.leaderboard(), 1):
        print(f"    {rank}. {name:<15} {rating:.0f}")

    print(f"\n  Match history ({len(elo.history)} matches):")
    for m in elo.history[:5]:
        winner = m["a"] if m["outcome"] == "a" else m["b"] if m["outcome"] == "b" else "tie"
        print(f"    {m['a']} vs {m['b']} -> {winner}")
    if len(elo.history) > 5:
        print(f"    ... and {len(elo.history) - 5} more")


def run_perplexity_demo():
    print(f"\n{'=' * 60}")
    print("  STEP 3: Perplexity Comparison")
    print("=" * 60)

    test_texts = [
        "The quick brown fox jumps over the lazy dog in the garden",
        "Quantum entanglement demonstrates nonlocal correlations between particles",
        "def fibonacci(n): return n if n < 2 else fibonacci(n-1) + fibonacci(n-2)",
    ]

    for text in test_texts:
        print(f"\n  Text: {text[:60]}...")
        for quality, label in [(0.9, "Strong"), (0.7, "Medium"), (0.4, "Weak")]:
            log_probs = token_log_probs_simulated(text, model_quality=quality)
            ppl = perplexity(log_probs)
            print(f"    {label} model (quality={quality}): perplexity = {ppl:.2f}")


def run_metric_comparison():
    print(f"\n{'=' * 60}")
    print("  STEP 4: Metric Disagreement Analysis")
    print("=" * 60)

    test_pairs = [
        ("Paris", "Paris", "Exact match"),
        ("The capital of France is Paris", "Paris", "Verbose correct answer"),
        ("France", "Paris", "Wrong but related"),
        ("I don't know", "Paris", "Refusal"),
        ("paris", "Paris", "Case mismatch"),
        ("Paris, France", "Paris", "Extra info"),
    ]

    print(f"\n  {'Prediction':<35} {'Expected':<10} {'EM':>5} {'F1':>5} {'Judge':>6}")
    print("  " + "-" * 68)

    for pred, expected, label in test_pairs:
        em = exact_match(pred, expected)
        f1 = token_f1(pred, expected)
        judge = llm_judge_simulated(pred, expected)
        print(f"  {pred:<35} {expected:<10} {em:>5.2f} {f1:>5.2f} {judge:>6.3f}  ({label})")


if __name__ == "__main__":
    run_eval_demo()
    run_elo_demo()
    run_perplexity_demo()
    run_metric_comparison()
