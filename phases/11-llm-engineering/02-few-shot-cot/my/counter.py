from collections import Counter

answers = ["yes", "no", "yes", "yes", "no", "yes"]
votes = Counter(answers)

print(votes)

votes = Counter(["yes", "no", "yes", "yes", "no", "yes"])

winner, count = votes.most_common(1)[0]
print(f"победитель: {winner}, встречался {count} раз")
