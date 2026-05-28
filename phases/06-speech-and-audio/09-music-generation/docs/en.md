# Music Generation — MusicGen、Stable Audio、Suno、そしてライセンスを揺るがした変化

> 2026年の音楽生成では、商用領域を Suno v5 と Udio v4 が支配し、オープンソースでは MusicGen、Stable Audio Open、ACE-Step が先頭を走っています。技術的な問題はほぼ解けています。法的な問題は、Warner Music の 5億ドル和解や UMG 和解によって、2025-2026年に分野全体を作り変えました。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 6 · 02 (Spectrograms), Phase 4 · 10 (Diffusion Models)
**所要時間:** 約75分

## 問題

テキストから、30秒から4分の音楽クリップを生成します。歌詞、ボーカル、曲構成も含めます。サブ問題は3つあります。

1. **インストゥルメンタル生成。** "lo-fi hip-hop drums with warm keys" のようなテキストから音声を生成します。MusicGen、Stable Audio、AudioLDM。
2. **楽曲生成（ボーカル + 歌詞あり）。** "Country song about rainy Texas nights" から完成曲を生成します。Suno、Udio、YuE、ACE-Step。
3. **条件付き / 制御可能な生成。** 既存クリップの延長、ブリッジの再生成、ジャンル変更、ステム分離、インペインティング。Udio の inpainting + stem separation は、2026年に追いつくべき機能です。

## コンセプト

![Music generation: token-LM vs diffusion, the 2026 model map](../assets/music-generation.svg)

### neural-codec トークン上の Token LM

Meta の **MusicGen**（2023年、MIT）と多くの派生モデルは、テキスト / メロディ埋め込みを条件にして EnCodec トークン（32 kHz、4 codebooks）を自己回帰的に予測し、EnCodec でデコードします。300M - 3.3B パラメータ。強力なベースラインですが、30秒を超えると苦戦します。

**ACE-Step**（オープンソース、4B XL は2026年4月リリース）は、この方式をフルソングの歌詞条件付き生成へ拡張します。オープンコミュニティにおける Suno に最も近い存在です。

### mel または latent 上の diffusion

**Stable Audio (2023)** と **Stable Audio Open (2024)** は、圧縮音声上の latent diffusion です。ループ、サウンドデザイン、アンビエントな質感に強みがあります。構造化されたフルソングは得意ではありません。

**AudioLDM / AudioLDM2** は、T2I 風の latent diffusion による text-to-audio で、音楽、効果音、音声へ一般化されています。

### Hybrid（production）— Suno、Udio、Lyria

重みは非公開です。おそらく AR codec LM と diffusion ベースの vocoder に、音声 / ドラム / メロディ専用ヘッドを組み合わせています。Suno v5（2026年）は ELO 1293 の品質リーダーです。Udio v4 は inpainting + stem separation（bass、drums、vocals の個別ダウンロード）を追加しています。

### 評価

- **FAD (Fréchet Audio Distance)。** VGGish または PANNs 特徴を使い、生成音声と実音声の分布間距離を埋め込みレベルで測ります。低いほど良いです。MusicGen small は MusicCaps で 4.5 FAD、SOTA は約 3.0。
- **音楽性（主観評価）。** 人間の選好です。Suno v5 が ELO 1293 でリードしています。
- **テキスト・音声の整合。** プロンプトと出力の CLAP score。
- **音楽性のアーティファクト。** 拍から外れた遷移、ボーカルフレーズのドリフト、30秒を超えた構造喪失。

## 2026年のモデルマップ

| Model | Params | Length | Vocals | License |
|-------|--------|--------|--------|---------|
| MusicGen-large | 3.3B | 30 s | no | MIT |
| Stable Audio Open | 1.2B | 47 s | no | Stability non-commercial |
| ACE-Step XL (Apr 2026) | 4B | &gt; 2 min | yes | Apache-2.0 |
| YuE | 7B | &gt; 2 min | yes, multilingual | Apache-2.0 |
| Suno v5 (closed) | ? | 4 min | yes, ELO 1293 | commercial |
| Udio v4 (closed) | ? | 4 min | yes + stems | commercial |
| Google Lyria 3 (closed) | ? | real-time | yes | commercial |
| MiniMax Music 2.5 | ? | 4 min | yes | commercial API |

## 法的状況（2025-2026）

- **Warner Music vs Suno settlement。** 5億ドル。WMG は現在、Suno 上の AI-likeness、音楽権利、ユーザー生成トラックを監督しています。Udio でも同様の UMG settlement がありました。
- **EU AI Act** + **California SB 942**: AI 生成音楽は開示が必要です。
- **Riffusion / MusicGen** は MIT の下でコンプライアンス上の重荷はありませんが、商用ボーカルもありません。

安全に出荷できるパターン:

1. インストゥルメンタルだけを生成する（MusicGen、Stable Audio Open、MIT/CC0 outputs）。
2. 生成ごとのライセンス付きで商用 API を使う（Suno、Udio、ElevenLabs Music）。
3. 自社所有またはライセンス済みカタログで学習する（多くの企業は最終的にここに行き着きます）。
4. 生成物に watermark + metadata を付与する。

## 作ってみる

### Step 1: MusicGen で生成する

```python
from audiocraft.models import MusicGen
import torchaudio

model = MusicGen.get_pretrained("facebook/musicgen-small")
model.set_generation_params(duration=10)
wav = model.generate(["upbeat synthwave with driving drums, 128 BPM"])
torchaudio.save("out.wav", wav[0].cpu(), 32000)
```

サイズは3種類です。`small`（300M、高速）、`medium`（1.5B）、`large`（3.3B）。「アイデアが成立するか」を見るだけなら Small で十分です。

### Step 2: メロディ条件付け

```python
melody, sr = torchaudio.load("humming.wav")
wav = model.generate_with_chroma(
    ["jazz piano cover"],
    melody.squeeze(),
    sr,
)
```

MusicGen-melody は chromagram を受け取り、音色を差し替えながら旋律を保ちます。「このメロディを弦楽四重奏にして」のような用途に便利です。

### Step 3: FAD 評価

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()

fad.get_fad_score("generated_folder/", "reference_folder/")
```

VGGish 埋め込み距離を計算します。ジャンルレベルの回帰テストには有用ですが、人間のリスナーの代替にはなりません。

### Step 4: LLM と音楽のワークフローに追加する

Lessons 7-8 のアイデアと組み合わせます。

```python
prompt = "Write a 30-second jazz loop. Describe the drums, bass, and piano voicing."
description = llm.complete(prompt)
music = musicgen.generate([description], duration=30)
```

## 使いどころ

| Goal | Stack |
|------|-------|
| Instrumental sound design | Stable Audio Open |
| Game / adaptive music | Google Lyria RealTime (closed) |
| Full songs with vocals (commercial) | Suno v5 or Udio v4 with explicit license |
| Full songs with vocals (open) | ACE-Step XL or YuE |
| Short ad jingle | MusicGen melody-conditioned on a hummed reference |
| Music-video background | MusicGen + Stable Video Diffusion |

## 2026年でも出荷時に残りがちな落とし穴

- **著作権ロンダリングのプロンプト。** "Song in the style of Taylor Swift" のような指定です。商用 Suno/Udio は現在これをフィルタしますが、オープンモデルはしません。自分でフィルタリストを追加してください。
- **30秒以降の反復 / ドリフト。** AR モデルはループしがちです。複数生成をクロスフェードするか、構造的一貫性のため ACE-Step を使います。
- **テンポのドリフト。** モデルは BPM から外れます。プロンプトに BPM タグを入れ、librosa の `beat_track` で後処理フィルタします。
- **ボーカルの明瞭さ。** Suno は優秀です。オープンモデルは単語がぼやけることがよくあります。歌詞が重要なら、商用 API または fine-tune を使います。
- **モノラル出力。** オープンモデルは mono または fake-stereo を生成します。適切な stereo reconstruction（ezst、Cartesia's stereo diffusion）で強化します。

## 出荷する

`outputs/skill-music-designer.md` として保存します。音楽生成デプロイのために、モデル、ライセンス戦略、長さ / 構成計画、開示 metadata を選びます。

## 演習

1. **Easy。** `code/main.py` を実行します。ASCII 記号で「生成的な」コード進行 + ドラムパターンを出力します。必要なら任意の MIDI renderer で再生してください。
2. **Medium。** `audiocraft` をインストールし、MusicGen-small で4つのジャンルプロンプトから10秒クリップを生成し、参照ジャンルセットに対する FAD を測定します。
3. **Hard。** ACE-Step（または MusicGen-melody）を使って、同じ旋律の3つのバリエーションを異なる音色プロンプトで生成します。プロンプトとの整合を検証するため CLAP similarity を計算します。

## 重要用語

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| FAD | Audio FID | 実音声と生成音声の埋め込み分布間の Fréchet distance。 |
| Chromagram | ピッチとしてのメロディ | フレームごとの12次元ベクトル。メロディ条件付けへの入力。 |
| Stems | 楽器トラック | bass / drums / vocals / melody を WAV として分離したもの。 |
| Inpainting | セクションの再生成 | 時間窓をマスクし、その部分だけをモデルが再生成する。 |
| CLAP | Text-audio CLIP | 対照学習された audio-text embedding。text-audio alignment を評価する。 |
| EnCodec | Music codec | MusicGen が使う Meta の neural codec。32 kHz、4 codebooks。 |

## 参考資料

- [Copet et al. (2023). MusicGen](https://arxiv.org/abs/2306.05284) — オープンな自己回帰ベンチマーク。
- [Evans et al. (2024). Stable Audio Open](https://arxiv.org/abs/2407.14358) — サウンドデザインの標準候補。
- [ACE-Step](https://github.com/ace-step/ACE-Step) — 2026年4月のオープンな 4B フルソング生成器。
- [Suno v5 platform docs](https://suno.com) — 商用品質のリーダー。
- [AudioLDM2](https://arxiv.org/abs/2308.05734) — 音楽 + 効果音向け latent diffusion。
- [WMG-Suno settlement coverage](https://www.musicbusinessworldwide.com/suno-warner-music-settlement/) — 2025年11月の先例。
