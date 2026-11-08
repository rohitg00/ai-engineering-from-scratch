---
id: ocr-documents
title: OCR and Document Understanding
code: OD
subtitle: Train CTC OCR, pick a document stack, retrieve pages with MaxSim and approve fields against exact source spans.
hue: 165
sources: phases/04-computer-vision/19-ocr-document-understanding, phases/12-multimodal-ai/22-document-diagram-understanding, phases/12-multimodal-ai/23-colpali-vision-native-rag, phases/19-capstone-projects/04-multimodal-document-qa, projects/document-extraction-desk
source_hash: 31f050e1ba845909
---

## Classical OCR pipeline
type: architecture
from: phases/04-computer-vision/19-ocr-document-understanding/docs/en.md

```arch
node | img | 1,1 | Image | | client
node | det | 2,1 | Text detection | DB, EAST, CRAFT | model
node | box | 3,1 | Bounding boxes | word or line | store
node | crop | 4,1 | Crop each region | fixed height | process
node | rec | 4,2 | Recognition | CRNN + CTC | model
node | txt | 3,2 | Text strings | | store
node | lay | 2,2 | Layout ordering | reading order | process
node | out | 1,2 | Reading-order text | | client
edge | img | det |
edge | det | box |
edge | box | crop |
edge | crop | rec |
edge | rec | txt |
edge | txt | lay |
edge | lay | out |
```

## Tasks in code
type: task-table
from: phases/04-computer-vision/19-ocr-document-understanding/docs/en.md, phases/04-computer-vision/19-ocr-document-understanding/code/main.py, phases/12-multimodal-ai/22-document-diagram-understanding/code/main.py, phases/12-multimodal-ai/23-colpali-vision-native-rag/code/main.py, phases/19-capstone-projects/04-multimodal-document-qa/code/main.py

| Task | Code |
|---|---|
| CTC loss | `ctc_loss(log_probs, targets, ...)` |
| Greedy CTC decode | `greedy_ctc_decode(log_probs, blank=0)` |
| Line recogniser | `TinyCRNN(vocab_size=40, hidden=128, feat=32)` |
| Production OCR | `PaddleOCR(lang="en").ocr(image_path)` |
| LayoutLMv3 input | `layoutlm_input(tokens)` |
| Donut JSON schema | `donut_schema("invoice")` |
| Top-k pages by MaxSim | `retrieve(query, pages, k=3)` |

## Train a CRNN with CTC
type: annotated-code
lang: python
from: phases/04-computer-vision/19-ocr-document-understanding/docs/en.md, phases/04-computer-vision/19-ocr-document-understanding/code/main.py

```python
vocab = ["_"] + list("0123456789abcdefghijklmnopqrstuvwxyz")  # blank at index 0
model = TinyCRNN(vocab_size=len(vocab))
opt = torch.optim.Adam(model.parameters(), lr=1e-3)
imgs, targets, target_lens = build_batch(strings, vocab)    # height 32
log_probs = model(imgs)                                     # (W', N, vocab)
input_lens = torch.full((8,), log_probs.size(0), dtype=torch.long)
loss = F.ctc_loss(log_probs, targets, input_lens, target_lens,
                  blank=0, reduction="mean", zero_infinity=True)
opt.zero_grad(); loss.backward(); opt.step()                # ~3 to ~0.2 in 200 steps
```

## MaxSim late interaction
type: annotated-code
lang: python
from: phases/12-multimodal-ai/23-colpali-vision-native-rag/code/main.py, phases/19-capstone-projects/04-multimodal-document-qa/code/main.py

```python
def maxsim(query_tokens, patches):
    s = 0.0
    for q in query_tokens:                      # one vector per query token
        best = max(cosine(q, p) for p in patches)  # best page patch
        s += best                               # sum over query tokens
    return s
scored = [(p.doc_id, maxsim(query.tokens, p.patches)) for p in pages]
scored.sort(key=lambda x: -x[1])                # top-k pages
idx = build_index(prune=True)                   # DocPruner on, 50% patches
hits = idx.retrieve(q, k=3)
```

## Commands
type: command-table
span: 2
from: projects/document-extraction-desk/README.md, projects/document-extraction-desk/solution/cli.py, phases/19-capstone-projects/04-multimodal-document-qa/code/ts/README.md, phases/19-capstone-projects/04-multimodal-document-qa/code/main.py

| Command | What it does |
|---|---|
| `python3 cli.py sample.txt --schema schema.json --output output/review.html` | Builds the HTML review desk and a JSON report |
| `--proposals <file>` | Loads external OCR or model candidates |
| `--approve <file>` | Applies decisions downloaded from the HTML desk |
| `python3 scripts/project_test.py document-extraction-desk --all --solution --strict` | Grades the reference solution |
| `python main.py` | Runs the capstone MaxSim and DocPruner scaffold |
| `npm start` | Runs the viewer self-check once and exits 0 |
| `npm run serve` | Starts the viewer HTTP server on 127.0.0.1 |

## Vision-first document QA
type: flow
from: phases/19-capstone-projects/04-multimodal-document-qa/docs/en.md

1. **Ingest**: render each PDF page to a 1536x2048 PNG. Keep `{doc_id, page_num, image_path}`.
2. **Embed**: run ColQwen2.5-v0.2. Get ~2048 patch vectors of dim 128 per page.
3. **Prune**: DocPruner keeps the highest-signal half of the patches.
4. **Query**: embed query tokens. Run MaxSim. Return the top-k pages.
5. **Synthesize**: give the query and the top-5 page images to the VLM. Cite (doc_id, page).
6. **Evidence**: draw the cited bounding boxes as overlays in the viewer.
7. **OCR fallback**: run Nougat or dots.ocr on equation-dense pages.
8. **Eval**: report ViDoRe v3 nDCG@5 and M3DocVQA against OCR-then-text.

## Formulas and numbers
type: concepts
from: phases/04-computer-vision/19-ocr-document-understanding/docs/en.md, phases/12-multimodal-ai/23-colpali-vision-native-rag/docs/en.md

- **CTC collapse**: merge repeats, then remove blanks. "h h h _ _ e e l l _ l l o _ _" gives "hello".
- **CER**: Levenshtein distance divided by the reference length. WER is the same per word.
- **MaxSim**: $\sum_i \max_j \cos(q_i, p_j)$ over query tokens $q_i$ and page patches $p_j$.
- **ColPali storage**: 50 pages x 729 patches x 128 dims x 4 bytes = ~18 MB raw, ~2.3 MB after 8x PQ.
- **Text-RAG storage**: 50 chunks x 768 dims x 4 bytes = ~150 kB. ColPali is ~120x more raw, ~15x after PQ.
- **ViDoRe**: ColPali-v1 scores ~80% nDCG@5. Text-RAG scores ~50-60%.

## Defaults and limits
type: defaults
from: phases/04-computer-vision/19-ocr-document-understanding/docs/en.md, phases/19-capstone-projects/04-multimodal-document-qa/docs/en.md, projects/document-extraction-desk/solution/main.py

| Setting | Default | Note |
|---|---|---|
| CER target | < 2% | On clean scans |
| CRNN input height | 32 | CNN pools height to 1. Width is time |
| Page render | 180 DPI | PyMuPDF in the capstone |
| DocPruner | 50% | Under 0.5% accuracy loss |
| Schema fields | 1 to 30 | Lowercase names, unique labels |
| Document size | 100000 | Characters at most |
| Candidates | 300 | Proposals at most per review |

## Pick a document stack
type: concepts
from: phases/12-multimodal-ai/22-document-diagram-understanding/docs/en.md, phases/12-multimodal-ai/23-colpali-vision-native-rag/docs/en.md, phases/04-computer-vision/19-ocr-document-understanding/docs/en.md

- **Printed invoices at scale**: LayoutLMv3 + rules. Cost-efficient.
- **Mixed, handwritten, forms**: VLM-native (PaliGemma 2 or Qwen2.5-VL).
- **arXiv papers**: Nougat for math, a VLM for figures.
- **Regulated**: OCR pipeline + VLM validator as a cross-check.
- **Receipts with fixed structure**: fine-tune Donut.
- **Pure-text documents**: text-RAG. It is simpler and uses less storage.
- **Visually rich PDFs**: ColPali for quality, VisRAG for scale.

## Troubleshooting
type: troubleshooting
from: projects/document-extraction-desk/solution/main.py, projects/document-extraction-desk/solution/cli.py, projects/document-extraction-desk/stages/03-review-and-approve/docs/en.md, phases/12-multimodal-ai/22-document-diagram-understanding/docs/en.md, phases/12-multimodal-ai/23-colpali-vision-native-rag/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| "Approval belongs to another document version" | Text changed, `sourceSha256` differs | Review the new version again |
| "Proposal does not match its exact source span" | Quote is not at `start`, `end` | Fix the offsets of the proposal |
| "Use an ISO date: YYYY-MM-DD" | Date field text is not ISO | Correct the source text |
| Field state is ambiguous | Two Seats quotes | Choose one span with `--approve` |
| Donut fails on a paper | OCR-free models are specialists | Use Nougat for papers |
| Chart data missing in RAG | OCR drops chart data | Embed page images with ColPali |

## Abbreviations
type: glossary
from: phases/04-computer-vision/19-ocr-document-understanding/docs/en.md, phases/12-multimodal-ai/22-document-diagram-understanding/docs/en.md, phases/12-multimodal-ai/23-colpali-vision-native-rag/docs/en.md

- **CTC**: Connectionist Temporal Classification. Trains without per-timestep labels.
- **CRNN**: conv features + BiLSTM + CTC. The 2015 baseline.
- **VLM-OCR**: a vision-language model trained or prompted for OCR.
- **DocVQA**: the document VQA standard. The most-cited score.
- **ViDoRe**: Visual Document Retrieval Evaluation. Metric is nDCG@5.
- **PQ**: product quantization. Shrinks storage ~8x.

## Questions
type: qa
from: phases/04-computer-vision/19-ocr-document-understanding/docs/en.md, phases/12-multimodal-ai/22-document-diagram-understanding/docs/en.md, phases/12-multimodal-ai/23-colpali-vision-native-rag/docs/en.md, projects/document-extraction-desk/README.md

- **Why CTC?** It trains without character-level alignment.
- **When do OCR pipelines still win?** Massive scan scale, deterministic failures, auditable output.
- **Why MaxSim over a mean?** Each query token picks its best patch. Irrelevant patches do not wash it out.
- **Do offsets prove the value is right?** No. They prove provenance. A reviewer confirms the field.
