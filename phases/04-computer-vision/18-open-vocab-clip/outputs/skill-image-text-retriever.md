---
name: skill-image-text-retriever
description: 任意の CLIP checkpoint で image embedding index を構築し、query-by-text と query-by-image をサポートする
version: 1.0.0
phase: 4
lesson: 18
tags: [clip, retrieval, faiss, zero-shot]
---

# Image-Text Retriever

画像フォルダを CLIP embeddings による検索可能な index に変換します。

## When to use

- internal catalog 上で zero-shot image search を構築する。
- embedding distance により near-identical images を deduplicate する。
- labelled dataset なしで素早く "find similar" component を作る。

## Inputs

- `image_folder`: image files の directory。
- `clip_model`: `openai/clip-vit-base-patch32` や `google/siglip-base-patch16-224` のような HuggingFace id。
- `index_type`: flat | IVF | HNSW。
- `embedding_dim`: model から推定する。

## Steps

1. CLIP model と preprocessor を load する。
2. folder 内のすべての images を batch-encode する。embeddings を (N, D) float32 と filename list として保存する。
3. embeddings 上に FAISS index を構築する。cosine similarity のため、L2-normalised vectors に inner-product を使う。
4. 2つの query interfaces を公開する。
   - `search_by_text(text, k)` — text を embed して search する。
   - `search_by_image(image_path, k)` — image を embed して search する。

## Output template

```python
import os
import glob
import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor
import faiss


class ImageTextRetriever:
    def __init__(self, model_name="openai/clip-vit-base-patch32"):
        self.model = CLIPModel.from_pretrained(model_name).eval()
        self.processor = CLIPProcessor.from_pretrained(model_name)
        self.dim = self.model.config.projection_dim
        self.index = None
        self.filenames = []

    @torch.no_grad()
    def _encode_images(self, paths, batch=16):
        embs = []
        for i in range(0, len(paths), batch):
            imgs = [Image.open(p).convert("RGB") for p in paths[i:i + batch]]
            inputs = self.processor(images=imgs, return_tensors="pt")
            out = self.model.get_image_features(**inputs)
            out = out / out.norm(dim=-1, keepdim=True)
            embs.append(out.cpu().numpy())
        return np.concatenate(embs).astype(np.float32)

    @torch.no_grad()
    def _encode_text(self, texts):
        inputs = self.processor(text=texts, return_tensors="pt", padding=True)
        out = self.model.get_text_features(**inputs)
        out = out / out.norm(dim=-1, keepdim=True)
        return out.cpu().numpy().astype(np.float32)

    def build_index(self, folder, index_type="flat"):
        exts = ("*.jpg", "*.jpeg", "*.png", "*.webp", "*.bmp")
        files = []
        for ext in exts:
            files.extend(glob.glob(os.path.join(folder, ext)))
        self.filenames = sorted(files)
        embs = self._encode_images(self.filenames)
        if index_type == "IVF":
            quantizer = faiss.IndexFlatIP(self.dim)
            nlist = min(256, max(4, len(embs) // 32))
            self.index = faiss.IndexIVFFlat(quantizer, self.dim, nlist)
            self.index.train(embs)
        elif index_type == "HNSW":
            self.index = faiss.IndexHNSWFlat(self.dim, 32, faiss.METRIC_INNER_PRODUCT)
        else:
            self.index = faiss.IndexFlatIP(self.dim)
        self.index.add(embs)

    def search_by_text(self, text, k=5):
        q = self._encode_text([text])
        dist, idx = self.index.search(q, k)
        return [(self.filenames[i], float(d)) for d, i in zip(dist[0], idx[0])]

    def search_by_image(self, image_path, k=5):
        q = self._encode_images([image_path])
        dist, idx = self.index.search(q, k)
        return [(self.filenames[i], float(d)) for d, i in zip(dist[0], idx[0])]
```

## Report

```
[retriever]
  model:          <name>
  num_images:     <int>
  dim:            <int>
  index_type:     flat | IVF | HNSW
  index_size_mb:  <float>
```

## Rules

- indexing 前に embeddings を必ず L2-normalise すること。normalised vectors に対する FAISS の inner product は cosine similarity と等価です。
- < 100k images では、`IndexFlatIP` (exact) が最も単純で高速です。
- 100k-10M では、`IndexIVFFlat` が標準的な trade-off です。
- > 10M では、HNSW または product-quantised variant を使う。
- query のたびに index を rebuild しないこと。一度 embed し、何度も search します。
