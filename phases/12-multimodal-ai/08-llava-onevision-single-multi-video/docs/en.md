# LLaVA-OneVision: Single-Image、Multi-Image、Video を1つの Model で扱う

> LLaVA-OneVision (Li et al., 2024年8月) 以前、open-VLM の世界には別々の lineage があった。single image 向けの LLaVA-1.5、Mantis や VILA のような multi-image models、Video-LLaVA や Video-LLaMA のような video models である。それぞれが自分の benchmark では勝ち、他では失敗した。LLaVA-OneVision は、1つの curriculum で3つの scenario すべてを支配する model を学習でき、emergent task-transfer effects (single-image skills が video に移る、multi-image reasoning が single-image に移る) が specialist の合計を上回ると主張した。recipe は見かけ以上に単純である。scenario をまたいで一定に保つ visual-token budget と、single-image から OneVision (multi-image) へ、さらに video へ進む明示的 curriculum である。この lesson では budget、curriculum、emergent behaviors を読む。

**種別:** 構築
**言語:** Python (stdlib、token budget solver + curriculum planner)
**前提条件:** Phase 12 · 05 (LLaVA)、Phase 12 · 06 (any-resolution)
**所要時間:** 約180分

## 学習目標

- single-image、multi-image、video input をまたいで一定に保つ visual-token budget を設計する。
- catastrophic forgetting を起こさず single-image から video へ skill を transfer する training curriculum を並べる。
- curriculum が正しく設計されると、同じ parameter count で1つの model が specialists に勝つ理由を説明する。
- LLaVA-OneVision が報告した3つの emergent capabilities、multi-camera reasoning、set-of-mark prompting、iPhone-screenshot agent を挙げる。

## 問題

Image、multi-image、video はそれぞれ異なる形で model に負荷をかける。

Single-image は OCR と fine detail を拾うために high-resolution tokens (AnyRes、約2880 visual tokens) を欲しがる。sample あたりの budget は、1 image、2880 tokens。

Multi-image は context に cross-image reasoning を収めるため、moderate resolution の複数画像 (各約576 tokens) を欲しがる。sample あたりの budget は、4-8 images、各576、合計 2300-4600 tokens。

Video は temporal dynamics を捉えるため、多くの frames を低解像度で欲しがる (pooling 後に frame あたり約196 tokens)。sample あたりの budget は、8-32 frames、各196、合計 1600-6200 tokens。

別々の model を train するなら、budget を1つ選べばよい。1つの model を train するなら、context を破裂させず、scenario をまたいで無理なく scale する budget が必要である。

Pre-OneVision の default answer は、「1 scenario で train し、他は無視する」だった。Video-LLaVA は image model に追加 training stage で video を後付けした。LLaVA-NeXT は tiling で multi-image support を追加した。3つをきれいに扱うものはなかった。

## コンセプト

### OneVision token budget

LLaVA-OneVision は sample あたり約 3000-4000 tokens の unified visual-token budget を選び、scenario ごとに違う形で配分する。

- Single image: AnyRes-9 (3x3 tiles + thumbnail)。各 tile は 384 で 729 patches、aggressive bilinear pooling 2x2 → tile あたり 182。合計: 9 * 182 + 182 = 1820 tokens。あるいは AnyRes-4 で tile あたり 729、合計 2916 + 729。
- Multi-image: 各 image は moderate resolution (384、tiling なし)、pooling なしで 729 tokens。6 images なら 4374 tokens。
- Video: 384 resolution の 32 frames に aggressive 3x3 bilinear pool → frame あたり 81 tokens。合計: 32 * 81 = 2592 tokens。

この配分により total tokens はおおむね一定に保たれる。LLM は context を破裂させる batch を見ない。encoder が scenario ごとに異なる geometry を出しても、LLM は同じ budget を消費する。

### 3-stage curriculum

LLaVA-OneVision は3段階で学習する。

1. Single-image SFT (stage SI)。data はすべて single-image-plus-text。high-resolution AnyRes input で train する。perception、OCR、fine-grained understanding を教える。LLaVA-NeXT data と OneVision-specific single-image data を使う。
2. OneVision SFT (stage OV)。single-image + multi-image + video (uniformly sampled frames) を混ぜる。unified token budget で train する。heterogeneous batch shape の扱いを model に教える。weight reset はせず、stage SI から継続する。
3. Task transfer (stage TT)。target task mix で継続する。通常は product に応じて multi-image または video を厚めにする。deployment 用 fine-tune は optional。

重要なのは curriculum order である。video-first や multi-image-first で学習すると、同じ data でも single-image-first より image performance が悪くなる。論文はこれを明示的に ablate している。

### なぜ curriculum が効くのか

Single-image training は perceptual base を作る。Patch tokens は fine-grained visual features を持ち、LLM はそれらを text と統合する方法を学ぶ。Multi-image と video は、どの image がどれか、何が先に起きたか、という structural challenge を持ち込む。強い perceptual base なしにそれらを学ぶのは難しい。

すべての scenario を最初から一緒に train すると、model は perception を underfit し (batch あたりの single-image data が限られる)、structure に overfit する (multi-image / video data が多い)。結果は、cross-image reasoning pattern は追えるが視覚的には浅い model になる。

curriculum order により、stage SI から perception strength を得て、stage OV から compositional/temporal reasoning を得る。どちらも失わない。

### Emergent cross-scenario skills

LLaVA-OneVision paper は3つの emergent capabilities を報告している。

1. Multi-camera reasoning。multi-image と video を別々に学習した後、inference で multi-camera driving scene の reasoning を求められる。training でその正確な format を見ていなくても、model は view を正しく統合する。
2. Set-of-mark prompting。user が画像内の object に番号付き mark を付け、model に「mark 3 は mark 7 に対して何をしているか」と reasoning させる。mark も annotation も training していない。spatial grounding + multi-image reference の組み合わせから学ばれた。
3. iPhone-screenshot agent。user が iPhone screen の screenshot を渡し、次の click を計画させる。UI screenshots、user workflow の video、before/after の multi-image pair で学んだことが agent use case に generalize する。

これらは trained task ではない。curriculum の compositional structure から出現する。

### Visual-token pooling

token budget には pooling が必要である。OneVision は 2D patch grid 上で bilinear interpolation を使う。24x24 = 576 patches を 12x12 = 144 (2x factor) または 8x8 = 64 (3x factor) にする。locality を保つため、pooling は token space ではなく patch-grid space で行う。

scenario ごとの pooling factor の選択は hyperparameter である。pooling を弱くすると tokens が増え、representation は richer になる。pooling を強くすると tokens は減り、より多くの frames / images が入る。

### LLaVA-OneVision-1.5

2025年の follow-up (LLaVA-OneVision-1.5、arXiv 2509.23661) は、training data、model weights、code において "fully open" である。一部 benchmark で proprietary gap を縮め、この recipe を democratize した。同じ curriculum、より多い data、より良い base LLM。architecture change はない。

### Qwen2.5-VL との対比

Qwen2.5-VL (Lesson 12.09) は異なる選択をする。fixed pooling ではなく M-RoPE と dynamic FPS を使う。budget は input に応じて scale する。1分の video は 5秒の video より多くの tokens を使う。LLaVA-OneVision は budget を固定し、pooling を scale させる。どちらも機能するが、configurability と predictability の trade-off がある。

## 使ってみる

`code/main.py` は OneVision-style VLM の curriculum と budget planner である。sample あたりの token budget と target scenario mix (例えば single-image 40%、multi-image 30%、video 30%) を受け取り、次を行う。

- scenario ごとに resolution、pooling factor、frame count を割り当てる。
- すべての scenario が shared budget に収まることを確認する。
- expected token count、LLM FLOPs、under-tokenized な scenario を報告する。
- stage-by-stage training schedule を出力する。

OneVision fine-tune の計画や、VLM deployment の request ごとの cost sanity check に使う。

## 仕上げ

この lesson は `outputs/skill-onevision-budget-planner.md` を生成する。target task distribution と per-sample budget を受け取り、AnyRes factor、per-frame pooling、video frame count、curriculum stage weights を出力する。unified-scenario VLM を train または fine-tune するときに使う。

## 演習

1. product は 80% single-image、10% multi-image (2-4 images)、10% video (8-16 frames) を support する。token budget を設計せよ。heavy multi-image をしないことで浮いた extra budget をどこに置くか。

2. LLaVA-OneVision Section 4.3 (emergent capabilities) を読め。paper が報告していないが、この curriculum が unlock しそうな4つ目の emergent skill を提案せよ。

3. curriculum order を入れ替え、multi-image first、その後 single-image、最後に video で train する。どの benchmark がなぜ degrade するかを予測せよ。

4. paper は video benchmark を sample あたり 8 frames だけで学習したと報告している。これは inference で 30秒 video に generalize するか。最初に壊れるのは token budget か temporal reasoning か。

5. 24x24 patches から 12x12 への bilinear pooling は、dim ごとに 4x reduction である。stdlib Python で pooling を実装し、各 2x2 block の mean が bilinear output と一致することを確認せよ。

## 重要語句

| Term | よく言われる表現 | 実際の意味 |
|------|-----------------|------------|
| OneVision scenario | "Single-image, multi-image, or video" | unified VLM が扱う3つの input shape の1つ。budget は scenario 間で一定に保つ |
| Token budget | "How many tokens per sample" | training / inference sample ごとに LLM が見る visual tokens の合計。通常 3000-4000 |
| Curriculum | "Training order" | emergent transfer のために選ぶ stage order (single-image → multi-image → video) |
| Bilinear pooling | "Token shrink" | locality を保ちながら token count を減らすため、patch grid (2D) に bilinear interpolation を適用すること |
| Emergent skill | "Not trained, still works" | curriculum composition により、matching training data なしで inference 時に現れる capability |
| AnyRes-k | "k-tile setup" | k 個の fixed-resolution sub-tiles と1つの thumbnail。典型的な k は {4, 9} |
| Task transfer | "Cross-scenario generalization" | shared backbone により single-image で学んだ skill が video に適用されること、またはその逆 |

## 参考文献

- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326)
- [LLaVA-OneVision-1.5: Fully Open Framework (arXiv:2509.23661)](https://arxiv.org/abs/2509.23661)
- [Lin et al. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Lin et al. — VILA (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
