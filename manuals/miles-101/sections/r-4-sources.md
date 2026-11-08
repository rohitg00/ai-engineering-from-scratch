# Sources

> The sources of this manual, in order of authority.

When two sources disagree, the one higher on this list wins, and the page says so.

## 1. Our runs

Every number marked as measured comes from runs that we recorded on one NVIDIA DGX Spark with a GB10 GPU, from 2026-10-17 to 2026-10-22. [The lab notes](#s-ref-lab-notes) list the runs, the image, and the timing rule.

## 2. The Miles code we ran

Every flag and default that a page names comes from the Miles code inside the image we ran: Miles main from 2026-10-15. We checked the parts that pages depend on against Miles main from 2026-10-20.

## 3. Miles documentation and release notes

Documented behavior comes from the Miles documentation and the release notes of v0.1.0, v0.1.1, and v0.1.2. Where the documentation and the code disagree, we follow the code. One example: the help text of the custom reward flag shows a plain function, and the code needs an async one.

## 4. The Miles issue tracker

The troubleshooting entries that we did not reproduce come from reports in the Miles issue tracker. Each one is marked as a report, not as our result.

## 5. Papers and posts

- The Miles v0.1 technical report, arXiv 2609.08368, September 2026.
- Rollout Routing Replay, arXiv 2510.11370.
- Score Centering Stabilizes Off-policy Reinforcement Learning, arXiv 2609.20807.
- The first public Miles post, November 2025, and the Miles v0.1 post, August 2026, both from the RadixArk team.
- The slime repository and its README, for the history of the project.
- Defeating the Training-Inference Mismatch via FP16, arXiv 2510.26788, October 2025.
- Deterministic Inference across Tensor Parallel Sizes That Eliminates Training-Inference Mismatch, arXiv 2511.17826, November 2025.
- Jet-RL, on-policy FP8 reinforcement learning, arXiv 2601.14243, January 2026.
- Scaling Laws for Collapse in Asynchronous GRPO, arXiv 2607.01083, July 2026.
- Unified FP8 for MoE RL, an LMSYS post by the Miles team and its partners, November 2025.
- The vime announcement, a vLLM team post, June 2026.
- SGLang pull request 42408, DeepSeek-V4.1 on GB300 with Miles, October 2026.
- The SGLang speculative decoding documentation.
- The SkyRL quantized rollouts documentation, 2026.
- TRL issue 6789, the importance-sampling bias of truncated sampling, August 2026.

Results that other teams measured appear on the pages with the team named, and with the hardware they used.

Sources: manual.json.
