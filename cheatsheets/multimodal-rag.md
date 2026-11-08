---
id: multimodal-rag
title: Multimodal and Vision-Native RAG
code: MV
subtitle: Embed page images, score with MaxSim, fuse modalities, cite evidence regions. Python and TypeScript from the lessons.
hue: 285
sources: phases/12-multimodal-ai/23-colpali-vision-native-rag, phases/12-multimodal-ai/24-multimodal-rag-cross-modal, phases/19-capstone-projects/04-multimodal-document-qa, projects/visual-evidence-library
source_hash: f1c3b60c3549aa6a
---

## Vision-first document QA pipeline
type: architecture
from: phases/19-capstone-projects/04-multimodal-document-qa/docs/en.md

```arch
node | pdf | 1,1 | PDFs | page renderer, 180 DPI | client
node | emb | 2,1 | ColQwen2.5-v0.2 | ~2048 patches per page | model
node | prune | 3,1 | DocPruner | 50% compression | process
node | idx | 4,1 | Multi-vector index | Vespa or Qdrant | store
node | query | 1,2 | Query | token embeddings | client
node | ret | 2,2 | Retrieve top-k | MaxSim | process
node | vlm | 3,2 | VLM answerer | query + page images | model
node | view | 4,2 | Viewer | boxes on source page | client
edge | pdf | emb | page images
edge | emb | prune | patches
edge | prune | idx |
edge | query | ret |
edge | idx | ret | MaxSim
edge | ret | vlm | top-k pages
edge | vlm | view | cited pages + regions
```

## Tasks in code
type: task-table
from: phases/12-multimodal-ai/23-colpali-vision-native-rag/code/main.py, phases/19-capstone-projects/04-multimodal-document-qa/code/main.py, phases/12-multimodal-ai/24-multimodal-rag-cross-modal/code/main.py, projects/visual-evidence-library/solution/main.py

| Task | Code |
|---|---|
| Score one page | `maxsim(query_tokens, patches)` |
| Rank toy pages | `retrieve(query, pages, k=3)` |
| Prune patches | `doc_prune(patches, keep_fraction=0.5)` |
| Index with pruning | `build_index(prune=True)` |
| Fuse three modalities | `fuse([t, i, a], [0.3, 0.4, 0.3])` |
| Retry on low confidence | `agentic_loop(query, confidence_floor=0.8)` |
| Check a manifest | `validate_manifest(manifest, root)` |
| Search text regions | `search(assets, query, limit=20)` |

## Run the lessons and the project
type: command-table
from: phases/19-capstone-projects/04-multimodal-document-qa/code/main.py, phases/19-capstone-projects/04-multimodal-document-qa/code/ts/README.md, phases/19-capstone-projects/04-multimodal-document-qa/code/ts/package.json, projects/visual-evidence-library/README.md
span: 2

| Command | What it does |
|---|---|
| `python main.py` | Capstone MaxSim scaffold plus a pruning ablation |
| `npm start` | Viewer self-check pass with `--demo`. Exits 0 |
| `npm run serve` | HTTP viewer on 127.0.0.1. Free port when `PORT` is unset |
| `npm test` | Fixture, HTML escape and route tests |
| `python3 scripts/project_test.py visual-evidence-library --init my-visual-evidence-library` | Creates the incomplete workspace |
| `python3 scripts/project_test.py visual-evidence-library --stage 1 --path my-visual-evidence-library` | Grades stage 1 |
| `python3 main.py --manifest ./fixtures/manifest.json --query "return dry seeds" --out ./visual-output` | Writes index.html and evidence.json |
| `python3 demo.py` | Runs the search on the original fixtures |

## MaxSim late interaction
type: annotated-code
lang: python
from: phases/19-capstone-projects/04-multimodal-document-qa/code/main.py

```python
def max_sim_score(query_tokens, doc_patches):
    total = 0.0
    for q in query_tokens:            # one vector per query token
        best = -1e9
        for p in doc_patches:         # every patch on the page
            s = dot(q, p)
            if s > best:
                best = s
        total += best                 # sum of the best match per token
    return total
idx = build_index(prune=True)         # DocPruner keeps 50% of patches
hits = idx.retrieve(q, k=3)           # list of (Page, score)
```

## Score fusion and agentic retry
type: flow
from: phases/12-multimodal-ai/24-multimodal-rag-cross-modal/code/main.py, phases/12-multimodal-ai/24-multimodal-rag-cross-modal/docs/en.md

1. **Decompose**: "quiet" goes to audio, "vegan brunch" to text, "natural light" to images.
2. **text_retrieve**: keyword counts in review text, divided by the number of keywords.
3. **image_retrieve**: query hints map to tags such as `natural_light` and `airy`.
4. **audio_retrieve**: "quiet" gives `1.0 - r.ambient_db / 80.0`. Else 0.5.
5. **fuse**: weighted sum with weights 0.3, 0.4, 0.3. `top_k` keeps 3.
6. **Check**: top score below `confidence_floor` adds " bright windows low noise".
7. **Round 2**: fuse again with weights 0.3, 0.5, 0.2.
8. **grounded_generate**: each hit cites review, image tags and ambient dB.

## Options side by side
type: comparison
from: phases/12-multimodal-ai/23-colpali-vision-native-rag/docs/en.md

| Factor | ColPali | VisRAG | Text-RAG |
|---|---|---|---|
| Page vectors | $N_p$ patch vectors | One pooled vector | One vector per chunk |
| Scoring | MaxSim | Bi-encoder | Cosine on chunks |
| OCR step | None | None | OCR / pdftotext |
| Storage | ~15x text-RAG after PQ | Smaller | ~150 kB per 50 chunks |
| Recall | Strong | Weaker | Loses charts and tables |
| Use for | Quality | Scale | Pure-text documents |

## Use X when
type: tips
from: phases/12-multimodal-ai/23-colpali-vision-native-rag/docs/en.md, phases/12-multimodal-ai/24-multimodal-rag-cross-modal/docs/en.md

- Use ColPali or ColQwen2 for financial reports, papers, contracts and medical records.
- Use VisRAG when indexing speed and storage matter more than recall.
- Use text-RAG for wiki articles, chat logs and multi-million-page archives.
- Use text-RAG when regulation demands extractable OCR text.
- Use CLIP or SigLIP 2 for text and image. Use CLAP for text and audio.
- Use score fusion first. Upgrade to MoE fusion when A/B shows clear wins.

## Formulas and numbers
type: concepts
from: phases/12-multimodal-ai/23-colpali-vision-native-rag/docs/en.md, phases/19-capstone-projects/04-multimodal-document-qa/docs/en.md

- **MaxSim**: $\sum_i \max_j \cos(q_i, p_j)$ over query tokens and page patches.
- **ColPali storage**: 50 * 729 * 128 * 4 bytes = ~18 MB raw, ~2.3 MB after 8x PQ.
- **Text-RAG storage**: 50 chunks * 768-dim * 4 bytes = ~150 kB.
- **PQ**: shrinks storage ~8x and keeps vector similarity.
- **ViDoRe**: ColPali-v1 ~80% nDCG@5. Text-RAG ~50-60%.
- **ColQwen page**: ~2048 patch embeddings of dim 128.
- **DocPruner**: 50% compression at < 0.5% accuracy loss.
- **Capstone targets**: 10k pages, top-5 pages to the VLM, answers under 2s.

## Defaults
type: defaults
from: phases/19-capstone-projects/04-multimodal-document-qa/code/main.py, phases/12-multimodal-ai/24-multimodal-rag-cross-modal/code/main.py, projects/visual-evidence-library/solution/main.py

| Setting | Default | Note |
|---|---|---|
| `EMB_DIM` | 16 | Fake patch vectors in the capstone |
| `keep_fraction` | 0.5 | `doc_prune` keeps at least 1 patch |
| Retrieve k | 5 | Top pages by MaxSim |
| `confidence_floor` | 0.8 | `main` passes 0.7 |
| `search` limit | 20 | Must be between 1 and 100 |
| `--query` | seed return | Evidence library CLI |
| `--model` | local-vision-model | Used with `--vision-image` |
| `--out` | visual-output | Holds index.html and evidence.json |

## Manifest and proposal errors
type: troubleshooting
from: projects/visual-evidence-library/solution/main.py, projects/visual-evidence-library/README.md

| Symptom | Cause | Fix |
|---|---|---|
| Asset IDs must be nonempty and unique | Empty or repeated `id` | Give each asset a unique id |
| Image dimensions must be positive integers at most 20000 | Bad `width` or `height` | Declare integer pixel sizes |
| Asset must be an image inside the manifest directory | Path escapes root or wrong suffix | Use .svg, .png, .jpg or .jpeg under root |
| Asset exceeds 5 MB | Large file | Shrink the image |
| Bounding box lies outside the declared image dimensions | x + w or y + h too large | Fix the `bbox` |
| Model-proposed text needs explicit review before indexing | `reviewed` is not true | Check the image, then set reviewed=true |
| Vision extraction requires --provider-url, --width and --height | Missing flags | Pass all three |
| Image bytes do not match the extension | PNG or JPEG magic bytes differ | Use the correct extension |

## Abbreviations
type: glossary
from: phases/12-multimodal-ai/23-colpali-vision-native-rag/docs/en.md, phases/12-multimodal-ai/24-multimodal-rag-cross-modal/docs/en.md, phases/19-capstone-projects/04-multimodal-document-qa/docs/en.md

- **MaxSim**: max similarity per query token, summed across the query.
- **ViDoRe**: Visual Document Retrieval Evaluation. Metric nDCG@5.
- **PQ / OPQ**: product quantization. Compresses patch vectors.
- **VisRAG**: pools each page into one vector with a VLM.
- **M3DocRAG**: retrieves pages across documents for multi-page reasoning.
- **MoE fusion**: a gating network routes to modality experts.
- **MuRAG**: the 2022 paper that started multimodal RAG.
- **Evidence region**: a bbox on the source page for the answer span.

## Questions
type: qa
from: phases/12-multimodal-ai/23-colpali-vision-native-rag/code/main.py, phases/12-multimodal-ai/23-colpali-vision-native-rag/docs/en.md, phases/12-multimodal-ai/24-multimodal-rag-cross-modal/docs/en.md, projects/visual-evidence-library/README.md

- **Why MaxSim, not mean similarity?** Irrelevant patches wash out the mean.
- **How do you cite mixed sources?** Text `[1]`, image `[img 3]`, audio `[audio 2 at 0:34]`.
- **How do you grade cross-modal RAG?** Recall@k per modality and fused top-k accuracy.
- **Does the evidence library do OCR?** No. It indexes supplied text rectangles.
- **What is query coverage?** Matched terms divided by query terms. It is not confidence.
