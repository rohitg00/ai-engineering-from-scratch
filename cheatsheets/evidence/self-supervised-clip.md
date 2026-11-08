# Evidence: cheatsheets/self-supervised-clip.md

Abbreviations: P04 = phases/04-computer-vision. L17 = P04/17-self-supervised-vision, L18 = P04/18-open-vocab-clip, L20 = P04/20-image-retrieval-metric, M02 = phases/12-multimodal-ai/02-clip-contrastive-pretraining. d = docs/en.md, c = code/main.py, s = outputs/skill-clip-zero-shot.md.

## Families and models (concepts, 8)
- Contrastive SimCLR, MoCo, CLIP, positives together, negatives apart: L17/d:31, 42
- Teacher-student DINO, BYOL, iBOT, EMA teacher, no explicit negatives: L17/d:32, 57
- Masked MAE, BEiT, SimMIM, mask 75%, reconstruct pixels: L17/d:33, 72
- CLIP two towers, 400M pairs, zero supervised labels: L18/d:21, M02/d:3
- SigLIP per-pair sigmoid, no all-gather, better at small batch: L18/d:59-68, M02/d:72
- Linear probe frozen encoder + linear classifier, feature quality: L17/d:99, 106
- Probe top-1 SimCLR ~71%, DINO ~77%, MAE ~76%, DINOv2 ~86%: L17/d:101-104
- Category level works off-the-shelf, instance level needs metric learning: L20/d:100-101

## CLIP two towers (architecture, 8 nodes)
- Image, batch of N pairs: M02/d:38
- Image encoder ViT or ResNet: M02/d:33
- Image L2 normalise to unit length, D-dim: M02/d:36, L18/d:41
- Caption, N captions: M02/d:38
- Text encoder small transformer: M02/d:34, L18/d:32
- Text L2 normalise to unit length, D-dim: M02/d:36, L18/d:41
- Similarity S (N, N) divided by tau: M02/d:38-42
- Symmetric CE (i2t + t2i) / 2, diagonal targets: L18/d:47-55, M02/d:50-54

## Formulas (concepts, 8)
- InfoNCE L_ij: L17/d:45-51
- CLIP S[i, j] = cos / tau, shape (N, N): M02/d:38-42
- CLIP loss rows and columns over 2: L18/d:50-52
- SigLIP log(1 + exp(-y sim)), y = +1 or -1: L18/d:61-66
- DINO EMA teacher update: L17/d:63
- Triplet loss with margin: L20/d:57-59
- ||a - b||^2 = 2 - 2 cos(a, b) for unit vectors: L20/d:72
- Recall@K definition: L20/d:78-80

## InfoNCE and MAE masking (annotated-code, 10 lines)
- info_nce body with tau=0.1, eye mask, -inf fill, targets, cross_entropy: L17/d:151-163, L17/c:5
- L2-normalise before calling: L17/d:166
- num_patches = 196, random_mask_indices(num_patches, mask_ratio=0.75): L17/d:194-195, L17/c:15
- keep 1 - mask_ratio of patches: L17/d:187

## CLIP loss and zero-shot (annotated-code, 8 lines)
- sim = logit_scale * image_emb @ text_emb.T, arange targets, two cross_entropy, mean: L18/d:127-133, L18/c:25-31
- random init loss near log(N): L18/d:169
- zero-shot normalise image_proj and text_proj, i @ t.T, argmax: L18/d:147-150

## Triplet loss and recall@K (annotated-code, 10 lines)
- triplet_loss with margin=0.2, pairwise_distance p=2, relu mean: L20/d:117-120, L20/c:6
- semi_hard_negatives(emb, y), hardest positive, semi-hard negative: L20/d:155, 202
- triplet_loss(emb, emb[pos_idx], emb[neg_idx]): L20/d:203
- sim, topk, matches, float().mean().item(): L20/d:161-164
- inner product on L2-normalised equals cosine: L20/d:167

## Zero-shot classification (flow, 7 steps)
1. "a photo of a {class}" per class: L18/d:74
2. average templates, extra 1-3% top-1: L18/d:80
3. T shape (C, d): L18/d:75
4. I shape (1, d): L18/d:76
5. normalize both sides to unit length: M02/s:15
6. I @ T.T shape (1, C): L18/d:77
7. argmax predicted class: L18/d:78; warn when top-1 below 0.2: M02/s:18

## Tasks in code (task-table, 8)
- info_nce(z1, z2, tau=0.1): L17/c:5
- DinoHead teacher temp=0.04 with centre: L17/c:24, 39-41
- clip_loss(i, t, logit_scale): L18/c:25
- zero_shot_classify(model, image_feats, class_text_feats, class_names): L18/c:35
- semi_hard_negatives(emb, labels, margin=0.2): L20/c:12
- recall_at_k(query_emb, gallery_emb, query_labels, gallery_labels, k=1): L20/c:39
- infonce_loss(S): M02/c:43
- sigmoid_loss(S, bias=0.0): M02/c:64

## Defaults and numbers (defaults, 8)
- SimCLR tau 0.1, lower needs more negatives: L17/d:50, 166
- CLIP tau init 0.07, logit_scale 2.6592 = ln(1/0.07): L18/d:55, 114, L18/c:11
- SimCLR batch 512-8192: L17/d:53
- mask_ratio 0.75, BERT 15%: L17/d:90, 185
- MAE decoder 8-layer, 512-dim, encoder sees visible patches only: L17/d:83
- DINO m 0.996: L17/d:63
- teacher temp 0.04, student temp 0.1: L17/c:36, 39
- triplet margin 0.2, semi-hard margin 0.2: L20/c:6, 12

## Pick a FAISS index (command-table, 8)
- IndexFlatIP / IndexFlatL2 brute force, exact, no training, up to ~1M: L20/d:90
- IndexFlatIP on cosine for 100k vectors: L20/d:94
- IndexIVFFlat K cells, needs training, 10M: L20/d:91, 94
- IndexHNSW graph, fastest for many queries, large index: L20/d:92
- IndexIVFPQ product quantisation, 100M+: L20/d:94
- DINOv2 + FAISS general retrieval: L20/d:213
- CLIP + FAISS text queries: L20/d:214
- Fine-tuned DINOv2 + FAISS instance, re-ID, e-commerce: L20/d:215

## Troubleshooting (troubleshooting, 8)
- batch matters, SimCLR 512-8192, MoCo momentum queue: L17/d:13, 53
- collapse prevented by centring and sharpening: L17/d:66, 248
- 75% mask so extrapolation cannot solve it: L17/d:82, 95
- recall@10 > 0.95, recall@1 < 0.5, longer fine-tune or re-rank: L20/d:82
- mixing cosine and L2 changes nearest: L20/d:72
- instance-level needs fine-tuning with metric learning: L20/d:101
- easy triplets give zero loss, semi-hard mining: L20/d:63
- softmax needs all-gather, sigmoid does not: M02/d:64, 72

## Questions (qa, 6)
- 75% vs 15%, low entropy patches: L17/d:88-95
- random pairs log(2N - 1) about 3.4 for 16 pairs: L17/d:180
- log(8) = 2.08 at random init: L18/d:169
- fine-tuning adds 2-5 points: L17/d:106
- outputs.last_hidden_state[:, 0], CLS token, 768-dim: L17/d:218-221
- probe beats zero-shot in domain, fine-tune can hurt zero-shot: M02/d:88
