# Capstone Lesson 39: Supervised Fine-Tuning による Instruction Tuning

> base model は文章を続けられますが、指示に従う形式は知りません。SFT は instruction と望ましい response のペアで、response token だけを loss に数える学習です。

**種別:** Build
**言語:** Python (torch, numpy)
**前提条件:** Phase 19 lessons 30-37
**所要時間:** 約90分

## 学習目標
- instruction-response ペアを `<INST> ... <RESP> ...` 形式の causal sequence に整形する。
- instruction token と padding token を `ignore_index=-100` で mask する collate function を作る。
- tiny transformer を SFT objective で学習する。
- greedy と temperature sampling による generation を実装する。
- held-out exact-match を計算する。

## SFT の契約
各例は1本の sequence になります。

```text
<INST> フランスの首都は? <RESP> フランスの首都はパリです。
```

model は instruction も response も forward で見ますが、loss は response token だけにかかります。`F.cross_entropy(..., ignore_index=-100)` は target が `-100` の位置を loss と gradient から除外します。

## tokenization と padding
byte-level tokenizer は `INST_ID=256`、`RESP_ID=257`、`PAD_ID=258` を予約します。collate function は batch 内の最長長に padding し、next-token target を作ったうえで instruction、boundary、padding を `-100` にします。

## 評価
generation では `[INST] instruction [RESP]` を prefix として与え、response を生成します。exact-match は正規化した予測文字列と正解文字列を完全一致で比較します。言い換えには厳しい指標ですが、fixture のように答えが決定的な場面では分かりやすい評価です。

## 実装
`InstructionTokenizer`、`make_dataset`、`SFTDataset`、`sft_collate`、`TinyGPT`、`train_sft`、`generate`、`exact_match`、`run_demo` を実装します。mask がこのレッスンの中心です。
