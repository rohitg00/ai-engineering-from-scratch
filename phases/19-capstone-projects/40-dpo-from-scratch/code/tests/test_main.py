"""DPO lesson のテスト。"""

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
        # 4つの log-probs がすべて打ち消すと sigmoid argument は0になり、
        # loss は -log(sigmoid(0)) = -log(0.5) = log(2) になります。
        z = torch.zeros(())
        loss, margin = dpo_loss(z, z, z, z, beta=1.0)
        self.assertAlmostEqual(loss.item(), math.log(2.0), places=6)
        self.assertEqual(margin.item(), 0.0)

    def test_positive_margin_lowers_loss(self) -> None:
        # policy 下で chosen log-prob が高く、reference 下では
        # 等しい場合、margin は正で loss は log(2) 未満です。
        lp_w_pol = torch.tensor(1.0)
        lp_w_ref = torch.tensor(0.0)
        lp_l_pol = torch.tensor(0.0)
        lp_l_ref = torch.tensor(0.0)
        loss, margin = dpo_loss(lp_w_pol, lp_l_pol, lp_w_ref, lp_l_ref, beta=1.0)
        self.assertGreater(margin.item(), 0.0)
        self.assertLess(loss.item(), math.log(2.0))

    def test_negative_margin_raises_loss(self) -> None:
        # policy 下で chosen log-prob が rejected より低く（reference は
        # 等しい）、margin は負で loss は log(2) より大きくなります。
        lp_w_pol = torch.tensor(-1.0)
        lp_w_ref = torch.tensor(0.0)
        lp_l_pol = torch.tensor(0.0)
        lp_l_ref = torch.tensor(0.0)
        loss, margin = dpo_loss(lp_w_pol, lp_l_pol, lp_w_ref, lp_l_ref, beta=1.0)
        self.assertLess(margin.item(), 0.0)
        self.assertGreater(loss.item(), math.log(2.0))

    def test_reference_cancels_when_chosen_and_rejected_offsets_match(self) -> None:
        # reference log-probs が chosen と rejected で同じ量だけ shift されると、
        # shift は両方の diff に現れるため打ち消されます。
        lp_w_pol = torch.tensor(2.0)
        lp_l_pol = torch.tensor(1.0)
        loss_a, margin_a = dpo_loss(lp_w_pol, lp_l_pol, torch.tensor(0.0), torch.tensor(0.0), beta=1.0)
        loss_b, margin_b = dpo_loss(lp_w_pol, lp_l_pol, torch.tensor(5.0), torch.tensor(5.0), beta=1.0)
        self.assertAlmostEqual(loss_a.item(), loss_b.item(), places=6)
        self.assertAlmostEqual(margin_a.item(), margin_b.item(), places=6)


class GradientTests(unittest.TestCase):
    def test_gradient_increases_chosen_logprob(self) -> None:
        # logp_w_pol に対する L の gradient は負であるべきです。つまり
        # optimizer は chosen log-prob を押し上げます。
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
        # 空でない event の log-probabilities は <= 0 です。
        self.assertLessEqual(lp, 0.0)

    def test_log_prob_sums_independently_of_dummy_batch(self) -> None:
        # 2回実行して determinism を確認します（同じ model、同じ input）。
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
        # margin = 1/(2*beta) では IPO loss は0です。
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
            # margin は chosen_logprob - rejected_logprob と一致します。
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
        # warmup が実際に reference を学習するよう unfreeze します（build_models は default で freeze）。
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
