# Capstone 04 — Multimodal Document QA (Vision-First PDF, Tables, Charts)

> 2026年の document-QA frontier は、OCR-then-text から vision-first late interaction へ移りました。ColPali、ColQwen2.5、ColQwen3-omni は PDF page を image として扱い、multi-vector late interaction で embed し、query が patch を直接 attend できるようにします。financial 10-K、scientific paper、handwritten notes では、この pattern が OCR-first を大きく上回ります。1万 page で pipeline を end to end に作り、OCR-then-text との side-by-side を公開します。

**種別:** Capstone
**言語:** Python (pipeline), TypeScript (viewer UI)
**前提条件:** Phase 4 (computer vision), Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:** P4 · P5 · P7 · P11 · P12 · P17
**所要時間:** 30時間

## 問題

enterprise には OCR pipeline が壊しがちな PDF が大量にあります。回転した table を含む scanned 10-K、equation が密な scientific paper、image として見なければ意味が取れない chart、手書き annotation です。これらを text-first で扱うと signal の半分を失います。2026年の答えは raw page image 上の late-interaction multi-vector retrieval です。ColPali (Illuin Tech) が導入し、ColQwen2.5-v0.2 と ColQwen3-omni が accuracy を押し上げました。ViDoRe v3 では vision-first retrieval が OCR-then-text を意味のある margin で上回り、chart、table、handwriting では差が広がります。

trade-off は storage と latency です。ColQwen embedding は page あたり単一の 1024-dim vector ではなく、約2048個の patch vector です。raw storage が膨らみます。DocPruner (2026) は精度低下をほぼ出さずに 50% pruning を可能にします。1万 page を index し、ViDoRe v3 nDCG@5 を測り、2秒未満で回答を提供し、OCR-then-text baseline と直接比較します。

## コンセプト

late interaction では、各 query token が各 patch token と score され、query token ごとの最大 score を合計します。single pooled vector を作らずに fine-grained matching ができます。multi-vector index (Vespa、Qdrant multi-vector、AstraDB) は per-patch embedding を保存し、retrieval 時に MaxSim を実行します。

answerer は query と top-k retrieved pages を image として受け取る vision-language model です。evidence region (bounding box または page reference) 付きで回答を書きます。2026年の frontier choice は Qwen3-VL-30B、Gemini 2.5 Pro、InternVL3 です。equation や scientific notation には、OCR fallback (Nougat、dots.ocr) を optional text channel として差し込みます。

evaluation は2次元の matrix です。片方の軸は content type (plain text paragraphs、dense tables、bar/line charts、handwritten notes、equations)。もう片方の軸は retrieval approach (vision-first late interaction、OCR-then-text、hybrid)。各 cell に nDCG@5 と answer accuracy を入れます。この report が deliverable です。

## Architecture

```
PDFs -> page renderer (PyMuPDF, 180 DPI)
           |
           v
  ColQwen2.5-v0.2 embed (multi-vector per page, ~2048 patches)
           |
           +------> DocPruner 50% compression
           |
           v
   multi-vector index (Vespa or Qdrant multi-vector)
           |
query ----+----> retrieve top-k pages (MaxSim)
           |
           v
  VLM answerer: Qwen3-VL-30B | Gemini 2.5 Pro | InternVL3
    inputs: query + top-k page images + optional OCR text
           |
           v
  answer with cited page numbers + evidence regions
           |
           v
  Streamlit / Next.js viewer: highlighted boxes on source page
```

## Stack

- Page rendering: PyMuPDF (fitz)、180 DPI、portrait-normalized
- Late-interaction model: ColQwen2.5-v0.2 または ColQwen3-omni (Hugging Face の vidore team)
- Index: multi-vector field を持つ Vespa、または Qdrant multi-vector、または MaxSim 付き AstraDB
- Pruning: DocPruner 2026 policy (high-variance patch を保持、50% compression、accuracy loss < 0.5%)
- OCR fallback (equations / dense tables): dots.ocr または Nougat
- VLM answerer: self-hosted Qwen3-VL-30B または hosted Gemini 2.5 Pro。fallback は InternVL3
- Evaluation: ViDoRe v3 benchmark、multi-page reasoning 用 M3DocVQA
- Viewer UI: evidence region overlay 用 canvas を備えた Next.js 15

## 実装

1. **Ingest.** 10-K、scientific paper、scanned document から成る1万 PDF page corpus を walk します。各 page を 1536x2048 PNG に render し、`{doc_id, page_num, image_path}` を persist します。

2. **Embed.** 各 page image に ColQwen2.5-v0.2 を走らせます。出力は dim 128 の patch embedding 約2048個です。DocPruner で signal の高い半分を残し、Vespa multi-vector field または Qdrant multi-vector に書きます。

3. **Query.** incoming query ごとに query tower で token-level embeddings を作ります。index に対して MaxSim を実行します。query token ごとに page patch embedding との max dot-product を取り、合計します。top-k pages を返します。

4. **Synthesize.** query と top-5 page images を Qwen3-VL-30B に渡します。Prompt: "Answer using only the supplied pages. Cite each claim by (doc_id, page) and name the region (figure, table, paragraph)."

5. **Evidence regions.** answer を post-process して cited region を抽出します。VLM が bounding box を出す場合 (Qwen3-VL は対応)、viewer 上に overlay として render します。

6. **OCR fallback.** equation-dense と判定された page (image variance heuristic) には Nougat または dots.ocr を走らせ、OCR text を image と並ぶ追加 channel として渡します。

7. **Eval.** ViDoRe v3 (retrieval nDCG@5) と M3DocVQA (multi-page QA accuracy) を走らせます。同じ corpus と synthesizer で OCR-then-text pipeline も走らせ、content-type x approach matrix を生成します。

8. **UI.** まず Streamlit prototype、次に source page へ evidence-region overlay を描く Next.js 15 production viewer を作ります。

## Use It

```
$ doc-qa ask "what was the 2024 operating margin change for segment EMEA?"
[retrieve]   top-5 pages in 320ms (ColQwen2.5, MaxSim, Vespa)
[synth]      qwen3-vl-30b, 1.4s, cited (form-10k-2024, p. 88) + (..., p. 92)
answer:
  EMEA operating margin moved from 18.2% to 16.8%, a 140bp decline.
  cited: 10-K-2024.pdf p.88 (Table 4, Segment Operating Margin)
         10-K-2024.pdf p.92 (MD&A, Operating Performance)
[viewer]     open with highlighted bounding boxes overlaid on p.88 Table 4
```

## Ship It

`outputs/skill-doc-qa.md` が deliverable です。特定 corpus に合わせた vision-first multimodal document QA system を作り、ViDoRe v3 上で OCR-then-text baseline と比較して評価します。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA accuracy | OCR-text baseline と published leaderboard に対する benchmark numbers |
| 20 | Evidence-region grounding | cited region が実際に answer span を含む割合 |
| 20 | Storage and latency engineering | DocPruner compression ratio、index p95、answer p95 |
| 20 | Multi-page reasoning | hand-labeled 100-question multi-page set の accuracy |
| 15 | Source-inspection UX | viewer clarity、overlay fidelity、side-by-side comparison tools |
| **100** | | |

## Exercises

1. 同じ corpus で ColQwen2.5-v0.2 と ColQwen3-omni を測定します。一方が正解し他方が miss する page を調べ、index に "content class" tag を追加して type 別に route します。

2. embedding を aggressively prune (75%, 90%) します。ViDoRe nDCG@5 が OCR baseline を下回る compression cliff を見つけます。

3. hybrid を作ります。OCR-then-text と ColQwen を parallel に走らせ、RRF で fuse し、cross-encoder で rerank します。hybrid は単独のどちらかを上回るか、どこで効くかを測ります。

4. Qwen3-VL-30B を小さな VLM (Qwen2.5-VL-7B) に差し替え、accuracy-per-dollar curve を測ります。

5. handwritten-note support を追加します。handwriting corpus を render し、ColQwen で embed して retrieval を測り、handwriting OCR pipeline と比較します。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Late interaction | 「ColPali-style retrieval」 | query token が page patch と独立に score され、MaxSim で aggregate される |
| Multi-vector | 「Per-patch embedding」 | document が1つの pooled vector ではなく多数の vector を持つ |
| MaxSim | 「Late-interaction scoring」 | 各 query token について document vector 上の max similarity を取り、合計する |
| DocPruner | 「Patch compression」 | accuracy loss ほぼなしで patch の50%を残す2026年の pruning |
| ViDoRe v3 | 「Document-retrieval benchmark」 | visual-document retrieval を測る2026年の標準 |
| Evidence region | 「Cited bounding box」 | answer span を source page 上に localize する bbox |
| OCR fallback | 「Equation channel」 | equation や table-heavy page で vision と並行して使う text pipeline |

## 参考文献

- [ColPali (Illuin Tech) repository](https://github.com/illuin-tech/colpali) — late-interaction doc retrieval の reference
- [ColPali paper (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449) — foundational method paper
- [ColQwen family on Hugging Face](https://huggingface.co/vidore) — production-ready checkpoints
- [M3DocRAG (Adobe)](https://arxiv.org/abs/2411.04952) — multi-page multimodal RAG baseline
- [Vespa multi-vector tutorial](https://docs.vespa.ai/en/colpali.html) — reference serving stack
- [Qdrant multi-vector support](https://qdrant.tech/documentation/concepts/vectors/#multivectors) — alternate index
- [AstraDB multi-vector](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html) — alternate managed index
- [Nougat OCR](https://github.com/facebookresearch/nougat) — equation-capable OCR fallback
