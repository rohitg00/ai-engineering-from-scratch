import re
from collections import Counter


ALIAS_INDEX = {
    "jordan": ["Q41421", "Q810", "Q254110", "Q3308285"],
    "paris":  ["Q90", "Q663094", "Q55411"],
    "apple":  ["Q312", "Q89"],
    "washington": ["Q23", "Q1223", "Q61"],
    "python": ["Q28865", "Q83320"],
}

KB_DESC = {
    "Q41421":  "Michael Jordan American basketball player Chicago Bulls six championships",
    "Q810":    "Jordan country Middle East kingdom capital Amman Arabic",
    "Q254110": "Michael B Jordan American actor Black Panther Creed film",
    "Q3308285": "Michael I Jordan Berkeley professor machine learning statistics",
    "Q90":     "Paris capital of France Eiffel Tower Seine river city",
    "Q663094": "Paris Texas city United States Lamar County",
    "Q55411":  "Paris Hilton American socialite hotel heiress television personality",
    "Q312":    "Apple Inc American technology company iPhone Mac Tim Cook Cupertino",
    "Q89":     "Apple fruit tree species Malus domestica red green grown worldwide",
    "Q23":     "George Washington American founding father first president",
    "Q1223":   "Washington state Pacific northwest United States Seattle capital Olympia",
    "Q61":     "Washington DC capital city of United States federal district",
    "Q28865":  "Python programming language Guido van Rossum interpreted dynamic",
    "Q83320":  "Python snake nonvenomous constrictor species Asia Africa large",
}

PRIORS = {
    "Q41421":  0.50, "Q810":    0.20, "Q254110": 0.20, "Q3308285": 0.10,
    "Q90":     0.85, "Q663094": 0.05, "Q55411":  0.10,
    "Q312":    0.70, "Q89":     0.30,
    "Q23":     0.40, "Q1223":   0.30, "Q61":     0.30,
    "Q28865":  0.80, "Q83320":  0.20,
}


def tokenize(text):
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def disambiguate(mention, context, use_prior=True):
    candidates = ALIAS_INDEX.get(mention.lower(), [])
    if not candidates:
        return None, 0.0
    ctx_tokens = tokenize(context)
    scored = []
    for cand in candidates:
        desc_tokens = tokenize(KB_DESC.get(cand, ""))
        if not desc_tokens:
            jac = 0.0
        else:
            overlap = len(ctx_tokens & desc_tokens)
            union = len(ctx_tokens | desc_tokens)
            jac = overlap / union if union else 0.0
        prior = PRIORS.get(cand, 0.0) if use_prior else 1.0
        score = jac + 0.1 * prior
        scored.append((cand, score, jac, prior))
    scored.sort(key=lambda x: -x[1])
    return scored[0][0], scored[0][1]


def run_eval(test_cases, use_prior):
    correct = 0
    print(f"=== disambiguation {'with' if use_prior else 'without'} prior ===")
    for mention, context, gold in test_cases:
        pred, score = disambiguate(mention, context, use_prior=use_prior)
        ok = pred == gold
        correct += int(ok)
        tag = "  OK" if ok else "MISS"
        print(f"  [{tag}] mention={mention:<10} pred={pred:<7} gold={gold:<7} score={score:.3f}")
        print(f"         context: {context[:70]}...")
    print(f"  accuracy: {correct}/{len(test_cases)} ({100 * correct / len(test_cases):.1f}%)")
    print()
    return correct


def main():
    test_cases = [
        ("Jordan", "Jordan scored 45 points against the Lakers last night.", "Q41421"),
        ("Jordan", "Jordan borders Syria, Iraq, and Saudi Arabia in the Middle East.", "Q810"),
        ("Jordan", "Jordan starred in the superhero movie Black Panther.", "Q254110"),
        ("Jordan", "Jordan's work on variational inference shaped machine learning.", "Q3308285"),
        ("Paris",  "Paris is the capital of France and home to the Eiffel Tower.", "Q90"),
        ("Paris",  "Paris Texas is a small city in Lamar County.", "Q663094"),
        ("Paris",  "Paris Hilton is a television personality and heiress.", "Q55411"),
        ("Apple",  "Apple announced the new iPhone at their Cupertino event.", "Q312"),
        ("Apple",  "An apple a day keeps the doctor away; the fruit is rich in fiber.", "Q89"),
        ("Python", "Python is a popular programming language used for data science.", "Q28865"),
        ("Python", "The python is a large nonvenomous snake found in Asia.", "Q83320"),
    ]

    run_eval(test_cases, use_prior=True)
    run_eval(test_cases, use_prior=False)

    print("note: toy 11-case test set.")
    print("production EL uses Wikipedia alias dumps (~18M aliases) and encoder-based disambiguation.")


if __name__ == "__main__":
    main()
