# Qwen-VL Family and Dynamic-FPS Video

> The Qwen-VL family — Qwen-VL (2023), Qwen2-VL (2024), Qwen2.5-VL (2025), Qwen3-VL (2025) — is the most influential open vision-language model lineage in 2026. Each generation made a single decisive architectural bet that the rest of the open ecosystem copied within twelve months: native dynamic resolution via M-RoPE, dynamic-FPS sampling with absolute time alignment, window attention in the ViT, and structured agent output formats. By Qwen3-VL, the recipe had stabilized: a 2D-RoPE-ViT encoder with native-aspect-ratio inputs, an MLP projector into a large Qwen3 language base, and training stages that emphasized OCR, grounding, and agent behavior as first-class targets. This lesson reads the family chronologically so you understand why every knob is where it is.

**Type:** Learn
**Languages:** Python (stdlib, M-RoPE encoder + dynamic-FPS sampler)
**Prerequisites:** Phase 12 · 06 (patch-n'-pack)
**Time:** ~120 minutes

## Learning Objectives

- Compute M-RoPE's three-axis rotations (temporal, height, width) and explain why all three are needed.
- Pick a dynamic-FPS sampling strategy for a video and reason about tokens-per-second vs event-detection accuracy.
- Name the four Qwen-VL generational upgrades in order and what each enabled.
- Wire a Qwen2.5-VL-style JSON agent output format and parse structured tool calls from a VLM response.

## The Problem

Qwen-VL shipped in August 2023 as a direct response to LLaVA-1.5 and BLIP-2. The gap the Qwen team targeted was threefold: resolution, video, and structured output.

Resolution: LLaVA-1.5 ran at 336x336. Fine for photos, useless for a Chinese-language invoice or a dense spreadsheet screenshot. Qwen-VL's first innovation was 448x448 and grounded bounding-box output, letting the model point at things.

Video: Video-LLaMA stacked per-frame encoders and fed them to the LLM. It worked for short clips, not for multi-minute videos where the temporal axis is the signal. The Qwen team wanted a single encoder that understood time.

Structured output: LLaVA emitted free-form text. An agent needs JSON. Qwen-VL trained on explicit JSON output formats including bounding-box coordinates as text.

Every Qwen-VL generation extends one of these three axes.

## The Concept

### Qwen-VL (August 2023)

The first generation: OpenCLIP ViT-bigG/14 as encoder (2.5B params), LLama-compatible Q-Former (1-step with 256 queries), Qwen-7B base. Contributions:

- 448x448 resolution (then SOTA for an open VLM).
- Grounding: trained on image-text pairs with explicit coordinate-token output. "The cat is at <box>(112, 204), (280, 344)</box>".
- Chinese + English multilingual training from the start.

Benchmarks at the time: competitive with GPT-4V on English, dominant on Chinese. The grounding supervision was the real headline.

### Qwen2-VL (September 2024) — M-RoPE and native resolution

Qwen2-VL replaced the fixed-resolution + Q-Former stack with a natively dynamic-resolution ViT encoder. Key changes:

- Native dynamic resolution. The ViT accepts any HxW divisible by 28 (patch 14 with 2x spatial merge). An image at 1120x672 (40x24 merged patches) produces 960 visual tokens. No resize, no tiling, no thumbnail.
- M-RoPE (Multimodal RoPE). Each token carries a 3D position (t, h, w) instead of 1D. For images t=0, for video t = frame_index. RoPE rotates query/key vectors by a frequency per axis. No positional embedding table.
- MLP projector. Drop the Q-Former; use a 2-layer MLP on the merged patch tokens.
- Video with dynamic FPS. Video sampled at 1-2 FPS by default, but the model accepts arbitrary frame counts.

Result: Qwen2-VL-7B matched GPT-4o on several multimodal benchmarks and beat it on DocVQA (94.5 vs 88.4). The architecture change was the decisive move.

### Qwen2.5-VL (February 2025) — dynamic FPS + absolute time

Qwen2.5-VL's big shift was video. Dynamic FPS is not just "sample more frames when needed." The paper formalized:

- Absolute time tokens. Instead of positional indices (frame 0, 1, 2...), use actual timestamps. "At 0:04, the cat jumps." The model sees `<time>0.04</time>` tokens interleaved with frame tokens.
- Dynamic FPS. Sample at 1 FPS for slow footage, 4+ FPS for action. The user or trainer chooses; M-RoPE adapts.
- Window attention in ViT. Spatial attention is windowed (local within blocks) for throughput; global attention every few layers.
- Explicit JSON output format. Trained on tool-call data: "{\"tool\": \"click\", \"coords\": [380, 220]}". Agent-ready out of the box.
- MRoPE-v2 scaling. Positions scale with max input size so a 10-minute video does not run out of frequency range.

Benchmarks: Qwen2.5-VL-72B beats GPT-4o on most video benchmarks, matches Gemini 2.0 on documents, and sets the open-model SOTA for GUI grounding (ScreenSpot: 84% accuracy vs 38% for GPT-4o).

### Qwen3-VL (November 2025)

Qwen3-VL is an incremental upgrade that consolidates rather than reinvents: larger LLM backbone (Qwen3-72B), expanded training data, improved OCR, stronger reasoning via the Qwen3 "thinking mode." The ViT and M-RoPE stay. The paper focuses on data and training improvements over architecture.

The lineage takeaway: by 2025 the Qwen-VL architecture had stabilized. Additional generations scale compute and data, not primitives.

### M-RoPE mathematically

Classical RoPE rotates a query `q` of dimension `d` by position `m` using paired coordinates:

```
q_rot[2i]   = q[2i]   * cos(m * theta_i) - q[2i+1] * sin(m * theta_i)
q_rot[2i+1] = q[2i]   * sin(m * theta_i) + q[2i+1] * cos(m * theta_i)
theta_i     = 10000^(-2i/d)
```

M-RoPE splits the hidden dim into three bands. Say `d = 96`. Assign 32 dims to temporal, 32 to height, 32 to width. Each band rotates by its own axis position. A patch at (t=5, h=10, w=20) gets rotations `R_t(5)`, `R_h(10)`, `R_w(20)` applied to its three bands.

Text tokens use `t = text_index, h = 0, w = 0` (or a normalized choice), keeping compatibility. Video frames use `t = frame_time, h = row, w = col`. Single images use `t = 0`.

The benefit: one position encoding handles text, image, and video without branching code or different position tables.

### Dynamic-FPS sampling logic

Given a video of duration `T` seconds and a target-tokens budget `B`:

1. Compute the maximum FPS you can afford: `fps_max = B / (T * tokens_per_frame)`.
2. Pick a target FPS from `{1, 2, 4, 8}` that satisfies `fps <= fps_max`.
3. If motion is high (optical-flow heuristic or explicit user request), pick higher FPS. If motion is low, pick lower.
4. Sample uniformly at the chosen FPS; insert `<time>t</time>` tokens between frames.

Qwen2.5-VL trains this logic implicitly; at inference the user controls via `fps` parameter. A 60-second action sequence at 4 FPS with 81 tokens per frame = 19440 tokens, manageable in a 32k context.

### Structured agent output

Qwen2.5-VL's agent training explicitly targets structured tool calls:

```
{
  "tool": "mouse_click",
  "coords": [1024, 512],
  "button": "left",
  "modifier": null
}
```

Parsing is deterministic: JSON.parse over the model's output. Compare to free-form "click at (1024, 512)" which required regex and ambiguity handling. The shift is why Qwen2.5-VL's ScreenSpot scores jumped from Qwen2-VL's 55% to 84%.

## Use It

`code/main.py` implements:

- M-RoPE position computation for a packed sequence mixing text, image patches, and video frames.
- Dynamic-FPS sampler: given (duration, budget, motion_level), pick FPS and emit frame timestamps.
- A toy Qwen2.5-VL JSON-output parser that handles tool-call responses with coordinate fields.

Run it, then feel the difference when you swap fixed-FPS for dynamic-FPS on a 5-minute video.

## Ship It

This lesson produces `outputs/skill-qwen-vl-pipeline-designer.md`. Given a video task (monitoring, agent, action recognition, accessibility), it emits the Qwen2.5-VL configuration (frame budget, FPS strategy, window-attention flag, agent-output mode) and a latency estimate. Use this whenever you deploy a Qwen-VL-family model for a video product.

## Exercises

1. Compute M-RoPE rotations for a patch at (t=3, h=5, w=7) with hidden 48 (16 per band, base theta 10000). Show the rotation angles for the first three pairs in each band.

2. A 10-minute security-camera recording at 1 FPS produces how many frames? At 384 resolution with 3x pool, how many total tokens? Does Qwen2.5-VL's default 32k context handle it?

3. Pick FPS for a 30-second tennis rally vs a 30-second recipe demo vs a 30-second UI-agent recording. Justify each with the dynamic-FPS logic.

4. Qwen2.5-VL drops the Q-Former entirely. Why does a simple MLP work in 2025 but not in 2023? (Hint: data scale and encoder quality.)

5. Parse three Qwen2.5-VL JSON tool-call outputs into Python dicts. What fails for malformed JSON and what recovery strategy does the Qwen cookbook recommend?

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| M-RoPE | "Multimodal RoPE" | 3D rotary position embedding with temporal, height, and width bands in the hidden dim |
| Dynamic FPS | "Smart sampling" | Frame sampling rate chosen per video based on motion, duration, and token budget |
| Absolute time token | "Timestamp token" | `<time>t</time>` interleaved in the sequence so the model sees actual seconds not frame index |
| Window attention | "Local attention" | Spatial self-attention restricted to small windows for speed; global attention added periodically |
| Structured agent output | "JSON mode" | Training data supervision teaching the VLM to emit parseable JSON with coords and tool names |
| min_pixels / max_pixels | "Resolution bounds" | Per-request Qwen2.5-VL controls bounding total pixel count and therefore token count |
| Grounding | "Point-at-it" | Outputting bounding-box coordinates as text tokens; used since Qwen-VL v1 |

## Further Reading

- [Bai et al. — Qwen-VL (arXiv:2308.12966)](https://arxiv.org/abs/2308.12966)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Qwen Team — Qwen3-VL (arXiv:2511.21631)](https://arxiv.org/abs/2511.21631)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
