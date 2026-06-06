# Embodied VLAs: RT-2, OpenVLA, π0, GR00T

> The first time a model read a recipe off a website and executed it in a kitchen robot was RT-2 (Google DeepMind, July 2023). RT-2 discretized actions as text tokens, co-fine-tuned a VLM on web data plus robot-action data, and proved that web-scale vision-language knowledge transfers to robotic control. OpenVLA (June 2024) shipped the open 7B reference. Physical Intelligence's π0 series (2024-2025) added flow-matching action experts. NVIDIA's GR00T N1 (March 2025) delivered dual-system (System 1 / System 2) control for humanoid robots at scale. The VLA primitive — vision-language-action, a single model that sees, reads, and acts — is the bridge between this phase's understanding models and the autonomous systems in Phase 15.

**Type:** Learn
**Languages:** Python (stdlib, action tokenizer + VLA inference skeleton)
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 15 (Autonomous Systems, referenced)
**Time:** ~180 minutes

## Learning Objectives

- Describe action tokenization: discrete bin encoding (RT-2), FAST efficient action tokens, continuous flow-matching actions (π0).
- Explain why co-fine-tuning on web + robot data preserves general-knowledge transfer to novel tasks.
- Compare OpenVLA (open 7B Llama+VLM), π0 (flow-matching), and GR00T N1 (dual-system) on the same robot task.
- Name the Open X-Embodiment dataset and its role as the RT-X training corpus.

## The Problem

A robot that does chores from natural language instructions has been a research target since the 1970s. The 2020s answer: a vision-language-action (VLA) model. Same VLM architecture used for VQA, but output is actions (joint torques, end-effector poses, discrete commands) instead of text.

Challenges specific to VLAs:

1. Action spaces are continuous (joint angles, forces) and high-dimensional (7-DOF arm + 3-DOF gripper = 10 dims at 30 Hz).
2. Robot-specific training data is scarce. Open X-Embodiment has ~1M trajectories; web text-image is 5B+.
3. Control frequency matters. 30 Hz control loop means 33ms budget per action.
4. Safety. A wrong action damages hardware, humans, or property.

## The Concept

### Action tokenization (RT-2)

RT-2's trick: represent each joint target as a quantized text token. Discretize the normalized [-1, 1] range into 256 bins, map each bin to a vocabulary ID. A 10-DOF action becomes 10 tokens at each control step.

Co-fine-tune a PaLM-X VLM on a mixture:

- Web image-text pairs (captioning, VQA).
- Robot demonstrations, action as tokens.

The model sees "pick up the red cube" (language) → image (vision) → 10-token action sequence (discretized joint targets). Web pretraining preserves general-knowledge transfer: RT-2 can follow "move towards the fast-moving object" even though "fast-moving" isn't in training data.

Inference at 3-5 Hz in the RT-2 paper, limited by VLM autoregressive decode.

### OpenVLA — the open 7B reference

OpenVLA (Kim et al., June 2024) is the open-weights RT-2 equivalent. 7B Llama backbone, DINOv2 + SigLIP dual vision encoder, action tokenization over 256 bins.

Trained on Open X-Embodiment (970k trajectories across 22 robots). Ships with LoRA fine-tuning support for adapting to new robots.

Inference: 4-5 Hz on an A100 with quantization. Fast enough for slow manipulation, not for high-frequency control.

### FAST tokenizer — faster action decode

Pertsch et al. (2024) showed that discrete-bin tokenization is inefficient — most actions cluster in a small region of bin-space. FAST (Frequency-domain Action Sequence Tokenizer) compresses action sequences via DCT and quantizes the coefficients.

A 30-step action trajectory becomes ~10 FAST tokens instead of 300 discrete-bin tokens. Inference speeds up 3-5x without quality loss.

### π0 and flow-matching actions

Physical Intelligence's π0 (Black et al., October 2024) replaces discrete action tokens with a flow-matching action expert:

- A small action transformer reads the VLM's hidden states and outputs a continuous 50-step action sequence via rectified flow.
- The action head trains with flow-matching loss; VLM pretraining stays unchanged.
- Inference: full action sequence emitted in ~5 denoising steps, effectively 50 Hz control.

π0's claim: beats OpenVLA and Octo on a wide suite of manipulation tasks. The continuous-action formulation preserves smoothness that discretization destroys.

π0.5 and π0-FAST are incremental upgrades. π0-FAST combines FAST tokenization with flow matching.

### GR00T N1 — dual-system for humanoids

NVIDIA's GR00T N1 (March 2025) is built for humanoid robots (>30 DOF, full-body):

- System 2: a large VLM reading scene + instruction, producing high-level subgoals at ~1 Hz.
- System 1: a small action-head transformer producing low-level 50-100 Hz joint commands conditioned on the subgoals.

The split maps to Kahneman's fast-and-slow thinking: System 2 plans, System 1 acts. Benefits: slow VLM-sized planning does not block fast control; System 1 stays small for latency.

GR00T N1.7 (late 2025) improves data scaling. GR00T fine-tunes with sim-to-real data from Omniverse.

### Open X-Embodiment

The training data. RT-X (October 2023) assembled 22 datasets covering 1M trajectories across 22 robots. Open X-Embodiment is the corpus everyone uses:

- ALOHA / Bridge V2 / Droid / RT-2 Kitchen / Language Table.
- Each sample: (robot state, camera views, instruction, action sequence).
- Training hygiene: unify action space, normalize joint ranges, resize cameras.

OpenVLA and π0 train on Open X-Embodiment. Domain gap to any specific robot is closed by LoRA fine-tuning on 100-1000 task-specific demos.

### Co-fine-tuning vs robot-only

Co-fine-tuning mixes web VQA data with robot trajectories. The ratio matters: too much VQA and the model forgets actions; too much robot data and the model loses general knowledge.

RT-2's ratio: ~1:1. OpenVLA: ~0.5:1 web-to-robot. π0: similar. The precise ratio is a hyperparameter to tune per dataset size.

Robot-only training produces task-specific models that fail on out-of-distribution instructions. Co-fine-tuning is the difference between "pick up the red cube (in demo)" and "pick up the third largest object from the left (novel phrasing)."

### Safety and action limits

Every production VLA ships with:

- Hard joint limits (can't torque past spec).
- Velocity limits (soft clipping).
- Workspace bounds (end-effector cannot leave the table).
- Human-in-the-loop approval for novel tasks.

These sit outside the VLA as control-layer checks. The VLA's output is a suggestion, not a command.

## Use It

`code/main.py`:

- Implements 256-bin action tokenization and de-tokenization.
- Sketches a FAST tokenizer based on DCT + quantization.
- Compares token-count per action step across (discrete-bin, FAST, continuous-flow).
- Prints a lineage summary of RT-2 → OpenVLA → π0 → GR00T.

## Ship It

This lesson produces `outputs/skill-vla-action-format-picker.md`. Given a robot task (manipulation, navigation, humanoid whole-body), picks between discrete-bin + RT-2, FAST + OpenVLA, flow-matching + π0, or dual-system + GR00T.

## Exercises

1. A 10-DOF arm at 30 Hz control rate. Discrete-bin tokenization at 256 bins emits how many tokens per second? Can a 7B VLM keep up?

2. FAST tokenization compresses 30-step trajectories to ~10 tokens. What does the user lose if the trajectory has high-frequency motion (e.g., drumming)?

3. π0's flow-matching head denoises in ~5 steps. Compare throughput to OpenVLA's autoregressive decode at 4-5 Hz.

4. GR00T's System 1 / System 2 split maps to Kahneman. Propose a different split (System 3?) that might help bipedal walking.

5. Read Open X-Embodiment Section 4 on dataset curation. Name the three curation rules that prevent domain leakage.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| VLA | "Vision-language-action" | Model that takes image + instruction and outputs action commands |
| Action tokenization | "Discrete bins" | Quantize continuous joint targets into 256 bins per dim, each a vocab ID |
| FAST tokenizer | "Frequency action tokens" | DCT + quantize to compress 30-step trajectories to ~10 tokens |
| Co-fine-tune | "Mix web + robot" | Train on web VQA data alongside robot demos to preserve general knowledge |
| Flow-matching action head | "π0 continuous output" | Small transformer that outputs a 50-step action sequence via rectified flow |
| System 1 / System 2 | "Dual-system control" | Large VLM plans slowly, small action head acts quickly; GR00T pattern |
| Open X-Embodiment | "RT-X dataset" | 1M-trajectory cross-robot dataset; the training corpus |

## Further Reading

- [Brohan et al. — RT-2 (arXiv:2307.15818)](https://arxiv.org/abs/2307.15818)
- [Kim et al. — OpenVLA (arXiv:2406.09246)](https://arxiv.org/abs/2406.09246)
- [Black et al. — π0 (arXiv:2410.24164)](https://arxiv.org/abs/2410.24164)
- [NVIDIA — GR00T N1 (arXiv:2503.14734)](https://arxiv.org/abs/2503.14734)
- [Open X-Embodiment Collab — RT-X (arXiv:2310.08864)](https://arxiv.org/abs/2310.08864)
