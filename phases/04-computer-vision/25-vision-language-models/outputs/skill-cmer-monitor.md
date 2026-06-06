---
name: skill-cmer-monitor
description: Instrument a production VLM endpoint with Cross-Modal Error Rate monitoring, dashboards, and alerts
version: 1.0.0
phase: 4
lesson: 25
tags: [vlm, production, monitoring, hallucination]
---

# CMER Monitor

Treat cross-modal alignment as a first-class production KPI.

## When to use

- Deploying any VLM endpoint that produces text grounded on images.
- Investigating reports of hallucinated responses.
- Tracking whether an input distribution shift degrades model grounding.

## Inputs

- `vlm_output`: generated text.
- `text_confidence`: mean per-token probability after softmax, in `[0, 1]`. Compute as `exp(mean(log_probs))`. Do not pass raw logits; raw logits are unbounded and `conf_threshold` assumes a probability.
- `image_embedding`: CLIP-family embedding of the image (DINOv3, SigLIP, CLIP).
- `text_embedding`: CLIP-family embedding of the generated text.
- Optional `prompt_type`: label for grouping (vqa / ocr / captioning / agent).

## Per-request computation

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

Embeddings are 1-D PyTorch tensors (`torch.float32`) from an independent CLIP-family encoder. If you use NumPy arrays, swap `.norm()` for `np.linalg.norm(...)` and cast the output accordingly.

Store `sim`, `text_conf`, `flagged`, `prompt_type`, `timestamp`, `model_version`, `request_id` to your monitoring pipeline (Prometheus, DataDog, OpenTelemetry).

## Aggregate metric

```
CMER = (flagged requests in window) / (total requests in window)
```

Report per endpoint, per prompt_type, per model version.

## Alert thresholds

- Baseline CMER: establish over 7 days of normal traffic.
- Warning: CMER >= 1.5x baseline for 1 hour.
- Critical: CMER >= 2x baseline for 30 minutes or > 15% absolute for any window.

## Dashboard panels

1. CMER over time (5-minute bucket, 7-day window).
2. CMER by prompt_type (stacked bar).
3. Distribution of `sim` per hour (histogram).
4. Top hallucinated outputs (sample 20 flagged responses per day for human review).

## Actions when CMER spikes

1. Sample the flagged requests.
2. Verify the model version has not changed inadvertently.
3. Check the input distribution (new file format? new image source? compressed differently?).
4. Route the affected traffic to human review until the spike resolves.
5. If the spike is persistent, fine-tune or replace the model; do not suppress the alert.

## Rules

- Never compute CMER using the VLM's own embeddings; use an independent encoder (DINOv3, SigLIP, or CLIP-L/14). Otherwise you are measuring the model's self-consistency, not alignment.
- Always log the raw `sim` value, not just the `flagged` bit; distribution shifts show up in the lower quartile before the flag rate changes.
- Do not ship a VLM endpoint without CMER monitoring; hallucinations are the dominant production failure mode and silent without this metric.
- For sensitive domains (medical, legal, financial), raise `sim_threshold` to 0.35 or higher; the flag condition is `sim < sim_threshold`, so a higher threshold catches more outputs as potentially ungrounded — the right default for high-stakes use.
