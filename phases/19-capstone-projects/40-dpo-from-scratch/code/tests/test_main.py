"""Tests for the DPO lesson."""

from __future__ import annotations

import math
import os
import sys
import unittest

import torch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    DPOConfig,
    DPOReport,
    InstructionTokenizer,
    MarginRow,
    TinyGPT,
    build_models,
    dpo_loss,
    evaluate_margins,
    ipo_loss,
    length_normalised_log_prob,
    make_preferences,
    margin_table,
    sequence_log_prob,
    train_dpo,
    warmup_pretrain,
)


class FixtureTests(unittest.TestCase):
    def test_preferences_have_chosen_and_rejected(self) -> None:
        triples = make_preferences()
        self.assertGreaterEqual(len(triples), 12)
        for tri in triples:
            self.assertIn("prompt", tri)
            self.assertIn("chosen", tri)
            self.assertIn("rejected", tri)
            self.assertNotEqual(tri["chosen"], tri["rejected"])


class LossMathTests(unittest.TestCase):
    def test_zero_margin_loss_is_log_two(self) -> None:
        # When all four log-probs cancel, the sigmoid argument is zero and
        # the loss is -log(sigmoid(0)) = -log(0.5) = log(2).
        z = torch.zeros(())
        loss, margin = dpo_loss(z, z, z, z, beta=1.0)
        self.assertAlmostEqual(loss.item(), math.log(2.0), places=6)
        self.assertEqual(margin.item(), 0.0)

    def test_positive_margin_lowers_loss(self) -> None:
        # If chosen log-prob is higher under the policy and equal under the
        # reference, the margin is positive and the loss is below log(2).
        lp_w_pol = torch.tensor(1.0)
        lp_w_ref = torch.tensor(0.0)
        lp_l_pol = torch.tensor(0.0)
        lp_l_ref = torch.tensor(0.0)
        loss, margin = dpo_loss(lp_w_pol, lp_l_pol, lp_w_ref, lp_l_ref, beta=1.0)
        self.assertGreater(margin.item(), 0.0)
        self.assertLess(loss.item(), math.log(2.0))

    def test_negative_margin_raises_loss(self) -> None:
        # If chosen log-prob is below rejected under the policy (with reference
        # equal), the margin is negative and loss is above log(2).
        lp_w_pol = torch.tensor(-1.0)
        lp_w_ref = torch.tensor(0.0)
        lp_l_pol = torch.tensor(0.0)
        lp_l_ref = torch.tensor(0.0)
        loss, margin = dpo_loss(lp_w_pol, lp_l_pol, lp_w_ref, lp_l_ref, beta=1.0)
        self.assertLess(margin.item(), 0.0)
        self.assertGreater(loss.item(), math.log(2.0))

    def test_reference_cancels_when_chosen_and_rejected_offsets_match(self) -> None:
        # If reference log-probs are shifted by the same amount for chosen and
        # rejected, the shift cancels (it appears in both diffs).
        lp_w_pol = torch.tensor(2.0)
        lp_l_pol = torch.tensor(1.0)
        loss_a, margin_a = dpo_loss(lp_w_pol, lp_l_pol, torch.tensor(0.0), torch.tensor(0.0), beta=1.0)
        loss_b, margin_b = dpo_loss(lp_w_pol, lp_l_pol, torch.tensor(5.0), torch.tensor(5.0), beta=1.0)
        self.assertAlmostEqual(loss_a.item(), loss_b.item(), places=6)
        self.assertAlmostEqual(margin_a.item(), margin_b.item(), places=6)


class GradientTests(unittest.TestCase):
    def test_gradient_increases_chosen_logprob(self) -> None:
        # The gradient of L wrt logp_w_pol should be negative, meaning the
        # optimiser will push the chosen log-prob up.
        lp_w_pol = torch.tensor(0.0, requires_grad=True)
        lp_w_ref = torch.tensor(0.0)
        lp_l_pol = torch.tensor(0.0)
        lp_l_ref = torch.tensor(0.0)
        loss, _ = dpo_loss(lp_w_pol, lp_l_pol, lp_w_ref, lp_l_ref, beta=1.0)
        loss.backward()
        self.assertLess(lp_w_pol.grad.item(), 0.0)

    def test_gradient_decreases_rejected_logprob(self) -> None:
        lp_w_pol = torch.tensor(0.0)
        lp_w_ref = torch.tensor(0.0)
        lp_l_pol = torch.tensor(0.0, requires_grad=True)
        lp_l_ref = torch.tensor(0.0)
        loss, _ = dpo_loss(lp_w_pol, lp_l_pol, lp_w_ref, lp_l_ref, beta=1.0)
        loss.backward()
        self.assertGreater(lp_l_pol.grad.item(), 0.0)


class SequenceLogProbTests(unittest.TestCase):
    def test_log_prob_of_empty_completion_is_zero(self) -> None:
        cfg = DPOConfig(hidden=32, heads=2, depth=1, max_len=16)
        _, policy = build_models(cfg)
        tok = InstructionTokenizer()
        prompt = tok.encode_prompt("hi")
        lp = sequence_log_prob(policy, prompt, [])
        self.assertEqual(lp.item(), 0.0)

    def test_log_prob_is_negative_or_zero(self) -> None:
        cfg = DPOConfig(hidden=32, heads=2, depth=1, max_len=16)
        _, policy = build_models(cfg)
        tok = InstructionTokenizer()
        prompt = tok.encode_prompt("hi")
        completion = tok.encode_completion("bye")
        lp = sequence_log_prob(policy, prompt, completion).item()
        # Log-probabilities of any non-empty event are <= 0.
        self.assertLessEqual(lp, 0.0)

    def test_log_prob_sums_independently_of_dummy_batch(self) -> None:
        # Run twice and check determinism (same model, same input).
        cfg = DPOConfig(hidden=32, heads=2, depth=1, max_len=24, seed=0)
        _, policy = build_models(cfg)
        tok = InstructionTokenizer()
        prompt = tok.encode_prompt("hello")
        completion = tok.encode_completion("world")
        a = sequence_log_prob(policy, prompt, completion).item()
        b = sequence_log_prob(policy, prompt, completion).item()
        self.assertAlmostEqual(a, b, places=6)


class ReferenceInvarianceTests(unittest.TestCase):
    def test_reference_parameters_have_requires_grad_false(self) -> None:
        cfg = DPOConfig(hidden=32, heads=2, depth=1, max_len=16)
        reference, _ = build_models(cfg)
        for p in reference.parameters():
            self.assertFalse(p.requires_grad)

    def test_policy_initially_matches_reference(self) -> None:
        cfg = DPOConfig(hidden=32, heads=2, depth=1, max_len=16)
        reference, policy = build_models(cfg)
        tok = InstructionTokenizer()
        prompt = tok.encode_prompt("hi")
        completion = tok.encode_completion("ok")
        with torch.no_grad():
            ref_lp = sequence_log_prob(reference, prompt, completion).item()
            pol_lp = sequence_log_prob(policy, prompt, completion).item()
        self.assertAlmostEqual(ref_lp, pol_lp, places=5)

    def test_reference_log_probs_unchanged_after_policy_training(self) -> None:
        cfg = DPOConfig(hidden=32, heads=2, depth=1, max_len=24, epochs=2, warmup_epochs=0)
        reference, policy = build_models(cfg)
        tok = InstructionTokenizer()
        triples = make_preferences()[:3]
        prompt = tok.encode_prompt(triples[0]["prompt"])
        completion = tok.encode_completion(triples[0]["chosen"])
        with torch.no_grad():
            before = sequence_log_prob(reference, prompt, completion).item()
        train_dpo(policy, reference, tok, triples, cfg, log=lambda s: None)
        with torch.no_grad():
            after = sequence_log_prob(reference, prompt, completion).item()
        self.assertAlmostEqual(before, after, places=5)


class IPOTests(unittest.TestCase):
    def test_ipo_loss_is_non_negative(self) -> None:
        for margin in (-2.0, -0.5, 0.0, 0.3, 1.5):
            loss, _ = ipo_loss(
                torch.tensor(margin), torch.tensor(0.0), torch.tensor(0.0), torch.tensor(0.0), beta=0.5
            )
            self.assertGreaterEqual(loss.item(), 0.0)

    def test_ipo_minimum_at_target_margin(self) -> None:
        # At margin = 1/(2*beta) the IPO loss equals zero.
        beta = 0.5
        target = 1.0 / (2.0 * beta)
        loss, _ = ipo_loss(
            torch.tensor(target), torch.tensor(0.0), torch.tensor(0.0), torch.tensor(0.0), beta=beta
        )
        self.assertAlmostEqual(loss.item(), 0.0, places=6)


class LengthNormaliseTests(unittest.TestCase):
    def test_length_normalised_matches_raw_divided_by_length(self) -> None:
        cfg = DPOConfig(hidden=32, heads=2, depth=1, max_len=24, seed=0)
        _, policy = build_models(cfg)
        tok = InstructionTokenizer()
        prompt = tok.encode_prompt("hi")
        completion = tok.encode_completion("hello")
        raw = sequence_log_prob(policy, prompt, completion).item()
        norm = length_normalised_log_prob(policy, prompt, completion).item()
        self.assertAlmostEqual(norm, raw / len(completion), places=5)


class MarginTableTests(unittest.TestCase):
    def test_margin_table_row_per_triple(self) -> None:
        cfg = DPOConfig(hidden=32, heads=2, depth=1, max_len=24, seed=0)
        _, policy = build_models(cfg)
        tok = InstructionTokenizer()
        triples = make_preferences()[:3]
        rows = margin_table(policy, tok, triples)
        self.assertEqual(len(rows), 3)
        for row in rows:
            self.assertIsInstance(row, MarginRow)
            # Margin equals chosen_logprob - rejected_logprob.
            self.assertAlmostEqual(row.margin, row.chosen_logprob - row.rejected_logprob, places=5)


class TrainingTests(unittest.TestCase):
    def test_train_dpo_decreases_loss(self) -> None:
        torch.manual_seed(0)
        cfg = DPOConfig(
            hidden=32,
            heads=2,
            depth=1,
            max_len=48,
            beta=0.2,
            lr=5e-3,
            epochs=5,
            warmup_epochs=3,
        )
        reference, policy = build_models(cfg)
        tok = InstructionTokenizer()
        triples = make_preferences()[:6]
        # Unfreeze reference so warmup actually trains it (build_models freezes by default).
        for p in reference.parameters():
            p.requires_grad = True
        reference.train()
        warmup_pretrain(reference, tok, triples, epochs=cfg.warmup_epochs, seed=cfg.seed)
        policy.load_state_dict(reference.state_dict())
        for p in reference.parameters():
            p.requires_grad = False
        reference.eval()
        report = train_dpo(policy, reference, tok, triples, cfg, log=lambda s: None)
        self.assertEqual(len(report.losses), cfg.epochs)
        self.assertLess(report.losses[-1], report.losses[0])

    def test_train_dpo_increases_chosen_margin(self) -> None:
        torch.manual_seed(0)
        cfg = DPOConfig(
            hidden=32,
            heads=2,
            depth=1,
            max_len=48,
            beta=0.2,
            lr=5e-3,
            epochs=5,
            warmup_epochs=3,
        )
        reference, policy = build_models(cfg)
        tok = InstructionTokenizer()
        triples = make_preferences()[:6]
        for p in reference.parameters():
            p.requires_grad = True
        reference.train()
        warmup_pretrain(reference, tok, triples, epochs=cfg.warmup_epochs, seed=cfg.seed)
        policy.load_state_dict(reference.state_dict())
        for p in reference.parameters():
            p.requires_grad = False
        reference.eval()
        report = train_dpo(policy, reference, tok, triples, cfg, log=lambda s: None)
        self.assertGreater(report.final_margin, report.initial_margin)


if __name__ == "__main__":
    unittest.main()
