---
name: skill-concept-prompt-designer
description: Turn user utterances into well-formed SAM 3 concept prompts with splitting, disambiguation, and fallbacks
version: 1.0.0
phase: 4
lesson: 24
tags: [sam3, open-vocab, prompt-engineering, segmentation]
---

# Concept Prompt Designer

SAM 3 の accuracy は concept prompt の phrasing に大きく依存する。この skill は free-form user utterances を、SAM 3 が扱いやすい prompts に normalise する。

## 使う場面

- natural-language object queries を受け付ける UI を作るとき。
- upstream callers が sentences を送る API 経由で SAM 3 を expose するとき。
- SAM 3 の match が悪い原因を debug するとき。問題は model ではなく prompt の malformed であることが多い。

## 入力

- `utterance`: raw user string。
- `context`: optional domain hint (例: "surveillance", "medical", "retail")。
- `max_concepts`: utterance ごとに抽出する最大 concepts。default 5。

## SAM 3 が好むルール

- **Short noun phrases, not sentences.** `"there is a cat"` より `"cat"` が勝つ。
- **Concrete nouns.** `"thing to ride on"` より `"skateboard"` が勝つ。
- **Modifiers immediately before the noun.** `"car that is red"` より `"red car"` が勝つ。
- **Lowercase.** SAM 3 は robust だが、経験的には lowercase inputs がわずかに良い。
- **Singular or plural.** どちらも動く。multiple instances が期待される場合は plural が役立つ。

## 手順

1. **Tokenise by common separators** — comma、semicolon、"and"、"or"、"&"。
2. **Drop filler prefixes** — "find", "show me", "segment", "detect", "locate", "a", "an", "the"。
3. **Keep prepositional modifiers** は visual な場合だけにする。`"striped red umbrella"` は yes、`"umbrella from yesterday"` は no (`"from yesterday"` は in-image ではない)。
4. optional `context` を使って **Disambiguate collisions** する:
   - surveillance context の `"window"` -> `"building window"`。
   - medical context の `"window"` -> 多くの場合 error。user に clarification を促す。
5. splitting で concepts が 0 件になり、utterance に concrete noun が少なくとも 1 つ含まれる場合は exact string に **Fallback** する。concrete noun が抽出できない場合は concept を emit せず、warnings だけを返して user に clarification を求める (Rules 参照)。
6. **Cap at `max_concepts`.** caller が求める数より多く抽出された場合、utterance order の先頭 `max_concepts` を保持し、残りは reason `"exceeded max_concepts"` 付きで `dropped` に入れる。これにより user が長い列挙を貼り付けても latency が bounded になる。

## 出力形式

```
[designed prompts]
  utterance:    <original>
  concepts:     ["concept_1", "concept_2", ...]
  dropped:      ["filler_1", ...]
  warnings:     ["concept too abstract", "may match many classes", ...]

[sam3 calls]
  For each concept run: sam3.detect(image, concept)
  Merge outputs with distinct concept tags per detection.
```

## 例

```
in:  "can you find me a cat or two dogs?"
out: ["cat", "dogs"]
dropped: ["can you find me", "a", "or two", "?"]
note: "dogs" kept plural because the utterance says "two dogs" — plural hint preserved.

in:  "segment the big red truck and the blue sedan"
out: ["big red truck", "blue sedan"]
dropped: ["segment", "the", "and"]

in:  "thing near the door"
out: ["door"]
warnings: ["'thing' is too abstract for SAM 3; fell back to 'door'"]

in:  "striped red umbrella, green hat, pink balloon"
out: ["striped red umbrella", "green hat", "pink balloon"]
```

## ルール

- 8 words を超える sentences を SAM 3 に渡してはいけない。accuracy はそれ以上で落ちる。
- utterance に抽出可能な concrete nouns がない場合、SAM 3 を実行しない。warnings を返し、clarification を求める。
- quoted strings 内の punctuation で split してはいけない。quoted されている場合は `"black and white cat"` を 1 concept として preserve する。
- production debugging のため、original utterance と derived concepts を必ず log する。
