---
id: self-supervised-clip
title: Self-Supervised Vision, CLIP and Retrieval
code: SS
subtitle: Pretrain without labels, align images and text, classify zero-shot, shape embeddings and search them. PyTorch.
hue: 285
sources: phases/04-computer-vision/17-self-supervised-vision, phases/04-computer-vision/18-open-vocab-clip, phases/04-computer-vision/20-image-retrieval-metric, phases/12-multimodal-ai/02-clip-contrastive-pretraining
source_hash: 7c8ba7f92fca8ec6
---

## Families and models
type: concepts
from: phases/04-computer-vision/17-self-supervised-vision/docs/en.md, phases/04-computer-vision/18-open-vocab-clip/docs/en.md, phases/04-computer-vision/20-image-retrieval-metric/docs/en.md, phases/12-multimodal-ai/02-clip-contrastive-pretraining/docs/en.md

- **Contrastive (SimCLR, MoCo, CLIP)**: pull two views together. Push the rest of the batch away.
- **Teacher-student (DINO, BYOL, iBOT)**: the student matches an EMA teacher. No negatives.
- **Masked (MAE, BEiT, SimMIM)**: mask 75% of patches. Reconstruct the pixels.
- **CLIP**: image and text towers in one space. 400M web pairs, no labels.
- **SigLIP**: per-pair sigmoid. No all-gather. Trains better at small batches.
- **Linear probe**: frozen encoder plus one linear layer. Measures feature quality.
- **Probe top-1**: SimCLR ~71%, DINO ~77%, MAE ~76%, DINOv2 ~86%.
- **Category or instance retrieval**: off-the-shelf embeddings work for category. Instance needs metric learning.

## CLIP two towers
type: architecture
from: phases/04-computer-vision/18-open-vocab-clip/docs/en.md, phases/12-multimodal-ai/02-clip-contrastive-pretraining/docs/en.md

```arch
node | img | 1,1 | Image | batch of N | client
node | ienc | 2,1 | Image encoder | ViT or ResNet | model
node | inorm | 3,1 | L2 normalise | (N, D)
node | txt | 1,2 | Caption | N captions | client
node | tenc | 2,2 | Text encoder | transformer | model
node | tnorm | 3,2 | L2 normalise | (N, D)
node | sim | 4,1 | Similarity S | N x N, over tau
node | loss | 4,2 | Symmetric CE | (i2t + t2i) / 2
edge | img | ienc |
edge | ienc | inorm |
edge | txt | tenc |
edge | tenc | tnorm |
edge | inorm | sim |
edge | tnorm | sim |
edge | sim | loss | diagonal targets
```

## Formulas
type: concepts
from: phases/04-computer-vision/17-self-supervised-vision/docs/en.md, phases/04-computer-vision/18-open-vocab-clip/docs/en.md, phases/04-computer-vision/20-image-retrieval-metric/docs/en.md, phases/12-multimodal-ai/02-clip-contrastive-pretraining/docs/en.md

- **InfoNCE**: $-\log \frac{\exp(\mathrm{sim}(z_i, z_j)/\tau)}{\sum_{k \ne i} \exp(\mathrm{sim}(z_i, z_k)/\tau)}$
- **CLIP matrix**: $S_{ij} = \cos(f(x_i), g(y_j)) / \tau$. Shape N x N.
- **CLIP loss**: CE over rows plus CE over columns, divided by 2.
- **SigLIP**: $\log(1 + \exp(-y_{ij} \, \mathrm{sim}_{ij}))$ per pair, with $y_{ij} = \pm 1$.
- **DINO EMA**: $\theta_t \leftarrow m \, \theta_t + (1 - m) \, \theta_s$
- **Triplet**: $\max(0, \lVert f(a) - f(p) \rVert^2 - \lVert f(a) - f(n) \rVert^2 + \mathrm{margin})$
- **Cosine and L2**: $\lVert a - b \rVert^2 = 2 - 2 \cos(a, b)$ for unit vectors.
- **Recall@K**: fraction of queries with one correct match in the top K.

## InfoNCE and MAE masking
type: annotated-code
lang: python
from: phases/04-computer-vision/17-self-supervised-vision/docs/en.md, phases/04-computer-vision/17-self-supervised-vision/code/main.py

```python
def info_nce(z1, z2, tau=0.1):                   # z1, z2 L2-normalised
    N, D = z1.shape
    z = torch.cat([z1, z2], dim=0)               # (2N, D)
    sim = z @ z.T / tau                          # (2N, 2N)
    mask = torch.eye(2 * N, dtype=torch.bool, device=z.device)
    sim = sim.masked_fill(mask, float("-inf"))   # no self match
    targets = torch.cat([torch.arange(N, 2 * N), torch.arange(0, N)]).to(z.device)
    return F.cross_entropy(sim, targets)
num_patches = 196
visible, masked = random_mask_indices(num_patches, mask_ratio=0.75)  # keep 25%
```

## CLIP loss and zero-shot
type: annotated-code
lang: python
from: phases/04-computer-vision/18-open-vocab-clip/docs/en.md, phases/04-computer-vision/18-open-vocab-clip/code/main.py

```python
sim = logit_scale * image_emb @ text_emb.T       # (N, N)
targets = torch.arange(N, device=sim.device)     # match on the diagonal
l_i = F.cross_entropy(sim, targets)              # image to text
l_t = F.cross_entropy(sim.T, targets)            # text to image
loss = (l_i + l_t) / 2                           # random init: near log(N)
i = F.normalize(model.image_proj(image_feats), dim=-1)
t = F.normalize(model.text_proj(class_text_feats), dim=-1)
pred = (i @ t.T).argmax(dim=-1)                  # one class per image
```

## Triplet loss and recall@K
type: annotated-code
lang: python
from: phases/04-computer-vision/20-image-retrieval-metric/docs/en.md, phases/04-computer-vision/20-image-retrieval-metric/code/main.py

```python
def triplet_loss(anchor, positive, negative, margin=0.2):
    d_ap = F.pairwise_distance(anchor, positive, p=2)
    d_an = F.pairwise_distance(anchor, negative, p=2)
    return F.relu(d_ap - d_an + margin).mean()
pos_idx, neg_idx = semi_hard_negatives(emb, y)   # hardest positive, semi-hard negative
loss = triplet_loss(emb, emb[pos_idx], emb[neg_idx])
sim = query_emb @ gallery_emb.T                  # cosine on unit vectors
_, top_k = sim.topk(k, dim=-1)
matches = (gallery_labels[top_k] == query_labels[:, None]).any(dim=-1)
matches.float().mean().item()                    # recall@K
```

## Zero-shot classification
type: flow
from: phases/04-computer-vision/18-open-vocab-clip/docs/en.md, phases/12-multimodal-ai/02-clip-contrastive-pretraining/outputs/skill-clip-zero-shot.md

1. **Prompts**: write "a photo of a {class}" for each class.
2. **Ensemble**: average many templates per class for 1-3% more top-1.
3. **Text tower**: encode the prompts. `T` has shape (C, d).
4. **Image tower**: encode the image. `I` has shape (1, d).
5. **Normalise**: make both sides unit length.
6. **Score**: `I @ T.T` gives shape (1, C).
7. **Predict**: argmax gives the class. Warn when the top-1 score is below 0.2.

## Tasks in code
type: task-table
span: 2
from: phases/04-computer-vision/17-self-supervised-vision/code/main.py, phases/04-computer-vision/18-open-vocab-clip/code/main.py, phases/04-computer-vision/20-image-retrieval-metric/code/main.py, phases/12-multimodal-ai/02-clip-contrastive-pretraining/code/main.py

| Task | Code |
|---|---|
| Contrastive loss on two views | `info_nce(z1, z2, tau=0.1)` |
| DINO teacher with centring | `DinoHead().teacher(x, temp=0.04)` |
| CLIP symmetric loss | `clip_loss(i, t, logit_scale)` |
| Zero-shot labels | `zero_shot_classify(model, image_feats, class_text_feats, class_names)` |
| Mine semi-hard negatives | `semi_hard_negatives(emb, labels, margin=0.2)` |
| Recall at K | `recall_at_k(query_emb, gallery_emb, query_labels, gallery_labels, k=1)` |
| Symmetric InfoNCE in pure Python | `infonce_loss(S)` |
| SigLIP per-pair loss | `sigmoid_loss(S, bias=0.0)` |

## Defaults and numbers
type: defaults
from: phases/04-computer-vision/17-self-supervised-vision/docs/en.md, phases/04-computer-vision/17-self-supervised-vision/code/main.py, phases/04-computer-vision/18-open-vocab-clip/docs/en.md, phases/04-computer-vision/20-image-retrieval-metric/code/main.py

| Setting | Default | Note |
|---|---|---|
| SimCLR `tau` | 0.1 | Lower is sharper, needs more negatives |
| CLIP `tau` init | 0.07 | Learned. `logit_scale` starts at ln(1/0.07) |
| SimCLR batch | 512-8192 | Many negatives per positive |
| MAE `mask_ratio` | 0.75 | BERT masks 15% of tokens |
| MAE decoder | 8-layer, 512-dim | Encoder sees visible patches only |
| DINO EMA m | 0.996 | Teacher is an EMA of the student |
| DINO teacher `temp` | 0.04 | Student `temp` 0.1 |
| Triplet `margin` | 0.2 | Same margin for semi-hard mining |

## Pick a FAISS index
type: command-table
from: phases/04-computer-vision/20-image-retrieval-metric/docs/en.md

| Command | What it does |
|---|---|
| `IndexFlatIP` | Exact inner product. Cosine on 100k vectors |
| `IndexFlatL2` | Exact L2, brute force, no training |
| `IndexIVFFlat` | K cells, searches the closest few. Needs training. 10M |
| `IndexHNSW` | Graph index. Fastest for many queries. Large index |
| `IndexIVFPQ` | Adds product quantisation. 100M+ vectors |
| DINOv2 + FAISS | General visual retrieval, off-the-shelf |
| CLIP + FAISS | Queries are text |
| Fine-tuned DINOv2 + FAISS | Instance retrieval, re-ID, e-commerce |

## Troubleshooting
type: troubleshooting
from: phases/04-computer-vision/17-self-supervised-vision/docs/en.md, phases/04-computer-vision/20-image-retrieval-metric/docs/en.md, phases/12-multimodal-ai/02-clip-contrastive-pretraining/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| InfoNCE fails at batch 32 | Too few negatives | Batch 512-8192 or a momentum queue |
| DINO gives a constant vector | Representation collapse | Centre and sharpen the teacher |
| Masked task too easy | Mask ratio too low | Mask 75% of patches |
| High recall@10, low recall@1 | Noisy ranking | Longer fine-tune or re-rank |
| Nearest neighbours change | Cosine and L2 mixed | Match the embedding training |
| Instance search misses | Off-the-shelf features | Fine-tune with metric learning |
| Triplet loss near 0 | Easy triplets | Semi-hard mining |
| Softmax loss slow on many GPUs | All-gather of embeddings | Use the sigmoid loss |

## Questions
type: qa
from: phases/04-computer-vision/17-self-supervised-vision/docs/en.md, phases/04-computer-vision/18-open-vocab-clip/docs/en.md, phases/12-multimodal-ai/02-clip-contrastive-pretraining/docs/en.md

- **Why 75% for MAE but 15% for BERT?** Image patches have low entropy. Neighbours give the pixels away.
- **InfoNCE on random pairs?** About log(2N - 1). That is 3.4 for 16 pairs.
- **CLIP loss at random init?** Close to log(N). For N = 8 it is 2.08.
- **Linear probe or fine-tune?** Fine-tuning adds 2-5 points. The probe measures the features only.
- **DINOv2 embedding?** `outputs.last_hidden_state[:, 0]`, the CLS token, 768-dim.
- **Zero-shot, probe or fine-tune?** A probe beats zero-shot in domain. Fine-tuning can hurt zero-shot transfer.
