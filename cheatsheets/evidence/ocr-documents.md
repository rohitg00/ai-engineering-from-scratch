# Evidence: cheatsheets/ocr-documents.md

Abbreviations: L0419 = phases/04-computer-vision/19-ocr-document-understanding, L1222 = phases/12-multimodal-ai/22-document-diagram-understanding, L1223 = phases/12-multimodal-ai/23-colpali-vision-native-rag, C04 = phases/19-capstone-projects/04-multimodal-document-qa, DESK = projects/document-extraction-desk. d = docs/en.md, c = code/main.py.

## Classical OCR pipeline (architecture, 8 nodes, 7 edges)
- Image: L0419/d:35
- Text detection (DB, EAST, CRAFT): L0419/d:35
- Word/line bounding boxes: L0419/d:36
- Crop each region, fixed height: L0419/d:37, 49
- Recognition (CRNN + CTC): L0419/d:38
- Text strings: L0419/d:39
- Layout ordering, reading order: L0419/d:40, 50
- Reading-order text: L0419/d:41

## Tasks in code (task-table, 7 rows)
- ctc_loss(log_probs, targets, input_lengths, target_lengths, blank=0): L0419/c:10, L0419/d:99
- greedy_ctc_decode(log_probs, blank=0): L0419/c:15
- TinyCRNN(vocab_size=40, hidden=128, feat=32): L0419/d:136
- paddleocr.PaddleOCR(lang="en").ocr(image_path): L0419/d:220
- layoutlm_input(tokens, patch_grid=(16, 16)): L1222/c:34
- donut_schema("invoice"): L1222/c:44, 92
- retrieve(query, pages, k=3): L1223/c:70

## Train a CRNN with CTC (annotated-code, 9 lines)
- vocab with "_" first, blank at index 0: L0419/d:192, 101
- TinyCRNN(vocab_size=len(vocab)), Adam lr=1e-3: L0419/d:202-203
- build_batch(strings, vocab), H = 32: L0419/d:179, 207
- log_probs shape (W', N, vocab): L0419/d:156, 208
- input_lens torch.full: L0419/d:209
- F.ctc_loss with blank, reduction="mean", zero_infinity=True: L0419/d:106-107
- opt.zero_grad(); loss.backward(); opt.step(): L0419/d:211
- loss ~3 to ~0.2 over 200 steps: L0419/d:214

## MaxSim late interaction (annotated-code, 10 lines)
- maxsim loop, max cosine over patches, sum: L1223/c:35-42
- scored list with p.doc_id and maxsim: L1223/c:71
- sort by -score: L1223/c:72
- build_index(prune=True), 50% patches: C04/c:122, 135, 134
- idx.retrieve(q, k=3): C04/c:147

## Commands (command-table, 7 rows)
- python3 cli.py sample.txt --schema schema.json --output output/review.html: DESK/README.md:13
- writes HTML and companion JSON: DESK/solution/cli.py:24-25
- --proposals, external candidates: DESK/solution/cli.py:13
- --approve, decisions from the HTML desk: DESK/solution/cli.py:14
- python3 scripts/project_test.py document-extraction-desk --all --solution --strict: DESK/README.md:42
- python main.py: C04/c:9
- npm start, one self-check pass, exits 0: C04/code/ts/README.md:32
- npm run serve, HTTP server on 127.0.0.1: C04/code/ts/README.md:33

## Vision-first document QA (flow, 8 steps)
1. Render to 1536x2048 PNG, persist {doc_id, page_num, image_path}: C04/d:68
2. ColQwen2.5-v0.2, ~2048 patch embeddings of dim 128: C04/d:70
3. DocPruner keeps the highest-signal half: C04/d:70
4. Query tower, MaxSim, top-k pages: C04/d:72
5. Qwen3-VL-30B with top-5 page images, cite (doc_id, page): C04/d:74
6. Bounding boxes as overlays: C04/d:76
7. Nougat or dots.ocr on equation-dense pages: C04/d:78
8. ViDoRe v3 nDCG@5, M3DocVQA, OCR-then-text baseline: C04/d:80

## Formulas and numbers (concepts, 6 bullets)
- CTC merge repeats and remove blanks, "hello" example: L0419/d:54, 57-58
- CER Levenshtein / reference length, WER word level: L0419/d:80-81
- MaxSim sum_i max_j cos(q_i, p_j): L1223/d:53
- 50 x 729 x 128 x 4 bytes ~18 MB raw, ~2.3 MB after 8x PQ: L1223/d:96-98
- 50 chunks x 768 x 4 bytes ~150 kB, ~120x raw and ~15x after PQ: L1223/d:99, 101
- ColPali-v1 ~80% nDCG@5, text-RAG ~50-60%: L1223/d:82

## Defaults and limits (defaults, 7 rows)
- CER target < 2% on clean scans: L0419/d:80
- input height 32, CNN pools height to 1, width is time: L0419/d:179, 159
- 180 DPI PyMuPDF: C04/d:53
- DocPruner 50%, < 0.5% accuracy loss: C04/d:33, 56
- Schema needs 1 to 30 fields, lowercase name, unique labels: DESK/solution/main.py:10-11, 15, 25
- at most 100000 characters: DESK/solution/main.py:33-34
- at most 300 candidates: DESK/solution/main.py:67

## Pick a document stack (concepts, 7 bullets)
- Pure-printed invoices at scale, LayoutLMv3 + rules: L1222/d:125
- Mixed documents, VLM-native PaliGemma 2 or Qwen2.5-VL: L1222/d:126
- arXiv, Nougat for math, VLM for figures: L1222/d:127
- Regulatory, OCR pipeline + VLM validator: L1222/d:128
- Receipts with repeatable structure, fine-tune Donut: L0419/d:233
- Pure-text documents, text-RAG simpler and cheaper: L1223/d:105
- ColPali for quality, VisRAG for scale: L1223/d:72

## Troubleshooting (troubleshooting, 6 rows)
- 'Approval belongs to another document version', sourceSha256 check: DESK/solution/main.py:69-73
- 'Proposal does not match its exact source span': DESK/solution/main.py:84-85
- 'Use an ISO date: YYYY-MM-DD': DESK/solution/main.py:59-60
- Two Seats quotes give ambiguous, reviewer chooses: DESK/stages/03-review-and-approve/docs/en.md:25, DESK/solution/main.py:107-108
- Donut on a scientific paper fails: L1222/d:63
- OCR drops chart data, ColPali embeds page image: L1223/d:3

## Abbreviations (glossary, 6 bullets)
- CTC: L0419/d:13, 253
- CRNN: L0419/d:254
- VLM-OCR: L0419/d:259
- DocVQA: L1222/d:166
- ViDoRe, nDCG@5: L1223/d:80
- PQ ~8x: L1223/d:149

## Questions (qa, 4 bullets)
- CTC trains without character-level alignment: L0419/d:54
- OCR pipelines win on scale, reliability, auditable output: L1222/d:95-99
- MaxSim vs mean, irrelevant patches wash out the mean: L1223/c:97-99, L1223/d:43
- Offsets prove provenance, reviewer confirms: DESK/README.md:45, DESK/solution/main.py:119
