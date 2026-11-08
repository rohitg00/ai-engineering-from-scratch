import numpy as np


def final_score(tokens, score, length_penalty):
    return score / (len(tokens) - 1) ** length_penalty


def beam_search(step_fn, bos_id, eos_id, beam_width, max_len, length_penalty=0.0):
    alive = [((bos_id,), 0.0)]
    finished = []
    for _ in range(max_len):
        candidates = []
        for tokens, score in alive:
            log_probs = np.asarray(step_fn(tokens), dtype=float)
            best = sorted(range(len(log_probs)), key=lambda t: (-log_probs[t], t))[:beam_width]
            for token in best:
                candidates.append((tokens + (token,), score + float(log_probs[token])))
        candidates.sort(key=lambda c: (-c[1], c[0]))
        alive = []
        for tokens, score in candidates:
            if tokens[-1] == eos_id:
                finished.append((tokens, score))
            else:
                alive.append((tokens, score))
        if not alive:
            break
    finished.extend(alive)
    ranked = [(tokens, final_score(tokens, score, length_penalty)) for tokens, score in finished]
    ranked.sort(key=lambda c: (-c[1], c[0]))
    return ranked
