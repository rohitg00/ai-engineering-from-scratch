---
name: skill-image-text-retriever
description: Build an image embedding index with any CLIP checkpoint; support query-by-text and query-by-image
version: 1.0.0
phase: 4
lesson: 18
tags: [clip, retrieval, faiss, zero-shot]
---

# Image-Text Retriever

Turn a folder of images into a searchable index using CLIP embeddings.

## When to use

- Building a zero-shot image search on an internal catalog.
- Deduplicating near-identical images by embedding distance.
- Building a quick "find similar" component without a labelled dataset.

## Inputs

- `image_folder`: directory of image files.
- `clip_model`: HuggingFace id like `openai/clip-vit-base-patch32` or `google/siglip-base-patch16-224`.
- `index_type`: flat | IVF | HNSW.
- `embedding_dim`: inferred from the model.

## Steps

1. Load the CLIP model and preprocessor.
2. Batch-encode every image in the folder. Save embeddings as (N, D) float32 + filename list.
3. Build a FAISS index over the embeddings. Use inner-product on L2-normalised vectors for cosine similarity.
4. Expose two query interfaces:
   - `search_by_text(text, k)` — embed the text, search.
   - `search_by_image(image_path, k)` — embed the image, search.

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

- Always L2-normalise embeddings before indexing; FAISS's inner product on normalised vectors equals cosine similarity.
- For < 100k images, `IndexFlatIP` (exact) is simplest and fastest.
- For 100k-10M, `IndexIVFFlat` is the standard trade-off.
- For > 10M, use HNSW or a product-quantised variant.
- Never rebuild the index on every query; embed once, search many times.
