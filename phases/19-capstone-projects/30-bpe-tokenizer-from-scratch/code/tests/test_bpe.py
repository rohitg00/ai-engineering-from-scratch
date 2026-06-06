"""Tests for the byte-level BPE tokenizer."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    BPETokenizer,
    BYTE_ALPHABET_SIZE,
    DEFAULT_SPECIALS,
    decode,
    encode,
    load,
    save,
    train,
)


SMALL_CORPUS = (
    "the quick brown fox\n"
    "the quick brown dog\n"
    "the slow brown fox\n"
    "the lazy brown dog\n"
) * 20


class TestInitialization(unittest.TestCase):
    def test_byte_alphabet_reserved(self) -> None:
        t = BPETokenizer()
        t.initialize(DEFAULT_SPECIALS)
        self.assertEqual(len(t.vocab), BYTE_ALPHABET_SIZE + len(DEFAULT_SPECIALS))
        for i in range(BYTE_ALPHABET_SIZE):
            self.assertEqual(t.vocab[i], bytes([i]))

    def test_specials_assigned_above_byte_block(self) -> None:
        t = BPETokenizer()
        t.initialize(DEFAULT_SPECIALS)
        for token_id in t.special_to_id.values():
            self.assertGreaterEqual(token_id, BYTE_ALPHABET_SIZE)

    def test_initialize_is_idempotent(self) -> None:
        t = BPETokenizer()
        t.initialize(DEFAULT_SPECIALS)
        size_before = t.vocab_size
        t.initialize(DEFAULT_SPECIALS)
        self.assertEqual(t.vocab_size, size_before)


class TestTraining(unittest.TestCase):
    def test_training_grows_vocab(self) -> None:
        t = BPETokenizer()
        train(t, SMALL_CORPUS, target_vocab_size=BYTE_ALPHABET_SIZE + 20)
        self.assertGreater(t.vocab_size, BYTE_ALPHABET_SIZE + len(DEFAULT_SPECIALS))
        self.assertLessEqual(t.vocab_size, BYTE_ALPHABET_SIZE + 20)
        self.assertGreater(len(t.merges), 0)

    def test_training_is_deterministic(self) -> None:
        t1 = BPETokenizer()
        train(t1, SMALL_CORPUS, target_vocab_size=BYTE_ALPHABET_SIZE + 15)
        t2 = BPETokenizer()
        train(t2, SMALL_CORPUS, target_vocab_size=BYTE_ALPHABET_SIZE + 15)
        self.assertEqual(list(t1.merges.items()), list(t2.merges.items()))

    def test_first_merge_is_a_frequent_pair(self) -> None:
        t = BPETokenizer()
        train(t, SMALL_CORPUS, target_vocab_size=BYTE_ALPHABET_SIZE + 5)
        first_pair = next(iter(t.merges.keys()))
        left = t.vocab[first_pair[0]]
        right = t.vocab[first_pair[1]]
        merged_bytes = left + right
        self.assertIn(merged_bytes, SMALL_CORPUS.encode("utf-8"))


class TestRoundTrip(unittest.TestCase):
    def _trained(self) -> BPETokenizer:
        t = BPETokenizer()
        train(t, SMALL_CORPUS, target_vocab_size=BYTE_ALPHABET_SIZE + 40)
        return t

    def test_ascii_round_trip(self) -> None:
        t = self._trained()
        text = "the quick brown fox is not the slow brown dog"
        ids = encode(t, text)
        self.assertEqual(decode(t, ids), text)

    def test_unicode_round_trip(self) -> None:
        t = self._trained()
        text = "the fox says hello to the dog at 7pm"
        ids = encode(t, text)
        self.assertEqual(decode(t, ids), text)

    def test_empty_string_round_trip(self) -> None:
        t = self._trained()
        ids = encode(t, "")
        self.assertEqual(ids, [])
        self.assertEqual(decode(t, ids), "")

    def test_unseen_word_falls_back_to_bytes(self) -> None:
        t = self._trained()
        text = "zxqv"
        ids = encode(t, text)
        self.assertEqual(decode(t, ids), text)


class TestCompression(unittest.TestCase):
    def test_encoded_length_at_most_byte_length(self) -> None:
        t = BPETokenizer()
        train(t, SMALL_CORPUS, target_vocab_size=BYTE_ALPHABET_SIZE + 40)
        text = "the quick brown fox jumps over the lazy dog"
        ids = encode(t, text)
        self.assertLessEqual(len(ids), len(text.encode("utf-8")))

    def test_larger_vocab_compresses_more(self) -> None:
        text = "the quick brown fox jumps over the lazy brown dog"
        small = BPETokenizer()
        train(small, SMALL_CORPUS, target_vocab_size=BYTE_ALPHABET_SIZE + 8)
        large = BPETokenizer()
        train(large, SMALL_CORPUS, target_vocab_size=BYTE_ALPHABET_SIZE + 60)
        self.assertLessEqual(len(encode(large, text)), len(encode(small, text)))


class TestSpecialTokens(unittest.TestCase):
    def test_special_tokens_get_dedicated_ids(self) -> None:
        t = BPETokenizer()
        train(t, SMALL_CORPUS, target_vocab_size=BYTE_ALPHABET_SIZE + 20)
        for s in DEFAULT_SPECIALS:
            self.assertIn(s, t.special_to_id)
            token_id = t.special_to_id[s]
            self.assertIn(token_id, t.id_to_special)

    def test_special_token_emitted_only_when_allowed(self) -> None:
        t = BPETokenizer()
        train(t, SMALL_CORPUS, target_vocab_size=BYTE_ALPHABET_SIZE + 20)
        eot = t.special_to_id["<|endoftext|>"]
        text = "doc one<|endoftext|>doc two"

        ids_off = encode(t, text, allow_special=False)
        self.assertNotIn(eot, ids_off)

        ids_on = encode(t, text, allow_special=True)
        self.assertIn(eot, ids_on)
        self.assertEqual(decode(t, ids_on), text)

    def test_special_token_does_not_split_inside_word(self) -> None:
        t = BPETokenizer()
        train(t, SMALL_CORPUS, target_vocab_size=BYTE_ALPHABET_SIZE + 20)
        text = "foo bar"
        ids = encode(t, text, allow_special=True)
        self.assertNotIn(t.special_to_id["<|endoftext|>"], ids)


class TestPersistence(unittest.TestCase):
    def test_save_and_load_round_trip(self) -> None:
        t = BPETokenizer()
        train(t, SMALL_CORPUS, target_vocab_size=BYTE_ALPHABET_SIZE + 12)
        text = "the brown fox"
        ids_before = encode(t, text)

        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "tok.json")
            save(t, path)
            t2 = load(path)

        self.assertEqual(t.vocab, t2.vocab)
        self.assertEqual(t.merges, t2.merges)
        self.assertEqual(t.special_to_id, t2.special_to_id)
        ids_after = encode(t2, text)
        self.assertEqual(ids_before, ids_after)
        self.assertEqual(decode(t2, ids_after), text)


if __name__ == "__main__":
    unittest.main()
