# Voice Cloning と Voice Conversion

> Voice cloning は、誰か別の声であなたのテキストを読み上げます。Voice conversion は、話した内容を保ったまま、あなたの声を別の人の声に書き換えます。どちらも同じ分解に依存します。speaker identity と content を分離することです。

**種類:** Build
**言語:** Python
**前提:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 07 (TTS)
**時間:** 約 75 分

## 問題

2026 年には、5 秒の音声クリップだけで、consumer GPU 上でも誰の声でも高品質に clone できます。ElevenLabs、F5-TTS、OpenVoice v2、VoiceBox はすべて zero-shot または few-shot cloning を出荷しています。この技術は恩恵 (accessibility TTS、dubbing、assistive voices) であると同時に、武器 (scam calls、political deepfakes、IP theft) でもあります。

密接に関連する 2 つのタスクがあります。

- **Voice cloning (TTS-side):** text + 5-second reference voice → audio in that voice。
- **Voice conversion (speech-side):** source audio (person A saying X) + reference voice of person B → audio of B saying X。

どちらも waveform を (content, speaker, prosody) に分解し、ある source の content と別の source の speaker を再結合します。

2026 年に本番出荷する際の重要な制約は、**watermarking と consent gates が EU (AI Act、2026 年 8 月施行) および California (AB 2905、2025 年発効) で法的に必須** になっていることです。pipeline は inaudible watermark を出力し、consent のない clones を拒否しなければなりません。

## コンセプト

![Voice cloning vs conversion: factorize, swap speaker, recombine](../assets/voice-cloning.svg)

**Zero-shot cloning。** 数千人の話者で学習したモデルに 5 秒のクリップを渡します。speaker encoder が clip を speaker embedding に写像し、TTS decoder がその embedding と text に条件付けられます。

使用例: F5-TTS (2024)、YourTTS (2022)、XTTS v2 (2024)、OpenVoice v2 (2024)。

**Few-shot fine-tuning。** 対象 voice を 5-30 分録音します。base model を LoRA-fine-tune で 1 時間ほど調整します。品質は「まあまあ」から「区別不能」へ跳ね上がります。Coqui と ElevenLabs はどちらもこのパターンをサポートしており、コミュニティでは F5-TTS と組み合わせて使われます。

**Voice conversion (VC)。** 2 つの系統があります。

- **Recognition-synthesis。** ASR 風のモデルで content representation (例: soft phoneme posteriors、PPGs) を抽出し、target speaker embedding で再合成します。言語やアクセントに強いです。KNN-VC (2023)、Diff-HierVC (2023) で使われます。
- **Disentanglement。** bottleneck の latent space で content、speaker、prosody を分離する autoencoder を学習します。inference 時に speaker embedding を差し替えます。品質は低めですが高速です。AutoVC (2019)、VITS-VC variants で使われます。

**Neural codec-based cloning (2024+)。** VALL-E、VALL-E 2、NaturalSpeech 3、VoiceBox は、audio を SoundStream / EnCodec の discrete tokens として扱い、codec tokens 上の大規模 autoregressive または flow-matching model を学習します。短い prompts では ElevenLabs に匹敵する品質です。

### 倫理は後付けの付属品ではない

**Watermarking。** PerTh (Perth) と SilentCipher (2024) は、音声に知覚不能な約 16-32 bit ID を埋め込みます。re-encoding、streaming、一般的な編集に耐えます。本番利用可能な open source です。

**Consent gates。** cloned output はすべて、検証可能な consent record と紐付ける必要があります。"I, Rohit, on 2026-04-22, authorize this voice for X purpose." のような記録です。tamper-evident log に保存します。

**Detection。** AASIST、RawNet2、Wav2Vec2-AASIST が detectors として使われます。ASVspoof 2025 challenge では、ElevenLabs、VALL-E 2、Bark outputs に対する state-of-the-art detectors の EER が 0.8-2.3% と報告されました。

### 数値 (2026)

| Model | Zero-shot? | SECS (target sim) | WER (intel.) | Params |
|-------|-----------|--------------------|--------------|--------|
| F5-TTS | Yes | 0.72 | 2.1% | 335M |
| XTTS v2 | Yes | 0.65 | 3.5% | 470M |
| OpenVoice v2 | Yes | 0.70 | 2.8% | 220M |
| VALL-E 2 | Yes | 0.77 | 2.4% | 370M |
| VoiceBox | Yes | 0.78 | 2.1% | 330M |

SECS > 0.70 は、多くの聞き手にとって target とほぼ区別できない水準です。

## 作ってみる

### Step 1: recognition-synthesis で分解する (`main.py` 内の code-only demo)

```python
def clone_pipeline(ref_audio, text, target_embedder, tts_model):
    speaker_emb = target_embedder.encode(ref_audio)
    mel = tts_model(text, speaker=speaker_emb)
    return vocoder(mel)
```

概念は単純です。実装の大部分は `tts_model` と speaker encoder にあります。

### Step 2: F5-TTS で zero-shot clone する

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="rohit_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please add milk and bread to my list.",
)
```

Reference transcript は audio と完全に一致している必要があります。不一致があると alignment が壊れます。

### Step 3: KNN-VC で voice conversion する

```python
import torch
from knnvc import KNNVC  # 2023 model, https://github.com/bshall/knn-vc
vc = KNNVC.load("wavlm-base-plus")
out_wav = vc.convert(source="my_voice.wav", target_pool=["alice_1.wav", "alice_2.wav"])
```

KNN-VC は WavLM で source と target pool の per-frame embeddings を抽出し、source の各 frame を pool 内の nearest neighbor で置き換えます。Non-parametric で、1 分程度の target speech があれば動きます。

### Step 4: watermark を埋め込む

```python
from silentcipher import SilentCipher
sc = SilentCipher(model="2024-06-01")
payload = b"consent_id:abc123;ts:1745353200"
watermarked = sc.embed(wav, sr=24000, message=payload)
detected = sc.detect(watermarked, sr=24000)   # returns payload bytes
```

約 32 bits の payload で、MP3 re-encode や軽い noise の後でも検出できます。

### Step 5: consent gate

```python
def cloned_inference(text, ref_audio, consent_record):
    assert verify_signature(consent_record), "Signed consent required"
    assert consent_record["speaker_id"] == hash_speaker(ref_audio)
    wav = tts.infer(ref_file=ref_audio, gen_text=text)
    wav = watermark(wav, payload=consent_record["id"])
    return wav
```

## 使いどころ

2026 年のスタック:

| Situation | Pick |
|-----------|------|
| 5-sec zero-shot clone, open-source | F5-TTS or OpenVoice v2 |
| Commercial production cloning | ElevenLabs Instant Voice Clone v2.5 |
| Voice conversion (rewriting) | KNN-VC or Diff-HierVC |
| Many-speaker fine-tune | StyleTTS 2 + speaker adapter |
| Cross-lingual cloning | XTTS v2 or VALL-E X |
| Deepfake detection | Wav2Vec2-AASIST |

## 落とし穴

- **Reference transcript の不一致。** F5-TTS などは、punctuation を含めて reference text が reference audio と完全に一致している必要があります。
- **Reverberant reference。** 反響は clone を壊します。dry で close-mic に録音してください。
- **感情の不一致。** "cheerful" な training reference は、すべてを cheerful に clone します。reference emotion を target use に合わせてください。
- **Language leakage。** English speaker を clone して French を話させると、accent が残ることがよくあります。cross-lingual models (XTTS, VALL-E X) を使ってください。
- **Watermark がない。** 2026 年 8 月以降、EU では法的に出荷できません。

## 提出物

`outputs/skill-voice-cloner.md` として保存してください。consent gate + watermark + quality target を含む cloning または conversion pipeline を設計します。

## 演習

1. **Easy.** `code/main.py` を実行してください。2 人の "speakers" の間で speaker-embedding swap を行い、swap 前後の cosine を計算して示します。
2. **Medium.** OpenVoice v2 を使って自分の声を clone してください。reference と clone の SECS を測定します。Whisper 経由で CER も測定します。
3. **Hard.** SilentCipher watermark を 20 個の clones に適用し、128 kbps MP3 encode+decode を通してから payload を検出します。bit-accuracy を報告してください。

## 重要用語

| Term | よく言われる意味 | 実際の意味 |
|------|-----------------|------------|
| Zero-shot clone | 5 秒で十分 | Pretrained model + speaker embedding。training なし。 |
| PPG | Phonetic posteriorgram | language-agnostic content rep として使われる per-frame ASR posteriors。 |
| KNN-VC | Nearest-neighbor conversion | source の各 frame を target-pool の nearest frame で置き換える。 |
| Neural codec TTS | VALL-E style | EnCodec/SoundStream tokens 上の AR model。 |
| Watermark | 聞こえない署名 | audio に埋め込まれ、re-encode に耐える bits。 |
| SECS | Cloning fidelity | target と clone の speaker embeddings 間 cosine。 |
| AASIST | Deepfake detector | Anti-spoof model。synthesized speech を検出する。 |

## 参考資料

- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) - open-source SOTA zero-shot cloning。
- [Baevski et al. / Microsoft (2023). VALL-E](https://arxiv.org/abs/2301.02111) and [VALL-E 2 (2024)](https://arxiv.org/abs/2406.05370) - neural-codec TTS。
- [Qian et al. (2019). AutoVC](https://arxiv.org/abs/1905.05879) - disentanglement-based voice conversion。
- [Baas, Waubert de Puiseau, Kamper (2023). KNN-VC](https://arxiv.org/abs/2305.18975) - retrieval-based VC。
- [SilentCipher (2024) - Audio Watermarking](https://github.com/sony/silentcipher) - production-ready 32-bit audio watermark。
- [ASVspoof 2025 results](https://www.asvspoof.org/) - detector と synthesizer の arms race。2026 年更新。
