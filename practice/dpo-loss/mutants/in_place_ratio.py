import numpy as np


def sigmoid(x):
    return np.exp(-np.logaddexp(0.0, -x))


def implicit_reward(policy_logprob, ref_logprob, beta=0.1):
    policy_logprob = np.asarray(policy_logprob, dtype=float)
    policy_logprob -= ref_logprob
    return beta * policy_logprob


def dpo_logits(policy_logprob_preferred, policy_logprob_rejected, ref_logprob_preferred, ref_logprob_rejected, beta=0.1):
    preferred_reward = implicit_reward(policy_logprob_preferred, ref_logprob_preferred, beta)
    rejected_reward = implicit_reward(policy_logprob_rejected, ref_logprob_rejected, beta)
    return preferred_reward - rejected_reward


def dpo_loss(policy_logprob_preferred, policy_logprob_rejected, ref_logprob_preferred, ref_logprob_rejected, beta=0.1):
    logit = dpo_logits(policy_logprob_preferred, policy_logprob_rejected, ref_logprob_preferred, ref_logprob_rejected, beta)
    return float(np.mean(np.logaddexp(0.0, -logit)))


def dpo_grad(policy_logprob_preferred, policy_logprob_rejected, ref_logprob_preferred, ref_logprob_rejected, beta=0.1):
    logit = dpo_logits(policy_logprob_preferred, policy_logprob_rejected, ref_logprob_preferred, ref_logprob_rejected, beta)
    weight = sigmoid(-logit) * beta / logit.size
    return -weight, weight
