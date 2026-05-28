"""SFT lesson のテスト。"""

from __future__ import annotations

import os
import sys
import unittest

import torch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    DataLoader,
    InstructionTokenizer,
    SFTConfig,
    SFTDataset,
    TinyGPT,
    build_model,
    exact_match,
    exact_match_set,
    generate,
    make_dataset,
    normalise,
    per_category_em,
    sft_collate,
    shifted_loss,
    split_dataset,
    train_sft,
)


class TokenizerTests(unittest.TestCase):
    def test_encode_pair_places_resp_marker(self) -> None:
        tok = InstructionTokenizer()
        ids, resp_start = tok.encode_pair("hi", "bye", max_len=32)
        self.assertEqual(ids[0], InstructionTokenizer.INST_ID)
        self.assertEqual(ids[resp_start - 1], InstructionTokenizer.RESP_ID)
        # response bytes は resp_start から始まります。
        self.assertEqual(bytes(ids[resp_start : resp_start + 3]), b"bye")

    def test_truncates_to_max_len(self) -> None:
        tok = InstructionTokenizer()
        ids, _ = tok.encode_pair("a" * 50, "b" * 50, max_len=16)
        self.assertEqual(len(ids), 16)

    def test_decode_response_drops_specials(self) -> None:
        tok = InstructionTokenizer()
        ids = [InstructionTokenizer.RESP_ID, ord("h"), ord("i")]
        self.assertEqual(tok.decode_response(ids), "hi")


class CollateTests(unittest.TestCase):
    def test_collate_pads_and_masks_instruction(self) -> None:
        tok = InstructionTokenizer()
        ids1, rs1 = tok.encode_pair("ab", "cd", max_len=32)
        ids2, rs2 = tok.encode_pair("a", "bcdefg", max_len=32)
        input_ids, labels, _attn_mask = sft_collate([(ids1, rs1), (ids2, rs2)])
        # 同じ長さに padding されます。
        self.assertEqual(input_ids.shape, labels.shape)
        self.assertEqual(input_ids.shape[0], 2)
        # row 0 の instruction region は labels で -100 である必要があります。
        for i in range(rs1):
            self.assertEqual(int(labels[0, i].item()), InstructionTokenizer.IGNORE_INDEX)
        # row 0 の response region は token ids を保持します（その positions の input_ids と同じ）。
        for i in range(rs1, len(ids1)):
            self.assertEqual(int(labels[0, i].item()), ids1[i])

    def test_collate_pads_labels_to_ignore_index(self) -> None:
        tok = InstructionTokenizer()
        ids1, rs1 = tok.encode_pair("abc", "de", max_len=32)
        ids2, rs2 = tok.encode_pair("a", "bcdefghij", max_len=32)
        input_ids, labels, attn_mask = sft_collate([(ids1, rs1), (ids2, rs2)])
        max_t = input_ids.size(1)
        # 短い row の末尾 positions は pad で、labels では -100 である必要があります。
        for i in range(len(ids1), max_t):
            self.assertEqual(int(labels[0, i].item()), InstructionTokenizer.IGNORE_INDEX)
        # attn_mask では pad positions が0、real positions が1です。
        self.assertEqual(int(attn_mask[0, 0].item()), 1)
        self.assertEqual(int(attn_mask[0, -1].item()), 0)


class DatasetTests(unittest.TestCase):
    def test_make_dataset_returns_200_pairs(self) -> None:
        pairs, cats = make_dataset(seed=0)
        self.assertEqual(len(pairs), 200)
        self.assertEqual(len(cats), 200)
        for p in pairs:
            self.assertIn("instruction", p)
            self.assertIn("response", p)
        self.assertEqual(set(cats), {"capitals", "arithmetic", "lists", "summaries", "code", "definitions"})

    def test_split_is_stratified(self) -> None:
        pairs, cats = make_dataset(seed=0)
        tr, _tr_c, te, te_c = split_dataset(pairs, cats, test_frac=0.2, seed=0)
        self.assertEqual(len(tr) + len(te), 200)
        # 全 category が test split に現れます。
        self.assertEqual(set(te_c), set(cats))


class LossTests(unittest.TestCase):
    def test_ignore_index_zeros_loss_on_masked_positions(self) -> None:
        torch.manual_seed(0)
        V = 10
        logits = torch.randn(1, 4, V, requires_grad=True)
        labels = torch.tensor([[InstructionTokenizer.IGNORE_INDEX] * 4])
        loss = shifted_loss(logits, labels)
        # 全 target が masked: valid target なしの cross-entropy は nan を返します。
        # これは標準的な PyTorch の挙動です。ここでの契約は
        # function が例外を投げないことです。
        self.assertTrue(torch.isnan(loss) or loss.item() == 0.0)

    def test_loss_decreases_when_target_distribution_is_learnable(self) -> None:
        torch.manual_seed(0)
        V = 10
        logits = torch.zeros(1, 4, V, requires_grad=True)
        labels = torch.tensor([[InstructionTokenizer.IGNORE_INDEX, 3, 5, 7]])
        l0 = shifted_loss(logits, labels)
        # shifted formulation の target positions は labels[:, 1:] = [3, 5, 7] です。
        # それらの token で peak する logits を手で作り、loss が下がることを確認します。
        logits2 = torch.zeros(1, 4, V)
        # logits at position i predict labels[i+1]; positions used for the loss are 0,1,2.
        logits2[0, 0, 3] = 10.0
        logits2[0, 1, 5] = 10.0
        logits2[0, 2, 7] = 10.0
        l1 = shifted_loss(logits2, labels)
        self.assertLess(l1.item(), l0.item())


class MetricTests(unittest.TestCase):
    def test_normalise_collapses_whitespace_and_case(self) -> None:
        self.assertEqual(normalise("  Hello   WORLD  "), "hello world")

    def test_exact_match_is_strict(self) -> None:
        self.assertEqual(exact_match("パリ", "paris"), 1)
        self.assertEqual(exact_match("パリ.", "パリ"), 0)


class GenerateTests(unittest.TestCase):
    def test_generation_respects_max_new_tokens(self) -> None:
        cfg = SFTConfig(hidden=32, heads=2, depth=1, max_len=24)
        tok = InstructionTokenizer()
        model = build_model(cfg)
        out = generate(model, tok, "Hi.", max_len=cfg.max_len, max_new_tokens=4)
        self.assertIsInstance(out, str)
        # 最大 max_new_tokens bytes（function はもっと早く止まる場合があります）。
        self.assertLessEqual(len(out.encode("utf-8")), 4)

    def test_temperature_zero_is_deterministic(self) -> None:
        cfg = SFTConfig(hidden=32, heads=2, depth=1, max_len=24, seed=1)
        tok = InstructionTokenizer()
        model = build_model(cfg)
        a = generate(model, tok, "Hi.", max_len=cfg.max_len, max_new_tokens=8, temperature=0.0)
        b = generate(model, tok, "Hi.", max_len=cfg.max_len, max_new_tokens=8, temperature=0.0)
        self.assertEqual(a, b)


class TrainingTests(unittest.TestCase):
    def test_train_sft_returns_loss_history_per_epoch(self) -> None:
        cfg = SFTConfig(hidden=32, heads=2, depth=1, max_len=48, batch_size=8, epochs=2)
        tok = InstructionTokenizer()
        pairs, cats = make_dataset(seed=cfg.seed)
        tr, _, _, _ = split_dataset(pairs, cats, test_frac=0.5, seed=cfg.seed)
        ds = SFTDataset(tr[:16], tok, cfg.max_len)
        dl = DataLoader(ds, batch_size=cfg.batch_size, shuffle=False, collate_fn=sft_collate)
        model = build_model(cfg)
        report = train_sft(model, dl, cfg, eval_every=10, log=lambda s: None)
        self.assertEqual(len(report.losses), cfg.epochs)
        self.assertLessEqual(report.losses[-1], report.losses[0] + 1.0)


if __name__ == "__main__":
    unittest.main()
