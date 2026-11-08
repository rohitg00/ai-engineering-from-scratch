import numpy as np


def implicit_reward(policy_logprob, ref_logprob, beta=0.1):
    raise NotImplementedError


def dpo_loss(policy_logprob_preferred, policy_logprob_rejected, ref_logprob_preferred, ref_logprob_rejected, beta=0.1):
    raise NotImplementedError


def dpo_grad(policy_logprob_preferred, policy_logprob_rejected, ref_logprob_preferred, ref_logprob_rejected, beta=0.1):
    raise NotImplementedError
