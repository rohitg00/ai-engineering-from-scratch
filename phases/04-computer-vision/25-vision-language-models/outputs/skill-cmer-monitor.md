---
name: skill-cmer-monitor
description: Cross-Modal Error Rate monitoring、dashboards、alerts を production VLM endpoint に instrument する
version: 1.0.0
phase: 4
lesson: 25
tags: [vlm, production, monitoring, hallucination]
---

# CMER Monitor

cross-modal alignment を first-class production KPI として扱う。

## 使用する場面

- 画像に grounded した text を生成する任意の VLM endpoint を deploy するとき。
- hallucinated responses の報告を調査するとき。
- input distribution shift が model grounding を劣化させているか追跡するとき。

## 入力

- `vlm_output`: generated text。
- `text_confidence`: softmax 後の mean per-token probability、範囲は `[0, 1]`。`exp(mean(log_probs))` として計算する。raw logits は渡さない。raw logits は unbounded で、`conf_threshold` は probability を前提にしている。
- `image_embedding`: 画像の CLIP-family embedding (DINOv3、SigLIP、CLIP)。
- `text_embedding`: generated text の CLIP-family embedding。
- Optional `prompt_type`: grouping 用 label (vqa / ocr / captioning / agent)。

## request ごとの計算

```python
import torch

def cmer_flag(image_emb, text_emb, text_conf, sim_thr=0.25, conf_thr=0.8):
    if image_emb.shape != text_emb.shape:
        raise ValueError(f"emb shape mismatch: {image_emb.shape} vs {text_emb.shape}")
    image_emb = image_emb / (image_emb.norm() + 1e-8)
    text_emb = text_emb / (text_emb.norm() + 1e-8)
    sim = float((image_emb * text_emb).sum())
    flagged = (text_conf > conf_thr) and (sim < sim_thr)
    return {"sim": sim, "flagged": flagged}
```

Embeddings は independent CLIP-family encoder から得た 1-D PyTorch tensors (`torch.float32`) である。NumPy arrays を使う場合は、`.norm()` を `np.linalg.norm(...)` に差し替え、出力を適切に cast する。

`sim`、`text_conf`、`flagged`、`prompt_type`、`timestamp`、`model_version`、`request_id` を monitoring pipeline (Prometheus、DataDog、OpenTelemetry) に保存する。

## 集約 metric

```
CMER = (flagged requests in window) / (total requests in window)
```

endpoint ごと、prompt_type ごと、model version ごとに report する。

## alert thresholds

- Baseline CMER: normal traffic の 7 days で確立する。
- Warning: 1 hour にわたり CMER >= 1.5x baseline。
- Critical: 30 minutes にわたり CMER >= 2x baseline、または任意の window で > 15% absolute。

## dashboard panels

1. 時系列 CMER (5-minute bucket、7-day window)。
2. prompt_type ごとの CMER (stacked bar)。
3. hour ごとの `sim` 分布 (histogram)。
4. Top hallucinated outputs (flagged responses を 1 日 20 件 sample し、human review へ)。

## CMER が spike したときの対応

1. flagged requests を sample する。
2. model version が意図せず変わっていないか確認する。
3. input distribution を確認する (new file format? new image source? compressed differently?)。
4. spike が解消するまで、影響を受ける traffic を human review へ route する。
5. spike が持続するなら、model を fine-tune または replace する。alert を抑制してはいけない。

## ルール

- VLM 自身の embeddings で CMER を計算しない。independent encoder (DINOv3、SigLIP、CLIP-L/14) を使う。そうしないと alignment ではなく model の self-consistency を測っているだけになる。
- `flagged` bit だけでなく raw `sim` value を必ず log する。distribution shift は flag rate が変わる前に lower quartile に現れる。
- CMER monitoring なしで VLM endpoint を ship しない。hallucination は本番で支配的な failure mode であり、この metric なしでは silent になる。
- sensitive domains (medical、legal、financial) では `sim_threshold` を 0.35 以上に上げる。flag condition は `sim < sim_threshold` なので、threshold を上げると potentially ungrounded な output をより多く捕捉できる。high-stakes use ではこれが適切な default である。
