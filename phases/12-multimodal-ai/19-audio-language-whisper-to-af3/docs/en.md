# Audio-Language Models: the Whisper to Audio Flamingo 3 Arc

> Whisper (Radford et al., 2022年12月) は speech recognition を一段落させました。680k hours の weakly-supervised multilingual speech、単純な encoder-decoder transformer、そして以後の ASR release が必ず引用する benchmark です。しかし recognition は reasoning ではありません。「この録音に含まれる楽器は何か」「話者はどんな感情を表しているか」「3分時点で何が起きたか」と問うには、transcription ではなく audio understanding が必要です。Qwen-Audio、SALMONN、LTU、NVIDIA の Audio Flamingo 3 (AF3、2025年7月) は、この stack を段階的に作りました。Whisper-class encoders を保ち、Q-formers を接続し、audio-text instruction data で訓練し、chain-of-thought reasoning を加える流れです。この lesson ではその arc をたどります。

**種別:** 構築
**言語:** Python (stdlib, log-Mel spectrogram + audio Q-former skeleton)
**前提条件:** Phase 6 (Speech and Audio), Phase 12 · 03 (Q-Former)
**所要時間:** 約180分

## 学習目標

- waveform から log-Mel spectrogram を計算する。windowing、FFT、filter banks、log transform を扱う。
- encoder options、Whisper encoder、BEATs、AF-Whisper hybrid を比較し、それぞれが勝つ場面を説明する。
- audio Q-former を作る。N learnable queries が spectrogram patches に cross-attend する。
- cascaded (Whisper-then-LLM) と end-to-end audio-LLM training を説明し、reasoning では end-to-end がより scale する理由を述べる。

## 問題

speech recognition は Whisper により解かれました。audio の OCR は commodity です。しかし「commodity」は transcription で止まります。model が聞いた内容、timing、speakers、emotion、music structure、environmental sounds について reasoning できなければ、transcription だけでは product feature を動かせません。

明らかな route は3つあります。

1. Cascade: Whisper が transcribe し、LLM が transcript 上で reasoning する。pure-speech scenario では機能します。music、environmental audio、multi-speaker overlap、emotion では失敗します。

2. End-to-end audio-LLM: audio encoder が audio tokens を transcription なしで直接 LLM に渡す。acoustic information (emotion、speaker、environment) を保持します。新しい training data が必要です。

3. Hybrid: transcribe と reason の両方ができる audio encoder + text decoder。Qwen-Audio と Audio Flamingo はこの route を選びます。

## コンセプト

### Log-Mel spectrogram: the input feature

すべての audio encoder は同じ feature、log-Mel spectrogram から始まります。

1. 16 kHz に resample する。
2. 25ms window、10ms hop で short-time Fourier transform を行う。
3. FFT result の magnitude を取る。
4. Mel filter banks (通常 0-8000 Hz を log-space した 80 filters) を適用し、perceptual frequency に warp する。
5. dynamic range のために log compress (log(1 + x)) する。

結果は shape (T, 80) の 2D array です。T は time frames の数です。100 Hz frame rate の30秒 clip なら (3000, 80) です。

### Whisper's encoder

Whisper の encoder は 12-layer の ViT-style transformer で、log-Mel spectrogram を time frame の sequence として処理します。output は time frame ごとに1つの hidden-state vector です。

ASR では、Whisper の decoder は encoder output に condition された text tokens を生成する cross-attention transformer です。標準的な encoder-decoder です。

ALM (audio-LLM) では、encoder output を別の LLM の input にしたい。pattern は、Whisper encoder は frozen、Q-former は trainable、LLM は frozen または tuned です。

### BEATs and audio-specific encoders

Whisper は speech-dominant data で訓練されました。そのため music や environmental audio では弱くなります。

BEATs (Chen et al., 2022) は AudioSet で訓練された self-supervised transformer です。同じ parameter count なら、Whisper よりも music と environmental sounds をよく捉えます。

AF-Whisper (Audio Flamingo 3 の hybrid): Whisper + BEATs features を concat して audio input にします。Whisper は linguistic signal、BEATs は acoustic signal を担います。

### Audio Q-former

BLIP-2 の visual Q-former と同じ pattern です。固定数の learnable queries (多くは 32 または 64) が audio encoder の output frames に cross-attend します。その queries が LLM に消費される audio tokens になります。

training alignment stage では、Q-former だけを audio-text pairs (AudioCaps、Clotho) の contrastive + captioning losses で訓練します。instruction stage では end-to-end で LLM を unfreeze し、instruction data で訓練します。

### arc — SALMONN, Qwen-Audio, AF3

SALMONN (Tang et al., 2023): Whisper + BEATs + Q-former + LLaMA。serious reasoning ability を持つ最初期の open audio-LLM です。MMAU benchmark では composite が約 0.55 です。

Qwen-Audio (Chu et al., 2023): 似た architecture で、より豊かな dataset で訓練され、multi-turn dialogue 向けに tuned されています。MMAU は約 0.60 です。

LTU、Listen, Think, Understand (Gong et al., 2023): explicit reasoning data を使い、audio clips 上の chain-of-thought に焦点を当てます。小さいが focused しています。

Audio Flamingo 3 (Goel et al., 2025年7月): 現在の open SOTA です。8B LLM backbone (Qwen2 7B)、Whisper-large encoder concat BEATs、64-query Q-former、1M+ audio-text instruction pairs での training。MMAU は 0.72 で、一部の sub-tasks では proprietary frontier と同等です。

AF3 は audio 向けの on-demand chain-of-thought も導入します。model は final answer の前に、必要に応じて thinking tokens (「まず楽器を特定します: ...」) を出せます。thinking を有効にすると、complex reasoning tasks の accuracy が 3-5 points 上がります。

### Cascaded vs end-to-end

Cascaded pipeline:

1. Whisper が audio を transcribe して text にする。
2. LLM が text 上で reasoning する。

「この podcast を要約して」には完全に機能します。失敗する例:
- 「この曲の mood は何か」: mood は words ではなく sound にあります。
- 「Alice と Bob のどちらが話しているか」: speaker identification が必要です。
- 「爆発は何秒時点で起きるか」: text では temporal grounding が失われます。
- 「これは real audio か generated audio か」: deepfake detection には acoustic features が必要です。

End-to-end は acoustic signal を保持します。Qwen-Audio と AF3 は music、environment、emotion を native に扱えます。

### 2026年の production recipe

新しい audio-understanding product では次のように選びます。

- Cascaded: transcription が目的で、music も emotion inference もない場合。
- AF3 / Qwen-Audio-family: music、emotion、multi-speaker、complex audio reasoning がある場合。

Cascaded は安く単純です。End-to-end はより高機能です。

### MMAU — the audio reasoning benchmark

MMAU (Massive Multimodal Audio Understanding) は 2024-2025 年の audio reasoning benchmark です。

- speech、music、environmental sounds にわたる 10,000 audio-text QA pairs。
- classification、temporal reasoning、causal reasoning、open-ended QA をカバー。
- cascaded pipeline が体系的に見落とすものをテストする。

Open SOTA (AF3) は 0.72、proprietary frontier は約 0.78 (Gemini 2.5 Pro、Claude Opus 4.7) です。この gap は VideoMME の open-vs-closed delta より小さく、audio-LLM が成熟していることを示します。

## 使ってみる

`code/main.py`:

- stdlib で log-Mel spectrogram computation を実装します。windowing、naive DFT、Mel filter-bank を含みます。
- Audio Q-former skeleton: encoder output frames を受け取り、Q、K、V、attention を計算し、N tokens を出力します。
- toy task で cascaded-vs-end-to-end comparison を行います。

## 仕上げ

この lesson は `outputs/skill-audio-llm-pipeline-picker.md` を生成します。audio task (transcription、music tagging、emotion inference、multi-speaker diarization、environment classification) を受け取り、cascaded、end-to-end AF3、hybrid のいずれかを選びます。

## 演習

1. 16kHz、25ms window、10ms hop、80 Mel bins の30秒 clip について、log-Mel spectrogram dimension を計算してください。48kHz ではどう変わりますか。

2. Whisper はなぜ music で underperform するのでしょうか。BEATs は Whisper が捉えないどんな audio features を捉えますか。

3. Audio Q-former の 64 queries と 32 queries を比較してください。どの task complexity で 64 が効きますか。32 は何の compute を節約しますか。

4. AF3 の Section 4、on-demand thinking を読んでください。chain-of-thought が最も役立つ audio task を3つ提案してください。

5. AF3 の output を使って minimal diarization pipeline を実装してください。speaker changes をどう signal しますか。

## 重要語句

| Term | よく言われること | 実際の意味 |
|------|-----------------|------------------------|
| Log-Mel spectrogram | 「Mel features」 | Mel filter banks 後の log-magnitude values からなる 2D (time, frequency) array |
| Audio Q-former | 「Audio Perceiver」 | audio encoder output から LLM に入る fixed-length queries への cross-attention bottleneck |
| Cascaded | 「ASR-then-LLM」 | Whisper が transcribe し text LLM が reasoning する pipeline。acoustic information を失う |
| End-to-end | 「Audio-LLM」 | audio features が Q-former 経由で LLM に直接入る。acoustic signal を保持する |
| BEATs | 「Audio AudioSet encoder」 | AudioSet で訓練された SSL transformer。music + environmental sounds に強い |
| MMAU | 「Audio reasoning bench」 | speech、music、environment にまたがる 10k QA pairs。2024年の eval standard |
| On-demand thinking | 「Audio CoT」 | model が final answer 前に reasoning tokens を任意で出せる仕組み。accuracy を 3-5 pts 上げる |

## 参考文献

- [Radford et al. — Whisper (arXiv:2212.04356)](https://arxiv.org/abs/2212.04356)
- [Chu et al. — Qwen-Audio (arXiv:2311.07919)](https://arxiv.org/abs/2311.07919)
- [Goel et al. — Audio Flamingo 3 (arXiv:2507.08128)](https://arxiv.org/abs/2507.08128)
- [Tang et al. — SALMONN (arXiv:2310.13289)](https://arxiv.org/abs/2310.13289)
- [Gong et al. — LTU (arXiv:2305.10790)](https://arxiv.org/abs/2305.10790)
