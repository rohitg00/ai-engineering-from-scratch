# Audio-Language Models — Qwen2.5-Omni、Audio Flamingo、GPT-4o Audio

> 2026年の audio-language model は、音声、環境音、音楽を横断して推論します。Qwen2.5-Omni-7B は MMAU-Pro で GPT-4o Audio に並びます。Audio Flamingo Next は LongAudioBench で Gemini 2.5 Pro を上回ります。オープンとクローズドの差は実質的に閉じています。ただし multi-audio task では例外で、どのモデルもほぼランダムに近い状態です。

**種別:** 学習
**言語:** Python
**前提条件:** Phase 6 · 04 (ASR), Phase 12 · 03 (Vision-Language Models), Phase 7 · 10 (Audio Transformers)
**所要時間:** 約45分

## 問題

5秒の音声があります。犬が吠え、誰かが "stop!" と叫び、その後に沈黙します。有用な質問は複数の軸にまたがります。

- **文字起こし。** "What was said?" — ASR の領域です。
- **意味推論。** "Is the person in danger?" — 吠え声、叫び声、沈黙をまとめて理解する必要があります。
- **音楽推論。** "What instruments play the melody?"
- **長時間音声検索。** "Where in this 90-minute lecture did the instructor explain gradient descent?"

これらすべてに1つのプロンプトで答える単一モデルが **audio-language model**（LALM / ALM）です。純粋な ASR とは別物です。LALM は文字起こしだけでなく、自由形式の自然言語回答を生成します。

## コンセプト

![Audio-language model: audio encoder + projector + LLM decoder](../assets/alm-architecture.svg)

### 3コンポーネントのテンプレート

2026年の LALM はすべて同じ骨格を持っています。

1. **Audio encoder。** Whisper encoder · BEATs · CLAP · WavLM · またはモデルごとの custom encoder。
2. **Projector。** audio-encoder features を LLM の token embedding space へ橋渡しする Linear または MLP。
3. **LLM。** Llama / Qwen / Gemma ベースの decoder。インターリーブされた text + audio tokens を受け取り、テキストを生成します。

学習:

- **Stage 1。** encoder + LLM を freeze し、ASR / captioning data で projector だけを学習します。
- **Stage 2。** instruction-following audio tasks（QA、推論、音楽理解）で full / LoRA fine-tune します。
- **Stage 3（任意）。** voice-in / voice-out では speech decoder を追加します。Qwen2.5-Omni と AF3-Chat はこれを行います。

### 2026年のモデルマップ

| Model | Backbone | Audio encoder | Output modality | Access |
|-------|----------|---------------|-----------------|--------|
| Qwen2.5-Omni-7B | Qwen2.5-7B | Custom + Whisper | text + speech | Apache-2.0 |
| Qwen3-Omni | Qwen3 | Custom | text + speech | Apache-2.0 |
| Audio Flamingo 3 | Qwen2 | AF-CLAP | text | NVIDIA non-commercial |
| Audio Flamingo Next | Qwen2 | AF-CLAP v2 | text | NVIDIA non-commercial |
| SALMONN | Vicuna | Whisper + BEATs | text | Apache-2.0 |
| LTU / LTU-AS | Llama | CAV-MAE | text | Apache-2.0 |
| GAMA | Llama | AST + Q-Former | text | Apache-2.0 |
| Gemini 2.5 Flash/Pro (closed) | Gemini | proprietary | text + speech | API |
| GPT-4o Audio (closed) | GPT-4o | proprietary | text + speech | API |

### ベンチマークの現実確認（2026）

**MMAU-Pro。** speech / sound / music / mixed をカバーする 1800 QA pairs。multi-audio subset も含まれます。

| Model | Overall | Speech | Sound | Music | Multi-audio |
|-------|---------|--------|-------|-------|-------------|
| Gemini 2.5 Pro | ~60% | 73.4% | 51.9% | 64.9% | ~22% |
| Gemini 2.5 Flash | ~57% | 73.4% | 50.5% | 64.9% | 21.2% |
| GPT-4o Audio | 52.5% | — | — | — | 26.5% |
| Qwen2.5-Omni-7B | 52.2% | 57.4% | 47.6% | 61.5% | ~20% |
| Audio Flamingo 3 | ~54% | — | — | — | — |
| Audio Flamingo Next | SOTA on LongAudioBench | — | — | — | — |

**multi-audio 列は全モデルにとって厳しい結果です。** 4択のランダム正答率は 25% で、多くのモデルはその周辺です。LALM はまだ2つのクリップを比較するのに苦戦しています。

### 2026年に LALM が役立つ場所

- **コールセンター録音のコンプライアンス監査。** "Did the agent mention the required disclosure?"
- **アクセシビリティ。** ろうユーザーに音イベントを説明する（文字起こしだけではない）。
- **コンテンツモデレーション。** 暴力的な言葉 + 威圧的な声色 + 背景文脈を検出する。
- **ポッドキャスト / 会議のチャプター化。** 話者ターンだけでなく意味的な要約を作る。
- **音楽カタログ分析。** "Find all tracks with a B-section key change."

### まだ役に立たない場所

- 細かな音楽理論（コードレベル未満）。
- 長い会話に対する話者帰属付き推論（10分を超えると劣化します）。
- multi-audio comparison（22-26% はランダムをわずかに上回る程度です）。
- real-time streaming reasoning（多くは offline batch inference です）。

## 作ってみる

### Step 1: Qwen2.5-Omni に問い合わせる

```python
from transformers import AutoModelForCausalLM, AutoProcessor

processor = AutoProcessor.from_pretrained("Qwen/Qwen2.5-Omni-7B")
model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-Omni-7B", torch_dtype="auto")

audio, sr = load_wav("clip.wav", sr=16000)
messages = [{
    "role": "user",
    "content": [
        {"type": "audio", "audio": audio},
        {"type": "text", "text": "What sounds do you hear, and what's happening?"},
    ],
}]
inputs = processor.apply_chat_template(messages, tokenize=True, return_tensors="pt")
output = model.generate(**inputs, max_new_tokens=200)
print(processor.decode(output[0], skip_special_tokens=True))
```

### Step 2: projector pattern

```python
import torch.nn as nn

class AudioProjector(nn.Module):
    def __init__(self, audio_dim=1280, llm_dim=4096):
        super().__init__()
        self.down = nn.Linear(audio_dim, llm_dim)
        self.act = nn.GELU()
        self.up = nn.Linear(llm_dim, llm_dim)

    def forward(self, audio_features):
        return self.up(self.act(self.down(audio_features)))
```

これだけです。projector は通常 1-3 個の linear layer です。ASR ペア（audio → transcript）でこれを学習するのが Stage-1 pretext task です。

### Step 3: MMAU / LongAudioBench のベンチマーク

```python
from datasets import load_dataset
mmau = load_dataset("MMAU/MMAU-Pro")

correct = 0
for item in mmau["test"]:
    answer = call_model(item["audio"], item["question"], item["choices"])
    if answer == item["correct_choice"]:
        correct += 1
print(f"Accuracy: {correct / len(mmau['test']):.3f}")
```

カテゴリ別（speech / sound / music / multi-audio）に分けて報告します。集計値だけでは、モデルがどこで失敗しているかが隠れます。

## 使いどころ

| Task | 2026 pick |
|------|-----------|
| Free-form audio QA (open) | Qwen2.5-Omni-7B |
| Best open on long audio | Audio Flamingo Next |
| Best closed | Gemini 2.5 Pro |
| Voice-in / voice-out agent | Qwen2.5-Omni or GPT-4o Audio |
| Music reasoning | Audio Flamingo 3 or 2 (music-specialized AF-CLAP) |
| Call-center audit | Gemini 2.5 Pro via API, with RAG over your policy docs |

## 落とし穴

- **multi-audio での過信。** タスクが "which clip has X" を必要とするなら、ランダム正答率レベルの性能は現実です。
- **長時間音声の劣化。** 10分を超えると、多くのモデルで話者帰属が壊れます。先に diarize（Lesson 6）してから要約します。
- **沈黙でのハルシネーション。** Whisper encoder を使う LALM が継承する、Whisper 風の同じ問題です。VAD-gate します。
- **ベンチマークの cherry-picking。** ベンダーブログは最高に見えるカテゴリを強調します。MMAU-Pro multi-audio subset を自分で実行してください。

## 出荷する

`outputs/skill-alm-picker.md` として保存します。与えられた音声理解タスクに対して、LALM + benchmark subset + output-modality（text vs speech）を選びます。

## 演習

1. **Easy。** `code/main.py` を実行し、toy projector pattern + fake LALM routing の (audio-embedding, text-tokens) → output tokens を確認します。
2. **Medium。** Qwen2.5-Omni-7B を MMAU-Pro speech items 100件で採点します。論文の報告値と比較します。
3. **Hard。** 最小の audio-captioning baseline を作ります。BEATs encoder + 2-layer projector + frozen Llama-3.2-1B。AudioCaps で projector だけを fine-tune します。Clotho-AQA で SALMONN と比較します。

## 重要用語

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LALM | Audio ChatGPT | Audio encoder + projector + LLM decoder。 |
| Projector | Adapter | audio features を LLM embedding space に写像する小さな MLP。 |
| MMAU | The benchmark | speech、sound、music にまたがる 10k audio-QA pairs。 |
| MMAU-Pro | Harder MMAU | 1800件の multi-audio / reasoning-heavy questions。 |
| LongAudioBench | Long-form eval | semantic query を伴う数分のクリップ。 |
| Voice-in / voice-out | Speech-native | テキスト迂回なしで、モデルが音声を取り込み音声を出す。 |

## 参考資料

- [Chu et al. (2024). Qwen2-Audio](https://arxiv.org/abs/2407.10759) — 参照アーキテクチャ。
- [Alibaba (2025). Qwen2.5-Omni](https://huggingface.co/Qwen/Qwen2.5-Omni-7B) — speech-in-speech-out。
- [NVIDIA (2025). Audio Flamingo 3](https://arxiv.org/abs/2507.08128) — オープンな長時間音声リーダー。
- [NVIDIA (2026). Audio Flamingo Next](https://arxiv.org/abs/2604.10905) — LongAudioBench SOTA。
- [Tang et al. (2023). SALMONN](https://arxiv.org/abs/2310.13289) — dual-encoder の先駆け。
- [MMAU-Pro leaderboard](https://mmaubenchmark.github.io/) — 2026年のライブランキング。
