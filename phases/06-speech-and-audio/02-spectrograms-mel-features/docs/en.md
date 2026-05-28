# スペクトログラム、Mel スケール、音声特徴量

> ニューラルネットは生波形をうまく直接消費できません。スペクトログラムを消費します。Mel スペクトログラムならさらにうまく扱えます。2026 年のあらゆる ASR、TTS、音声分類器は、この 1 つの前処理選択に成否を左右されます。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 6 · 01 (Audio Fundamentals)
**所要時間:** 約45分

## 問題

10 秒、16 kHz のクリップを考えます。これは `[-1, 1]` に収まる 160,000 個の float であり、ラベル "dog barking" や "the word cat" とはほぼ完全に相関していません。生波形には情報がありますが、モデルが簡単に取り出せる形ではありません。100 ms 離れて発話された同一音素は、生サンプルとしてはまったく違う値になります。

スペクトログラムはこれを直します。人間の知覚が無視する時間的な細部 (マイクロ秒単位の揺らぎ) を畳み込み、知覚が注目する構造 (どの周波数に、約 10–25 ms の時間窓でどれだけエネルギーがあるか) を保ちます。

Mel スペクトログラムはさらに進みます。人間はピッチを対数的に知覚します。100 Hz と 200 Hz の差は、1000 Hz と 2000 Hz の差と「同じ距離」に聞こえます。Mel スケールはこの知覚に合わせて周波数軸を歪ませます。Mel スケールのスペクトログラムは、2010 年から 2026 年までの音声 ML で最も重要な特徴量です。

## 概念

![波形から STFT、Mel スペクトログラム、MFCC への段階](../assets/mel-features.svg)

**STFT (Short-Time Fourier Transform)。** 波形を重なり合うフレームに切ります (典型例: 25 ms 窓、10 ms hop = 16 kHz で 400 samples / 160 samples)。各フレームに窓関数を掛けます (Hann がデフォルト、Hamming は少し違うトレードオフ)。各フレームを FFT します。大きさスペクトルを積み重ねて shape `(n_frames, n_freq_bins)` の行列にします。これがスペクトログラムです。

**対数振幅。** 生の大きさは 5-6 桁にわたります。`log(|X| + 1e-6)` または `20 * log10(|X|)` を取ってダイナミックレンジを圧縮します。本番パイプラインはすべて、生の大きさではなく log-magnitude を使います。

**Mel スケール。** Hz 単位の周波数 `f` は `m = 2595 * log10(1 + f / 700)` で Mel `m` に写像されます。この写像は 1 kHz 未満ではおおむね線形、1 kHz より上ではおおむね対数的です。0–8 kHz を覆う 80 個の Mel ビンが ASR 入力の標準です。

**Mel フィルタバンク。** Mel スケール上で等間隔に並んだ三角フィルタの集合です。各フィルタは隣接する FFT ビンの重み付き和です。STFT の大きさにフィルタバンク行列を掛けると、1 回の matmul で Mel スペクトログラムが得られます。

**Log-mel スペクトログラム。** `log(mel_spec + 1e-10)`。Whisper の入力。Parakeet の入力。SeamlessM4T の入力。2026 年における汎用オーディオフロントエンドです。

**MFCC。** Log-mel スペクトログラムに DCT (type II) を適用し、最初の 13 係数を残します。特徴量を非相関化し、さらに圧縮します。生の log-mels 上の CNN/Transformer が追いつく 2015 年頃までは支配的な特徴量でした。今でも話者認識 (x-vectors, ECAPA) で使われます。

**解像度のトレードオフ。** FFT を大きくすると周波数解像度は上がりますが、時間解像度は下がります。25 ms / 10 ms は音声 ML のデフォルトです。音楽では 50 ms / 12.5 ms、過渡検出 (ドラムヒット、破裂音) では 5 ms / 2 ms を使います。

## 作る

### 手順 1: 波形をフレーム化する

```python
def frame(signal, frame_len, hop):
    n = 1 + (len(signal) - frame_len) // hop
    return [signal[i * hop : i * hop + frame_len] for i in range(n)]
```

`frame_len=400, hop=160` のとき、10 秒 16 kHz のクリップは 998 フレームになります。

### 手順 2: Hann 窓

```python
import math

def hann(N):
    return [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]
```

FFT の前に要素ごとに掛けます。ゼロでない端点で切り詰めることによるスペクトル漏れを取り除きます。

### 手順 3: STFT の大きさ

```python
def stft_magnitude(signal, frame_len=400, hop=160):
    win = hann(frame_len)
    frames = frame(signal, frame_len, hop)
    return [magnitudes(dft([w * s for w, s in zip(win, f)])) for f in frames]
```

本番では `torch.stft` または `librosa.stft` を使います (FFT ベースでベクトル化済み)。ここでのループは教育用で、`code/main.py` の短いクリップでは動きます。

### 手順 4: Mel フィルタバンク

```python
def hz_to_mel(f):
    return 2595.0 * math.log10(1.0 + f / 700.0)

def mel_to_hz(m):
    return 700.0 * (10 ** (m / 2595.0) - 1)

def mel_filterbank(n_mels, n_fft, sr, fmin=0, fmax=None):
    fmax = fmax or sr / 2
    mels = [hz_to_mel(fmin) + (hz_to_mel(fmax) - hz_to_mel(fmin)) * i / (n_mels + 1)
            for i in range(n_mels + 2)]
    hzs = [mel_to_hz(m) for m in mels]
    bins = [int(h * n_fft / sr) for h in hzs]
    fb = [[0.0] * (n_fft // 2 + 1) for _ in range(n_mels)]
    for m in range(n_mels):
        for k in range(bins[m], bins[m + 1]):
            fb[m][k] = (k - bins[m]) / max(1, bins[m + 1] - bins[m])
        for k in range(bins[m + 1], bins[m + 2]):
            fb[m][k] = (bins[m + 2] - k) / max(1, bins[m + 2] - bins[m + 1])
    return fb
```

`n_fft=400` で 0–8 kHz を覆う 80 mels は `(80, 201)` 行列になります。`(n_frames, 201)` の STFT 大きさにその転置を掛けると、`(n_frames, 80)` の Mel スペクトログラムが得られます。

### 手順 5: log-mel

```python
def log_mel(mel_spec, eps=1e-10):
    return [[math.log(max(v, eps)) for v in frame] for frame in mel_spec]
```

一般的な代替は `librosa.power_to_db` (参照で正規化された dB)、`10 * log10(power + eps)` です。Whisper はより複雑な clip + normalize ルーチンを使います (Whisper の `log_mel_spectrogram` を参照)。

### 手順 6: MFCC

```python
def dct_ii(x, n_coeffs):
    N = len(x)
    return [
        sum(x[n] * math.cos(math.pi * k * (2 * n + 1) / (2 * N)) for n in range(N))
        for k in range(n_coeffs)
    ]
```

各 log-mel フレームに DCT を適用し、最初の 13 係数を残します。これが MFCC 行列です。最初の係数は通常は捨てます (全体エネルギーを符号化するため)。

## 使う

2026 年のスタック:

| タスク | 特徴量 |
|------|----------|
| ASR (Whisper, Parakeet, SeamlessM4T) | 80 log-mels, 10 ms hop, 25 ms window |
| TTS acoustic model (VITS, F5-TTS, Kokoro) | 80 mels, fine temporal control には 5–12 ms hop |
| Audio classification (AST, PANNs, BEATs) | 128 log-mels, 10 ms hop |
| Speaker embedding (ECAPA-TDNN, WavLM) | 80 log-mels または raw-waveform SSL |
| Music (MusicGen, Stable Audio 2) | EnCodec discrete tokens (mels ではない) |
| Keyword spotting | 小型デバイス向け 40 MFCCs |

経験則: **音楽を扱っていないなら、80 log-mels から始める**。そこから外れるなら、その妥当性を示す責任があります。

## 2026 年でも本番に紛れ込む落とし穴

- **Mel 数の不一致。** 学習は 80 mels、推論は 128 mels。静かに失敗します。両端で feature shape をログに出します。
- **上流のサンプルレート不一致。** 22.05 kHz で計算した mels は 16 kHz のものと違って見えます。特徴量化の *前* に SR を直します。
- **dB vs log。** Whisper が期待するのは log-mel であり、dB-mel ではありません。一部の HF pipeline は自動検出しますが、自作コードはしません。
- **正規化ドリフト。** 学習時は発話ごとの正規化、推論時はグローバル正規化。WER を倍にする本番バグです。
- **padding からの漏れ。** クリップ末尾のゼロパディングは、後続フレームに平坦なスペクトルを生みます。対称に pad するか replicate します。

## 出荷する

`outputs/skill-feature-extractor.md` として保存します。このスキルは、対象モデルに合わせて feature type、mel count、frame/hop、normalization を選びます。

## 演習

1. **Easy.** `code/main.py` を実行します。chirp (200 → 4000 Hz に周波数掃引) を合成し、フレームごとの argmax Mel ビンを出力します。プロットし (任意)、掃引と一致することを確認します。
2. **Medium.** `n_mels` を `{40, 80, 128}`、`frame_len` を `{200, 400, 800}` にして再実行します。時間軸に沿った sharp-peak bandwidth を測定します。どの組み合わせが chirp を最もよく分解しますか。
3. **Hard.** `power_to_db` を実装し、AudioMNIST 上の小さな CNN 分類器で ASR accuracy を比較します: (a) raw log-mel、(b) `ref=max` の dB-mel、(c) MFCC-13 + delta + delta-delta。top-1 accuracy を報告します。

## 重要用語

| 用語 | よく言われる説明 | 実際の意味 |
|------|-----------------|-----------------------|
| Frame | ひと切れ | 1 回の FFT に渡す 25 ms の波形チャンク。 |
| Hop | ストライド | 連続フレーム間のサンプル数。ASR のデフォルトは 10 ms。 |
| Window | Hann/Hamming のやつ | フレーム端をゼロへなだらかにする点ごとの乗数。 |
| STFT | スペクトログラム生成器 | フレーム化 + 窓掛け FFT。時間 × 周波数行列を出します。 |
| Mel | 歪めた周波数 | 対数知覚スケール。`m = 2595·log10(1 + f/700)`。 |
| Filterbank | 行列 | STFT を Mel ビンへ射影する三角フィルタ。 |
| Log-mel | Whisper の入力 | `log(mel_spec + eps)`。2026 年の標準形式。 |
| MFCC | 旧来の特徴量 | log-mel の DCT。13 係数、非相関化済み。 |

## 参考資料

- [Davis, Mermelstein (1980). Comparison of parametric representations for monosyllabic word recognition](https://ieeexplore.ieee.org/document/1163420) — MFCC の論文。
- [Stevens, Volkmann, Newman (1937). A Scale for the Measurement of the Psychological Magnitude Pitch](https://pubs.aip.org/asa/jasa/article-abstract/8/3/185/735757/) — 元の Mel スケール。
- [OpenAI — Whisper source, log_mel_spectrogram](https://github.com/openai/whisper/blob/main/whisper/audio.py) — リファレンス実装を読んでください。
- [librosa feature extraction docs](https://librosa.org/doc/main/feature.html) — `mfcc`、`melspectrogram`、hop/window の参照。
- [NVIDIA NeMo — audio preprocessing](https://docs.nvidia.com/deeplearning/nemo/user-guide/docs/en/main/asr/asr_all.html#featurizers) — Parakeet + Canary models 向けの本番規模パイプライン。
