# CLIP and Contrastive Vision-Language Pretraining

> OpenAI's CLIP (2021) proved a single idea big enough to power the next five years: align an image encoder and a text encoder in the same vector space using only noisy web image-caption pairs and a contrastive loss. Zero supervised labels. 400M pairs. The resulting embedding space does zero-shot classification, image-text retrieval, and plugs into every 2026 VLM as its vision tower. SigLIP 2 (2025) replaced softmax with sigmoid and scaled past CLIP at lower cost. This lesson walks the math from InfoNCE to sigmoid pairwise loss and builds the training step in stdlib Python.

**Type:** Build
**Languages:** Python (stdlib, InfoNCE + sigmoid loss implementations)
**Prerequisites:** Phase 12 · 01 (ViT patches), Phase 7 (Transformers)
**Time:** ~180 minutes

## Learning Objectives

- Derive InfoNCE loss from mutual information and implement a numerically-stable vectorized version.
- Explain why sigmoid pairwise loss (SigLIP) scales to batch 32768+ without the all-gather overhead softmax demands.
- Run zero-shot ImageNet classification by constructing text templates (`a photo of a {class}`) and taking argmax over cosine similarity.
- Name the four levers CLIP / SigLIP pretraining gives you: batch size, temperature, prompt template, data quality.

## The Problem

Pre-CLIP vision was supervised. Collect labeled datasets (ImageNet: 1.2M images, 1000 classes), train a CNN, ship it. Labels are expensive, labels bias to what labelers can agree on, and labels do not transfer to new tasks without finetuning.

The image-caption web has one billion-plus loosely-labeled pairs for free. A picture of a golden retriever with alt text "my dog Max in the park" carries a supervisory signal — the text describes the image. The question: can you turn this into useful training?

CLIP's answer: treat image-caption pairs as a matching task. Given a batch of N images and N captions, learn to match each image to its own caption against N-1 distractors. The supervision is "these two things belong together; these N-1 do not." No class labels. No human annotation. Just a contrastive loss.

The resulting embedding space does more than CLIP was trained for. ImageNet zero-shot works because "a photo of a cat" embeds near pictures of cats that were never explicitly labeled cats. This is the bet that spawned every 2026 VLM.

## The Concept

### The dual encoder

CLIP has two towers:

- Image encoder `f`: ViT or ResNet, outputs a D-dim vector per image.
- Text encoder `g`: small transformer, outputs a D-dim vector per caption.

Both towers normalize their outputs to unit length. Similarity is `cos(f(x), g(y)) = f(x)^T g(y)` since both are unit-norm.

For a batch of N (image, caption) pairs, build the similarity matrix `S` of shape `(N, N)`:

```
S[i, j] = cos(f(x_i), g(y_j)) / tau
```

where `tau` is a learned temperature (CLIP initializes to 0.07; learned in log-space).

### InfoNCE loss

CLIP uses a symmetric cross-entropy over rows and columns:

```
loss_i2t = CE(S, labels=identity)     # each image's positive is its own caption
loss_t2i = CE(S^T, labels=identity)   # each caption's positive is its own image
loss = (loss_i2t + loss_t2i) / 2
```

This is InfoNCE. The softmax in CE forces each image to match its caption more than every other caption in the batch. The "negatives" are all other batch items. Bigger batches = more negatives = stronger signal. CLIP trained at batch 32k; scale matters.

### Temperature

`tau` controls the sharpness of the softmax. Low tau → sharp distribution, hard negative mining effect. High tau → soft, all samples contribute. CLIP learns log(1/tau), clipped to prevent collapse. SigLIP 2 fixes the initial tau and uses a learned bias instead.

### Why sigmoid scales better (SigLIP)

Softmax needs the whole similarity matrix in sync. In distributed training you must all-gather every embedding to every replica, then do the softmax. This is quadratic in world size for communication.

SigLIP replaces softmax with element-wise sigmoid: for each pair `(i, j)`, the loss is a binary classification of "are these the matching pair?" positive class labels are the diagonal, everything else is negative. The loss is:

```
L = -1/N sum over (i, j) [ y_ij log sigmoid(S[i,j]) + (1-y_ij) log sigmoid(-S[i,j]) ]
```

`y_ij = 1` if `i == j`, else 0. Each pair's loss is independent. No all-gather needed. Each GPU computes its local block and sums. SigLIP 2 scales to batch 32k-512k cheaply where CLIP would need proportionally more communication.

### Zero-shot classification

Given N class names, for each class build a text template:

```
"a photo of a {class}"
```

Embed each template with the text encoder. Embed your image with the image encoder. Argmax cosine similarity = predicted class. No training on the target classes.

Prompt templates matter. CLIP's original paper used 80 templates per class (plain, artistic, photo, painting, etc.) and averaged the embeddings. +3 ImageNet points. Modern usage typically picks one or two templates.

### Linear probes and finetuning

Zero-shot is a baseline. A linear probe (train one linear layer on top of frozen CLIP features for your target classes) beats zero-shot on in-domain tasks. Full finetuning beats linear probe on in-domain but can hurt zero-shot transfer. Three regimes with three trade-offs.

### SigLIP 2: NaFlex and dense features

SigLIP 2 (2025) adds:
- NaFlex: single model handles variable aspect ratios and resolutions.
- Better dense features for segmentation and depth estimation, targeting use as a frozen backbone in VLMs.
- Multilingual: trained on 100+ languages where CLIP was English-only.
- 1B param scale where CLIP topped out at 400M.

In 2026 open VLMs, SigLIP 2 SO400m/14 is the default vision tower. CLIP remains the default for pure image-text retrieval where the specific LAION-2B training distribution matches your query pattern.

### ALIGN, BASIC, OpenCLIP, EVA-CLIP

ALIGN (Google, 2021): same idea as CLIP, 1.8B pair scale, 90% noisy. Proved noisy data scales. OpenCLIP (LAION): open reproduction of CLIP on LAION-400M / 2B, multiple scales, the go-to open checkpoint. EVA-CLIP: initializes from masked image modeling; strong backbone for VLMs. BASIC: Google's CLIP+ALIGN hybrid. All the same family, different data and tuning.

### The zero-shot ceiling

CLIP-class models cap around 76% ImageNet zero-shot (CLIP-G, OpenCLIP-G). Beyond requires either much larger data (SigLIP 2 gets 80%+) or architecture changes (supervised heads, more parameters). The benchmark is saturating; the real value is the embedding space that downstream VLMs consume.

## Use It

`code/main.py` implements:

1. A toy dual encoder (hash-based image features, text char features) so you can see the InfoNCE shape without numpy.
2. InfoNCE loss in pure Python (numerical stability via log-sum-exp).
3. Sigmoid pairwise loss for comparison.
4. A zero-shot classification routine: compute cosine similarity against a set of text prompts, argmax for prediction.

Run it and watch the loss curve. The absolute numbers are toy; the shape matches what a real CLIP trainer emits.

## Ship It

This lesson produces `outputs/skill-clip-zero-shot.md`. Given a set of images (via path) and a list of target classes, it builds text prompts with the CLIP template, embeds both sides with a stated checkpoint (e.g., `openai/clip-vit-large-patch14`), and returns top-1 / top-5 predictions with similarity scores. The skill refuses to make claims about classes not in the prompt list.

## Exercises

1. Implement InfoNCE for a batch of 4 pairs by hand. Construct the 4x4 similarity matrix, run softmax, pick out the diagonal, compute cross-entropy. Verify your Python implementation against this hand calculation.

2. SigLIP uses a bias parameter `b` in addition to temperature: `S'[i,j] = S[i,j]/tau + b`. What role does `b` play when the batch has a large class imbalance (many more negatives than positives per row)? Read SigLIP Section 3 (arXiv:2303.15343).

3. Build a zero-shot classifier for cats vs dogs. Try two prompt templates: `a photo of a {class}` and `a picture of a {class}`. Measure accuracy on 100 test images. Does the ensemble of templates beat single?

4. Compute the communication cost of softmax InfoNCE vs sigmoid pairwise for a 512-GPU run at batch 32k. Which scales as O(N), which as O(N^2)? Cite SigLIP Section 4.

5. Read the OpenCLIP scaling-laws paper (arXiv:2212.07143, Cherti et al.). Reproduce their conclusion for data scaling from the figures: at fixed model size, what is the log-linear relationship between ImageNet zero-shot accuracy and training data size?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| InfoNCE | "Contrastive loss" | Cross-entropy over a batch's similarity matrix; each item's positive is its paired item, negatives are everything else |
| Sigmoid loss | "SigLIP loss" | Per-pair binary cross-entropy; no softmax, no all-gather, scales cheaply in distributed training |
| Temperature | "tau" | Scalar that scales logits before softmax/sigmoid; controls sharpness of the distribution |
| Zero-shot | "no-finetune classification" | Use text prompts to construct class embeddings and classify by cosine similarity; no training on target classes |
| Prompt template | "a photo of a ..." | Text scaffold around a class name; affects zero-shot accuracy by 1-5 points |
| Dual encoder | "Two-tower" | One image encoder + one text encoder, outputs in shared D-dim space |
| Hard negative | "Tough distractor" | A negative similar enough to the positive that the model has to work to separate them |
| Linear probe | "Frozen + one layer" | Train only a linear classifier on top of frozen features; measures feature quality |
| NaFlex | "Native flexible resolution" | SigLIP 2 capability to ingest images at any aspect ratio and resolution without resizing |
| Temperature scaling | "log-parametrized tau" | CLIP parametrizes `log(1/tau)` so gradients behave; clips to prevent collapse to near-zero tau |

## Further Reading

- [Radford et al. — Learning Transferable Visual Models From Natural Language Supervision (arXiv:2103.00020)](https://arxiv.org/abs/2103.00020) — the CLIP paper.
- [Zhai et al. — Sigmoid Loss for Language Image Pre-Training (arXiv:2303.15343)](https://arxiv.org/abs/2303.15343) — SigLIP.
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) — multilingual + NaFlex.
- [Jia et al. — ALIGN (arXiv:2102.05918)](https://arxiv.org/abs/2102.05918) — scale with noisy web data.
- [Cherti et al. — Reproducible scaling laws for contrastive language-image learning (arXiv:2212.07143)](https://arxiv.org/abs/2212.07143) — OpenCLIP scaling laws.
