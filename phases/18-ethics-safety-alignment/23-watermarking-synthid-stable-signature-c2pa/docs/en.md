# Watermarking — SynthID, Stable Signature, C2PA

> 2026年の AI-generated-content provenance は3つの technology で整理できる。SynthID (Google DeepMind) — image watermarking は 2023年8月に開始、text+video は 2024年5月 (Gemini + Veo)、text は 2024年10月に Responsible GenAI Toolkit 経由で open-sourced、2025年11月に Gemini 3 Pro と併せて unified multi-media detector。Text watermarking は next-token sampling probabilities を知覚できない程度に調整する。image/video watermarks は compression、cropping、filters、frame-rate changes に耐える。Stable Signature (Fernandez et al., ICCV 2023, arXiv:2303.15435) — latent diffusion decoder を fine-tune し、すべての output に固定 message を含める。cropped (content の10%) generated images を FPR<1e-6 で >90% 検出。follow-up "Stable Signature is Unstable" (arXiv:2405.07145, 2024年5月) — fine-tuning は quality を保ったまま watermark を除去する。C2PA — cryptographically signed, tamper-evident metadata standard (C2PA 2.2 Explainer 2025)。Watermarking と C2PA は complementary である。metadata は削除され得るが richer provenance を持つ。watermarks は transcoding 後も残りやすいが情報量は少ない。

**種別:** 構築
**言語:** Python (stdlib, token-watermark embed + detect)
**前提条件:** Phase 10 · 04 (sampling), Phase 01 · 09 (information theory)
**所要時間:** 約75分

## Learning Objectives

- token-level watermarking (SynthID-text style) と、それが detect 可能になる mechanism を説明する。
- Stable Signature と、それを破った 2024年の removal attack を説明する。
- C2PA の役割と、watermarking と complementary である理由を述べる。
- 主な limitation、つまり model-specific signal、paraphrase 下の robustness、meaning-preserving attacks (arXiv:2508.20228) を説明する。

## 問題

2023-2024年に deepfakes と AI-generated content は政治・消費者 context に大規模に入り込んだ。Watermarking は提案されている technical provenance signal である。generation 時点で mark し、後で detect する。2025年の evidence: 無条件に robust な watermark はないが、C2PA metadata と layered に使うと、実用可能な provenance story を提供する。

## The Concept

### Text watermarking (SynthID-text style)

Kirchenbauer et al. 2023 の mechanism を Google が productionize したもの:

1. 各 decoding step で、直前 K tokens を hash し、vocabulary を "green" と "red" set に pseudorandom に分割する。
2. green logits に δ を加えて、green set に sampling を bias する。
3. generation には chance より多くの green tokens が含まれる。

Detection: 各 prefix を再 hash し、generation 内の green tokens を数え、z-score を計算する。z-score は watermarked text では >0、人間の text では ~0 になる。

Properties:
- readers には知覚できない (δ は quality loss が小さい程度に小さい)。
- vocabulary partition function に access できれば detect 可能。
- paraphrase に robust ではない。text を書き換えると signal は壊れる。

SynthID-text は 2024年10月に Google の Responsible GenAI Toolkit 経由で open-sourced された。

### Stable Signature (image)

Fernandez et al. ICCV 2023。latent diffusion decoder を fine-tune し、生成されるすべての image に latent representation 内の固定 binary message を埋め込む。Detection は neural decoder で latent から decode する。content の10%に crop された image でも FPR<1e-6 で >90% 検出された。

2024年5月 "Stable Signature is Unstable" (arXiv:2405.07145): decoder の fine-tuning は image quality を保ったまま watermark を除去する。post-generation の adversarial fine-tuning は安価であり、watermark の adversarial robustness は限定的である。

### SynthID unified detector (November 2025)

Gemini 3 Pro と併せて、text、image、audio、video の SynthID signal を1つの API で読む multi-media detector。Google provenance stack を統合する。

### C2PA

Coalition for Content Provenance and Authenticity。cryptographically signed tamper-evident metadata standard。C2PA 2.2 Explainer (2025)。C2PA manifest は provenance claims (誰が作成したか、いつ、どの transformations があったか) を creator の key で署名して記録する。

Watermarking との complementarity:
- Metadata は削除され得る。watermark は簡単には削除できない。
- Metadata は rich (full provenance chain)。watermark は bits を運ぶ。
- C2PA は platform adoption に依存する。watermark は自動で埋め込まれる。

Google は Search、Ads、"About this image" で両方を統合している。

### Limitations

- **Model-specific.** SynthID watermarks は SynthID-enabled models からの generations に付く。SynthID のない model からの generation は watermarked ではないため、「SynthID signal がない」ことは authenticity の証明ではない。
- **Paraphrase.** Text watermarks は meaning-preserving paraphrase に耐えない。
- **Transformation attacks.** arXiv:2508.20228 (2025) は、text watermarks と多くの image watermarks の両方を壊す meaning-preserving attacks を示す。
- **Fine-tune removal.** "Stable Signature is Unstable" によれば、post-generation fine-tuning は embedded watermarks を除去する。

### EU AI Act Article 50

AI-generated content labeling の Transparency Code (first draft 2025年12月、second draft 2026年3月、[European Commission status page](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content) によれば final は 2026年6月見込み)。Code は 2026年4月時点では draft のままで、timeline は変更され得る。これは technical layer を要求する regulatory layer である。Deepfakes は label されなければならない。

### Where this fits in Phase 18

Lessons 22-23 は model が何を emit するか (private data、provenance signal) を扱う。Lesson 27 は training-data governance を扱う。Lesson 24 はこれらの technical measures を要求する regulatory framework である。

## Use It

`code/main.py` は toy text watermark を構築する。Tokens は integers 0..N-1。watermarked sampling は hash で定義される green set に bias する。detector は green-token z-score を計算する。1000-token generations で detection を観察し、paraphrase が signal を壊す様子を見て、human text 上の false-positive rate を測る。

## Ship It

この lesson では `outputs/skill-provenance-audit.md` を作る。provenance claim を持つ content deployment が与えられたとき、watermark mechanism (もしあれば)、C2PA signing chain (もしあれば)、それぞれの adversarial robustness、modality ごとの coverage を監査する。

## Exercises

1. `code/main.py` を実行する。watermarked 1000-token generation と human-authored text の z-score を報告する。95% confidence threshold での false-positive rate を特定する。

2. tokens の30%を synonyms に置き換える paraphrase attack を実装する。z-score を再測定する。

3. Kirchenbauer et al. 2023 Section 6 の robustness を読む。text watermarks は paraphrase で失敗するのに、image watermarks が cropping に耐えるのはなぜか。

4. SynthID-text + C2PA metadata を使う deployment を設計する。consumer が見る provenance chain を説明する。各 component の failure mode を1つずつ特定する。

5. 2024年の "Stable Signature is Unstable" result は、fine-tuning が image watermark を除去することを示している。この attack を制限する deployment control を設計する。例えば fine-tuned checkpoints の signed releases を要求する。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| SynthID | 「Google の watermark」 | text、image、audio、video にまたがる cross-modal provenance signal |
| Token watermark | 「Kirchenbauer-style」 | green-token z-score で detect できる biased-sampling text watermark |
| Stable Signature | 「image watermark」 | fine-tuned-decoder watermark。ICCV 2023 |
| C2PA | 「metadata standard」 | cryptographically signed tamper-evident provenance metadata |
| Paraphrase robustness | 「言い換えで壊れるか」 | text watermark の property。現状は限定的 |
| Fine-tune removal | 「adversarial unwatermark」 | decoder fine-tuning で image watermark を除去する attack |
| Cross-modal detector | 「unified SynthID」 | modalities をまたぐ 2025年11月の unified API |

## 参考文献

- [Kirchenbauer et al. — A Watermark for Large Language Models (ICML 2023, arXiv:2301.10226)](https://arxiv.org/abs/2301.10226) — token-watermark mechanism
- [Fernandez et al. — Stable Signature (ICCV 2023, arXiv:2303.15435)](https://arxiv.org/abs/2303.15435) — image watermark paper
- ["Stable Signature is Unstable" (arXiv:2405.07145)](https://arxiv.org/abs/2405.07145) — removal attack
- [Google DeepMind — SynthID](https://deepmind.google/models/synthid/) — cross-modal watermark
- [C2PA 2.2 Explainer (2025)](https://c2pa.org/specifications/specifications/2.2/explainer/Explainer.html) — metadata standard
