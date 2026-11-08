# Evidence: cheatsheets/multimodal-rag.md

Abbreviations: L23 = phases/12-multimodal-ai/23-colpali-vision-native-rag, L24 = phases/12-multimodal-ai/24-multimodal-rag-cross-modal, C04 = phases/19-capstone-projects/04-multimodal-document-qa, VEL = projects/visual-evidence-library. d = docs/en.md, c = code/main.py.

## Architecture: Vision-first document QA pipeline (8 nodes, 7 edges)
- PDFs, page renderer 180 DPI: C04/d:28, 53
- ColQwen2.5-v0.2, ~2048 patches: C04/d:31
- DocPruner 50% compression: C04/d:33
- Multi-vector index, Vespa or Qdrant: C04/d:36
- Query, token embeddings: C04/d:38, 72
- Retrieve top-k pages, MaxSim: C04/d:38
- VLM answerer, query + top-k page images: C04/d:41-42
- Answer with cited pages + evidence regions, viewer with boxes on source page: C04/d:45, 48

## Tasks in code (task-table, 8)
- maxsim(query_tokens, patches): L23/c:35-36
- retrieve(query, pages, k=3): L23/c:70
- doc_prune(patches, keep_fraction=0.5): C04/c:54
- build_index(prune=True): C04/c:122, 135
- fuse([t, i, a], [0.3, 0.4, 0.3]): L24/c:103
- agentic_loop(query, confidence_floor=0.8): L24/c:99
- validate_manifest(manifest, root): VEL/solution/main.py:14
- search(assets, query, limit=20): VEL/solution/main.py:87

## Run the lessons and the project (command-table, 8)
- python main.py: C04/c:9, ablation C04/c:151-160
- npm start, --demo, exits 0: C04/code/ts/README.md:32, C04/code/ts/package.json:8
- npm run serve, 127.0.0.1, PORT unset gives a free port: C04/code/ts/README.md:33, 36
- npm test: C04/code/ts/README.md:31, 42-44
- project_test.py --init: VEL/README.md:18
- project_test.py --stage 1 --path: VEL/README.md:19
- main.py --manifest ... --query "return dry seeds" --out ./visual-output: VEL/README.md:29, writes index.html and evidence.json VEL/README.md:5, 32
- python3 demo.py: VEL/README.md:32-35

## MaxSim late interaction (annotated-code, 12 lines)
- max_sim_score loop body: C04/c:71-83
- build_index(prune=True), keep_fraction 0.5: C04/c:122-129, 135
- idx.retrieve(q, k=3) returns (Page, score): C04/c:97-101, 147

## Score fusion and agentic retry (flow, 8 steps)
1. Decompose quiet / vegan brunch / natural light: L24/d:84-88
2. text_retrieve keyword counts divided by keyword count: L24/c:36-44
3. image_retrieve tag hints natural_light, airy: L24/c:47-60
4. audio_retrieve 1.0 - r.ambient_db / 80.0, else 0.5: L24/c:63-72
5. fuse weights 0.3, 0.4, 0.3, top_k k=3: L24/c:103-104
6. confidence below confidence_floor adds " bright windows low noise": L24/c:105-110
7. round 2 weights 0.3, 0.5, 0.2: L24/c:113
8. grounded_generate cites review, img tags, ambient dB: L24/c:89-96

## Options side by side (comparison, 6 rows)
- Page vectors: ColPali N_p patches L23/d:51, VisRAG single vector L23/d:70, text-RAG one vector per chunk L23/d:25
- Scoring: MaxSim L23/d:53, bi-encoder L23/d:70, cosine L23/d:26
- OCR: none L23/d:92, text-RAG OCR / pdftotext L23/d:23
- Storage: ~15x after PQ L23/d:101, VisRAG smaller L23/d:70, ~150 kB L23/d:99
- Recall: strong L23/d:45, weaker L23/d:70, charts and tables lost L23/d:29
- Use for: quality vs scale L23/d:72, pure-text L23/d:105

## Use X when (tips, 6)
- ColPali for financial reports, papers, contracts, medical records: L23/d:109
- VisRAG faster indexing, smaller storage: L23/d:70-72
- text-RAG for wiki, chat logs, multi-million-page archives: L23/d:105-106
- regulatory OCR text: L23/d:107
- CLIP / SigLIP 2, CLAP: L24/d:40
- score fusion first, MoE on A/B wins: L24/d:52

## Formulas and numbers (concepts, 8)
- MaxSim formula: L23/d:53
- ColPali storage ~18 MB, ~2.3 MB after 8x PQ: L23/d:98
- Text-RAG ~150 kB: L23/d:99
- PQ ~8x: L23/d:149
- ViDoRe ~80% vs ~50-60%: L23/d:82
- ~2048 patch embeddings of dim 128: C04/d:70
- DocPruner 50% at < 0.5% accuracy loss: C04/d:56
- 10k pages, answers under 2s: C04/d:15, top-5 page images: C04/d:74

## Defaults (defaults, 8)
- EMB_DIM 16: C04/c:24
- keep_fraction 0.5, max(1, ...): C04/c:54, 59
- retrieve k 5: C04/c:97
- confidence_floor 0.8, main passes 0.7: L24/c:99, 139
- search limit 20, 1 to 100: VEL/solution/main.py:87-89
- --query default seed return: VEL/solution/main.py:313
- --model default local-vision-model, --vision-image: VEL/solution/main.py:315, 317
- --out default visual-output: VEL/solution/main.py:314, outputs VEL/solution/main.py:282, 298

## Manifest and proposal errors (troubleshooting, 8)
- Asset IDs must be nonempty and unique: VEL/solution/main.py:26
- Image dimensions must be positive integers at most 20000: VEL/solution/main.py:29-30
- Asset must be an image inside the manifest directory: VEL/solution/main.py:33-38
- Asset exceeds 5 MB: VEL/solution/main.py:39-40
- Bounding box lies outside the declared image dimensions: VEL/solution/main.py:63-66
- Model-proposed text needs explicit review before indexing: VEL/solution/main.py:71-77, reviewed=true VEL/README.md:49
- Vision extraction requires --provider-url, --width and --height: VEL/solution/main.py:322-325
- Image bytes do not match the extension: VEL/solution/main.py:173-176

## Abbreviations (glossary, 8)
- MaxSim: L23/d:144
- ViDoRe, nDCG@5: L23/d:80
- PQ / OPQ: L23/d:60, 149
- VisRAG: L23/d:70
- M3DocRAG: L23/d:76
- MoE fusion: L24/d:50
- MuRAG 2022: L24/d:76
- Evidence region: C04/d:131

## Questions (qa, 5)
- MaxSim vs mean washed out: L23/c:97-99
- Citations [1], [img 3], [audio 2 at 0:34]: L24/d:58-60
- Recall@k per modality, fused top-k accuracy: L24/d:107-108
- No OCR, supplied text: VEL/README.md:47
- Query coverage is lexical overlap, not confidence: VEL/README.md:47, VEL/solution/main.py:105
