# Whisper - アーキテクチャとファインチューニング

> Whisper は、30 秒ウィンドウの transformer encoder-decoder です。68 万時間の多言語・弱教師あり音声テキストペアで学習されました。1 つのアーキテクチャで複数タスクに対応し、99 言語で堅牢に動きます。2026 年の基準となる ASR です。

**種類:** Build
**言語:** Python
**前提:** Phase 6 · 04 (ASR), Phase 5 · 10 (Attention), Phase 7 · 05 (Full Transformer)
**時間:** 約 75 分

## 問題

OpenAI が 2022 年 9 月に公開した Whisper は、コモディティとして配布された最初の ASR モデルでした。音声を渡すとテキストが得られ、99 言語に対応し、ノイズに強く、ノート PC でも動きます。2024 年までに OpenAI は Large-v3 と Turbo 系を出荷しました。2026 年時点では、Whisper はポッドキャスト文字起こしから音声アシスタント、YouTube 字幕まで、あらゆる場面のデフォルト基準になっています。

しかし Whisper は、いつまでもブラックボックスとして扱えるパイプラインではありません。ドメインシフトは性能を大きく落とします。専門用語、話者のアクセント、固有名詞、短いクリップ、無音が典型例です。知っておくべきことは次の通りです。

1. 内部で実際に何が起きているか。
2. チャンク化、ストリーミング、長尺音声を正しく渡す方法。
3. いつ、どのようにファインチューニングするか。

## コンセプト

![Whisper encoder-decoder, tasks, chunked inference, fine-tune](../assets/whisper.svg)

**アーキテクチャ。** 標準的な transformer encoder-decoder です。

- 入力: 30 秒の log-mel spectrogram、80 mels、10 ms hop → 3000 frames。短いクリップはゼロパディングされ、長いクリップはチャンク化されます。
- Encoder: conv-downsample (stride 2) + `N` transformer blocks。Large-v3 では 32 layers、1280-dim、20 heads。
- Decoder: causal self-attn と encoder 出力への cross-attn を持つ `N` transformer blocks。encoder と同じサイズです。
- 出力: 51,865-token vocab 上の BPE tokens。

Large-v3 は 1.55B params です。Turbo は decoder を 32 層から 4 層に減らし、WER の悪化を 1% 未満に抑えながらレイテンシを 8 倍改善します。

**プロンプト形式。** Whisper は decoder prompt 内の special tokens で制御される multitask model です。

```
<|startoftranscript|><|en|><|transcribe|><|notimestamps|> Hello world.<|endoftext|>
```

- `<|en|>` - language tag。translation と transcription の挙動を制御します。
- `<|transcribe|>` または `<|translate|>` - 任意言語入力から英語出力へ翻訳するか、逐語的に文字起こしするかを指定します。
- `<|notimestamps|>` - word-level timestamps を省略します。高速です。

このプロンプトにより、1 つのモデルで多くのタスクを扱えます。`<|en|>` を `<|fr|>` に変えれば、フランス語を文字起こしします。

**30 秒ウィンドウ。** すべては 30 秒に固定されています。長いクリップはチャンク化が必要で、短いクリップはパディングされます。ウィンドウはネイティブにはストリーミングされません。これが WhisperX、Whisper-Streaming、faster-whisper が存在する理由です。

**Log-mel normalization。** `(log_mel - mean) / std` の形で、統計量は Whisper 自身の学習コーパスに由来します。`librosa.feature.melspectrogram` ではなく、Whisper の前処理 (`whisper.audio.log_mel_spectrogram`) を必ず使ってください。

### 2026 年のバリアント

| Variant | Params | Latency (A100) | WER (LibriSpeech-clean) |
|---------|--------|----------------|------------------------|
| Tiny | 39M | 1× realtime | 5.4% |
| Base | 74M | 1× | 4.1% |
| Small | 244M | 1× | 3.0% |
| Medium | 769M | 1× | 2.7% |
| Large-v3 | 1.55B | 2× | 1.8% |
| Large-v3-turbo | 809M | 8× | 1.58% |
| Whisper-Streaming (2024) | 1.55B | streaming | 2.0% |

### ファインチューニング

2026 年の標準的なワークフローは次の通りです。

1. 対象ドメインの音声と対応する transcript を 10-100 時間集めます。
2. `generate_with_loss` callback 付きで `transformers.Seq2SeqTrainer` を実行します。
3. パラメータ効率を高めるには、attention layers の `q_proj`, `k_proj`, `v_proj` に LoRA を入れます。GPU メモリを 4 分の 1 にし、WER コストは 0.3 未満に抑えられます。
4. データが 10 時間未満なら encoder を freeze します。decoder だけを調整します。
5. Whisper 自身の tokenizer と prompt format を使います。tokenizer は絶対に差し替えません。

コミュニティの結果では、医療ディクテーション 20 時間で Medium をファインチューニングすると、医療語彙で WER が 12% から 4.5% に下がりました。アイスランド語 4 時間で Turbo をファインチューニングすると、WER が 18% から 6% に下がりました。

## 作ってみる

### Step 1: Whisper をそのまま実行する

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe(
    "clip.wav",
    language="en",
    task="transcribe",
    temperature=0.0,
    condition_on_previous_text=False,  # prevents runaway repetition
)
print(result["text"])
for seg in result["segments"]:
    print(f"[{seg['start']:.2f}–{seg['end']:.2f}] {seg['text']}")
```

必ず上書きすべき重要なデフォルトは、`temperature=0.0` (sampling は 0.0 → 0.2 → 0.4 … の fallback chain がデフォルト)、`condition_on_previous_text=False` (連鎖的な hallucination を防ぐ)、`no_speech_threshold=0.6` (無音検出) です。

### Step 2: チャンク化した長尺処理

```python
# whisperx is the 2026 reference for long-form with word-level timestamps
import whisperx
model = whisperx.load_model("large-v3-turbo", device="cuda", compute_type="float16")
segments = model.transcribe("1hour.mp3", batch_size=16, chunk_size=30)
```

WhisperX は、(1) Silero VAD gating、(2) wav2vec 2.0 による word-level alignment、(3) `pyannote.audio` による diarization を追加します。2026 年の本番 transcription で使われる実用的な定番です。

### Step 3: LoRA でファインチューニングする

```python
from transformers import WhisperForConditionalGeneration, WhisperProcessor
from peft import LoraConfig, get_peft_model

model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-large-v3-turbo")
lora = LoraConfig(
    r=16, lora_alpha=32, target_modules=["q_proj", "v_proj"],
    lora_dropout=0.1, bias="none", task_type="SEQ_2_SEQ_LM",
)
model = get_peft_model(model, lora)
# model.print_trainable_parameters()  -> ~3M trainable / 809M total
```

あとは標準的な Trainer loop です。1000 steps ごとに checkpoint を保存します。held-out データの WER で評価します。

### Step 4: 各層が何を学ぶかを調べる

```python
# Grab cross-attention weights during decode to see what the decoder attends to.
with torch.inference_mode():
    out = model.generate(
        input_features=features,
        return_dict_in_generate=True,
        output_attentions=True,
    )
# out.cross_attentions: layer × head × step × src_len
```

heatmap で可視化すると、decoder steps が encoder frames を走査するにつれて斜めの alignment が見えます。この斜め線が Whisper における word timestamps の考え方です。

## 使いどころ

2026 年のスタック:

| Situation | Pick |
|-----------|------|
| General English, offline | Large-v3-turbo via `whisperx` |
| Mobile / edge | Whisper-Tiny quantized (int8) or Moonshine |
| Multilingual long-form | Large-v3 via `whisperx` + diarization |
| Low-resource language | Fine-tune Medium or Turbo with LoRA |
| Streaming (2 s latency) | Whisper-Streaming or Parakeet-TDT |
| Word-level timestamps | WhisperX (forced alignment via wav2vec 2.0) |

`faster-whisper` (CTranslate2 backend) は 2026 年時点で最速の CPU+GPU inference runtime です。vanilla より 4 倍速く、出力は同一です。

## 2026 年でも出荷されがちな落とし穴

- **無音で hallucinated text が出る。** Whisper は captions で学習しているため、"Thanks for watching!", "Subscribe!", song lyrics のような文を出すことがあります。呼び出す前に必ず VAD-gate します。
- **`condition_on_previous_text` の連鎖。** 1 つの hallucination が後続ウィンドウを汚染します。チャンク間の流暢さが必要でない限り `False` にします。
- **短いクリップのパディング。** 2 秒のクリップを 30 秒にパディングすると、末尾の無音で hallucination が起きることがあります。`pad=False` または VAD-gate を使います。
- **誤った mel 統計量。** Whisper のものではなく librosa の mels を使うと、ほぼランダムな出力になります。`whisper.audio.log_mel_spectrogram` を使ってください。

## 提出物

`outputs/skill-whisper-tuner.md` として保存してください。特定ドメイン向けの Whisper fine-tune または inference pipeline を設計します。

## 演習

1. **Easy.** `code/main.py` を実行してください。Whisper 形式の prompt を token 化し、decode の shape budget を計算し、10 分クリップの chunk schedule を出力します。
2. **Medium.** `faster-whisper` をインストールし、10 分の podcast を文字起こしして、人手 transcript と WER を比較してください。`language="auto"` と強制 `language="en"` を試します。
3. **Hard.** HF `datasets` を使い、Whisper が苦手な言語 (例: Urdu) を選び、2 時間分のデータで Medium を LoRA により 2 epochs ファインチューニングし、WER delta を報告してください。

## 重要用語

| Term | よく言われる意味 | 実際の意味 |
|------|-----------------|------------|
| 30-sec window | Whisper の制限 | 硬い入力上限。長い音声は chunk する。 |
| SOT | Start-of-transcript | `<\|startoftranscript\|>` が decoder prompt を開始する。 |
| Timestamps token | 時間 alignment | 0.02 s ごとの offset が 51k vocab 内の special token になっている。 |
| Turbo | 高速バリアント | decoder 4 層、8 倍高速、WER 回帰は 1% 未満。 |
| WhisperX | 長尺用 wrapper | VAD + Whisper + wav2vec alignment + diarization。 |
| LoRA fine-tune | 効率的な調整 | attention に low-rank adapter を追加し、params の約 0.3% を学習する。 |
| Hallucination | 無音時の失敗 | Whisper がノイズや無音から流暢な英語を生成する。 |

## 参考資料

- [Radford et al. (2022). Whisper paper](https://arxiv.org/abs/2212.04356) - 元の architecture と training recipe。
- [OpenAI (2024). Whisper Large-v3-turbo release](https://github.com/openai/whisper/discussions/2363) - 4-layer decoder、8 倍の高速化。
- [Bain et al. (2023). WhisperX](https://arxiv.org/abs/2303.00747) - 長尺、word-aligned、diarized。
- [Systran - faster-whisper repo](https://github.com/SYSTRAN/faster-whisper) - CTranslate2 backed、4 倍高速。
- [HuggingFace - Whisper fine-tune tutorial](https://huggingface.co/blog/fine-tune-whisper) - 標準的な LoRA / full-FT walkthrough。
