## Why beam search helps

Greedy decoding commits to the best token at each step. In the toy model, token 1 has the highest first probability, but every token after it is unlikely. Token 2 is a little worse at first, and EOS after it has probability 0.9. Width 2 keeps both paths alive long enough to see this.

## What beam search does not promise

Beam search is a heuristic. A beam wide enough to keep every hypothesis is an exhaustive search, but any narrower beam can miss the best sequence. A wider beam often finds a better sequence, but this is not a theorem: a new candidate can push out a hypothesis that a narrower beam keeps and later extends to a better finish.

## Length normalization

Each log-prob is 0 or less, so a raw score only goes down as a sequence grows. Without a correction, beam search prefers short outputs. Division by $L^{\alpha}$ removes part of that bias. Production decoders apply it when they rank finished hypotheses, as this problem does. The seq2seq lesson explains why beam width 3 to 5 is standard for translation.

## Where this goes next

The machine translation lesson decodes with `num_beams=5`. The GPT lesson compares beam search with sampling and shows why open chat output uses sampling.
